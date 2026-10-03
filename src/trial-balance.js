import {normalizeAccounts} from './account-master.js';

/* The five account types the Chart of Accounts can create, in report order. */
export const TRIAL_BALANCE_TYPES=['Assets','Liabilities','Equity','Income','Expenses'];
export const ACCOUNT_TYPE_LABELS={Assets:'Asset',Liabilities:'Liability',Equity:'Equity',Income:'Income',Expenses:'Expense'};
/* Group order inside each type, using the groups accountGroupFor() already assigns.
   The same Chart of Accounts hierarchy is used, so no second classification exists. */
export const GROUP_ORDER={
  Assets:['Cash and Bank','Current Assets','Fixed Assets','Other Assets'],
  Liabilities:['Current Liabilities','Long-term Liabilities','Other Liabilities'],
  Equity:['Equity','Capital','Reserves','Retained Earnings','Drawings'],
  Income:['Operating Income','Other Income'],
  Expenses:['Cost of Goods Sold','Operating Expenses','Other Expenses']
};
const NORMAL_SIDE={Assets:'Debit',Expenses:'Debit',Liabilities:'Credit',Equity:'Credit',Income:'Credit'};

/* The posted-journal rule is deliberately the same one src/balance-sheet.js applies, so a Trial
   Balance always reconciles with the Balance Sheet. Drafts never reach the journal at all: an
   unposted document is not an accounting transaction and has no ledger lines to project. */
const posted=journal=>!journal.status||journal.status==='Posted';
const sum=(rows,key)=>rows.reduce((total,row)=>total+(Number(row[key])||0),0);
const add=(movement,code,debit,credit)=>{const current=movement.get(code)||{debit:0,credit:0};movement.set(code,{debit:current.debit+debit,credit:current.credit+credit})};

/* Read-only projection of the posted journal. It never posts, edits, reverses or creates an entry.
   Every account is stated on the side its own net movement falls, so an account is never shown in
   both columns and the report cannot be forced to balance. */
export function trialBalance(state,{date='9999-12-31',branch='All',account='All',accountType='All',search='',includeZero=false}={}){
  const books=normalizeAccounts(state),movement=new Map();
  for(const journal of books.journals||[]){
    if(!posted(journal)||String(journal.date||'')>date)continue;
    for(const line of journal.lines||[]){
      if(branch!=='All'&&(line.branch||journal.branch||journal.branchId)!==branch)continue;
      add(movement,line.account,line.debit||0,line.credit||0);
    }
  }
  const chart=(books.accounts||[]).filter(a=>a.active&&!a.isGroup&&TRIAL_BALANCE_TYPES.includes(a.type)).map(a=>{
    const activity=movement.get(a.code)||{debit:0,credit:0},net=activity.debit-activity.credit;
    return {...a,debit:activity.debit,credit:activity.credit,net,debitBalance:net>0?net:0,creditBalance:net<0?-net:0,group:a.group||a.type,nature:ACCOUNT_TYPE_LABELS[a.type]||a.type,normalSide:NORMAL_SIDE[a.type]||'Debit'};
  }).sort((a,b)=>String(a.code).localeCompare(String(b.code),undefined,{numeric:true}));
  const query=String(search||'').trim().toLowerCase();
  const rows=chart.filter(row=>(accountType==='All'||row.type===accountType)&&(account==='All'||row.code===account)&&(includeZero||row.net!==0)&&(!query||[row.code,row.name,row.type,row.nature,row.accountNature||'',row.group].join(' ').toLowerCase().includes(query)));
  const sections=TRIAL_BALANCE_TYPES.filter(type=>accountType==='All'||type===accountType).map(type=>{
    const inType=rows.filter(row=>row.type===type),order=GROUP_ORDER[type]||[],seen=[...new Set(inType.map(row=>row.group))];
    const names=[...order.filter(name=>seen.includes(name)),...seen.filter(name=>!order.includes(name)).sort()];
    const groups=names.map(name=>{const groupRows=inType.filter(row=>row.group===name);return {name,rows:groupRows,debit:sum(groupRows,'debitBalance'),credit:sum(groupRows,'creditBalance')}});
    return {type,label:type,groups,rows:inType,debit:sum(inType,'debitBalance'),credit:sum(inType,'creditBalance')};
  }).filter(section=>section.groups.length);
  const debit=sum(rows,'debitBalance'),credit=sum(rows,'creditBalance');
  return {chart,rows,sections,debit,credit,difference:debit-credit,balanced:debit===credit,accounts:rows.length};
}

/* Export shape for the shared CSV/Excel writer in src/daybook-export.js. Money leaves the engine in
   integer paise, as every other report export does, and is stated in rupees in the sheet. */
export function trialBalanceExportRows(report,context={}){
  return [['Account Code','Account','Account Type','Account Group','Debit INR','Credit INR'],
    ...report.rows.map(row=>[row.code,row.name,row.nature,row.group,row.debitBalance/100,row.creditBalance/100]),
    ['','Total','','',report.debit/100,report.credit/100],
    ['','Difference','','',report.difference/100,''],
    ['As of',context.date||'','Branch',context.branch||'All branches','Account type',context.accountType||'All account types'],
    ['Account',context.account||'All accounts','Search',context.search||'None','Accounts',report.accounts]];
}
