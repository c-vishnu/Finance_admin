import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {ALL,DEFAULT_SORT,POSTED,SORT_OPTIONS,expenseExportSheet,branchName,expenseReport,purchaseExportSheet,purchaseReport,salesExportSheet,salesReport,sortTransactions} from '../src/business-reports.js';

const read=name=>readFileSync('src/'+name,'utf8');
const R=rupees=>Math.round(rupees*100);

/* ---------- the fixture ---------- */
/* Every amount is in paise, the unit the document stores hold and money() expects. The book carries
   the four cases the brief names - a posted document, a draft, a cancelled document and another
   organisation's document - so the exclusion rules are pinned rather than assumed. */
const journal=(id,branch='abc-kochi')=>({id,lines:[{account:'1100',branch}],branchId:branch,companyId:'ABC01'});
const invoice=(id,number,date,status,taxable,extra={})=>({
 id,number,date,dueDate:date,posted:true,status,customerId:'cus-1',customerName:'ABC Retail Pvt Ltd',
 reference:'REF-'+number,notes:'September supply',branchId:'abc-kochi',organizationId:'abc',journalId:'j-'+id,
 totals:{taxable:R(taxable),cgst:R(taxable*0.09),sgst:R(taxable*0.09),igst:0,cess:0,roundOff:0,total:R(taxable*1.18),lines:[]},...extra});
const bill=(id,number,date,status,taxable,extra={})=>({
 id,number,date,dueDate:date,posted:true,status,vendorId:'ven-1',vendorName:'Kerala Office Supplies',
 vendorInvoice:'VINV/'+number,notes:'Stock purchase',branchId:'abc-kochi',organizationId:'abc',journalId:'j-'+id,
 total:R(taxable*1.18),totals:{taxable:R(taxable),cgst:R(taxable*0.09),sgst:R(taxable*0.09),igst:0,cess:0,roundOff:0,total:R(taxable*1.18),lines:[]},...extra});
const expense=(id,number,date,status,payee,category,accountCode,rupees,extra={})=>({
 id,number,date,name:category,payee,category,account:accountCode,amount:R(rupees),paidThrough:'1010',method:'UPI',
 tax:'GST 18%',status,description:'September spend',...extra});

const invoices=[
 invoice('i1','INV-00001','2026-09-01','Approved',1000),
 invoice('i2','INV-00002','2026-09-15','Approved',2000,{reference:'WEB-DEMO-002'}),
 invoice('i3','INV-00003','2026-09-30','Approved',3000),
 invoice('i4','INV-DRAFT','2026-09-12','Draft',5000,{posted:false}),
 invoice('i5','INV-CANCELLED','2026-09-13','Cancelled',7000,{posted:false}),
 invoice('i6','INV-OTHER','2026-09-14','Approved',9000,{organizationId:'northstar'}),
 invoice('i7','INV-TRIVANDRUM','2026-09-16','Approved',1500,{branchId:'abc-trivandrum'})
];
const bills=[
 bill('b1','BILL-00001','2026-09-01','Partially Paid',4000),
 bill('b2','BILL-00002','2026-09-30','Paid',6000),
 bill('b3','BILL-DRAFT','2026-09-12','Unpaid',8000,{posted:false}),
 bill('b4','BILL-CANCELLED','2026-09-13','Cancelled',12000,{posted:false})
];
const expenses=[
 expense('e1','EXP-00041','2026-09-05','Posted','Cloudstack Services','Software & subscriptions','5600',1180),
 expense('e2','EXP-00042','2026-09-30','Posted','Kochi Business Park','Rent & lease','5300',8500),
 expense('e3','EXP-00043','2026-09-07','Draft','Metro Cabs','Travel & conveyance','5400',2450)
];
const book=()=>({
 accounts:[{id:'a5600',code:'5600',name:'Professional Fees',type:'Expenses',active:true,isGroup:false},{id:'a5300',code:'5300',name:'Utilities',type:'Expenses',active:true,isGroup:false},{id:'a1010',code:'1010',name:'Bank',type:'Assets',active:true,isGroup:false}],
 config:{state:'Kerala',roundRupee:false,sales:'4100',ar:'1100',cgst:'2100',sgst:'2100',igst:'2100',cess:'2100',round:'5900'},
 invoices,creditNotes:[],journals:[...invoices,...bills].map(row=>journal(row.journalId,row.branchId)),payments:[],receipts:[],debitNotes:[],purchaseBills:bills
});
const customers=[{id:'cus-1',name:'ABC Retail Pvt Ltd',code:'CUS001'}];
const vendors=[{id:'ven-1',name:'Kerala Office Supplies',code:'VEN-00001',pan:'ABCDE1234F'}];
const branches=[{id:'abc-kochi',name:'Kochi'},{id:'abc-trivandrum',name:'Trivandrum'}];
const context={branches,organisation:'abc',organisationCode:'ABC01',status:POSTED,party:ALL,branch:ALL};
const sales=(overrides={})=>salesReport(book(),customers,{...context,...overrides});
const purchases=(overrides={})=>purchaseReport(book(),vendors,{...context,...overrides});
const expenses_=(overrides={})=>expenseReport(book(),{expenses,audit:[]},{branches,organisation:'abc',organisationCode:'ABC01',status:POSTED,...overrides});

/* ---------- navigation ---------- */

test('the sidebar states a Business Reports group with exactly the three brief entries',()=>{
 const nav=read('Navigation.jsx');
 assert.ok(nav.includes("{label:'Business Reports',icon:IconChartHistogram,children:[leaf('Sales Report'),leaf('Purchase Report'),leaf('Expense Report')]}"),'the group is declared with the three leaves');
 for(const label of ['Sales Report','Purchase Report','Expense Report'])assert.equal(nav.split("leaf('"+label+"')").length-1,1,label+' is listed exactly once');
 assert.ok(nav.indexOf("label:'Business Reports'")<nav.indexOf("leaf('Audit Log')"),'the group sits before Audit Log, inside Reports');
});

test('every report in the brief is reachable from Reports and nothing is duplicated',()=>{
 const nav=read('Navigation.jsx');
 const reported=(nav.match(/^.*label:'Reports'.*$/m)||[''])[0];
 for(const label of ['Transaction Register','Balance Sheet','Profit & Loss','Cash Flow Statement','Trial Balance','Customer Outstanding','Supplier Outstanding','General Ledger','Day Book','Tax & Compliance','Business Reports'])assert.ok(reported.includes("'"+label+"'"),label+' is still listed');
 for(const label of ['Sales Report','Purchase Report','Expense Report'])assert.equal(reported.split("'"+label+"'").length-1,1,label+' is not duplicated');
 const leaves=reported.match(/leaf\('([^']+)'/g)||[];
 assert.equal(new Set(leaves).size,leaves.length,'no Reports leaf is repeated');
});

test('each of the three reports is mounted through the shared portal and excluded from the module switch',()=>{
 const nav=read('Navigation.jsx');
 for(const label of ['Sales Report','Purchase Report','Expense Report']){
  assert.ok(nav.includes("{active==='"+label+"'&&createPortal(<div className=\"transactionPortal\"><"+label.replaceAll(' ','')+" onNavigate={onNavigate}/></div>,document.body)}"),label+' is mounted through .transactionPortal');
  assert.ok(nav.includes("import "+label.replaceAll(' ','')+" from './"+label.replaceAll(' ','')+".jsx';"),label+' is imported');
 }
 const app=read('App.jsx');
 const welcome=(app.match(/!\[([^\]]*)\]\.includes\(a\)&&<div className="welcome">/)||['',''])[1];
 for(const label of ['Sales Report','Purchase Report','Expense Report'])assert.ok(welcome.includes("'"+label+"'"),'the welcome banner is suppressed for '+label);
 assert.ok(/\[[^\]]*'Sales Report'[^\]]*\]\.includes\(a\)\?null:/.test(app),'the operational-module fallback is bypassed for the reports');
});

/* ---------- the shared family ---------- */

test('the three pages reuse the family shell rather than growing their own',()=>{
 for(const name of ['SalesReport.jsx','PurchaseReport.jsx','ExpenseReport.jsx']){
  const page=read(name);
  assert.ok(page.includes("import './business-reports.css';"),name+' uses the shared sheet');
  assert.ok(page.includes("import EmptyState from './EmptyState.jsx';"),name+' uses the shared empty state');
  assert.ok(page.includes("import OutstandingActions from './OutstandingActions.jsx';"),name+' uses the shared row menu');
  assert.ok(page.includes("import StatusPill from './StatusPill.jsx';"),name+' uses the shared status pill');
  assert.ok(page.includes("import {tableExport} from './tax-compliance.js';")&&page.includes('tableExport('),name+' builds its export with the shared identity block');
  assert.ok(page.includes('excelReport')&&page.includes('downloadReport'),name+' exports through daybook-export');
  assert.ok(page.includes('window.print()'),name+' prints through the shared browser print path');
  assert.ok(page.includes("className=\"transactionPortal\"")===false,name+' does not declare its own portal');
 }
 const sheet=read('business-reports.css');
 assert.ok(sheet.includes('body:has(.brPage)'),'the print block neutralises the shell chrome');
 assert.ok(sheet.includes('.transactionPortal:has(.brPage)'),'the print block neutralises the portal for all three pages');
 assert.ok(sheet.includes('.brRegisterCard th,.brRegisterCard td'),'the cell rules are scoped by the report card, so they still out-rank the global table block');
 assert.ok(sheet.includes('.brStickyBalance'),'the reconciliation strip is the shared sticky footer');
 for(const width of ['max-width:1100px','max-width:900px','max-width:760px','max-width:560px'])assert.ok(sheet.includes(width),'the '+width+' breakpoint is declared');
 assert.ok(sheet.includes('.brCaptureScroll')===false&&sheet.includes('overflow-x:auto'),'only the table container scrolls sideways');
});

test('the shipped sheet never redeclares the shared portal',()=>{
 const sheet=read('business-reports.css');
 assert.ok(!/^\.transactionPortal\{/m.test(sheet),'the portal position rule stays owned by transaction-register.css');
});

/* ---------- Sales Report ---------- */

test('the Sales Report states the brief\'s copy, cards and columns',()=>{
 const page=read('SalesReport.jsx');
 assert.ok(page.includes('<h1>Sales Report</h1>'),'the title');
 assert.ok(page.includes('View sales transactions, customers and sales amounts.'),'the subtitle');
 for(const card of ['Total Sales','Taxable Sales','GST','Invoices'])assert.ok(page.includes('<span>'+card+'</span>'),'the '+card+' card');
 for(const column of ['<th className="brDateCol">Date</th>','<th className="brNumberCol">Invoice</th>','<th className="brPartyCol">Customer</th>','<th className="brMetaCol brMoney">Taxable Amount</th>','<th className="brMetaCol brTaxCol brMoney">GST</th>','<th className="brMoneyCol brMoney">Total</th>','<th className="brStatusCol">Status</th>','<th className="brActionsCol">Actions</th>'])assert.ok(page.includes(column),'the column '+column);
 assert.ok(page.includes('placeholder="Search invoice, customer or reference"'),'the search placeholder');
 assert.ok(page.includes('>Date From<')&&page.includes('>Date To<')&&page.includes('>Customer<')&&page.includes('>Branch<')&&page.includes('>Invoice Status<'),'the five required filters');
 assert.ok(page.includes('>Clear filters<'),'Clear filters');
 assert.ok(page.includes('View Invoice')&&page.includes('View Customer'),'both row actions');
 assert.ok(page.includes('Sales invoices will appear here once they are posted.'),'the empty-state description');
 const heads=(page.match(/<th[^>]*>[^<]*<\/th>/g)||[]).join(' ');
 assert.ok(!/Receivable|Outstanding|Payment/i.test(heads),'no receivable, outstanding or payment-status column');
});

test('the Sales Report is filterable on every required field, together',()=>{
 assert.equal(sales().rows.length,4,'the posted invoices of this organisation only');
 assert.deepEqual(sales({status:ALL}).rows.map(row=>row.number).sort(),['INV-00001','INV-00002','INV-00003','INV-DRAFT','INV-TRIVANDRUM'],'an explicit All states the drafts too, never the cancelled one');
 assert.ok(!sales({status:ALL}).rows.some(row=>row.number==='INV-CANCELLED'),'a cancelled invoice is never stated');
 assert.ok(!sales({status:ALL}).rows.some(row=>row.number==='INV-OTHER'),'another organisation\'s invoice is never stated');

 /* Date From and Date To are inclusive at both ends. */
 assert.deepEqual(sales({from:'2026-09-01',to:'2026-09-01'}).rows.map(row=>row.number),['INV-00001'],'the boundary date is inside the range');
 assert.deepEqual(sales({from:'2026-09-02',to:'2026-09-29'}).rows.map(row=>row.number),['INV-00002','INV-TRIVANDRUM'],'a range states only what is inside it');
 assert.deepEqual(sales({to:'2026-09-30'}).rows.length,4,'Date To alone is inclusive');
 assert.deepEqual(sales({from:'2026-09-01'}).rows.length,4,'Date From alone is inclusive');

 /* Every filter, applied together. */
 assert.deepEqual(sales({party:'ABC Retail Pvt Ltd',branch:'Kochi',from:'2026-09-01',to:'2026-09-30'}).rows.length,3,'customer, branch and dates narrow together');
 assert.equal(sales({branch:'Trivandrum'}).rows.length,1,'the branch filter is resolved to the organisation\'s own branch name');
 assert.equal(sales({branch:'Kochi'}).rows.length,3,'Kochi states the three Kochi invoices');
 assert.equal(sales({branch:'Trivandrum',party:'ABC Retail Pvt Ltd'}).rows.length,1,'two filters together still narrow');
 assert.equal(sales({branch:'Bengaluru'}).rows.length,0,'a branch no invoice was raised in states nothing');
 assert.equal(sales({party:'Nobody'}).rows.length,0,'an unknown customer states nothing');
});

test('the Sales Report search reads the invoice number, customer, code, reference and description',()=>{
 assert.deepEqual(sales({search:'INV-00001'}).rows.map(row=>row.number),['INV-00001'],'by invoice number');
 assert.equal(sales({search:'abc retail'}).rows.length,4,'by customer name');
 assert.equal(sales({search:'cus001'}).rows.length,4,'by customer code');
 assert.deepEqual(sales({search:'WEB-DEMO-002'}).rows.map(row=>row.number),['INV-00002'],'by reference');
 assert.equal(sales({search:'september supply'}).rows.length,4,'by description');
 assert.equal(sales({search:'INV-00001',party:'Nobody'}).rows.length,0,'search and filters work together');
});

test('the Sales Report totals are the documents\' own paise, and one invoice is stated once',()=>{
 const report=sales();
 assert.equal(report.totals.taxable,R(7500),'Taxable Sales is the sum of the invoices\' own taxable value');
 assert.equal(report.totals.gst,R(1350),'GST is the sum of the four tax components the engine wrote');
 assert.equal(report.totals.total,R(8850),'Total Sales is the sum of the invoices\' own totals');
 assert.equal(report.totals.count,4,'the Invoices card counts the invoices shown');
 assert.equal(report.totals.total,report.rows.reduce((total,row)=>total+row.total,0),'the card total equals the rows');
 assert.equal(new Set(report.rows.map(row=>row.recordId)).size,report.rows.length,'one row per invoice');
 assert.ok(report.checks.every(check=>check.ok),'every stated check holds');
 assert.equal(report.valid,true,'the report is internally consistent');
 assert.equal(report.poolSize,5,'the pool states the drafts too, so the filter count is honest');
 assert.equal(report.excludedOtherOrganisation,1,'the foreign organisation document is counted as excluded');
});

/* ---------- Purchase Report ---------- */

test('the Purchase Report states the brief\'s copy, cards and columns',()=>{
 const page=read('PurchaseReport.jsx');
 assert.ok(page.includes('<h1>Purchase Report</h1>'),'the title');
 assert.ok(page.includes('View purchase bills, suppliers and purchase amounts.'),'the subtitle');
 for(const card of ['Total Purchases','Taxable Purchases','GST','Bills'])assert.ok(page.includes('<span>'+card+'</span>'),'the '+card+' card');
 for(const column of ['<th className="brDateCol">Date</th>','<th className="brNumberCol">Bill</th>','<th className="brPartyCol">Supplier</th>','<th className="brMetaCol brMoney">Taxable Amount</th>','<th className="brMetaCol brTaxCol brMoney">GST</th>','<th className="brMoneyCol brMoney">Total</th>','<th className="brStatusCol">Status</th>','<th className="brActionsCol">Actions</th>'])assert.ok(page.includes(column),'the column '+column);
 assert.ok(page.includes('placeholder="Search bill, supplier or reference"'),'the search placeholder');
 assert.ok(page.includes('>Date From<')&&page.includes('>Date To<')&&page.includes('>Supplier<')&&page.includes('>Branch<')&&page.includes('>Bill Status<'),'the five required filters');
 assert.ok(page.includes('View Bill')&&page.includes('View Supplier'),'both row actions');
 assert.ok(page.includes('Purchase bills will appear here once they are posted.'),'the empty-state description');
 const heads=(page.match(/<th[^>]*>[^<]*<\/th>/g)||[]).join(' ');
 assert.ok(!/Payable|Outstanding/i.test(heads),'no payable or outstanding column');
});

test('the Purchase Report follows the bill\'s own posting rule, not its payment status',()=>{
 assert.equal(purchases().rows.length,2,'the posted bills only');
 assert.ok(purchases().rows.every(row=>row.status==='Posted'),'a bill\'s lifecycle is Posted from its posted flag, not from Paid / Partially Paid / Unpaid');
 assert.ok(!purchases().rows.some(row=>/Paid|Unpaid/.test(row.status)),'the stored payment status is never printed as the lifecycle status');
 assert.deepEqual(purchases({status:ALL}).rows.map(row=>row.number).sort(),['BILL-00001','BILL-00002','BILL-DRAFT'],'an explicit All states the draft, never the cancelled bill');
 assert.deepEqual(purchases({from:'2026-09-01',to:'2026-09-01'}).rows.map(row=>row.number),['BILL-00001'],'the date range is inclusive');
 assert.equal(purchases({search:'vinv/bill-00002'}).rows.length,1,'the search reads the supplier invoice reference');
 assert.equal(purchases({search:'ven-00001'}).rows.length,2,'the search reads the supplier code from the vendor master');
 assert.equal(purchases({search:'kerala office'}).rows.length,2,'the search reads the supplier name');
 assert.equal(purchases({party:'Kerala Office Supplies',branch:'Kochi'}).rows.length,2,'supplier and branch narrow together');
 assert.equal(purchases().totals.total,R(11800),'Total Purchases is the sum of the bills\' own totals');
 assert.equal(purchases().totals.taxable,R(10000),'Taxable Purchases is the sum of the bills\' own taxable value');
 assert.equal(purchases().totals.count,2,'the Bills card counts the bills shown');
 assert.ok(purchases().checks.every(check=>check.ok),'every stated check holds');
 assert.equal(new Set(purchases().rows.map(row=>row.recordId)).size,2,'one row per bill');
});

/* ---------- Expense Report ---------- */

test('the Expense Report states the requested copy, columns and structure',()=>{
 const page=read('ExpenseReport.jsx');
 assert.ok(page.includes('<h2>Expenses'),'the title');
 assert.ok(page.includes('View business expenses by date, account and payee.'),'the subtitle');
 for(const column of ['Reference# & Date','Expense Account','Vendor Name','Paid Through','CustomerName','Status','Amount','Actions'])assert.ok(page.includes('<th>'+column+'</th>'),'the column '+column);
 for(const filter of ['>Date From<','>Date To<','>Expense Account<','>Category<','>Vendor Name<','>Status<','>Payment Account<'])assert.ok(page.includes(filter),'the '+filter+' filter');
 assert.ok(page.includes('View Expense'),'the row action');
 assert.ok(page.includes('Expenses will appear here once they are posted.'),'the empty-state description');
});

test('the Expense Report states the recorded amount and never invents a tax figure',()=>{
 const report=expenses_({status:POSTED});
 assert.equal(report.rows.length,2,'the posted expenses only');
 assert.equal(report.totals.total,R(9680),'Total Expenses is the sum of the amounts the store recorded');
 assert.equal(report.totals.gst,0,'no GST total is derived for an expense');
 assert.equal(report.totals.taxable,0,'no taxable value is derived for an expense');
 assert.ok(report.rows.every(row=>row.total===row.amount),'the Total is the recorded amount, not a recomputed one');
 assert.ok(report.rows.every(row=>row.taxLabel==='GST 18%'),'the Tax column states the recorded rate label');
 assert.ok(report.rows.every(row=>!/^\d/.test(String(row.taxLabel))),'the Tax column is never a rupee figure');
 assert.deepEqual(expenses_({status:ALL}).rows.map(row=>row.number).sort(),['EXP-00041','EXP-00042','EXP-00043'],'an explicit All states the draft expense');
 assert.deepEqual(expenses_({from:'2026-09-05',to:'2026-09-05'}).rows.map(row=>row.number),['EXP-00041'],'the date range is inclusive');
 assert.equal(expenses_({account:'Professional Fees'}).rows.length,1,'the Expense Account filter reads the chart of accounts name');
 assert.equal(expenses_({category:'Rent & lease'}).rows.length,1,'the Category filter');
 assert.equal(expenses_({party:'Cloudstack Services'}).rows.length,1,'the Payee filter');
 assert.equal(expenses_({payment:'Bank'}).rows.length,2,'the Payment Account filter reads the paid-through account name');
 assert.equal(expenses_({search:'cloudstack'}).rows.length,1,'the search reads the payee');
 assert.equal(expenses_({search:'exp-00042'}).rows.length,1,'the search reads the expense number');
 assert.equal(expenses_({search:'rent & lease'}).rows.length,1,'the search reads the category');
 assert.equal(expenses_({search:'professional fees'}).rows.length,1,'the search reads the expense account');
 assert.equal(expenses_({account:'Professional Fees',payment:'Cash'}).rows.length,0,'filters that cannot both hold state nothing');
 assert.ok(report.checks.every(check=>check.ok),'every stated check holds');
 assert.equal(new Set(report.rows.map(row=>row.recordId)).size,report.rows.length,'one row per expense');
});

test('the Expense Report offers no Branch filter when no expense carries a branch',()=>{
 assert.deepEqual(expenses_().branchOptions,[],'an expense recorded with no branch context offers no branch option');
 const withBranch=expenseReport(book(),{expenses:[{...expenses[0],journalId:'j-i7'}]},{branches,organisation:'abc',organisationCode:'ABC01',status:POSTED,party:ALL,branch:ALL});
 assert.deepEqual(withBranch.branchOptions,['Trivandrum'],'a branch read from the posted journal resolves to the organisation\'s own branch name');
 assert.equal(withBranch.rows.length,1,'and the row is stated');
});

/* ---------- exports ---------- */

test('each export states exactly the columns the brief lists',()=>{
 assert.deepEqual(salesExportSheet(sales()).header,['Date','Invoice','Customer','Taxable Amount INR','GST INR','Total INR','Status'],'the sales export header');
 assert.deepEqual(purchaseExportSheet(purchases()).header,['Date','Bill','Supplier','Taxable Amount INR','GST INR','Total INR','Status'],'the purchase export header');
 assert.deepEqual(expenseExportSheet(expenses_()).header,['Date','Expense No.','Expense Account','Payee','Category','Amount INR','Tax','Total INR','Status'],'the expense export header');
 assert.equal(salesExportSheet(sales()).rows.length,4,'the sales export states every filtered row');
 assert.equal(expenseExportSheet(expenses_()).rows.length,2,'the expense export states every filtered row');
 assert.equal(salesExportSheet(sales()).rows[0]===undefined,false,'the sales export is a header plus rows');
 assert.deepEqual(salesExportSheet(sales({branch:'Trivandrum'})).rows.map(row=>row[1]),['INV-TRIVANDRUM'],'the export respects the active filters');
 assert.deepEqual(salesExportSheet(sales({search:'WEB-DEMO-002'})).rows.map(row=>row[1]),['INV-00002'],'the export respects the search');
 const sheet=salesExportSheet(sales());
 assert.equal(sheet.rows[0][5],sales().rows[0].total/100,'the export states money in rupees, as every report export does');
 assert.equal(sheet.rows.length,sales().rows.length,'the export states exactly the rows the page shows');
});

/* ---------- the shared ordering ---------- */

test('the three reports sort with the register\'s own control, newest first by default',()=>{
 assert.equal(DEFAULT_SORT,'newest','Date descending is the default');
 assert.ok(SORT_OPTIONS.some(option=>option.value==='newest'&&option.label==='Newest first'),'the register\'s order options are reused');
 const ordered=sortTransactions(sales().rows,DEFAULT_SORT);
 assert.deepEqual(ordered.map(row=>row.date),[ '2026-09-30','2026-09-16','2026-09-15','2026-09-01' ],'newest first');
 assert.deepEqual(sortTransactions(sales().rows,'oldest').map(row=>row.date),['2026-09-01','2026-09-15','2026-09-16','2026-09-30'],'oldest first reverses it');
 assert.equal(sortTransactions(sales().rows,'amount-desc')[0].number,'INV-00003','the amount order reads the document total');
});

/* ---------- honesty guards ---------- */

test('no business report re-derives a tax or reaches past the document store',()=>{
 const module=read('business-reports.js');
 assert.ok(!/calculate\(|lineTaxes|invoiceTax/.test(module),'the projection never calls a tax engine');
 assert.ok(!/journal\(|command\(|writeAccounts|saveOperations/.test(module),'the projection never posts or writes');
 assert.ok(module.includes('lines belong to the Day Book, the General Ledger and the Journal register'),'the module says where ledger lines belong');
 assert.ok(!/creditNote|debitNote/i.test(module),'a credit or debit note is not folded into a business report');
 assert.ok(module.includes("from './transaction-register.js'"),'the ordering control is the register\'s own');
 for(const report of [sales(),purchases(),expenses_()])assert.ok(report.checks.every(check=>check.ok),report.type+' report checks all hold');
 const srcNames=readdirSync('src',{recursive:true}).filter(name=>/^business-reports\.(js|css)$/.test(name)||/^(SalesReport|PurchaseReport|ExpenseReport)\.jsx$/.test(name));
 assert.deepEqual(srcNames.sort(),['ExpenseReport.jsx','PurchaseReport.jsx','SalesReport.jsx','business-reports.css','business-reports.js'],'the pass adds exactly five source files');
});
