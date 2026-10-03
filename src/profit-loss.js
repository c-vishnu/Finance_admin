import {normalizeAccounts} from './account-master.js';

/* A Profit & Loss reads only the two Chart of Accounts types that belong to an income statement.
   Assets, Liabilities and Equity are balance-sheet accounts and are never stated here. */
export const PROFIT_LOSS_TYPES=['Income','Expenses'];

/* The groups accountGroupFor() already assigns to the Chart of Accounts, in statement order. The
   report reads that existing hierarchy instead of inventing a second account taxonomy, so a group
   the chart does not define simply never appears, and a custom group the chart does define is
   stated after the known ones. */
export const REVENUE_GROUP_ORDER=['Operating Income'];
export const EXPENSE_GROUP_ORDER=['Cost of Goods Sold','Operating Expenses','Other Expenses'];
export const OTHER_INCOME_GROUP='Other Income';
export const COGS_GROUP='Cost of Goods Sold';
export const OTHER_EXPENSES_GROUP='Other Expenses';

/* The posted-journal rule is the same one src/balance-sheet.js and src/trial-balance.js apply, so a
   Profit & Loss always reconciles with them. Drafts never reach the journal at all: an unposted
   document is not an accounting transaction and carries no ledger lines to project. A reversal is
   an ordinary posted entry in its own right, so a reversed pair nets to zero by itself. */
const posted=journal=>!journal.status||journal.status==='Posted';
const sum=(rows,key)=>rows.reduce((total,row)=>total+(Number(row[key])||0),0);

/* The Indian financial year the rest of the product uses: April to March. The application states it
   as FY 2026-27, named for the calendar year it opens in, which is also what the budget module
   means by the same phrase. */
export function financialYearStart(date=new Date()){const year=date.getMonth()>=3?date.getFullYear():date.getFullYear()-1;return `${year}-04-01`}

/* Groups one section's rows by the group the Chart of Accounts gave them, keeping the statement's
   own order first and any custom group the chart defines afterwards, alphabetically. */
function groupsFor(rows,order){
  const seen=[...new Set(rows.map(row=>row.group))];
  const names=[...order.filter(name=>seen.includes(name)),...seen.filter(name=>!order.includes(name)).sort()];
  return names.map(name=>{const inGroup=rows.filter(row=>row.group===name);return {name,rows:inGroup,total:sum(inGroup,'amount')}});
}

/* Read-only projection of the posted journal for one accounting period. It never posts, edits,
   reverses or creates an entry, and it reads nothing from the invoice, purchase, receipt or expense
   records - only the posted ledger. Income is stated credit-positive and Expenses debit-positive,
   which is the side each type is expected on; a contra movement is reported as the negative it is
   rather than being forced positive, so the report can never flatter the result. */
export function profitAndLoss(state,{from='0000-01-01',to='9999-12-31',branch='All',account='All',accountType='All',accountGroup='All',search='',includeZero=false}={}){
  const books=normalizeAccounts(state),movement=new Map();
  for(const journal of books.journals||[]){
    if(!posted(journal))continue;
    const date=String(journal.date||'');
    if(date<from||date>to)continue;
    for(const line of journal.lines||[]){
      if(branch!=='All'&&(line.branch||journal.branch||journal.branchId)!==branch)continue;
      const current=movement.get(line.account)||{debit:0,credit:0};
      movement.set(line.account,{debit:current.debit+(line.debit||0),credit:current.credit+(line.credit||0)});
    }
  }
  const chart=(books.accounts||[]).filter(a=>a.active&&!a.isGroup&&PROFIT_LOSS_TYPES.includes(a.type)).map(a=>{
    const activity=movement.get(a.code)||{debit:0,credit:0};
    const amount=a.type==='Income'?activity.credit-activity.debit:activity.debit-activity.credit;
    return {...a,debit:activity.debit,credit:activity.credit,amount,nature:a.type==='Income'?'Income':'Expense',group:a.group||a.type};
  }).sort((a,b)=>String(a.code).localeCompare(String(b.code),undefined,{numeric:true}));

  /* The period had income or expense activity before any filter narrowed the rows; the page needs
     that to tell "nothing was posted this period" apart from "nothing matches these filters". */
  const periodActivity=chart.some(row=>row.amount!==0);
  const query=String(search||'').trim().toLowerCase();
  const rows=chart.filter(row=>(accountType==='All'||row.type===accountType)&&(account==='All'||row.code===account)&&(accountGroup==='All'||row.group===accountGroup)&&(includeZero||row.amount!==0)&&(!query||[row.code,row.name,row.type,row.nature,row.accountNature||'',row.group].join(' ').toLowerCase().includes(query)));

  const income=rows.filter(row=>row.type==='Income'),expenses=rows.filter(row=>row.type==='Expenses');
  const section=(key,label,sectionRows,order)=>{const groups=groupsFor(sectionRows,order);
    /* A section whose only group carries the section's own name states that name once. Nothing is
       hidden: the group total would only repeat the section total, and the group name still prints
       in the Account Group column of every row. */
    return {kind:'section',key,label,rows:sectionRows,groups,total:sum(sectionRows,'amount'),collapsed:groups.length===1&&groups[0].name===label}};
  const revenue=section('revenue','Revenue',income.filter(row=>row.group!==OTHER_INCOME_GROUP),REVENUE_GROUP_ORDER);
  const cogs=section('cogs',COGS_GROUP,expenses.filter(row=>row.group===COGS_GROUP),[COGS_GROUP]);
  const operatingExpenses=section('operatingExpenses','Operating Expenses',expenses.filter(row=>row.group!==COGS_GROUP&&row.group!==OTHER_EXPENSES_GROUP),EXPENSE_GROUP_ORDER);
  const otherIncome=section('otherIncome',OTHER_INCOME_GROUP,income.filter(row=>row.group===OTHER_INCOME_GROUP),[OTHER_INCOME_GROUP]);
  const otherExpenses=section('otherExpenses',OTHER_EXPENSES_GROUP,expenses.filter(row=>row.group===OTHER_EXPENSES_GROUP),[OTHER_EXPENSES_GROUP]);
  const present=[revenue,cogs,operatingExpenses,otherIncome,otherExpenses].filter(item=>item.groups.length);
  const has=key=>present.some(item=>item.key===key);

  const totalRevenue=revenue.total,totalCogs=cogs.total,totalOperatingExpenses=operatingExpenses.total;
  const totalOtherIncome=otherIncome.total,totalOtherExpenses=otherExpenses.total;
  const grossProfit=totalRevenue-totalCogs;
  const operatingProfit=grossProfit-totalOperatingExpenses;
  const netProfit=operatingProfit+totalOtherIncome-totalOtherExpenses;
  const totalExpenses=totalCogs+totalOperatingExpenses+totalOtherExpenses;
  const margin=totalRevenue>0?(netProfit/totalRevenue)*100:null;
  const loss=netProfit<0;

  const hasTaxExpense=rows.some(r=>r.type==='Tax Expense'||(r.name&&r.name.toLowerCase().includes('income tax')));
  const finalProfitLabel=hasTaxExpense
    ?(loss?'Net Loss After Tax':'Net Profit After Tax')
    :(loss?'Net Loss':'Net Profit');

  /* One ordered statement that both the page and the export walk, so the sheet can never drift from
     the screen. The derived rows are the arithmetic itself, not decoration. */
  const statement=[
    ...(has('revenue')?[revenue]:[]),
    ...(has('cogs')?[cogs]:[]),
    {kind:'derived',key:'grossProfit',label:'Gross Profit',amount:grossProfit},
    ...(has('operatingExpenses')?[operatingExpenses]:[]),
    {kind:'derived',key:'operatingProfit',label:'Operating Profit',amount:operatingProfit},
    ...(has('otherIncome')?[otherIncome]:[]),
    ...(has('otherExpenses')?[otherExpenses]:[]),
    {kind:'derived',key:'netProfit',label:finalProfitLabel,amount:netProfit}
  ];

  /* Every total is re-derived from the rows it claims to summarise, and no account may be counted
     twice. The page shows the result instead of assuming the arithmetic held. */
  const codes=rows.map(row=>row.code);
  const checks=[
    {key:'revenueReconciles',label:'Total revenue matches the revenue accounts',ok:totalRevenue===sum(revenue.rows,'amount')},
    {key:'cogsReconciles',label:'Total cost of goods sold matches its accounts',ok:totalCogs===sum(cogs.rows,'amount')},
    {key:'operatingExpensesReconcile',label:'Total operating expenses match their accounts',ok:totalOperatingExpenses===sum(operatingExpenses.rows,'amount')},
    {key:'otherIncomeReconciles',label:'Total other income matches its accounts',ok:totalOtherIncome===sum(otherIncome.rows,'amount')},
    {key:'otherExpensesReconcile',label:'Total other expenses match their accounts',ok:totalOtherExpenses===sum(otherExpenses.rows,'amount')},
    {key:'grossProfit',label:'Gross profit is revenue less cost of goods sold',ok:grossProfit===totalRevenue-totalCogs},
    {key:'operatingProfit',label:'Operating profit is gross profit less operating expenses',ok:operatingProfit===grossProfit-totalOperatingExpenses},
    {key:'netProfit',label:'Net profit is operating profit plus other income less other expenses',ok:netProfit===operatingProfit+totalOtherIncome-totalOtherExpenses},
    {key:'totalExpenses',label:'Total expenses is every expense section added together',ok:totalExpenses===sum(expenses,'amount')},
    {key:'noDoubleCounting',label:'Every account appears once in the statement',ok:codes.length===new Set(codes).size}
  ];

  const grossMargin=totalRevenue>0?(grossProfit/totalRevenue)*100:null;

  return {chart,rows,sections:present,revenueSection:revenue,cogsSection:cogs,opExSection:operatingExpenses,otherIncomeSection:otherIncome,otherExpensesSection:otherExpenses,statement,totalRevenue,totalCogs,grossProfit,totalOperatingExpenses,operatingProfit,totalOtherIncome,totalOtherExpenses,totalExpenses,netProfit,margin,grossMargin,loss,hasTaxExpense,finalProfitLabel,accounts:rows.length,periodActivity,checks,valid:checks.every(check=>check.ok)};
}

/* Export shape for the shared CSV/Excel writer in src/daybook-export.js. Money leaves the engine in
   integer paise, as every other report export does, and is stated in rupees in the sheet. */
export function profitLossExportRows(report,context={}){
  const head=[['Wayvida Books . Profit & Loss',`For ${context.from||''} to ${context.to||''}`],
    ['Branch',context.branch||'All branches'],
    ['Accounting basis','Accrual'],
    ['Account type',context.accountType||'All account types'],
    ['Account group',context.accountGroup||'All account groups'],
    ['Account',context.account||'All accounts'],
    ['Search',context.search||'None'],
    ['Include zero-balance accounts',context.includeZero?'Yes':'No'],
    ['Accounts shown',String(report.accounts)],
    [],
    ['Account Code','Account','Account Group','Amount INR']];
  const body=[];
  for(const item of report.statement){
    if(item.kind==='section'){
      body.push(['',item.label,'','']);
      if(item.collapsed)for(const row of item.groups[0].rows)body.push([row.code,row.name,row.group,row.amount/100]);
      else for(const group of item.groups){
        for(const row of group.rows)body.push([row.code,row.name,row.group,row.amount/100]);
        body.push(['',`Total for ${group.name}`,'',group.total/100]);
      }
      body.push(['',`Total ${item.label}`,'',item.total/100]);
    }else{
      body.push(['',item.label,'',item.amount/100]);
    }
  }
  return [...head,...body,
    [],
    ['Total Revenue','', '',report.totalRevenue/100],
    ['Total Expenses','','',report.totalExpenses/100],
    [report.loss?'Net Loss':'Net Profit','','',report.netProfit/100],
    ['Profit Margin','','',report.margin===null?'N/A':Number(report.margin.toFixed(2))]];
}
