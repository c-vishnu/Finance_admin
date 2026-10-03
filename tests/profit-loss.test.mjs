import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {profitAndLoss,profitLossExportRows,PROFIT_LOSS_TYPES,financialYearStart} from '../src/profit-loss.js';
import {excelReport} from '../src/daybook-export.js';

/* Amounts are integer paise, as everywhere else in the accounting engine. The chart carries the
   groups the Chart of Accounts itself assigns, so the report is reading the real hierarchy rather
   than a list invented for the test. The unfiltered run covers both branches: Kochi (100000 + 200000
   of operating expenses) and Trivandrum (25000). */
const chart=[
  {code:'1010',name:'Bank',type:'Assets',accountNature:'Bank',active:true},
  {code:'1100',name:'Accounts Receivable',type:'Assets',accountNature:'Accounts Receivable',active:true},
  {code:'2000',name:'Accounts Payable',type:'Liabilities',accountNature:'Accounts Payable',active:true},
  {code:'4000',name:'Sales',type:'Income',accountNature:'Sales Income',group:'Operating Income',active:true},
  {code:'4100',name:'Service Income',type:'Income',accountNature:'Sales Income',group:'Operating Income',active:true},
  {code:'4200',name:'Interest Income',type:'Income',accountNature:'Other Income',group:'Other Income',active:true},
  {code:'5000',name:'Purchase',type:'Expenses',accountNature:'Cost of Goods Sold',group:'Cost of Goods Sold',active:true},
  {code:'5300',name:'Utilities',type:'Expenses',accountNature:'Operating Expense',group:'Operating Expenses',active:true},
  {code:'5400',name:'Salaries',type:'Expenses',accountNature:'Operating Expense',group:'Operating Expenses',active:true},
  {code:'5900',name:'Interest Expense',type:'Expenses',accountNature:'Financial Expense',group:'Other Expenses',active:true},
  {code:'9000',name:'Suspense Group',type:'Expenses',active:true,isGroup:true}
];
const posted=(id,date,lines,source='Sales Invoice',branch='Kochi')=>({id,number:id,date,status:'Posted',source,branch,lines:lines.map(line=>({branch,...line}))});
const journals=[
  posted('j1','2026-05-10',[{account:'1100',debit:1000000,credit:0},{account:'4000',debit:0,credit:1000000}]),
  posted('j2','2026-06-15',[{account:'1100',debit:500000,credit:0},{account:'4100',debit:0,credit:500000}]),
  posted('j3','2026-05-20',[{account:'5000',debit:400000,credit:0},{account:'2000',debit:0,credit:400000}],'Purchase Bill'),
  posted('j4','2026-07-01',[{account:'5300',debit:100000,credit:0},{account:'1010',debit:0,credit:100000}],'Expense'),
  posted('j5','2026-07-31',[{account:'5400',debit:200000,credit:0},{account:'1010',debit:0,credit:200000}],'Expense'),
  posted('j6','2026-08-05',[{account:'1010',debit:50000,credit:0},{account:'4200',debit:0,credit:50000}],'Customer Receipt'),
  posted('j7','2026-08-20',[{account:'5900',debit:30000,credit:0},{account:'1010',debit:0,credit:30000}],'Payment Made'),
  /* A posted credit note: one entry, so it can only ever reduce Sales once. */
  posted('j8','2026-08-25',[{account:'4000',debit:100000,credit:0},{account:'1100',debit:0,credit:100000}],'Credit Note'),
  {id:'j9',number:'j9',date:'2026-09-01',status:'Draft',source:'Expense',branch:'Kochi',lines:[{account:'5300',debit:99999,credit:0,branch:'Kochi'},{account:'1010',debit:0,credit:99999,branch:'Kochi'}]},
  {id:'j10',number:'j10',date:'2026-09-04',status:'Cancelled',source:'Expense',branch:'Kochi',lines:[{account:'5300',debit:88888,credit:0,branch:'Kochi'},{account:'1010',debit:0,credit:88888,branch:'Kochi'}]},
  posted('j11','2026-10-15',[{account:'5300',debit:70000,credit:0},{account:'1010',debit:0,credit:70000}],'Expense'),
  posted('j12','2026-07-10',[{account:'5300',debit:25000,credit:0},{account:'1010',debit:0,credit:25000}],'Expense','Trivandrum')
];
const state={accounts:chart,journals};
const period={from:'2026-04-01',to:'2026-09-30'};
const section=(report,key)=>report.sections.find(item=>item.key===key);

test('the statement reads the chart hierarchy and every total reconciles',()=>{
  const report=profitAndLoss(state,period);
  assert.deepEqual(report.sections.map(item=>item.key),['revenue','cogs','operatingExpenses','otherIncome','otherExpenses']);
  assert.equal(section(report,'revenue').total,1400000);
  assert.equal(section(report,'cogs').total,400000);
  assert.equal(section(report,'operatingExpenses').total,325000);
  assert.equal(section(report,'otherIncome').total,50000);
  assert.equal(section(report,'otherExpenses').total,30000);
  assert.equal(report.grossProfit,1000000);
  assert.equal(report.operatingProfit,675000);
  assert.equal(report.netProfit,695000);
  assert.equal(report.totalExpenses,755000);
  assert.equal(report.loss,false);
  assert.equal(report.margin.toFixed(2),'49.64');
  assert.ok(report.valid,report.checks.filter(check=>!check.ok).map(check=>check.key).join(', '));
  assert.equal(report.checks.length,10);
  /* The section groups come from the chart, and the group account is never stated. */
  assert.deepEqual(section(report,'revenue').groups.map(group=>group.name),['Operating Income']);
  assert.deepEqual(section(report,'operatingExpenses').groups.map(group=>group.name),['Operating Expenses']);
  assert.ok(!report.rows.some(row=>row.code==='9000'));
});

test('the statement is one ordered list the page and the export both walk',()=>{
  const report=profitAndLoss(state,period);
  assert.deepEqual(report.statement.map(item=>item.key),
    ['revenue','cogs','grossProfit','operatingExpenses','operatingProfit','otherIncome','otherExpenses','netProfit']);
  assert.equal(report.statement.find(item=>item.key==='grossProfit').label,'Gross Profit');
  assert.equal(report.statement.find(item=>item.key==='operatingProfit').label,'Operating Profit');
  assert.deepEqual(report.sections.map(item=>item.label),['Revenue','Cost of Goods Sold','Operating Expenses','Other Income','Other Expenses']);
  assert.equal(report.statement.at(-1).label,'Net Profit');
  assert.equal(report.statement.at(-1).amount,695000);
  const draftOnly=profitAndLoss(state,{from:'2026-09-02',to:'2026-09-03'});
  assert.equal(draftOnly.accounts,0);
  assert.equal(draftOnly.periodActivity,false);
});

test('a section whose only group repeats its own name prints that heading once',()=>{
  const report=profitAndLoss(state,period);
  /* The chart has no finer taxonomy than the group, so Operating Expenses and Cost of Goods Sold
     would otherwise head the same block twice and repeat the section total as a group total. */
  assert.equal(section(report,'operatingExpenses').collapsed,true);
  assert.equal(section(report,'cogs').collapsed,true);
  assert.equal(section(report,'revenue').collapsed,false);
  /* Nothing is hidden by the collapse: every account and its group still reach the export. */
  const exported=profitLossExportRows(report,{from:period.from,to:period.to});
  assert.ok(exported.some(row=>row[0]==='5400'&&row[2]==='Operating Expenses'));
  assert.ok(!exported.some(row=>row[1]==='Total for Operating Expenses'));
  assert.ok(exported.some(row=>row[1]==='Total for Operating Income'));
  assert.ok(exported.some(row=>row[1]==='Total Operating Expenses'&&row[3]===3250));
});

test('only posted entries reach the report: drafts and cancelled entries do not',()=>{
  const report=profitAndLoss(state,period);
  assert.equal(section(report,'operatingExpenses').total,325000);
  /* The cancelled 888.88 and the draft 999.99 are both absent, and the October entry is outside the period. */
  const wide=profitAndLoss(state,{from:'2026-04-01',to:'2026-12-31'});
  assert.equal(section(wide,'operatingExpenses').total,395000);
});

test('a posted credit note reduces revenue once and is never subtracted twice',()=>{
  const report=profitAndLoss(state,period);
  const sales=report.rows.find(row=>row.code==='4000');
  assert.equal(sales.credit,1000000);
  assert.equal(sales.debit,100000);
  assert.equal(sales.amount,900000);
  assert.equal(section(report,'revenue').total,900000+500000);
});

test('the period, branch, account, account type and group filters each change the report',()=>{
  const may=profitAndLoss(state,{from:'2026-05-01',to:'2026-05-31'});
  assert.equal(may.totalRevenue,1000000);
  assert.equal(may.netProfit,600000);
  const trivandrum=profitAndLoss(state,{...period,branch:'Trivandrum'});
  assert.equal(trivandrum.totalRevenue,0);
  assert.equal(section(trivandrum,'operatingExpenses').total,25000);
  const oneAccount=profitAndLoss(state,{...period,account:'5300'});
  assert.deepEqual(oneAccount.rows.map(row=>row.code),['5300']);
  assert.equal(section(oneAccount,'operatingExpenses').total,125000);
  const incomeOnly=profitAndLoss(state,{...period,accountType:'Income'});
  assert.deepEqual(incomeOnly.rows.map(row=>row.code),['4000','4100','4200']);
  assert.equal(incomeOnly.totalCogs,0);
  const otherExpenses=profitAndLoss(state,{...period,accountGroup:'Other Expenses'});
  assert.deepEqual(otherExpenses.rows.map(row=>row.code),['5900']);
  assert.equal(otherExpenses.totalRevenue,0);
});

test('search matches account code, name and group without touching the balances',()=>{
  const byName=profitAndLoss(state,{...period,search:'service'});
  assert.deepEqual(byName.rows.map(row=>row.code),['4100']);
  const byCode=profitAndLoss(state,{...period,search:'5300'});
  assert.deepEqual(byCode.rows.map(row=>row.code),['5300']);
  const byGroup=profitAndLoss(state,{...period,search:'other income'});
  assert.deepEqual(byGroup.rows.map(row=>row.code),['4200']);
  /* Narrowing the rows narrows the visible totals, which is what the page states. */
  assert.equal(byName.totalRevenue,500000);
  const all=profitAndLoss(state,period);
  assert.equal(all.totalRevenue,1400000);
});

test('zero-balance accounts are hidden until the toggle asks for them, and totals do not move',()=>{
  const zero={...state,accounts:[...chart,{code:'5500',name:'Depreciation',type:'Expenses',accountNature:'Operating Expense',group:'Operating Expenses',active:true}]};
  const hidden=profitAndLoss(zero,period);
  assert.ok(!hidden.rows.some(row=>row.code==='5500'));
  const shown=profitAndLoss(zero,{...period,includeZero:true});
  assert.ok(shown.rows.some(row=>row.code==='5500'));
  assert.equal(shown.netProfit,hidden.netProfit);
  assert.equal(section(shown,'operatingExpenses').total,section(hidden,'operatingExpenses').total);
});

test('a loss is stated as a loss with a negative margin, never as a profit',()=>{
  const heavy={accounts:chart,journals:[...journals,posted('j13','2026-06-30',[{account:'5300',debit:2000000,credit:0},{account:'1010',debit:0,credit:2000000}],'Expense')]};
  const report=profitAndLoss(heavy,period);
  assert.ok(report.netProfit<0);
  assert.equal(report.loss,true);
  assert.ok(report.margin<0);
  assert.equal(report.statement.at(-1).label,'Net Loss');
  assert.equal(report.statement.at(-1).amount,report.netProfit);
  assert.ok(report.valid);
});

test('profit margin is not divided by zero when the period has no revenue',()=>{
  const expensesOnly={accounts:chart,journals:[journals[3]]};
  const report=profitAndLoss(expensesOnly,period);
  assert.equal(report.totalRevenue,0);
  assert.equal(report.margin,null);
  assert.equal(report.netProfit,-100000);
});

test('the projection reads the journal without mutating it and exports the same statement',()=>{
  const source={accounts:chart,journals},before=JSON.stringify(source);
  const report=profitAndLoss(source,period);
  assert.equal(JSON.stringify(source),before);
  const rows=profitLossExportRows(report,{from:period.from,to:period.to,branch:'All branches',includeZero:false});
  assert.deepEqual(rows[0],['Wayvida Books . Profit & Loss','For 2026-04-01 to 2026-09-30']);
  assert.deepEqual(rows[10],['Account Code','Account','Account Group','Amount INR']);
  assert.ok(rows.some(row=>row[1]==='Total Revenue'&&row[3]===14000));
  assert.ok(rows.some(row=>row[1]==='Net Profit'&&row[3]===6950));
  assert.ok(rows.some(row=>row[0]==='4000'&&row[3]===9000));
  assert.ok(excelReport(rows).includes('ss:Type="Number">6950'));
  assert.equal(PROFIT_LOSS_TYPES.join(','),'Income,Expenses');
});

test('the financial year the report defaults to opens in April',()=>{
  assert.equal(financialYearStart(new Date('2026-09-28T00:00:00')),'2026-04-01');
  assert.equal(financialYearStart(new Date('2026-02-10T00:00:00')),'2025-04-01');
});

test('the page reuses the report shell, drills into the General Ledger and never writes to the store',async()=>{
  const page=await readFile(new URL('../src/ProfitLoss.jsx',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/profit-loss.css',import.meta.url),'utf8');
  const navigation=await readFile(new URL('../src/Navigation.jsx',import.meta.url),'utf8');
  for(const label of ['Profit & Loss','View income, expenses and net profit for the selected period.','From date','To date','Account Group','Export Excel','Export PDF','No income or expense transactions were posted for this period.','Based on posted accounting entries for the selected period. Draft and cancelled transactions are excluded.'])assert.ok(page.includes(label),label);
  assert.ok(page.includes("onNavigate('General Ledger')"));
  assert.ok(page.includes("sessionStorage.setItem('wayvida-open-account'"));
  assert.ok(page.includes("import EmptyState from './EmptyState.jsx'"));
  assert.ok(page.includes("import {downloadReport,excelReport} from './daybook-export.js'"));
  assert.ok(page.includes('useDeferredValue'));
  assert.ok(!/localStorage\.setItem/.test(page));
  assert.ok(!/writeAccounts/.test(page));
  assert.ok(navigation.includes("active==='Profit & Loss'"),'the Profit & Loss route is present in navigation');
  assert.ok(navigation.includes("active==='Profit & Loss'&&createPortal(<div className=\"transactionPortal\"><ProfitLoss"),'the report is portalled like the Balance Sheet and Trial Balance');
  /* The same shell traps the Balance Sheet and Trial Balance hit apply here too. */
  assert.match(css,/\.plHead\s*\{[^}]*position:\s*relative\s*!important/);
  assert.match(css,/\.plSectionHeader th|\.plSection th/);
  assert.match(css,/@media \(max-width: 900px\)/);
  assert.match(css,/@media \(max-width: 560px\)/);
  assert.match(css,/@media print/);
  assert.match(css,/\.plTableScroll\s*\{[^}]*overflow-x:\s*auto/);
  /* The empty state replaces the statement, so no zero arithmetic rows print beside it. */
  assert.match(page,/<tbody>\s*\{report\.accounts\s*\?/);
  assert.match(page,/<tr className="plSectionTotal">\s*<td className="plMajorTotalLabel"/);
});
