import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AGING_BUCKETS,BILL_STATUSES,agingBucket,billStatus,daysPastDue,payableAccounts,supplierOutstanding,supplierOutstandingExportRows} from '../src/supplier-outstanding.js';

const AS_OF='2026-09-28';
const accounts=[
  {code:'1010',name:'Bank',type:'Assets',nature:'Debit',group:'Cash and Bank',active:true},
  {code:'2000',name:'Accounts Payable',type:'Liabilities',nature:'Credit',group:'Current Liabilities',active:true,accountNature:'Accounts Payable'},
  {code:'2100',name:'GST Payable',type:'Liabilities',nature:'Credit',group:'Current Liabilities',active:true,accountNature:'GST Payable'},
  {code:'5000',name:'Purchase',type:'Expenses',nature:'Debit',group:'Operating Expenses',active:true}
];
const vendors=[
  {id:'s1',name:'Kerala Office Supplies',code:'VEN-00001',phone:'9847011223',email:'accounts@keralaoffice.example'},
  {id:'s2',name:'Cloudstack Services',code:'VEN-00002',phone:'9876541002',email:'billing@cloudstack.example'},
  {id:'s3',name:'Metro Maintenance Works',code:'VEN-00003',phone:'9895088221',email:''}
];
const bill=(id,number,vendorId,date,dueDate,total,extra={})=>({id,number,vendorId,vendorName:(vendors.find(v=>v.id===vendorId)||{}).name,date,dueDate,posted:true,status:'Unpaid',payableAccount:'2000',total,paidAmount:0,lines:[],...extra});
const payment=(id,billId,vendorId,amount,date,extra={})=>({id,number:'VPAY-'+id,billId,vendorId,amount,date,status:'Posted',bankAccount:'1010',...extra});
const note=(id,billId,vendorId,total,date,status,extra={})=>({id,number:'DN-'+id,billId,vendorId,vendorName:(vendors.find(v=>v.id===vendorId)||{}).name,date,status,posted:true,total,appliedAmount:status==='Adjusted'?total:0,...extra});
const journal=(id,date,lines,status)=>({id,date,status,lines});
const line=(account,debit,credit)=>({account,debit,credit});

function fixture(){
  return {
    version:1,
    accounts:JSON.parse(JSON.stringify(accounts)),
    config:{},
    purchaseBills:[
      bill('b1','BILL-0001','s1','2026-08-01','2026-08-15',5900000),
      bill('b2','BILL-0002','s1','2026-09-20','2026-10-20',1000000),
      bill('b3','BILL-0003','s2','2026-09-01','2026-09-28',500000),
      bill('b4','BILL-0004','s2','2026-09-10','2026-10-10',400000,{posted:false,status:'Draft'}),
      bill('b5','BILL-0005','s2','2026-08-10','2026-09-10',300000,{status:'Cancelled'}),
      bill('b6','BILL-0006','s2','2026-07-01','2026-07-15',200000,{status:'Paid'}),
      bill('b7','BILL-0007','s3','2026-09-05','2026-10-05',5000000)
    ],
    vendorPayments:[
      payment('p1','b1','s1',3000000,'2026-08-20'),
      payment('p2','b1','s1',400000,'2026-12-20'),
      payment('p3','b6','s2',200000,'2026-07-20'),
      payment('p4','b7','s3',2000000,'2026-09-10'),
      payment('p5','','s2',500000,'2026-09-05'),
      payment('p6','b2','s1',1000000,'2026-09-21',{status:'Reversed'})
    ],
    debitNotes:[
      note('n1','b1','s1',900000,'2026-09-01','Adjusted'),
      note('n2','b1','s1',100000,'2026-09-10','Posted'),
      note('n3','b3','s2',200000,'2026-09-12','Draft',{posted:false}),
      note('n4','b3','s2',300000,'2026-09-13','Voided')
    ],
    journals:[
      journal('j1','2026-08-01',[line('5000',5900000,0),line('2000',0,5900000)]),
      journal('j2','2026-09-20',[line('5000',1000000,0),line('2000',0,1000000)]),
      journal('j3','2026-09-01',[line('5000',500000,0),line('2000',0,500000)]),
      journal('j4','2026-07-01',[line('5000',200000,0),line('2000',0,200000)]),
      journal('j5','2026-09-05',[line('5000',5000000,0),line('2000',0,5000000)]),
      journal('j6','2026-08-20',[line('2000',3000000,0),line('1010',0,3000000)]),
      journal('j7','2026-07-20',[line('2000',200000,0),line('1010',0,200000)]),
      journal('j8','2026-09-10',[line('2000',2000000,0),line('1010',0,2000000)]),
      journal('j9','2026-09-05',[line('2000',500000,0),line('1010',0,500000)]),
      journal('j10','2026-09-01',[line('2000',900000,0),line('5000',0,900000)]),
      journal('j11','2026-09-10',[line('2000',100000,0),line('5000',0,100000)]),
      journal('j12','2026-09-21',[line('2000',1000000,0),line('1010',0,1000000)]),
      journal('j13','2026-09-22',[line('2000',0,1000000),line('1010',1000000,0)]),
      journal('j14','2026-12-20',[line('2000',400000,0),line('1010',0,400000)]),
      journal('j15','2026-09-25',[line('2000',700000,0),line('1010',0,700000)],'Draft')
    ]
  };
}
const find=(report,id)=>report.suppliers.find(entry=>entry.id===id);
const row=(report,supplierId,number)=>find(report,supplierId).rows.find(item=>item.number===number);

test('the projection states each posted bill once and never touches the source',()=>{
  const state=fixture(),before=JSON.stringify(state);
  const report=supplierOutstanding(state,vendors,{asOf:AS_OF});
  assert.equal(JSON.stringify(state),before,'the report must not write the accounting state');
  assert.deepEqual(AGING_BUCKETS.map(bucket=>bucket.label),['Not Yet Due','Due Today','1–30 Days Overdue','31–60 Days Overdue','61–90 Days Overdue','90+ Days Overdue']);
  assert.deepEqual(BILL_STATUSES,['Not Yet Due','Due Today','Overdue','Partially Paid','Paid']);
  assert.equal(report.suppliers.length,3);
  assert.equal(report.totals.bills,4,'the draft, the cancelled and the paid bill never reach the default view');
  assert.equal(report.suppliers.some(entry=>entry.rows.some(item=>item.number==='BILL-0004')),false,'a draft bill is never stated');
  assert.equal(report.suppliers.some(entry=>entry.rows.some(item=>item.number==='BILL-0005')),false,'a cancelled bill is never stated');
});

test('case 1: a purchase bill of 59000 less a 30000 payment leaves 29000 payable',()=>{
  const state=fixture();
  state.debitNotes=state.debitNotes.map(entry=>entry.id==='n1'?{...entry,status:'Draft'}:entry);
  const report=supplierOutstanding(state,vendors,{asOf:AS_OF});
  const first=row(report,'s1','BILL-0001');
  assert.equal(first.total,5900000);
  assert.equal(first.paid,3000000,'only the payment tied to the bill is applied');
  assert.equal(first.creditApplied,0,'a draft debit note has not reduced anything');
  assert.equal(first.outstanding,2900000,'59000 - 30000 = 29000');
});

test('case 2: a debit note of 9000 on top of the 30000 payment leaves 20000 payable',()=>{
  const report=supplierOutstanding(fixture(),vendors,{asOf:AS_OF});
  const first=row(report,'s1','BILL-0001');
  assert.equal(first.creditApplied,900000,'only the applied debit note reduces the bill');
  assert.equal(first.outstanding,2000000,'59000 debit note 9000 payment 30000 = 20000');
  assert.equal(find(report,'s1').outstanding,2000000+1000000);
  assert.equal(row(report,'s2','BILL-0002'),undefined,'BILL-0002 belongs to the other supplier');
});

test('case 3: a 20000 payment against a 50000 bill leaves 30000 payable, and no bill prints a negative',()=>{
  const report=supplierOutstanding(fixture(),vendors,{asOf:AS_OF});
  const third=row(report,'s3','BILL-0007');
  assert.equal(third.total,5000000);
  assert.equal(third.paid,2000000);
  assert.equal(third.outstanding,3000000,'50000 - 20000 = 30000');
  const state=fixture();
  state.vendorPayments=state.vendorPayments.filter(entry=>entry.id!=='p4');
  assert.equal(row(supplierOutstanding(state,vendors,{asOf:AS_OF}),'s3','BILL-0007').outstanding,5000000,'a credit purchase with no payment is a 50000 payable');
  state.vendorPayments.push(payment('p7','b7','s3',5000000,'2026-09-20'));
  assert.equal(row(supplierOutstanding(state,vendors,{asOf:AS_OF,status:'Paid'}),'s3','BILL-0007').outstanding,0,'settled in full, the payable is nil');
  const overpaid=fixture();
  overpaid.vendorPayments.push(payment('p8','b3','s2',500000,'2026-09-22'));
  assert.ok(supplierOutstanding(overpaid,vendors,{asOf:AS_OF}).suppliers.every(entry=>entry.rows.every(item=>item.outstanding>=0)),'no bill may print a negative outstanding');
});

test('aging is counted from the due date in days past due',()=>{
  assert.equal(daysPastDue('2026-08-15','2026-09-28'),44);
  assert.equal(agingBucket(44),'d31_60','44 days past due is the 31-60 bucket');
  assert.equal(agingBucket(0),'dueToday','the day a bill falls due is stated on its own');
  assert.equal(agingBucket(-5),'notDue');
  assert.equal(agingBucket(1),'d1_30');
  assert.equal(agingBucket(30),'d1_30');
  assert.equal(agingBucket(31),'d31_60');
  assert.equal(agingBucket(61),'d61_90');
  assert.equal(agingBucket(91),'d90plus');
  const report=supplierOutstanding(fixture(),vendors,{asOf:AS_OF});
  const first=row(report,'s1','BILL-0001');
  assert.equal(first.daysOverdue,44);
  assert.equal(first.bucket,'d31_60');
  assert.equal(find(report,'s1').buckets.d31_60,2000000);
  assert.equal(find(report,'s1').buckets.notDue,1000000,'BILL-0002 is not yet due');
  assert.equal(find(report,'s2').buckets.dueToday,500000,'BILL-0003 falls due on the report date');
  assert.equal(find(report,'s1').overdue,2000000);
  assert.equal(find(report,'s3').notYetDue,3000000);
});

test('status follows the due date, and paid bills keep zero outstanding',()=>{
  const report=supplierOutstanding(fixture(),vendors,{asOf:AS_OF});
  assert.equal(row(report,'s1','BILL-0001').status,'Overdue');
  assert.equal(row(report,'s1','BILL-0002').status,'Not Yet Due');
  assert.equal(row(report,'s2','BILL-0003').status,'Due Today');
  assert.equal(row(report,'s3','BILL-0007').status,'Partially Paid','paid part, not yet due');
  const paid=supplierOutstanding(fixture(),vendors,{asOf:AS_OF,status:'Paid'});
  assert.equal(row(paid,'s2','BILL-0006').status,'Paid');
  assert.equal(row(paid,'s2','BILL-0006').outstanding,0);
  assert.equal(billStatus({outstanding:1,applied:5,dueDate:'2026-09-01',asOf:AS_OF}),'Overdue','a due date in the past still reads Overdue');
  assert.equal(billStatus({outstanding:1,applied:0,dueDate:'2026-10-30',asOf:AS_OF}),'Not Yet Due');
});

test('paid bills are hidden by default and stated only when the Status filter asks for them',()=>{
  const report=supplierOutstanding(fixture(),vendors,{asOf:AS_OF});
  assert.equal(find(report,'s2').bills,1,'BILL-0004 draft, BILL-0005 cancelled and BILL-0006 paid are all hidden');
  assert.equal(report.suppliers.some(entry=>entry.rows.some(item=>item.number==='BILL-0004')),false);
  assert.equal(report.suppliers.some(entry=>entry.rows.some(item=>item.number==='BILL-0005')),false);
  const withPaid=supplierOutstanding(fixture(),vendors,{asOf:AS_OF,status:'Paid'});
  assert.deepEqual(find(withPaid,'s2').rows.map(item=>item.number),['BILL-0006'],'the Status filter is how a settled bill is asked for');
  assert.equal(find(withPaid,'s2').outstanding,0,'a settled bill carries no balance');
});

test('a draft payment, a voided debit note and a reversal never reduce a bill',()=>{
  const report=supplierOutstanding(fixture(),vendors,{asOf:AS_OF});
  assert.equal(row(report,'s2','BILL-0003').creditApplied,0,'the draft and the voided debit note are both ignored');
  assert.equal(row(report,'s2','BILL-0003').outstanding,500000);
  assert.equal(row(report,'s1','BILL-0002').paid,0,'the reversed payment is not an allocation');
  assert.equal(row(report,'s1','BILL-0002').outstanding,1000000);
  assert.equal(row(report,'s1','BILL-0001').paid,3000000,'the payment dated after the report date has not happened yet');
});

test('an unallocated payment stays an advance and never becomes negative debt',()=>{
  const report=supplierOutstanding(fixture(),vendors,{asOf:AS_OF});
  assert.equal(find(report,'s2').advance,500000,'the payment with no bill is stated as a supplier advance');
  assert.equal(find(report,'s2').unallocated,0);
  assert.equal(find(report,'s2').debitNoteAvailable,0);
  assert.equal(find(report,'s1').debitNoteAvailable,100000,'the issued-but-unapplied debit note is stated as available');
  assert.equal(report.reconciliation.unallocatedPayments,500000);
  assert.equal(report.reconciliation.unappliedDebitNotes,100000);
  assert.ok(report.suppliers.every(entry=>entry.outstanding>=0));
  const advanced=fixture();
  advanced.vendorPayments=advanced.vendorPayments.map(entry=>entry.id==='p4'?{...entry,billId:'missing-bill'}:entry);
  assert.equal(find(supplierOutstanding(advanced,vendors,{asOf:AS_OF}),'s3').advance,2000000,'a payment naming a bill that was never raised is a supplier advance');
  const orphaned=fixture();
  orphaned.vendorPayments=orphaned.vendorPayments.map(entry=>entry.id==='p4'?{...entry,billId:'b5'}:entry);
  assert.equal(find(supplierOutstanding(orphaned,vendors,{asOf:AS_OF}),'s3').unallocated,2000000,'a payment naming a bill that is not stated is an unallocated payment');
});

test('the as-of date, supplier, status, aging, search and branch filters all narrow the report',()=>{
  const early=supplierOutstanding(fixture(),vendors,{asOf:'2026-08-31'});
  assert.equal(row(early,'s1','BILL-0001').outstanding,2900000,'the September debit note has not been applied yet');
  assert.equal(find(early,'s1').bills,1,'BILL-0002 is raised after the report date');

  const one=supplierOutstanding(fixture(),vendors,{asOf:AS_OF,supplier:'s2'});
  assert.deepEqual(one.suppliers.map(entry=>entry.id),['s2']);

  const overdue=supplierOutstanding(fixture(),vendors,{asOf:AS_OF,status:'Overdue'});
  assert.deepEqual(overdue.suppliers.map(entry=>entry.id),['s1']);
  assert.equal(overdue.totals.outstanding,2000000);

  /* The Aging filter chooses which suppliers are listed, but the Outstanding column keeps stating the
     whole balance - the filtered bucket amount travels beside it for the hint, never in its place. */
  const aged=supplierOutstanding(fixture(),vendors,{asOf:AS_OF,aging:'d31_60'});
  assert.deepEqual(aged.suppliers.map(entry=>entry.id),['s1'],'only a supplier with money in the bucket is listed');
  assert.equal(aged.totals.outstanding,3000000,'Outstanding stays the whole balance, not the bucket');
  assert.equal(find(aged,'s1').agingAmount,2000000,'the hint carries the money in the chosen bucket');
  const notDue=supplierOutstanding(fixture(),vendors,{asOf:AS_OF,aging:'notDue'});
  assert.deepEqual(notDue.suppliers.map(entry=>entry.id).sort(),['s1','s3'],'every supplier with a not-yet-due bill is stated');
  assert.equal(notDue.totals.outstanding,6000000);
  assert.equal(notDue.filtersActive,true,'an aging filter counts as an active filter');
  assert.equal(supplierOutstanding(fixture(),vendors,{asOf:AS_OF}).suppliers[0].agingAmount,0,'no aging filter means no hint');

  assert.deepEqual(supplierOutstanding(fixture(),vendors,{asOf:AS_OF,search:'cloudstack'}).suppliers.map(entry=>entry.id),['s2'],'search reads the name');
  assert.deepEqual(supplierOutstanding(fixture(),vendors,{asOf:AS_OF,search:'VEN-00001'}).suppliers.map(entry=>entry.id),['s1'],'search reads the code');
  assert.deepEqual(supplierOutstanding(fixture(),vendors,{asOf:AS_OF,search:'9876541002'}).suppliers.map(entry=>entry.id),['s2'],'search reads the phone');
  assert.deepEqual(supplierOutstanding(fixture(),vendors,{asOf:AS_OF,search:'keralaoffice.example'}).suppliers.map(entry=>entry.id),['s1'],'search reads the email');

  const state=fixture();
  state.purchaseBills[0].branchId='abc-kochi';
  state.purchaseBills[1].branchId='abc-kochi';
  const branch=supplierOutstanding(state,vendors,{asOf:AS_OF,branch:'abc-kochi'});
  assert.equal(branch.totals.outstanding,3000000,'only the tagged branch is stated');
  assert.deepEqual(branch.branchOptions,['abc-kochi']);
  assert.equal(supplierOutstanding(state,vendors,{asOf:AS_OF,branch:'other'}).suppliers.length,0);
});

test('the subledger reconciles with the accounts payable control account',()=>{
  const report=supplierOutstanding(fixture(),vendors,{asOf:AS_OF});
  const reconciliation=report.reconciliation;
  assert.equal(reconciliation.controlAccount,'2000');
  assert.deepEqual(payableAccounts(fixture()),['2000'],'GST Payable is never mistaken for the payables control');
  assert.equal(reconciliation.control,5900000,'2000 credits less debits from the posted journal only');
  assert.equal(reconciliation.subledgerOutstanding,6500000);
  assert.equal(reconciliation.unallocatedPayments,500000);
  assert.equal(reconciliation.unappliedDebitNotes,100000);
  assert.equal(reconciliation.expected,5900000);
  assert.equal(reconciliation.difference,0);
  assert.equal(reconciliation.reconciled,true);
  assert.equal(report.valid,true,report.checks.filter(check=>!check.ok).map(check=>check.key).join(', '));
  assert.ok(report.checks.length>=10);
});

test('a flagged control account and a configured payable account are both honoured',()=>{
  const state=fixture();
  state.accounts=[...state.accounts,{code:'2001',name:'Sundry Creditors',type:'Liabilities',nature:'Credit',group:'Current Liabilities',active:true,controlAccount:true}];
  assert.deepEqual(payableAccounts(state),['2000','2001']);
  const configured=fixture();
  configured.config={ap:'2000'};
  assert.deepEqual(payableAccounts(configured),['2000']);
});

test('a mismatch between the control account and the subledger is surfaced, never forced away',()=>{
  const state=fixture();
  state.journals.push({id:'j16',date:'2026-09-26',lines:[{account:'5000',debit:100000,credit:0},{account:'2000',debit:0,credit:100000,description:'Purchase on account, no bill'}]});
  const report=supplierOutstanding(state,vendors,{asOf:AS_OF});
  assert.equal(report.reconciliation.control,6000000,'the control carries a payable with no bill behind it');
  assert.equal(report.reconciliation.difference,100000,'the unattributed payable is stated as the difference');
  assert.equal(report.reconciliation.reconciled,false);
  assert.equal(report.valid,false);
  assert.equal(report.checks.find(check=>check.key==='reconciles').ok,false);
  assert.equal(report.totals.outstanding,6500000,'the bill rows still state what is owed');
});

test('every supplier total reconciles with its own bill rows, and unposted documents contribute nothing',()=>{
  const report=supplierOutstanding(fixture(),vendors,{asOf:AS_OF});
  for(const entry of report.suppliers){
    const summed=entry.rows.reduce((total,item)=>total+item.outstanding,0);
    assert.equal(entry.outstanding,summed,`${entry.name} total must equal its bill rows`);
    assert.equal(entry.bills,entry.rows.length);
    assert.equal(AGING_BUCKETS.reduce((total,bucket)=>total+entry.buckets[bucket.key],0),entry.outstanding,`${entry.name} buckets must add up`);
  }
  const draft=fixture();
  draft.journals.push({id:'j17',date:'2026-09-27',status:'Draft',lines:[{account:'2000',debit:900000,credit:0},{account:'1010',debit:0,credit:900000}]});
  assert.equal(supplierOutstanding(draft,vendors,{asOf:AS_OF}).reconciliation.control,5900000,'an unposted journal contributes nothing');
  const late=fixture();
  assert.equal(supplierOutstanding(late,vendors,{asOf:'2026-12-31'}).reconciliation.control,5500000,'a payment dated after the report date is excluded by the as-of narrowing');
});

test('the export carries the scope, the supplier rows, the totals and the bill detail',()=>{
  const report=supplierOutstanding(fixture(),vendors,{asOf:AS_OF});
  const rows=supplierOutstandingExportRows(report,{organisation:'Wayvida Learning'});
  assert.deepEqual(rows[0],['Wayvida Books · Supplier Outstanding','See what you currently owe your suppliers.']);
  assert.ok(rows[1].includes('Wayvida Learning')&&rows[1].includes('Branch'));
  assert.ok(rows[2].includes('As of')&&rows[2].includes(AS_OF));
  assert.deepEqual(rows[6],[],'a blank separator row sits before the column header, as the other reports do');
  assert.deepEqual(rows[7],['Supplier','Supplier ID','Bills','Outstanding INR','Overdue INR','Not Yet Due INR'],'the simplified table is the whole shape of the export, with no aging bucket column');
  const header=rows.findIndex(cells=>cells[0]==='Supplier'&&cells[1]==='Supplier ID');
  const total=rows.find(cells=>cells[0]==='Total');
  assert.equal(total[2],4);
  assert.equal(total[3],65000,'the totals row sums the supplier rows');
  assert.equal(total[4],20000,'the totals row carries the overdue money');
  assert.equal(total[5],40000,'and the not-yet-due money');
  assert.equal(rows.slice(header+1,header+1+report.suppliers.length).every(cells=>typeof cells[3]==='number'),true);
  const billHead=rows.find(cells=>cells[1]==='Bill Number');
  assert.ok(billHead,'the sheet carries the bill-level detail');
  assert.ok(billHead.includes('Vendor Invoice'));
  assert.equal(rows.filter(cells=>cells[1]==='BILL-0001').length,1);
  assert.equal(rows.some(cells=>cells[1]==='BILL-0004'),false,'a draft bill is never exported');
});

test('the export respects the active filters',()=>{
  const report=supplierOutstanding(fixture(),vendors,{asOf:AS_OF,supplier:'s2',status:'Due Today'});
  const rows=supplierOutstandingExportRows(report,{organisation:'Wayvida Learning'});
  assert.equal(report.totals.outstanding,500000);
  const total=rows.find(cells=>cells[0]==='Total');
  assert.equal(total[2],1);
  assert.equal(total[3],5000);
  assert.equal(rows.some(cells=>cells[0]==='Kerala Office Supplies'),false,'a filtered-out supplier is never exported');
  assert.ok(rows.some(cells=>cells[0]==='Cloudstack Services'));
  assert.equal(rows.filter(cells=>cells[1]==='BILL-0003').length,1);
});

test('the page, the sidebar and the reports grid carry the report',()=>{
  const page=readFileSync(new URL('../src/SupplierOutstanding.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/supplier-outstanding.css',import.meta.url),'utf8');
  const secondaryNav=readFileSync(new URL('../src/ReportsSecondaryNav.jsx',import.meta.url),'utf8');
  const navigation=readFileSync(new URL('../src/Navigation.jsx',import.meta.url),'utf8');
  const modules=readFileSync(new URL('../src/OperationalModules.jsx',import.meta.url),'utf8');
  for(const token of ['Supplier Outstanding','See what you currently owe your suppliers.','spoSummary','spoStickyBalance','EmptyState'])assert.ok(page.includes(token),token);
  assert.ok(page.includes('No outstanding supplier balances found.'),'the empty state carries the report wording');
  assert.ok(page.includes('Try changing the date or filters.'),'the empty state offers the filtered hint');
  assert.ok(page.includes("variant=\"customer\""),'the empty state reuses the shared party illustration');
  /* The statement table is exactly six columns and aging is not one of them: it is a filter. */
  const headStart=page.indexOf('<thead><tr><th className="spoNameCol">');
  const tableHead=page.slice(headStart,page.indexOf('</thead>',headStart));
  for(const token of ['Supplier','Supplier ID','Bills','Outstanding','Overdue','Not Yet Due'])assert.ok(tableHead.includes('>'+token+'<'),token);
  assert.equal((tableHead.match(/<th /g)||[]).length,6,'the statement table is exactly six columns');
  assert.ok(!page.includes('spoBucketCol'),'no aging bucket is a permanent column');
  assert.ok(page.includes('aria-label="Aging"')&&!page.includes('aria-label="Aging bucket"'),'aging is a filter named Aging');
  for(const token of ['text-align:right','.spoStickyBalance{position:sticky','.spoCodeCol{display:none}','overflow-x:auto','.spoTableScroll>table{table-layout:fixed}','.spoBillTable{width:100%;min-width:760px'])assert.ok(css.includes(token),token);
  assert.ok(css.includes('.spoStatementCard>.spoTableScroll>table{table-layout:fixed}')&&!css.includes('.spoStatementCard table{table-layout:fixed}'),'the phone statement-table rules stay scoped, so the nested bill table keeps its own layout and scrolls instead of collapsing');
  assert.ok(secondaryNav.includes("label: 'Supplier Outstanding'"),'the secondary nav carries the leaf');
  assert.ok(navigation.includes("active==='Supplier Outstanding'&&createPortal"),'the page is portalled like its siblings');
  assert.ok(modules.includes("['Supplier Outstanding','Payables, overdue balances and aging','Supplier Outstanding']"),'the financial reports grid opens it by name');
  assert.ok(!page.includes('\\u2013'),'the aging headers carry real en dashes, never an escape that would render literally');
});

test('the two outstanding reports are one design, differing only in terminology',()=>{
  const customer=readFileSync(new URL('../src/CustomerOutstanding.jsx',import.meta.url),'utf8');
  const supplier=readFileSync(new URL('../src/SupplierOutstanding.jsx',import.meta.url),'utf8');
  const columns=page=>[...page.matchAll(/<th className="(?:co|spo)(?:NameCol|CodeCol|CountCol|OutCol|DueCol|ActionsCol)">([^<]+)<\/th>/g)].map(match=>match[1]);
  const customerColumns=columns(customer),supplierColumns=columns(supplier).map(label=>label.replace('Supplier','Customer').replace('Bills','Invoices'));
  assert.equal(customerColumns.length,6,'the statement table is exactly six columns');
  assert.deepEqual(supplierColumns,customerColumns,'both reports carry the same six columns in the same order');
  const customerCss=readFileSync(new URL('../src/customer-outstanding.css',import.meta.url),'utf8');
  const supplierCss=readFileSync(new URL('../src/supplier-outstanding.css',import.meta.url),'utf8');
  const rules=css=>[...css.matchAll(/@media\(max-width:(900|700|560)px\)/g)].length;
  assert.equal(rules(customerCss),rules(supplierCss),'both sheets declare the same responsive breakpoints');
});
