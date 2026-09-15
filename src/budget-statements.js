import {periodCount,periodLabels} from './budget-store.js';

/* The budget statement layer. A budget stores only what its author planned -
   the accounts it references and one amount per account per period - so every
   figure these statements print is either that amount or a sum of those
   amounts. Nothing is stored twice and nothing is invented, which is why the
   allocation step and the statement view share this one derivation instead of
   each totalling the grid for itself.

   The three statements differ only in how the same planned amounts are read:
   the profit and loss groups income and expenses, the balance sheet groups
   assets, liabilities and equity and then shows what the plan leaves
   unbalanced, and the cash flow reads each amount as the cash it moves. */

export const BUDGET_STATEMENTS=['Profit and Loss','Balance Sheet','Cash Flow Statement'];

const amountOf=(allocations,code,index)=>Number(allocations?.[code]?.[`p${index+1}`]||0);
const sumValues=values=>values.reduce((total,value)=>total+value,0);
const marginOf=(profit,revenue)=>revenue?Math.round(profit/revenue*100):0;

/* One row of planned amounts per period, plus the period count and labels, for
   the whole budget: revenue, expense, the profit it leaves, the three balance
   sheet types, the liabilities and equities line the profit rolls into, and
   the mismatch that balances the sheet. Paid for once per render. */
export function budgetPeriodTotals(accounts=[],allocations={},period='Monthly',financialYear=''){
  const count=periodCount(period);
  const sumsFor=rows=>Array.from({length:count},(_,index)=>rows.reduce((sum,account)=>sum+amountOf(allocations,account.code,index),0));
  const ofType=type=>accounts.filter(account=>account.type===type);
  const revenue=sumsFor(ofType('Income'));
  const expense=sumsFor(ofType('Expenses'));
  const profit=revenue.map((value,index)=>value-expense[index]);
  const assets=sumsFor(ofType('Assets'));
  const liabilities=sumsFor(ofType('Liabilities'));
  const equity=sumsFor(ofType('Equity'));
  const netWorth=liabilities.map((value,index)=>value+equity[index]+profit[index]);
  const mismatch=assets.map((value,index)=>value-netWorth[index]);
  const margin=profit.map((value,index)=>marginOf(value,revenue[index]));
  return {
    count,
    labels:periodLabels(period,financialYear),
    revenue,expense,profit,assets,liabilities,equity,netWorth,mismatch,margin,
    revenueTotal:sumValues(revenue),
    expenseTotal:sumValues(expense),
    profitTotal:sumValues(profit),
    assetsTotal:sumValues(assets),
    liabilitiesTotal:sumValues(liabilities),
    equityTotal:sumValues(equity),
    netWorthTotal:sumValues(netWorth),
    mismatchTotal:sumValues(mismatch),
    marginTotal:marginOf(sumValues(profit),sumValues(revenue))
  };
}

/* The totals the allocation step closes with, in the order the standard budget
   sheets print them. The type totals stay positive planned amounts; only the
   derived lines are signed, so a loss reads negative and the liabilities and
   equities line repeats the profit and loss line because the planned result
   rolls into equity. */
export function budgetTotalRows(accounts=[],allocations={},period='Monthly',financialYear=''){
  const totals=budgetPeriodTotals(accounts,allocations,period,financialYear);
  return [
    {key:'revenue',label:'Total Revenue',values:totals.revenue,total:totals.revenueTotal},
    {key:'expense',label:'Total Expenses',values:totals.expense,total:totals.expenseTotal},
    {key:'profit',label:'Net Profit / Loss',values:totals.profit,total:totals.profitTotal,className:'budgetTotalsDerived'},
    {key:'margin',label:'Profit Margin',values:totals.margin,total:totals.marginTotal,percent:true,className:'budgetTotalsDerived'},
    {key:'assets',label:'Total Assets',values:totals.assets,total:totals.assetsTotal},
    {key:'liabilities',label:'Total Liabilities',values:totals.liabilities,total:totals.liabilitiesTotal},
    {key:'equity',label:'Total Equity',values:totals.equity,total:totals.equityTotal},
    {key:'netWorth',label:'Total Liabilities & Equity',values:totals.netWorth,total:totals.netWorthTotal,className:'budgetTotalsDerived'}
  ];
}

/* The accounting relationship a plan has to satisfy, read as one check rather
   than as another budget line: assets against liabilities plus equity plus the
   result the plan expects. The difference is what the plan leaves unbalanced,
   and it is reported, never posted and never stored. */
export function budgetBalanceCheck(accounts=[],allocations={},period='Monthly',financialYear=''){
  const totals=budgetPeriodTotals(accounts,allocations,period,financialYear);
  const difference=totals.mismatchTotal;
  return {
    assets:totals.assetsTotal,
    liabilities:totals.liabilitiesTotal,
    equity:totals.equityTotal,
    profit:totals.profitTotal,
    liabilitiesAndEquity:totals.netWorthTotal,
    difference,
    balanced:difference===0
  };
}

/* The accounts of one type gathered under the chart of accounts group they were
   created in, so a statement reads the way the Chart of Accounts is organised. */
function groupAccounts(accounts,type){
  const groups=[];
  for(const account of accounts.filter(item=>item.type===type)){
    const name=account.group||account.type;
    let group=groups.find(item=>item.name===name);
    if(!group){group={name,accounts:[]};groups.push(group)}
    group.accounts.push(account);
  }
  return groups;
}

/* One statement, read as rows the view page can render without deciding
   anything itself: section, type and group headers, the account rows with their
   planned amounts, the sub-total under each group and type, and the closing
   line of the statement. A negative sign means the amount moves value out - an
   expense or an asset purchase on the cash flow - and the profit and loss and
   balance sheet statements print the planned amounts positive, as they were
   entered. */
export function budgetStatementRows(statement,accounts=[],allocations={},period='Monthly',financialYear=''){
  const totals=budgetPeriodTotals(accounts,allocations,period,financialYear);
  const count=totals.count;
  const rows=[];
  const emptyTotals=()=>Array.from({length:count},()=>0);
  const addBlock=(label,key,types,signFor,totalLabel)=>{
    rows.push({kind:'type',key:`type-${key}`,label});
    const blockTotals=emptyTotals();
    for(const type of types){
      for(const group of groupAccounts(accounts,type)){
        rows.push({kind:'group',key:`group-${key}-${type}-${group.name}`,label:group.name});
        const groupTotals=emptyTotals();
        for(const account of group.accounts){
          const values=Array.from({length:count},(_,index)=>amountOf(allocations,account.code,index)*signFor(type));
          rows.push({kind:'account',key:`account-${account.code}`,account,values,total:sumValues(values)});
          for(let index=0;index<count;index+=1){groupTotals[index]+=values[index];blockTotals[index]+=values[index]}
        }
        rows.push({kind:'groupTotal',key:`groupTotal-${key}-${type}-${group.name}`,label:`Total for ${group.name}`,values:groupTotals,total:sumValues(groupTotals)});
      }
    }
    rows.push({kind:'typeTotal',key:`typeTotal-${key}`,label:totalLabel,values:blockTotals,total:sumValues(blockTotals)});
    return blockTotals;
  };
  if(statement==='Profit and Loss'){
    rows.push({kind:'section',key:'section',label:'Profit and Loss'});
    addBlock('Revenue','revenue',['Income'],()=>1,'Total Revenue');
    addBlock('Expenses','expense',['Expenses'],()=>1,'Total Expenses');
    rows.push({kind:'grand',key:'grand',label:'Net Profit / Loss',values:totals.profit,total:totals.profitTotal});
    return rows;
  }
  if(statement==='Balance Sheet'){
    rows.push({kind:'section',key:'section',label:'Balance Sheet'});
    addBlock('Assets','assets',['Assets'],()=>1,'Total Assets');
    addBlock('Liabilities','liabilities',['Liabilities'],()=>1,'Total Liabilities');
    addBlock('Equity','equity',['Equity'],()=>1,'Total Equity');
    rows.push({kind:'grand',key:'netWorth',label:'Total Liabilities & Equity',values:totals.netWorth,total:totals.netWorthTotal,className:'budgetStatementDerived'});
    rows.push({kind:'check',key:'difference',label:'Balance Difference',values:totals.mismatch,total:totals.mismatchTotal,className:'budgetStatementMismatch',note:'Assets less liabilities and equity. Reported here, never posted to a budget account.'});
    return rows;
  }
  if(statement==='Cash Flow Statement'){
    rows.push({kind:'section',key:'section',label:'Cash Flow Statement'});
    const operating=addBlock('Operating activities','operating',['Income','Expenses'],type=>type==='Expenses'?-1:1,'Net cash from operating activities');
    const investing=addBlock('Investing activities','investing',['Assets'],()=>-1,'Net cash used in investing activities');
    const financing=addBlock('Financing activities','financing',['Liabilities','Equity'],()=>1,'Net cash from financing activities');
    rows.push({kind:'grand',key:'netCash',label:'Net Cash Flow',values:operating.map((value,index)=>value+investing[index]+financing[index]),total:sumValues(operating)+sumValues(investing)+sumValues(financing),className:'budgetStatementDerived'});
    return rows;
  }
  return [];
}
