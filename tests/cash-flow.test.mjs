import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ACTIVITY_SECTIONS,cashFlow,cashFlowExportRows,isCashEquivalent,financialYearStart} from '../src/cash-flow.js';
import {excelReport} from '../src/daybook-export.js';

/* Amounts are integer paise, as everywhere else in the accounting engine. The chart is a real one:
   cash and bank accounts carry the natures the Chart of Accounts assigns, and the classification is
   read from those accounts rather than from any code in the report. */
const chart=[
  {code:'1000',name:'Cash',type:'Assets',accountNature:'Cash',active:true},
  {code:'1010',name:'Bank',type:'Assets',accountNature:'Bank',active:true},
  {code:'1020',name:'ICICI Current Account',type:'Assets',active:true,group:'Cash and Bank'},
  {code:'1100',name:'Accounts Receivable',type:'Assets',accountNature:'Accounts Receivable',active:true},
  {code:'1200',name:'Inventory',type:'Assets',accountNature:'Inventory',active:true},
  {code:'1410',name:'Input CGST',type:'Assets',accountNature:'Current Assets',active:true},
  {code:'1500',name:'Equipment',type:'Assets',accountNature:'Fixed Assets',active:true},
  {code:'1600',name:'Investments',type:'Assets',accountNature:'Current Assets',active:true},
  {code:'1700',name:'Security Deposit',type:'Assets',accountNature:'Other Assets',active:true},
  {code:'2000',name:'Accounts Payable',type:'Liabilities',accountNature:'Accounts Payable',active:true},
  {code:'2100',name:'GST Payable',type:'Liabilities',accountNature:'GST Payable',active:true},
  {code:'2200',name:'Customer Advances',type:'Liabilities',accountNature:'Current Liabilities',active:true},
  {code:'2500',name:'Bank Loan',type:'Liabilities',accountNature:'Loans',active:true},
  {code:'3000',name:'Capital',type:'Equity',accountNature:'Capital',active:true},
  {code:'3100',name:'Drawings',type:'Equity',accountNature:'Drawings',active:true},
  {code:'4000',name:'Sales',type:'Income',accountNature:'Sales Income',active:true},
  {code:'4100',name:'Service Income',type:'Income',accountNature:'Sales Income',active:true},
  {code:'4200',name:'Interest Income',type:'Income',accountNature:'Other Income',active:true},
  {code:'5000',name:'Purchase',type:'Expenses',accountNature:'Cost of Goods Sold',active:true},
  {code:'5300',name:'Utilities',type:'Expenses',accountNature:'Operating Expense',active:true},
  {code:'5700',name:'Bank Charges',type:'Expenses',accountNature:'Financial Expense',active:true},
  {code:'9000',name:'Suspense',type:'Expenses',active:true,isGroup:true}
];
const row=(id,date,lines,extra={})=>({id,number:id,date,status:'Posted',source:extra.source||'Journal Transaction',branch:extra.branch||'',branchId:extra.branchId||'',lines:lines.map(line=>({branch:extra.lineBranch||'',...line}))});
const journals=[
  /* A credit sale and a credit purchase move no cash at all. */
  row('j1','2026-05-02',[{account:'1100',debit:100000},{account:'4000',credit:100000}],{source:'Sales Invoice'}),
  row('j3','2026-05-06',[{account:'5000',debit:60000},{account:'2000',credit:60000}],{source:'Purchase Bill'}),
  row('j2','2026-05-10',[{account:'1010',debit:50000},{account:'1100',credit:50000}],{source:'Customer Receipt'}),
  row('j4','2026-05-14',[{account:'2000',debit:30000},{account:'1010',credit:30000}],{source:'Vendor Payment'}),
  row('j5','2026-05-18',[{account:'5300',debit:8500},{account:'1000',credit:8500}],{source:'Expense'}),
  row('j6','2026-05-20',[{account:'2100',debit:12000},{account:'1010',credit:12000}],{source:'Journal Transaction'}),
  row('j7','2026-06-01',[{account:'1500',debit:200000},{account:'1010',credit:200000}],{source:'Journal Transaction'}),
  row('j8','2026-06-08',[{account:'1010',debit:30000},{account:'1500',credit:30000}],{source:'Journal Transaction'}),
  row('j9','2026-06-12',[{account:'1600',debit:50000},{account:'1010',credit:50000}],{source:'Journal Transaction'}),
  row('j10','2026-06-20',[{account:'1010',debit:150000},{account:'2500',credit:150000}],{source:'Journal Transaction'}),
  row('j11','2026-07-01',[{account:'2500',debit:40000},{account:'1010',credit:40000}],{source:'Journal Transaction'}),
  row('j12','2026-07-05',[{account:'1010',debit:300000},{account:'3000',credit:300000}],{source:'Journal Transaction'}),
  row('j13','2026-07-09',[{account:'3100',debit:25000},{account:'1010',credit:25000}],{source:'Journal Transaction'}),
  row('j14','2026-07-15',[{account:'5700',debit:5000},{account:'1010',credit:5000}],{source:'Expense'}),
  row('j15','2026-07-21',[{account:'1010',debit:7000},{account:'4200',credit:7000}],{source:'Customer Receipt'}),
  row('j16','2026-07-25',[{account:'1010',debit:15000},{account:'2200',credit:15000}],{source:'Customer Receipt'}),
  row('j17','2026-08-02',[{account:'1700',debit:9000},{account:'1010',credit:9000}],{source:'Journal Transaction'}),
  row('j18','2026-08-06',[{account:'1200',debit:22000},{account:'1010',credit:22000}],{source:'Journal Transaction'}),
  /* Cash to bank: the business own money moving between its own accounts is not an activity. */
  row('j19','2026-08-10',[{account:'1000',debit:40000},{account:'1010',credit:40000}],{source:'Bank Transfer'}),
  /* A reversed expense: one posted entry and its posted reversal, netting to zero by themselves. */
  row('j22a','2026-08-12',[{account:'5600',debit:4999},{account:'1010',credit:4999}],{source:'Expense'}),
  row('j22b','2026-08-14',[{account:'1010',debit:4999},{account:'5600',credit:4999}],{source:'Journal Reversal'}),
  /* A counterpart the chart does not know is still stated, on the catch-all operating line. */
  row('j26','2026-08-18',[{account:'7777',debit:2000},{account:'1010',credit:2000}],{source:'Journal Transaction'}),
  /* Another branch. */
  row('j25','2026-08-20',[{account:'5300',debit:1234},{account:'1010',credit:1234}],{source:'Expense',branchId:'TVM'}),
  /* Before and after the period: before it is opening cash, after it is outside the report. */
  row('j23','2026-03-20',[{account:'1010',debit:5000},{account:'3000',credit:5000}],{source:'Opening Balance'}),
  row('j24','2026-10-15',[{account:'1010',debit:1000},{account:'4000',credit:1000}],{source:'Sales Invoice'}),
  /* Draft and cancelled documents are not accounting transactions and reach no journal. */
  {...row('j20','2026-05-22',[{account:'5300',debit:99999},{account:'1010',credit:99999}]),status:'Draft'},
  {...row('j21','2026-05-24',[{account:'5300',debit:88888},{account:'1010',credit:88888}]),status:'Cancelled'}
];
const state={accounts:chart,journals};
const period={from:'2026-04-01',to:'2026-09-30'};
const line=(report,key)=>report.sections.flatMap(section=>section.lines).find(item=>item.key===key);

test('the statement classifies every cash movement and every total reconciles',()=>{
  const report=cashFlow(state,period);
  assert.deepEqual(report.sections.map(item=>item.key),['operating','investing','financing']);
  assert.equal(report.openingCash,5000);
  assert.equal(report.operating,-8734);
  assert.equal(report.investing,-229000);
  assert.equal(report.financing,385000);
  assert.equal(report.netCashFlow,147266);
  assert.equal(report.closingCash,152266);
  assert.equal(report.difference,0);
  assert.equal(report.cashInflows,556999);
  assert.equal(report.cashOutflows,409733);
  assert.equal(report.internalTransfers,0);
  assert.equal(report.excluded,0);
  assert.ok(report.valid,report.checks.filter(check=>!check.ok).map(check=>check.key).join(', '));
  assert.equal(report.checks.length,10);
  assert.deepEqual(report.checks.map(check=>check.key),['reconciles','closingIsLedger','netCashFlow','operatingTotal','investingTotal','financingTotal','lineTotals','noDoubleCount','grossFlows','difference']);
  /* The statement opens and closes where the report says it does, in that order. */
  assert.equal(report.statement[0].label,'Opening Cash & Cash Equivalents');
  assert.equal(report.statement.at(-1).label,'Closing Cash & Cash Equivalents');
  assert.equal(report.statement.at(-1).amount,152266);
  assert.ok(report.statement.some(item=>item.kind==='derived'&&item.key==='netCashFlow'&&item.label==='Net Increase / (Decrease) in Cash'));
  /* The line hierarchy is the fixed one the spec states, and each line carries its own accounts. */
  assert.equal(report.sections.find(section=>section.key==='operating').totalLabel,'Net Cash from Operating Activities');
  assert.equal(line(report,'customers').total,65000);
  assert.equal(line(report,'suppliers').total,-52000);
  assert.equal(line(report,'operatingExpenses').total,-14734);
  assert.equal(line(report,'taxes').total,-12000);
  assert.equal(line(report,'otherOperating').total,5000);
  assert.equal(line(report,'fixedAssets').total,-200000);
  assert.equal(line(report,'fixedAssetsSale').total,30000);
  assert.equal(line(report,'investments').total,-50000);
  assert.equal(line(report,'otherInvesting').total,-9000);
  assert.equal(line(report,'loansReceived').total,150000);
  assert.equal(line(report,'loanRepayments').total,-40000);
  assert.equal(line(report,'capital').total,300000);
  assert.equal(line(report,'drawings').total,-25000);
  /* One account can stand under two lines - Bank received from customers and paid suppliers - and
     each row is that line own movement, so nothing is ever counted twice. */
  assert.deepEqual(line(report,'customers').rows.map(item=>[item.code,item.amount]),[['1010',65000]]);
  assert.deepEqual(line(report,'operatingExpenses').rows.map(item=>[item.code,item.amount]).sort(),[['1000',-8500],['1010',-6234]]);
  assert.equal(report.accounts,14);
});

test('a credit sale and a credit purchase create no cash flow until they are settled',()=>{
  const creditOnly={accounts:chart,journals:[journals[0],journals[1]]};
  const report=cashFlow(creditOnly,period);
  assert.equal(report.accounts,0);
  assert.equal(report.movements,0);
  assert.equal(report.periodActivity,false);
  assert.equal(report.netCashFlow,0);
  assert.equal(report.openingCash,0);
  assert.equal(report.closingCash,0);
  assert.ok(report.valid);
  /* Once the customer pays, exactly that settlement is the operating inflow. */
  const settled=cashFlow({accounts:chart,journals:[journals[0],journals[1],journals[2]]},period);
  assert.equal(line(settled,'customers').total,50000);
  assert.equal(settled.operating,50000);
});

test('each movement lands on the fixed line its counterpart account means',()=>{
  const report=cashFlow(state,period);
  const onLine=(key,code,amount)=>assert.deepEqual(line(report,key).rows.map(item=>[item.code,item.amount]),[[code,amount]],key);
  onLine('fixedAssets','1010',-200000);
  onLine('fixedAssetsSale','1010',30000);
  onLine('investments','1010',-50000);
  onLine('otherInvesting','1010',-9000);
  onLine('loansReceived','1010',150000);
  onLine('loanRepayments','1010',-40000);
  onLine('capital','1010',300000);
  onLine('drawings','1010',-25000);
  onLine('taxes','1010',-12000);
  onLine('otherOperating','1010',5000);
  /* Interest paid is an operating payment and stays inside operating expenses. */
  assert.equal(line(report,'operatingExpenses').total,-14734);
  /* Nothing is stated on two activities at once. */
  assert.equal(report.movementsShown+report.transferMovements+report.excludedMovements,report.movements);
});

test('a draft, a cancelled document and a reversal are handled the way the ledger handles them',()=>{
  const noReversal={accounts:chart,journals:journals.filter(item=>item.id!=='j22a'&&item.id!=='j22b')};
  const report=cashFlow(noReversal,period);
  assert.equal(line(report,'operatingExpenses').total,-14734);
  assert.equal(report.operating,-8734);
  /* The reversed pair is in the journal and nets to zero, so it changes nothing. */
  assert.equal(report.movementsShown+report.transferMovements+report.excludedMovements,report.movements);
  const withReversal=cashFlow(state,period);
  assert.equal(withReversal.operating,report.operating);
  assert.equal(withReversal.closingCash,report.closingCash);
  /* The draft and the cancelled expense never reached a journal line. */
  assert.ok(!withReversal.statement.some(item=>item.kind==='derived'&&Math.abs(item.amount)===99999));
});

test('opening cash is the balance immediately before the period and closing agrees with the ledger',()=>{
  const report=cashFlow(state,period);
  assert.equal(report.openingCash,5000);
  assert.equal(report.closingCash,5000+report.periodMovement);
  assert.equal(report.closingCash,152266);
  /* Nothing after the To date is in the report. */
  assert.ok(!report.statement.some(item=>item.amount===1000));
  /* A window that starts after the opening entry makes that entry part of the period instead. */
  const later=cashFlow(state,{from:'2026-04-01',to:'2026-10-31'});
  assert.equal(later.closingCash,report.closingCash+1000);
});

test('a transfer between the business own cash accounts is not invented as an inflow and an outflow',()=>{
  const report=cashFlow(state,period);
  assert.equal(report.internalTransfers,0);
  assert.equal(report.movements,report.movementsShown+report.transferMovements+report.excludedMovements);
  assert.ok(!report.statement.some(item=>item.key==='internalTransfers'));
  /* Reading one account at a time, the same transfer is stated once, on its own reconciling line. */
  const bank=cashFlow(state,{...period,cashAccount:'1010'});
  assert.equal(bank.internalTransfers,-40000);
  assert.equal(bank.closingCash+cashFlow(state,{...period,cashAccount:'1000'}).closingCash,report.closingCash+report.internalTransfers+bank.internalTransfers+cashFlow(state,{...period,cashAccount:'1000'}).internalTransfers);
  assert.ok(bank.statement.some(item=>item.key==='internalTransfers'&&item.label==='Transfers between cash and bank accounts'));
  assert.ok(bank.valid,bank.checks.filter(check=>!check.ok).map(check=>check.key).join(', '));
});

test('the cash and bank account filter narrows the opening balance, the totals and the closing balance',()=>{
  const all=cashFlow(state,period),cash=cashFlow(state,{...period,cashAccount:'1000'}),bank=cashFlow(state,{...period,cashAccount:'1010'});
  assert.equal(cash.openingCash,0);
  assert.equal(bank.openingCash,5000);
  assert.equal(cash.closingCash,31500);
  /* The closing balance is the account's own ledger balance, so the transfer leg it received sits inside it. */
  assert.equal(cash.closingCash,cash.openingCash+cash.operating+cash.internalTransfers);
  assert.equal(cash.operating,-8500);
  assert.equal(cash.capital,undefined);
  /* Only the selected accounts are stated, so the two accounts together are the whole statement. */
  assert.equal(cash.closingCash+bank.closingCash,all.closingCash+all.internalTransfers);
  assert.equal(cash.cashChart.length,3);
  assert.deepEqual(all.selectedCash.map(item=>item.code),['1000','1010','1020']);
  assert.ok(cash.valid&&bank.valid);
});

test('the branch filter states one branch only',()=>{
  const other=cashFlow(state,{...period,branch:'TVM'});
  assert.equal(other.operating,-1234);
  assert.equal(other.closingCash,1234===other.closingCash?0:-1234);
  assert.equal(other.movements,1);
  const kochi=cashFlow(state,{...period,branch:''});
  assert.equal(kochi.operating,-7500);
  assert.ok(other.valid&&kochi.valid);
});

test('the account, group and search filters narrow the classified movements and state what they leave out',()=>{
  const report=cashFlow(state,{...period,account:'1500'});
  assert.equal(report.operating,0);
  assert.equal(report.investing,-170000);
  assert.equal(report.netCashFlow,-170000);
  assert.equal(report.excluded,317266);
  assert.equal(report.closingCash,152266);
  assert.equal(report.difference,0);
  assert.ok(report.valid,report.checks.filter(check=>!check.ok).map(check=>check.key).join(', '));
  assert.ok(report.statement.some(item=>item.key==='excluded'&&item.label==='Cash movements excluded by the current filters'));
  const group=cashFlow(state,{...period,accountGroup:'Fixed Assets'});
  assert.equal(group.investing,-170000);
  assert.equal(group.excluded,317266);
  assert.ok(group.valid);
  const searched=cashFlow(state,{...period,search:'equipment'});
  assert.equal(searched.investing,-170000);
  assert.ok(searched.valid);
  /* The search reads the account name, its code and its group, and never invents a classification.
     Searching a cash account finds that account's own movements; the movements it leaves out are
     stated on the reconciling line, so closing cash still agrees with the ledger. */
  const searchedCash=cashFlow(state,{...period,search:'1010'});
  assert.equal(searchedCash.excluded,-8500);
  assert.equal(searchedCash.movementsShown,19);
  assert.equal(searchedCash.closingCash,152266);
  assert.equal(cashFlow(state,{...period,search:'nothing here'}).movementsShown,0);
});

test('the zero-balance toggle reveals zero rows and zero lines without changing a total',()=>{
  const hidden=cashFlow(state,period),shown=cashFlow(state,{...period,includeZero:true});
  assert.equal(hidden.sections.length,3);
  assert.deepEqual(shown.sections.map(section=>section.key),['operating','investing','financing']);
  assert.ok(shown.sections.every(section=>section.lines.length===section.stated.length));
  assert.deepEqual(shown.sections.map(section=>section.total),hidden.sections.map(section=>section.total));
  assert.equal(shown.closingCash,hidden.closingCash);
  assert.equal(shown.netCashFlow,hidden.netCashFlow);
  assert.equal(shown.accounts,hidden.accounts);
  /* Revealing the zero-value line adds no account row and leaves every section total standing. */
  assert.equal(shown.sections.find(section=>section.key==='financing').lines.length,hidden.sections.find(section=>section.key==='financing').lines.length+1);
});

test('the projection reads the journal without mutating it and exports the same statement',()=>{
  const source={accounts:chart,journals},before=JSON.stringify(source);
  const report=cashFlow(source,period);
  assert.equal(JSON.stringify(source),before);
  const rows=cashFlowExportRows(report,{from:period.from,to:period.to,branch:'All branches',cashAccount:'All cash and bank accounts'});
  assert.deepEqual(rows[0],['Wayvida Books . Cash Flow Statement','For 2026-04-01 to 2026-09-30']);
  assert.deepEqual(rows[5],['Section','Line','Account Code','Account','Account Group','Amount INR']);
  assert.ok(rows.some(item=>item[1]==='Opening Cash & Cash Equivalents'&&item[5]===50));
  assert.ok(rows.some(item=>item[0]==='Financing Activities'&&item[1]==='Capital introduced'&&item[2]==='1010'&&item[5]===3000));
  assert.ok(rows.some(item=>item[1]==='Net Cash from Investing Activities'&&item[5]===-2290));
  assert.ok(rows.some(item=>item[1]==='Net Increase / (Decrease) in Cash'&&item[5]===1472.66));
  assert.ok(rows.some(item=>item[1]==='Closing Cash & Cash Equivalents'&&item[5]===1522.66));
  assert.ok(excelReport(rows).includes('ss:Type="Number">1522.66'));
  assert.ok(!/Export Excel|Export PDF|Filters/.test(rows.flat().join(' ')));
});

test('cash and bank accounts come from the account metadata, never from a code',async()=>{
  const source=await readFile(new URL('../src/cash-flow.js',import.meta.url),'utf8');
  assert.ok(!/['"](1000|1010|1020)['"]/.test(source),'no account code is named in the report');
  assert.ok(isCashEquivalent({code:'9001',name:'Petty Cash',type:'Assets',accountNature:'Cash',active:true}));
  assert.ok(isCashEquivalent({code:'9002',name:'ICICI Current Account',type:'Assets',group:'Cash and Bank',active:true}));
  assert.ok(!isCashEquivalent({code:'5700',name:'Bank Charges',type:'Expenses',accountNature:'Financial Expense',active:true}));
  assert.ok(!isCashEquivalent({code:'1410',name:'Input CGST',type:'Assets',accountNature:'Current Assets',active:true}));
  assert.ok(!isCashEquivalent({code:'1200',name:'Inventory',type:'Assets',accountNature:'Inventory',active:true}));
  assert.ok(!isCashEquivalent({code:'9100',name:'Cash Group',type:'Assets',isGroup:true,active:true}));
  assert.equal(financialYearStart(new Date('2026-09-28T00:00:00')),'2026-04-01');
});

test('the page reuses the report shell, drills into the General Ledger and never writes to the store',async()=>{
  const page=await readFile(new URL('../src/CashFlowStatement.jsx',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/cash-flow.css',import.meta.url),'utf8');
  const navigation=await readFile(new URL('../src/Navigation.jsx',import.meta.url),'utf8');
  for(const label of ['Cash Flow Statement','Track cash inflows and outflows for the selected period.','From date','To date','Cash / Bank account','Account group','Opening Cash','Cash Inflows','Cash Outflows','Net Cash Flow','Closing Cash','Export Excel','Export PDF','No cash or bank movements were posted for this period.','Based on posted accounting entries for the selected period. Draft and cancelled transactions are excluded.'])assert.ok(page.includes(label),label);
    /* The activity, line and subtotal labels are the report's own fixed vocabulary, so the engine states
     them and the page renders whatever the report carries instead of restating them by hand. */
  for(const label of ['Operating Activities','Investing Activities','Financing Activities','Net Cash from Operating Activities','Cash received from customers','Cash paid to suppliers','Cash paid for operating expenses','Taxes paid','Purchase of fixed assets','Loan repayments','Owner drawings / distributions'])assert.ok(ACTIVITY_SECTIONS.some(section=>section.label===label||section.totalLabel===label||section.lines.some(([,lineLabel])=>lineLabel===label)),label);
  for(const template of ['{item.label}','{item.totalLabel}','{line.label}'])assert.ok(page.includes(template),template);
  assert.ok(page.includes("onNavigate('General Ledger')"));
  assert.ok(page.includes("sessionStorage.setItem('wayvida-open-account'"));
  assert.ok(page.includes("import EmptyState from './EmptyState.jsx'"));
  assert.ok(page.includes("import {downloadReport,excelReport} from './daybook-export.js'"));
  assert.ok(page.includes('useDeferredValue'));
  assert.ok(!/localStorage\.setItem/.test(page));
  assert.ok(!/writeAccounts/.test(page));
  /* The sidebar route opens the report. */
  assert.ok(navigation.includes("active==='Cash Flow Statement'"),'the Cash Flow Statement route is present in navigation');
  assert.ok(navigation.includes("active==='Cash Flow Statement'&&createPortal(<div className=\"transactionPortal\"><CashFlowStatement"),'the report is portalled like the other statements');
  /* The shell traps the other statements hit apply here too. */
  assert.match(css,/\.cfHead\{position:static!important;inset:auto!important/);
  assert.match(css,/\.cfStatementCard \.cfSection th,\.cfStatementCard \.cfGroup th\{text-align:left!important/);
  assert.match(css,/\.cfRowLine\{display:flex/);
  assert.match(css,/@media\(max-width:900px\)/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/@media\(max-width:560px\)/);
  assert.match(css,/@media print/);
  assert.match(css,/\.cfStickyBalance\{position:sticky/);
  assert.match(css,/\.cfTableScroll\{overflow-x:auto/);
  /* Opening and closing stay stated when there is no movement, so the empty state sits between. */
  assert.ok(page.includes('{!report.accounts&&index===0?emptyRow:null}'));
  assert.ok(page.includes('report.periodActivity?'));
  /* A subtotal states its label and amount in one full-width cell, so the amount survives the phone
     widths where the narrow columns are hidden and a three-column label span would leave it zero. */
  assert.match(page,/<tr className="cfSectionTotal"><th colSpan="3"/);
  assert.ok(page.includes("colSpan=\"3\""));
});
