import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {trialBalance,trialBalanceExportRows,TRIAL_BALANCE_TYPES} from '../src/trial-balance.js';
import {csvReport,excelReport} from '../src/daybook-export.js';

/* One posted journal that balances: Cash 37,568.00 and Bank 4,10,600.00 against Accounts Payable
   25,000.00, Sales 3,99,900.00 and Purchase 23,268.00. Amounts are integer paise, as everywhere else
   in the accounting engine. */
const posted={id:'j1',number:'JE-000001',date:'2026-09-08',status:'Posted',source:'Sales Invoice',lines:[
  {account:'1000',debit:3756800,credit:0,branch:'Kochi'},
  {account:'1010',debit:41060000,credit:0,branch:'Kochi'},
  {account:'2000',debit:0,credit:2500000,branch:'Kochi'},
  {account:'4000',debit:0,credit:39990000,branch:'Kochi'},
  {account:'5000',debit:0,credit:2326800,branch:'Kochi'}
]};
const chart=[
  {code:'1000',name:'Cash',type:'Assets',accountNature:'Cash',active:true},
  {code:'1010',name:'Bank',type:'Assets',accountNature:'Bank',active:true},
  {code:'1300',name:'Equipment',type:'Assets',accountNature:'Fixed Assets',active:true},
  {code:'2000',name:'Accounts Payable',type:'Liabilities',accountNature:'Accounts Payable',active:true},
  {code:'3000',name:'Capital',type:'Equity',accountNature:'Capital',active:true},
  {code:'4000',name:'Sales',type:'Income',accountNature:'Sales Income',active:true},
  {code:'5000',name:'Purchase',type:'Expenses',accountNature:'Cost of Goods Sold',active:true},
  {code:'9000',name:'Suspense Group',type:'Assets',active:true,isGroup:true}
];
const state={accounts:chart,journals:[posted]};
const codes=report=>report.rows.map(row=>row.code);

test('Trial Balance states each account on its own side and the posted journal balances',()=>{
  const report=trialBalance(state,{date:'2026-09-08'});
  assert.equal(report.debit,44816800);
  assert.equal(report.credit,44816800);
  assert.equal(report.difference,0);
  assert.equal(report.balanced,true);
  assert.equal(report.accounts,5);
  const cash=report.rows.find(row=>row.code==='1000');
  assert.equal(cash.debitBalance,3756800);
  assert.equal(cash.creditBalance,0);
  assert.equal(cash.normalSide,'Debit');
  assert.equal(cash.nature,'Asset');
  assert.equal(cash.group,'Cash and Bank');
  const payable=report.rows.find(row=>row.code==='2000');
  assert.equal(payable.debitBalance,0);
  assert.equal(payable.creditBalance,2500000);
  assert.equal(payable.normalSide,'Credit');
  /* A group account is never a ledger balance, and zero-balance accounts are hidden by default. */
  assert.ok(!codes(report).includes('9000'));
  assert.ok(!codes(report).includes('3000'));
});

test('Trial Balance groups accounts under the Chart of Accounts hierarchy with subtotals',()=>{
  const report=trialBalance(state,{date:'2026-09-08'});
  assert.deepEqual(report.sections.map(section=>section.type),['Assets','Liabilities','Income','Expenses']);
  const assets=report.sections[0];
  assert.equal(assets.debit,44816800);
  assert.equal(assets.credit,0);
  assert.deepEqual(assets.groups.map(group=>group.name),['Cash and Bank']);
  assert.equal(assets.groups[0].debit,44816800);
  const expenses=report.sections.find(section=>section.type==='Expenses');
  assert.deepEqual(expenses.groups.map(group=>group.name),['Cost of Goods Sold']);
  assert.ok(TRIAL_BALANCE_TYPES.includes('Equity'));
});

test('date, branch, account type, account and search filters each change the report',()=>{
  assert.equal(trialBalance(state,{date:'2026-09-07'}).accounts,0);
  assert.equal(trialBalance(state,{date:'2026-09-08'}).accounts,5);
  assert.equal(trialBalance(state,{date:'2026-09-08',branch:'Kochi'}).accounts,5);
  assert.equal(trialBalance(state,{date:'2026-09-08',branch:'Trivandrum'}).accounts,0);
  assert.deepEqual(codes(trialBalance(state,{date:'2026-09-08',accountType:'Liabilities'})),['2000']);
  assert.deepEqual(codes(trialBalance(state,{date:'2026-09-08',account:'1010'})),['1010']);
  assert.deepEqual(codes(trialBalance(state,{date:'2026-09-08',search:'payable'})),['2000']);
  assert.deepEqual(codes(trialBalance(state,{date:'2026-09-08',search:'1010'})),['1010']);
  assert.deepEqual(codes(trialBalance(state,{date:'2026-09-08',search:'Liability'})),['2000']);
  assert.deepEqual(codes(trialBalance(state,{date:'2026-09-08',search:'cash and bank'})),['1000','1010']);
  assert.deepEqual(codes(trialBalance(state,{date:'2026-09-08',search:'   '})),['1000','1010','2000','4000','5000']);
  const filtered=trialBalance(state,{date:'2026-09-08',accountType:'Assets'});
  assert.equal(filtered.debit,44816800);
  assert.equal(filtered.credit,0);
  assert.equal(filtered.difference,44816800);
  assert.equal(filtered.balanced,false);
});

test('zero-balance accounts appear only when the toggle is on',()=>{
  assert.ok(!codes(trialBalance(state,{date:'2026-09-08'})).includes('3000'));
  assert.ok(codes(trialBalance(state,{date:'2026-09-08',includeZero:true})).includes('3000'));
  assert.equal(trialBalance(state,{date:'2026-09-08',includeZero:true}).accounts,7);
  assert.equal(trialBalance(state,{date:'2026-09-08',includeZero:true}).difference,0);
});

test('only posted entries reach the report: drafts, cancelled entries and unposted documents do not',()=>{
  const drafts={...state,journals:[posted,{id:'d1',date:'2026-09-08',status:'Draft',lines:[{account:'1000',debit:900000,credit:0}]}]};
  assert.equal(trialBalance(drafts,{date:'2026-09-08'}).debit,44816800);
  const cancelled={...state,journals:[posted,{id:'c1',date:'2026-09-08',status:'Cancelled',lines:[{account:'1000',debit:900000,credit:0}]}]};
  assert.equal(trialBalance(cancelled,{date:'2026-09-08'}).accounts,5);
  /* A reversal is a posted entry in its own right: it must be included so the balances net out. */
  const reversed={...state,journals:[posted,{id:'r1',date:'2026-09-09',status:'Posted',source:'Invoice Reversal',lines:posted.lines.map(line=>({...line,debit:line.credit,credit:line.debit}))}]};
  assert.equal(trialBalance(reversed,{date:'2026-09-09'}).debit,0);
  assert.equal(trialBalance(reversed,{date:'2026-09-09'}).accounts,0);
  assert.equal(trialBalance(reversed,{date:'2026-09-09'}).difference,0);
  /* Unposted documents live outside the journal entirely, so a document-only state reports nothing. */
  assert.equal(trialBalance({accounts:chart,invoices:[{id:'i1',posted:false,status:'Draft',totals:{total:500000}}],journals:[]},{date:'2026-09-08'}).accounts,0);
});

test('an unbalanced ledger is surfaced rather than forced to zero',()=>{
  const broken={accounts:chart,journals:[{id:'x',date:'2026-09-08',status:'Posted',lines:[{account:'1000',debit:500000,credit:0},{account:'4000',debit:0,credit:400000}]}]};
  const report=trialBalance(broken,{date:'2026-09-08'});
  assert.equal(report.difference,100000);
  assert.equal(report.balanced,false);
  assert.equal(report.debit,500000);
  assert.equal(report.credit,400000);
});

test('the projection reads the journal without mutating it and exports the visible rows',()=>{
  const source={accounts:chart,journals:[posted]},before=JSON.stringify(source);
  const report=trialBalance(source,{date:'2026-09-08'});
  assert.equal(JSON.stringify(source),before);
  const rows=trialBalanceExportRows(report,{date:'2026-09-08',branch:'All branches',accountType:'All account types',account:'All accounts',search:'None'});
  assert.deepEqual(rows[0],['Account Code','Account','Account Type','Account Group','Debit INR','Credit INR']);
  assert.deepEqual(rows[1],['1000','Cash','Asset','Cash and Bank',37568,0]);
  assert.deepEqual(rows[6],['','Total','','',448168,448168]);
  assert.deepEqual(rows[7],['','Difference','','',0,'']);
  assert.ok(csvReport(rows).includes('"Cash and Bank"'));
  assert.ok(excelReport(rows).includes('ss:Type="Number">37568'));
  const filtered=trialBalanceExportRows(trialBalance(state,{date:'2026-09-08',accountType:'Liabilities'}));
  assert.equal(filtered.length,6);
  assert.equal(filtered[1][1],'Accounts Payable');
});

test('the page reuses the report shell, drills into the General Ledger and never writes to the store',async()=>{
  const page=await readFile(new URL('../src/TrialBalance.jsx',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/trial-balance.css',import.meta.url),'utf8');
  for(const label of ['Trial Balance','View debit and credit balances for all ledger accounts as of a selected date.','ACCOUNT','DEBIT','CREDIT','GRAND TOTAL','Include zero-balance accounts','As of','Export Excel','Export PDF'])assert.ok(page.includes(label),label);
  assert.ok(page.includes("onNavigate('General Ledger')"));
  assert.ok(page.includes("sessionStorage.setItem('wayvida-open-account'"));
  assert.ok(page.includes('No ledger balances found'));
  assert.ok(page.includes("import EmptyState from './EmptyState.jsx'"));
  assert.ok(page.includes("import {downloadReport,excelReport} from './daybook-export.js'"));
  assert.ok(page.includes('useDeferredValue'));
  assert.ok(!/localStorage\.setItem/.test(page));
  assert.ok(!/writeAccounts/.test(page));
  /* Responsive: the table narrows with the page instead of forcing a page-level scrollbar. */
  assert.match(css,/@media \(max-width: 900px\)/);
  assert.match(css,/@media \(max-width: 700px\)/);
  assert.match(css,/@media \(max-width: 560px\)/);
  assert.match(css,/@media print/);
  /* The page header is a <header> element, so it must neutralise the shell's fixed header bar. */
  assert.match(css,/\.tbHead\s*\{[^}]*position:\s*relative\s*!important/);
  assert.match(css,/\.tbTableScroll\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css,/\.tbStatementCard table\s*\{[^}]*width:\s*100%/);
  assert.match(css,/\.tbStatementCard table thead th\s*\{[^}]*position:\s*sticky/);
  assert.match(css,/\.tbSection th/);
});

test('the sidebar renders the page and the invoice workspace no longer carries a second Trial Balance',async()=>{
  const navigation=await readFile(new URL('../src/Navigation.jsx',import.meta.url),'utf8');
  const app=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
  const workspace=await readFile(new URL('../src/InvoiceWorkspace.jsx',import.meta.url),'utf8');
  assert.ok(navigation.includes("import TrialBalance from './TrialBalance.jsx'"));
  assert.ok(navigation.includes("active==='Trial Balance'&&createPortal"));
  assert.ok(app.includes("['Invoices','Payments Received','General Ledger'].includes(a)"));
  assert.ok(!workspace.includes("page==='Trial Balance'"));
});
