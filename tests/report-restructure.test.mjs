import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

import {customerOutstanding} from '../src/customer-outstanding.js';
import {supplierOutstanding} from '../src/supplier-outstanding.js';
import {AGING_BUCKETS,AGING_KEYS,ALL,OVERDUE_KEYS,agingExportRows,customerAging,supplierAging} from '../src/aging.js';
import {JOURNAL_STATUSES,journalReport,journalReportExportRows} from '../src/journal-report.js';

/* The restructure added three read-only projections beside the four report pages that read them: the
   ONE customer/supplier aging grid, the single-account statement, and the line-level journal listing.
   These tests hold the arithmetic each projection states, the empty states it chooses and the
   honesty guards that keep it away from the ledger. */

const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const AS_OF='2026-09-28';
const R=rupees=>Math.round(rupees*100);
const check=(report,key)=>(report.checks.find(item=>item.key===key)||{}).ok;

const account=(code,name,extra={})=>({id:'acct-'+code,code,name,type:'Assets',active:true,isGroup:false,...extra});
const accounts=[
  account('1000','Cash',{group:'Cash and Bank'}),
  account('1010','Bank',{group:'Cash and Bank'}),
  account('1100','Accounts Receivable',{group:'Current Assets',controlAccount:true}),
  account('2000','Accounts Payable',{type:'Liabilities',group:'Current Liabilities',controlAccount:true}),
  account('2100','GST Payable',{type:'Liabilities',group:'Current Liabilities'}),
  account('3000','Opening Balance Equity',{type:'Equity',group:'Equity'}),
  account('4000','Sales',{type:'Income',group:'Operating Income'}),
  account('5000','Purchases',{type:'Expenses',group:'Operating Expenses'})
];
const customers=[{id:'c1',name:'ABC Retail Pvt Ltd',code:'CUS001'},{id:'c2',name:'Northstar Services',code:'CUS002'}];
const vendors=[{id:'s1',name:'Kerala Office Supplies',code:'VEN-00001'},{id:'s2',name:'Cloudstack Services',code:'VEN-00002'}];
const invoice=(id,number,customerId,date,dueDate,total)=>({id,number,customerId,date,dueDate,posted:true,status:'Approved',arAccount:'1100',totals:{total}});
const bill=(id,number,vendorId,date,dueDate,total)=>({id,number,vendorId,date,dueDate,posted:true,status:'Unpaid',payableAccount:'2000',total,paidAmount:0,lines:[]});
const line=(account,debit,credit,description)=>({account,debit,credit,description,branch:'abc-kochi'});
const journal=(id,date,number,source,lines,extra={})=>({id,date,number,reference:number,source,status:'Posted',createdAt:'2026-09-01T00:0'+id.slice(1)+':00.000Z',lines,...extra});
const journals=[
  journal('j0','2026-04-01','OPEN-CASH','Opening Balance',[line('1000',R(1000),0,'Opening cash balance'),line('3000',0,R(1000),'Opening balance equity')]),
  journal('j1','2026-09-04','SINV-1','Sales Invoice',[line('1100',R(1180),0,'Sale to ABC Retail Pvt Ltd'),line('4000',0,R(1000),'Sale to ABC Retail Pvt Ltd'),line('2100',0,R(180),'Output GST')]),
  journal('j2','2026-09-05','RCPT-1','Customer Receipt',[line('1000',R(500),0,'Receipt from ABC Retail Pvt Ltd'),line('1100',0,R(500),'Customer receipt')]),
  journal('j3','2026-09-10','VPAY-1','Vendor Payment',[line('2000',R(250),0,'Payment to Kerala Office Supplies'),line('1010',0,R(250),'Vendor payment')]),
  journal('j4','2026-09-12','CSH-1','Journal Transaction',[line('1000',R(50),0,'Cash moved to the bank'),line('1010',0,R(50),'Cash moved to the bank')]),
  journal('j5','2026-09-15','REV-1','Reversal of SINV-1',[line('4000',R(200),0,'Reversal of a sales invoice'),line('1100',0,R(200),'Reversal of a sales invoice')]),
  journal('j6','2026-09-20','DRAFT-1','Journal Transaction',[line('1000',R(9999),0,'Draft that must never appear')],{status:'Draft'})
];
function fixture(){
  return {version:1,accounts:JSON.parse(JSON.stringify(accounts)),config:{ar:'1100',ap:'2000'},customers,vendors,journals:JSON.parse(JSON.stringify(journals)),
    invoices:[invoice('i1','INV-0001','c1','2026-07-01','2026-07-15',R(9000)),invoice('i2','INV-0002','c1','2026-08-10','2026-09-05',R(3000)),invoice('i3','INV-0003','c2','2026-09-01','2026-09-28',R(500)),invoice('i4','INV-0004','c2','2026-09-20','2026-10-20',R(1000))],
    purchaseBills:[bill('b1','BILL-0001','s1','2026-07-05','2026-07-20',R(4000)),bill('b2','BILL-0002','s2','2026-08-20','2026-09-25',R(2000)),bill('b3','BILL-0003','s1','2026-09-15','2026-10-15',R(1500))],
    receipts:[],receiptAllocations:[],creditNotes:[],creditApplications:[],payments:[],vendorPayments:[],debitNotes:[]};
}
/* The aging grid is reconciled against the AR/AP control account, so its fixture posts the journal
   that backs every invoice and bill: the subledger and the control account then state the same money. */
const agingJournals=[
  journal('a1','2026-07-01','SINV-1','Sales Invoice',[line('1100',R(9000),0,'Sale to ABC Retail Pvt Ltd'),line('4000',0,R(9000),'Sale to ABC Retail Pvt Ltd')]),
  journal('a2','2026-08-10','SINV-2','Sales Invoice',[line('1100',R(3000),0,'Sale to ABC Retail Pvt Ltd'),line('4000',0,R(3000),'Sale to ABC Retail Pvt Ltd')]),
  journal('a3','2026-09-01','SINV-3','Sales Invoice',[line('1100',R(500),0,'Sale to Northstar Services'),line('4000',0,R(500),'Sale to Northstar Services')]),
  journal('a4','2026-09-20','SINV-4','Sales Invoice',[line('1100',R(1000),0,'Sale to Northstar Services'),line('4000',0,R(1000),'Sale to Northstar Services')]),
  journal('p1','2026-07-05','PBILL-1','Purchase Invoice',[line('5000',R(4000),0,'Kerala Office Supplies'),line('2000',0,R(4000),'Kerala Office Supplies')]),
  journal('p2','2026-08-20','PBILL-2','Purchase Invoice',[line('5000',R(2000),0,'Cloudstack Services'),line('2000',0,R(2000),'Cloudstack Services')]),
  journal('p3','2026-09-15','PBILL-3','Purchase Invoice',[line('5000',R(1500),0,'Kerala Office Supplies'),line('2000',0,R(1500),'Kerala Office Supplies')])
];
function agingFixture(){return {...fixture(),journals:JSON.parse(JSON.stringify(agingJournals))}}
const find=(list,id)=>list.find(entry=>entry.id===id);

/* ---------- the shared aging grid ---------- */

test('Customer Aging restates the receivables subledger instead of re-deriving it',()=>{
  const state=agingFixture(),before=JSON.stringify(state);
  const report=customerAging(state,customers,{asOf:AS_OF});
  assert.equal(JSON.stringify(state),before,'the aging grid must not write the accounting state');
  const source=customerOutstanding(state,customers,{asOf:AS_OF});
  assert.deepEqual(AGING_BUCKETS.map(bucket=>bucket.label),['Not Yet Due','Due Today','1–30 Days Overdue','31–60 Days Overdue','61–90 Days Overdue','90+ Days Overdue']);
  assert.deepEqual(AGING_KEYS,['notDue','dueToday','d1_30','d31_60','d61_90','d90plus']);
  assert.deepEqual(OVERDUE_KEYS,['d1_30','d31_60','d61_90','d90plus'],'Not Yet Due and Due Today are inside the terms, never inside the overdue figure');
  assert.equal(report.totals.parties,2);
  assert.equal(report.totals.documents,4);
  assert.equal(report.totals.total,R(13500));
  assert.equal(report.totals.total,source.totals.outstanding,'the grid total is the outstanding report own total');
  assert.equal(report.totals.buckets.notDue,R(1000));
  assert.equal(report.totals.buckets.dueToday,R(500));
  assert.equal(report.totals.buckets.d1_30,R(3000));
  assert.equal(report.totals.buckets.d31_60,0);
  assert.equal(report.totals.buckets.d61_90,R(9000));
  assert.equal(report.totals.buckets.d90plus,0);
  assert.equal(report.totals.overdueAmount,R(12000),'the overdue figure adds the four past-due buckets');
  assert.equal(report.totals.largestLabel,'61–90 Days Overdue');
  assert.equal(report.totals.largestBucket,'d61_90');
  assert.ok(report.checks.every(item=>item.ok),'every stated check holds');
  assert.equal(report.valid,true);
  for(const entry of report.rows){
    assert.equal(AGING_KEYS.reduce((total,key)=>total+entry.buckets[key],0),entry.total,entry.name+' buckets must add up to its own balance');
    assert.equal(find(source.customers,entry.id).outstanding,entry.total,'the party row is the subledger row');
  }
  assert.equal(find(report.rows,'c1').buckets.d61_90,R(9000),'a document is bucketed by DAYS PAST ITS OWN DUE DATE, never by document age');
  assert.equal(find(report.rows,'c2').buckets.notDue,R(1000),'the bucket key is AGING_KEYS own notDue');
  assert.equal(find(report.rows,'c2').notYetDue,R(1000),'the row also states the not-yet-due figure the summary reads');
  assert.equal(find(report.rows,'c2').buckets.dueToday,R(500));
});

test('Supplier Aging ages the payables subledger on exactly the same vocabulary',()=>{
  const state=agingFixture();
  const report=supplierAging(state,vendors,{asOf:AS_OF});
  const source=supplierOutstanding(state,vendors,{asOf:AS_OF});
  assert.equal(report.totals.total,source.totals.outstanding,'the grid total is the outstanding report own total');
  assert.equal(report.totals.parties,2);
  assert.equal(report.totals.documents,3);
  assert.equal(report.totals.total,R(7500));
  assert.equal(report.totals.buckets.notDue,R(1500));
  assert.equal(report.totals.buckets.d1_30,R(2000));
  assert.equal(report.totals.buckets.d61_90,R(4000));
  assert.equal(report.totals.overdueAmount,R(6000));
  assert.ok(report.checks.every(item=>item.ok));
  assert.deepEqual(report.keys,AGING_KEYS,'both sides of the ledger age on the same keys');
  assert.equal(find(report.rows,'s1').buckets.d61_90,R(4000),'a bill past its own due date lands in its own bucket');
});

test('the aging export states the brief columns and money in rupees',()=>{
  const report=customerAging(agingFixture(),customers,{asOf:AS_OF});
  const rows=agingExportRows(report,{organisation:'Wayvida Learning'});
  assert.equal(rows[0][0],'Wayvida Books - Customer Aging','the identity block names the report');
  const header=rows.find(row=>row[0]==='Customer');
  assert.deepEqual(header,['Customer','Customer ID','Invoices','Not Yet Due INR','Due Today INR','1–30 Days Overdue INR','31–60 Days Overdue INR','61–90 Days Overdue INR','90+ Days Overdue INR','Total INR']);
  const total=rows.find(row=>row[0]==='Total');
  assert.deepEqual(total,['Total','',4,1000,500,3000,0,9000,0,13500],'the export states the same column totals the page shows, in rupees');
  const detail=rows.filter(row=>/^INV-0001$/.test(row[1]));
  assert.equal(detail.length,1,'each aged document is listed once');
  assert.equal(detail[0][8],'61–90 Days Overdue','the detail line names the bucket the document fell into');
  assert.equal(detail[0][7],75,'days past the document own due date');
  assert.equal(rows.filter(row=>row[1]==='INV-0004').length,1,'a not-yet-due invoice is still stated, in its own bucket');
});

/* ---------- the journal report ---------- */

test('the Journal Report states one row per posted journal line and never a draft',()=>{
  const state=fixture(),before=JSON.stringify(state);
  const report=journalReport(state);
  assert.equal(JSON.stringify(state),before,'the journal report must not write the accounting state');
  assert.equal(report.rows.length,13,'13 posted lines: the draft contributes nothing at all');
  assert.equal(report.totals.journals,6);
  assert.equal(report.totals.debit,R(3180));
  assert.equal(report.totals.credit,R(3180));
  assert.equal(report.totals.difference,0);
  assert.equal(report.rows.some(row=>row.number==='DRAFT-1'),false,'an unposted draft has no journal line');
  assert.equal(report.journals.some(voucher=>voucher.id==='j6'),false);
  assert.deepEqual(JOURNAL_STATUSES,['Posted','Reversal']);
  assert.ok(report.checks.every(item=>item.ok),'every stated check holds');
  assert.equal(report.valid,true);
  assert.equal(report.rows.find(row=>row.number==='SINV-1').type,'Sales Invoice','the type is the Day Book own transaction type');
  assert.equal(report.rows.find(row=>row.number==='RCPT-1').type,'Receipt');
  assert.equal(report.rows.find(row=>row.number==='VPAY-1').type,'Payment');
  assert.equal(report.rows.find(row=>row.number==='OPEN-CASH').type,'Opening Balance');
  assert.equal(report.rows.find(row=>row.number==='CSH-1').type,'Journal Entry');
});

test('a reversed journal is marked Reversal rather than dropped from the period',()=>{
  const report=journalReport(fixture());
  const reversal=report.rows.filter(row=>row.number==='REV-1');
  assert.equal(reversal.length,2,'the reversal keeps its own two lines');
  assert.ok(reversal.every(row=>row.status==='Reversal'));
  assert.equal(report.rows.filter(row=>row.number==='SINV-1').every(row=>row.status==='Posted'),true);
  const onlyReversals=journalReport(fixture(),{status:'Reversal'});
  assert.equal(onlyReversals.rows.length,2,'the status filter offers the Reversal state');
  assert.equal(journalReport(fixture(),{status:'Posted'}).rows.length,11);
});

test('the journal report proves its own vouchers, including a voucher whose lines share an account',()=>{
  const report=journalReport(fixture());
  for(const key of ['debitsEqualCredits','scopeBalanced','everyVoucherBalanced','voucherTotals','noNegativeAmounts']){
    assert.equal(check(report,key),true,'the whole-journal check '+key+' holds');
  }
  const split={version:1,config:{ar:'1100'},
    accounts:[account('1100','Accounts Receivable',{group:'Current Assets',controlAccount:true}),account('4000','Sales',{type:'Income'})],
    journals:[{id:'x1',date:'2026-09-01',number:'X-1',source:'Sales Invoice',status:'Posted',
      lines:[{account:'1100',debit:R(1000),credit:0},{account:'4000',debit:0,credit:R(600)},{account:'4000',debit:0,credit:R(400)}]}]};
  const repeated=journalReport(split);
  assert.equal(repeated.journals[0].debit,R(1000));
  assert.equal(repeated.journals[0].credit,R(1000));
  assert.equal(check(repeated,'voucherTotals'),true,'a voucher whose lines share an account still proves its own totals');
  assert.equal(check(repeated,'everyVoucherBalanced'),true);
  const scoped=journalReport(fixture(),{account:'1100'});
  assert.equal(scoped.rows.every(row=>row.account==='1100'),true);
  assert.equal(scoped.totals.debit,R(1180));
  assert.equal(scoped.totals.credit,R(700));
  assert.equal(scoped.totals.difference,R(480),'a one-account scope states its own totals, which do not have to tie');
  assert.equal(check(scoped,'everyVoucherBalanced'),true,'the voucher checks do not weaken when one account is picked');
  assert.equal(check(scoped,'voucherTotals'),true);
  assert.equal(check(scoped,'noNegativeAmounts'),true);
});

test('the journal export states a line sheet and a voucher sheet, with money in rupees',()=>{
  const rows=journalReportExportRows(journalReport(fixture()),{organisation:'Wayvida Learning'});
  assert.equal(rows[0][0],'Wayvida Books - Journal Report');
  const headers=rows.filter(row=>row[0]==='Date');
  assert.equal(headers.length,2,'the export states a line sheet and a voucher sheet');
  assert.deepEqual(headers[0],['Date','Journal ID','Voucher','Type','Status','Source','Reference','Account Code','Account','Particulars','Debit INR','Credit INR','Branch']);
  assert.deepEqual(headers[1],['Date','Journal ID','Voucher','Type','Status','Source','Reference','Lines','Debit INR','Credit INR']);
  assert.deepEqual(rows.find(row=>row[0]==='Total'),['Total','','','','','','','','','',3180,3180,''],'the header total states the period debit and credit, in rupees');
  assert.deepEqual(rows.find(row=>row[0]==='Difference'),['Difference','','','','','','','','','',0,'','']);
});

/* ---------- the honesty guards ---------- */

test('no new report projection posts, writes or re-derives a ledger figure',()=>{
  const aging=read('aging.js');
  assert.ok(aging.includes("from './customer-outstanding.js'")&&aging.includes("from './supplier-outstanding.js'"),'the grid restates the two subledgers instead of owning its own arithmetic');
  assert.ok(!/journal\(|command\(|writeAccounts|saveOperations|localStorage/.test(aging),'the grid never posts, writes or reads a store');
  assert.ok(aging.includes('a bucket is a range of DAYS PAST DUE, never a range of document age'),'the module says what a bucket means');
  const journal_=read('journal-report.js');
  assert.ok(journal_.includes("from './daybook-service.js'")&&journal_.includes('transactionType'),'the journal report reuses the Day Book own transaction type');
  assert.ok(!/calculate\(|lineTaxes|invoiceTax/.test(journal_),'the journal listing never calls a tax engine');
  assert.ok(!/writeAccounts|saveOperations|localStorage/.test(journal_),'the journal listing never writes or reads a store');
});

test('the four new pages reuse the shared report shell rather than growing their own',()=>{
  for(const [name,marker] of [['AgingReport.jsx','cbAging'],['JournalReport.jsx','cbJournal']]){
    const page=read(name);
    assert.ok(page.includes("import './cash-banking.css';"),name+' reuses the shared report shell sheet');
    assert.ok(page.includes("import './report-pages.css';"),name+' carries its own column widths only');
    assert.ok(page.includes("import EmptyState from './EmptyState.jsx';"),name+' uses the shared empty state');
    assert.ok(page.includes('excelReport(')&&page.includes('downloadReport('),name+' exports through the shared writer');
    assert.ok(page.includes('window.print()'),name+' prints through the shared browser print path');
    assert.ok(page.includes(marker),name+' states its own shell marker');
    assert.equal(page.includes('className="transactionPortal"'),false,name+' does not declare its own portal');
  }
  for(const [name,kind] of [['CustomerAging.jsx','customer'],['SupplierAging.jsx','supplier']]){
    const page=read(name);
    assert.ok(page.includes("import AgingReport from './AgingReport.jsx';"),name+' is a thin wrapper over the ONE aging page');
    assert.ok(page.includes('kind="'+kind+'"'),name+' picks its own subledger rather than copying the grid');
  }
  assert.ok(read('report-pages.css').includes('@media(max-width:1100px)'),'the new column widths stand down on a narrow viewport');
  assert.equal(read('report-pages.css').includes('.cbPage'),false,'the shell stays owned by cash-banking.css, never redeclared here');
});
