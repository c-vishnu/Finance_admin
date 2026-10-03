import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AGING_BUCKETS,INVOICE_STATUSES,agingBucket,customerOutstanding,customerOutstandingExportRows,daysPastDue,invoiceStatus,receivableAccounts} from '../src/customer-outstanding.js';

const AS_OF='2026-09-28';
const accounts=[
  {code:'1010',name:'Bank',type:'Assets',nature:'Debit',group:'Cash and Bank',active:true},
  {code:'1100',name:'Accounts Receivable',type:'Assets',nature:'Debit',group:'Current Assets',active:true,controlAccount:true},
  {code:'2200',name:'Customer Advances',type:'Liabilities',nature:'Credit',group:'Current Liabilities',active:true},
  {code:'4000',name:'Sales',type:'Income',nature:'Credit',group:'Operating Income',active:true}
];
const customers=[
  {id:'c1',name:'ABC Retail Pvt Ltd',code:'CUS001',phone:'9876543210',email:'accounts@abcretail.example'},
  {id:'c2',name:'Northstar Services',code:'CUS002',phone:'9876543211',email:'finance@northstar.example'}
];
const invoice=(id,number,customerId,date,dueDate,total,extra={})=>({id,number,customerId,date,dueDate,posted:true,status:'Approved',arAccount:'1100',totals:{total},...extra});
const journal=(id,date,lines,status)=>({id,date,status,lines});
const line=(account,debit,credit)=>({account,debit,credit});

function fixture(){
  return {
    version:1,
    accounts:JSON.parse(JSON.stringify(accounts)),
    config:{ar:'1100'},
    customers:[],
    invoices:[
      invoice('i1','INV-0001','c1','2026-08-01','2026-08-15',5900000),
      invoice('i2','INV-0002','c1','2026-09-20','2026-10-20',1000000),
      invoice('i3','INV-0003','c2','2026-09-01','2026-09-28',500000),
      invoice('i4','INV-0004','c2','2026-09-10','2026-10-10',900000,{posted:false,status:'Draft'}),
      invoice('i5','INV-0005','c2','2026-08-10','2026-09-10',300000,{status:'Cancelled'}),
      invoice('i6','INV-0006','c2','2026-07-01','2026-07-15',200000)
    ],
    receipts:[
      {id:'r1',customerId:'c1',kind:'Normal',status:'Posted',amount:2000000,date:'2026-08-20',arAccount:'1100'},
      {id:'r2',customerId:'c1',kind:'Normal',status:'Posted',amount:100000,date:'2026-09-20',arAccount:'1100'},
      {id:'r3',customerId:'c2',kind:'Advance',status:'Posted',amount:500000,date:'2026-09-05',advanceAccount:'2200',arAccount:'1100'},
      {id:'r4',customerId:'c2',kind:'Normal',status:'Draft',amount:400000,date:'2026-09-22',arAccount:'1100'}
    ],
    receiptAllocations:[
      {id:'a1',receiptId:'r1',invoiceId:'i1',amount:2000000,date:'2026-08-20'},
      {id:'a2',receiptId:'r6',invoiceId:'i6',amount:200000,date:'2026-07-20'}
    ],
    creditNotes:[{id:'n1',customerId:'c1',number:'CN-0001',date:'2026-09-01',total:900000,posted:true,status:'Issued',arAccount:'1100',totals:{total:900000}}],
    creditApplications:[{id:'ap1',creditNoteId:'n1',invoiceId:'i1',amount:900000,date:'2026-09-01'}],
    payments:[],
    journals:[
      journal('j1','2026-08-01',[line('1100',5900000,0),line('4000',0,5900000)]),
      journal('j2','2026-09-20',[line('1100',1000000,0),line('4000',0,1000000)]),
      journal('j3','2026-09-01',[line('1100',500000,0),line('4000',0,500000)]),
      journal('j4','2026-07-01',[line('1100',200000,0),line('4000',0,200000)]),
      journal('j5','2026-08-20',[line('1010',2000000,0),line('1100',0,2000000)]),
      journal('j6','2026-07-20',[line('1010',200000,0),line('1100',0,200000)]),
      journal('j7','2026-09-01',[line('4000',900000,0),line('1100',0,900000)]),
      journal('j8','2026-09-05',[line('1010',500000,0),line('2200',0,500000)]),
      journal('j9','2026-09-20',[line('1010',100000,0),line('1100',0,100000)]),
      journal('j10','2026-09-25',[line('1010',700000,0),line('1100',0,700000)],'Draft')
    ]
  };
}
const find=(report,id)=>report.customers.find(entry=>entry.id===id);
const row=(report,customerId,number)=>find(report,customerId).rows.find(item=>item.number===number);

test('the projection states each posted invoice once and never touches the source',()=>{
  const state=fixture(),before=JSON.stringify(state);
  const report=customerOutstanding(state,customers,{asOf:AS_OF});
  assert.equal(JSON.stringify(state),before,'the report must not write the accounting state');
  assert.deepEqual(AGING_BUCKETS.map(bucket=>bucket.label),['Not Yet Due','Due Today','1–30 Days Overdue','31–60 Days Overdue','61–90 Days Overdue','90+ Days Overdue']);
  assert.deepEqual(INVOICE_STATUSES,['Not Yet Due','Due Today','Overdue','Partially Paid','Paid']);
  assert.equal(report.customers.length,2);
  assert.equal(report.totals.invoices,3,'the draft, the cancelled and the paid invoice never reach the default view');
  assert.equal(report.customers.some(entry=>entry.rows.some(item=>item.number==='INV-0004')),false,'a draft invoice is never stated');
  assert.equal(report.customers.some(entry=>entry.rows.some(item=>item.number==='INV-0005')),false,'a cancelled invoice is never stated');
});

test('outstanding is billed less the allocations and credit applications actually applied',()=>{
  const report=customerOutstanding(fixture(),customers,{asOf:AS_OF});
  const first=row(report,'c1','INV-0001');
  assert.equal(first.total,5900000);
  assert.equal(first.paid,2000000,'only the allocated receipt is applied, never the whole receipt total');
  assert.equal(first.creditApplied,900000);
  assert.equal(first.outstanding,3000000,'59000 - 9000 credit note - 20000 receipt = 30000');
  assert.equal(find(report,'c1').outstanding,3000000+1000000);
  assert.equal(row(report,'c2','INV-0002'),undefined,'INV-0002 belongs to the other customer');
});

test('aging is counted from the due date in days past due',()=>{
  assert.equal(daysPastDue('2026-08-15','2026-09-28'),44);
  assert.equal(agingBucket(44),'d31_60','44 days past due is the 31-60 bucket');
  assert.equal(agingBucket(0),'dueToday','the day an invoice falls due is stated on its own');
  assert.equal(agingBucket(-5),'notDue');
  assert.equal(agingBucket(1),'d1_30');
  assert.equal(agingBucket(30),'d1_30');
  assert.equal(agingBucket(31),'d31_60');
  assert.equal(agingBucket(61),'d61_90');
  assert.equal(agingBucket(91),'d90plus');
  const report=customerOutstanding(fixture(),customers,{asOf:AS_OF});
  const first=row(report,'c1','INV-0001');
  assert.equal(first.daysOverdue,44);
  assert.equal(first.bucket,'d31_60');
  assert.equal(find(report,'c1').buckets.d31_60,3000000);
  assert.equal(find(report,'c1').buckets.notDue,1000000,'INV-0002 is not yet due');
  assert.equal(find(report,'c2').buckets.dueToday,500000,'INV-0003 falls due on the report date');
  assert.equal(find(report,'c1').overdue,3000000);
  assert.equal(find(report,'c1').notYetDue,1000000);
});

test('status follows the due date, and paid invoices keep zero outstanding',()=>{
  const report=customerOutstanding(fixture(),customers,{asOf:AS_OF});
  assert.equal(row(report,'c1','INV-0001').status,'Overdue');
  assert.equal(row(report,'c1','INV-0002').status,'Not Yet Due');
  assert.equal(row(report,'c2','INV-0003').status,'Due Today');
  const paid=customerOutstanding(fixture(),customers,{asOf:AS_OF,status:'Paid'});
  assert.equal(row(paid,'c2','INV-0006').status,'Paid');
  assert.equal(row(paid,'c2','INV-0006').outstanding,0);
  assert.equal(invoiceStatus({outstanding:1,applied:5,dueDate:'2026-10-30',asOf:AS_OF}),'Partially Paid','paid part, not yet due');
  assert.equal(invoiceStatus({outstanding:1,applied:5,dueDate:'2026-09-01',asOf:AS_OF}),'Overdue','a due date in the past still reads Overdue');
});

test('paid invoices are hidden by default and stated only when the Status filter asks for them',()=>{
  const report=customerOutstanding(fixture(),customers,{asOf:AS_OF});
  assert.equal(find(report,'c2').invoices,1,'INV-0004 draft, INV-0005 cancelled and INV-0006 paid are all hidden');
  assert.equal(report.customers.some(entry=>entry.rows.some(item=>item.number==='INV-0004')),false);
  assert.equal(report.customers.some(entry=>entry.rows.some(item=>item.number==='INV-0005')),false);
  const withPaid=customerOutstanding(fixture(),customers,{asOf:AS_OF,status:'Paid'});
  assert.deepEqual(find(withPaid,'c2').rows.map(item=>item.number),['INV-0006'],'the Status filter is how a settled invoice is asked for');
  assert.equal(find(withPaid,'c2').outstanding,0,'a settled invoice carries no balance');
});

test('an advance and an unallocated receipt stay identifiable and never become negative debt',()=>{
  const report=customerOutstanding(fixture(),customers,{asOf:AS_OF});
  assert.equal(find(report,'c2').advance,500000,'the customer advance is stated as itself');
  assert.equal(find(report,'c1').unallocated,100000,'the unallocated receipt is stated as itself');
  assert.ok(report.customers.every(entry=>entry.rows.every(item=>item.outstanding>=0)),'no invoice may print a negative outstanding');
  assert.ok(report.customers.every(entry=>entry.outstanding>=0));
});

test('the as-of date, customer, status, aging, search and branch filters all narrow the report',()=>{
  const early=customerOutstanding(fixture(),customers,{asOf:'2026-08-31'});
  assert.equal(row(early,'c1','INV-0001').outstanding,3900000,'the September credit note has not been applied yet');
  assert.equal(find(early,'c1').invoices,1,'INV-0002 is raised after the report date');

  const one=customerOutstanding(fixture(),customers,{asOf:AS_OF,customer:'c2'});
  assert.deepEqual(one.customers.map(entry=>entry.id),['c2']);

  const overdue=customerOutstanding(fixture(),customers,{asOf:AS_OF,status:'Overdue'});
  assert.deepEqual(overdue.customers.map(entry=>entry.id),['c1']);
  assert.equal(overdue.totals.outstanding,3000000);

  /* The Aging filter chooses which customers are listed, but the Outstanding column keeps stating the
     whole balance - the filtered bucket amount travels beside it for the hint, never in its place. */
  const aged=customerOutstanding(fixture(),customers,{asOf:AS_OF,aging:'d31_60'});
  assert.deepEqual(aged.customers.map(entry=>entry.id),['c1'],'only a customer with money in the bucket is listed');
  assert.equal(aged.totals.outstanding,4000000,'Outstanding stays the whole balance, not the bucket');
  assert.equal(find(aged,'c1').agingAmount,3000000,'the hint carries the money in the chosen bucket');
  const today=customerOutstanding(fixture(),customers,{asOf:AS_OF,aging:'dueToday'});
  assert.deepEqual(today.customers.map(entry=>entry.id),['c2']);
  assert.equal(today.customers[0].agingAmount,500000);
  const notDue=customerOutstanding(fixture(),customers,{asOf:AS_OF,aging:'notDue'});
  assert.deepEqual(notDue.customers.map(entry=>entry.id),['c1']);
  assert.equal(notDue.customers[0].agingAmount,1000000);
  assert.equal(notDue.filtersActive,true,'an aging filter counts as an active filter');
  assert.equal(customerOutstanding(fixture(),customers,{asOf:AS_OF}).customers[0].agingAmount,0,'no aging filter means no hint');

  assert.deepEqual(customerOutstanding(fixture(),customers,{asOf:AS_OF,search:'northstar'}).customers.map(entry=>entry.id),['c2'],'search reads the name');
  assert.deepEqual(customerOutstanding(fixture(),customers,{asOf:AS_OF,search:'CUS001'}).customers.map(entry=>entry.id),['c1'],'search reads the code');
  assert.deepEqual(customerOutstanding(fixture(),customers,{asOf:AS_OF,search:'9876543211'}).customers.map(entry=>entry.id),['c2'],'search reads the phone');
  assert.deepEqual(customerOutstanding(fixture(),customers,{asOf:AS_OF,search:'abcretail.example'}).customers.map(entry=>entry.id),['c1'],'search reads the email');

  const state=fixture();
  state.invoices[0].branchId='abc-kochi';
  state.invoices[1].branchId='abc-kochi';
  const branch=customerOutstanding(state,customers,{asOf:AS_OF,branch:'abc-kochi'});
  assert.equal(branch.totals.outstanding,4000000,'only the tagged branch is stated');
  assert.deepEqual(branch.branchOptions,['abc-kochi']);
  assert.equal(customerOutstanding(state,customers,{asOf:AS_OF,branch:'other'}).customers.length,0);
});

test('the subledger reconciles with the accounts receivable control account',()=>{
  const report=customerOutstanding(fixture(),customers,{asOf:AS_OF});
  const reconciliation=report.reconciliation;
  assert.equal(reconciliation.controlAccount,'1100');
  assert.equal(receivableAccounts(fixture()).includes('1100'),true);
  assert.equal(reconciliation.control,4400000,'1100 balance from the posted journal only');
  assert.equal(reconciliation.subledgerOutstanding,4500000);
  assert.equal(reconciliation.unallocatedReceipts,100000);
  assert.equal(reconciliation.unappliedCredit,0);
  assert.equal(reconciliation.expected,4400000);
  assert.equal(reconciliation.difference,0);
  assert.equal(reconciliation.reconciled,true);
  assert.equal(report.valid,true,report.checks.filter(check=>!check.ok).map(check=>check.key).join(', '));
  assert.ok(report.checks.length>=10);
});

test('a mismatched receivable posting is surfaced, never forced away',()=>{
  const state=fixture();
  state.journals.push({id:'j11',date:'2026-09-26',lines:[{account:'1010',debit:100000,credit:0},{account:'1100',debit:0,credit:100000,description:'Customer payment by journal'}]});
  const report=customerOutstanding(state,customers,{asOf:AS_OF});
  assert.equal(report.reconciliation.difference,-100000,'the unattributed receivable credit is stated as the difference');
  assert.equal(report.reconciliation.reconciled,false);
  assert.equal(report.valid,false);
  assert.equal(report.checks.find(check=>check.key==='reconciles').ok,false);
  assert.equal(report.totals.outstanding,4500000,'the invoice rows still state what is owed');
});

test('the export carries the scope, the customer rows, the totals and the invoice detail',()=>{
  const report=customerOutstanding(fixture(),customers,{asOf:AS_OF});
  const rows=customerOutstandingExportRows(report,{organisation:'Wayvida Learning',generatedBy:'Local user',generatedAt:'2026-09-28T10:00:00.000Z'});
  assert.deepEqual(rows[0],['Wayvida Books \u00b7 Customer Outstanding','See what your customers currently owe you.']);
  assert.ok(rows[1].includes('Organisation')&&rows[1].includes('Branch'));
  assert.ok(rows[2].includes('As of')&&rows[2].includes(AS_OF));
  assert.deepEqual(rows[6],[],'a blank separator row sits before the column header, as the other reports do');
  assert.deepEqual(rows[7],['Customer','Customer ID','Invoices','Outstanding INR','Overdue INR','Not Yet Due INR'],'the simplified table is the whole shape of the export, with no aging bucket column');
  const header=rows.findIndex(cells=>cells[0]==='Customer'&&cells[1]==='Customer ID');
  const total=rows.find(cells=>cells[0]==='Total');
  assert.equal(total[2],3);
  assert.equal(total[3],45000,'the totals row sums the customer rows');
  assert.equal(total[4],30000,'the totals row carries the overdue money');
  assert.equal(total[5],10000,'and the not-yet-due money');
  assert.equal(rows.slice(header+1,header+1+report.customers.length).every(cells=>typeof cells[3]==='number'),true);
  const invoiceHeader=rows.find(cells=>cells[1]==='Invoice Number');
  assert.ok(invoiceHeader,'the sheet carries the invoice-level detail');
  assert.equal(rows.filter(cells=>cells[1]==='INV-0001').length,1);
  assert.equal(rows.some(cells=>cells[1]==='INV-0004'),false,'a draft invoice is never exported');
});

test('the page, the sidebar and the reports grid carry the report',()=>{
  const page=readFileSync(new URL('../src/CustomerOutstanding.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/customer-outstanding.css',import.meta.url),'utf8');
  const secondaryNav=readFileSync(new URL('../src/ReportsSecondaryNav.jsx',import.meta.url),'utf8');
  const navigation=readFileSync(new URL('../src/Navigation.jsx',import.meta.url),'utf8');
  const modules=readFileSync(new URL('../src/OperationalModules.jsx',import.meta.url),'utf8');
  for(const token of ['Customer Outstanding','See what your customers currently owe you.','coSummary','coStickyBalance','EmptyState'])assert.ok(page.includes(token),token);
  assert.ok(page.includes('No outstanding customer balances found.'),'the empty state carries the report wording');
  assert.ok(page.includes('Try changing the date or filters.'),'the empty state offers the filtered hint');
  assert.ok(page.includes("variant=\"customer\""),'the empty state reuses the shared customer illustration');
  /* The statement table is exactly six columns and aging is not one of them: it is a filter. */
  const headStart=page.indexOf('<thead><tr><th className="coNameCol">');
  const tableHead=page.slice(headStart,page.indexOf('</thead>',headStart));
  for(const token of ['Customer','Customer ID','Invoices','Outstanding','Overdue','Not Yet Due'])assert.ok(tableHead.includes('>'+token+'<'),token);
  assert.equal((tableHead.match(/<th /g)||[]).length,6,'the statement table is exactly six columns');
  assert.ok(!page.includes('coBucketCol'),'no aging bucket is a permanent column');
  assert.ok(page.includes('aria-label="Aging"')&&!page.includes('aria-label="Aging bucket"'),'aging is a filter named Aging');
  for(const token of ['text-align:right','.coStickyBalance{position:sticky','.coCodeCol{display:none}','overflow-x:auto'])assert.ok(css.includes(token),token);
  assert.ok(css.includes('.coStatementCard>.coTableScroll>table{table-layout:fixed}')&&!css.includes('.coStatementCard table{table-layout:fixed}'),'the phone statement-table rules stay scoped, so the nested invoice table keeps its own layout and scrolls instead of collapsing');
  assert.ok(secondaryNav.includes("label: 'Customer Outstanding'"),'the secondary nav carries the leaf');
  assert.ok(navigation.includes("active==='Customer Outstanding'&&createPortal"),'the page is portalled like its siblings');
  assert.ok(modules.includes("['Customer Outstanding','Receivables, overdue balances and aging','Customer Outstanding']"),'the financial reports grid opens it by name');
});
test('every customer total reconciles with its own invoice rows, and unposted documents contribute nothing',()=>{
  const report=customerOutstanding(fixture(),customers,{asOf:AS_OF});
  for(const entry of report.customers){
    const summed=entry.rows.reduce((total,item)=>total+item.outstanding,0);
    assert.equal(entry.outstanding,summed,`${entry.name} total must equal its invoice rows`);
    assert.equal(entry.invoices,entry.rows.length);
    assert.equal(AGING_BUCKETS.reduce((total,bucket)=>total+entry.buckets[bucket.key],0),entry.outstanding,`${entry.name} buckets must add up`);
  }
  const state=fixture();
  const withLegacy=customerOutstanding({...state,payments:[{id:'p1',invoiceId:'i1',amount:500000,date:'2026-08-20'}]},customers,{asOf:AS_OF});
  assert.equal(row(withLegacy,'c1','INV-0001').paid,2500000,'a legacy payment in payments[] is applied alongside the allocation');
  assert.equal(row(withLegacy,'c1','INV-0001').outstanding,2500000,'59000 - 9000 credit note - 25000 received');
  const lateLegacy=customerOutstanding({...state,payments:[{id:'p2',invoiceId:'i1',amount:500000,date:'2026-12-20'}]},customers,{asOf:AS_OF});
  assert.equal(row(lateLegacy,'c1','INV-0001').paid,2000000,'a payment dated after the report date has not happened yet');
  const draftReceipt=customerOutstanding(state,customers,{asOf:AS_OF,status:'Paid'});
  assert.equal(find(draftReceipt,'c2').unallocated,0,'the draft receipt is not a valid unallocated receipt');
  assert.equal(report.totals.customers,2);
});

test('the export respects the active filters',()=>{
  const report=customerOutstanding(fixture(),customers,{asOf:AS_OF,customer:'c2',status:'Due Today'});
  const rows=customerOutstandingExportRows(report,{organisation:'Wayvida Learning'});
  assert.equal(report.totals.outstanding,500000);
  const total=rows.find(cells=>cells[0]==='Total');
  assert.equal(total[2],1);
  assert.equal(total[3],5000);
  assert.equal(rows.some(cells=>cells[0]==='ABC Retail Pvt Ltd'),false,'a filtered-out customer is never exported');
  assert.ok(rows.some(cells=>cells[0]==='Northstar Services'));
  assert.equal(rows.filter(cells=>cells[1]==='INV-0003').length,1);
  assert.equal(rows.filter(cells=>cells[1]==='INV-0004').length,0);
});
