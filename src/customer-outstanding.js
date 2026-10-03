/* Customer Outstanding - a read-only receivables subledger over the posted accounting records.

   The report answers one question: how much does each customer owe us as of a date. It is a
   subledger, not a second General Ledger. It never posts, edits or reverses anything, and it never
   re-derives receivables from the UI documents: outstanding comes from the records the accounting
   engine already wrote - the invoice's own total, the receipt allocations (and the legacy payments)
   actually applied to that invoice, and the credit-note applications actually applied to it. That is
   the same arithmetic src/invoice-engine.js `outstanding()` performs, narrowed to an As-of date so
   the position is the one that existed on the report date rather than today's.

   A receipt is never spread across invoices by this module. Only the allocation records the receipt
   engine wrote are read, so an unallocated or advance receipt stays identifiable as exactly that -
   Customer Advance / Unallocated receipt - instead of quietly paying down an invoice nobody applied
   it to. */
import {normalizeAccounts} from './account-master.js';
import {today} from './invoice-engine.js';

/* The aging vocabulary. A bucket is a range of DAYS PAST DUE, never a range of invoice age: a
   customer on 30-day terms is not overdue on the day it is invoiced. `notDue` is everything still
   inside its terms and `dueToday` is the day they end, so the payable day is stated on its own
   rather than folded into the bucket behind it. The ranges are contiguous and never overlap - one
   ends at 30 and the next begins at 31 - so no day is counted twice or missed. */
export const AGING_BUCKETS=[
  {key:'notDue',label:'Not Yet Due'},
  {key:'dueToday',label:'Due Today'},
  {key:'d1_30',label:'1–30 Days Overdue'},
  {key:'d31_60',label:'31–60 Days Overdue'},
  {key:'d61_90',label:'61–90 Days Overdue'},
  {key:'d90plus',label:'90+ Days Overdue'}
];
export const AGING_KEYS=AGING_BUCKETS.map(bucket=>bucket.key);
export const AGING_LABELS=AGING_BUCKETS.reduce((map,bucket)=>{map[bucket.key]=bucket.label;return map},{});

/* The invoice statuses the report prints and the Status filter accepts, listed the way the filter
   offers them: the open states first, Paid last. Paid wins on money alone; after that the due date
   decides, so an invoice past its due date with money still owed is Overdue even when part of it has
   been paid, and Partially Paid is the not-yet-due case. */
export const INVOICE_STATUSES=['Not Yet Due','Due Today','Overdue','Partially Paid','Paid'];

const ALL='All';
const DAY=86400000;
const sum=(rows,key)=>rows.reduce((total,row)=>total+(Number(row[key])||0),0);
const unique=values=>[...new Set(values.filter(Boolean))];
const money=value=>Number(value)||0;

const dayNumber=value=>{const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));return match?Date.UTC(+match[1],+match[2]-1,+match[3])/DAY:null};

/* Days past due, counted from the DUE date. A null means one of the two dates is unusable, which the
   caller treats as "not due" rather than silently aging an invoice from its invoice date. */
export function daysPastDue(dueDate,asOf){const due=dayNumber(dueDate),at=dayNumber(asOf);return due===null||at===null?null:Math.round(at-due)}

export function agingBucket(days){
  if(days===null||days<0)return 'notDue';
  if(days===0)return 'dueToday';
  if(days<=30)return 'd1_30';
  if(days<=60)return 'd31_60';
  if(days<=90)return 'd61_90';
  return 'd90plus';
}

/* Where an invoice sits: paid, past due, due today, partially paid or not yet due. */
export function invoiceStatus({outstanding,applied,dueDate,asOf}){
  if(money(outstanding)<=0)return 'Paid';
  const days=daysPastDue(dueDate,asOf);
  if(days===null)return 'Not Yet Due';
  if(days>0)return 'Overdue';
  if(days===0)return 'Due Today';
  return money(applied)>0?'Partially Paid':'Not Yet Due';
}

/* The branch an invoice, receipt or credit note was posted in. The document carries it when the
   working context set one; otherwise the branch is read from the journal the document posted, which
   is the value the rest of the product scopes by. No branch is ever invented. */
const branchIndex=books=>{const map=new Map();for(const journal of books.journals||[]){const branch=(journal.lines||[]).map(line=>line.branch).find(Boolean)||journal.branch||journal.branchId;if(journal.id&&branch)map.set(journal.id,branch)}return map};
const posted=row=>!row?.status||row.status==='Posted';
const postedReceipt=row=>row&&row.status==='Posted';
const receivedOnOrBefore=(row,asOf)=>!row?.date||String(row.date)<=asOf;

/* The Accounts Receivable control accounts the Chart of Accounts already marks as control accounts,
   plus the receivable account the accounting configuration names. No report-specific code list. */
export function receivableAccounts(books){
  const named=(books.accounts||[]).filter(account=>(account.controlAccount===true||account.control===true)&&/receivable|debtor/i.test([account.name,account.displayName,account.group].filter(Boolean).join(' ')));
  const configured=(books.config||{}).ar;
  return unique([...named.map(account=>account.code),configured]);
}

/* The posted AR control balance as of a date, read from the same posted journal every other report
   reads and scoped by the branch the same way the Trial Balance scopes its movement. This is the
   number the subledger is checked against, never a number the report writes. */
function controlBalance(books,codes,asOf,branch){
  const wanted=new Set(codes.map(String));
  let balance=0;
  for(const journal of books.journals||[]){
    if(!posted(journal)||String(journal.date||'')>asOf)continue;
    for(const line of journal.lines||[]){
      if(!wanted.has(String(line.account)))continue;
      if(branch!==ALL&&(line.branch||journal.branch||journal.branchId)!==branch)continue;
      balance+=money(line.debit)-money(line.credit);
    }
  }
  return balance;
}

const matchesQuery=(customer,query)=>{
  if(!query)return true;
  const needle=query.trim().toLowerCase();
  return [customer.name,customer.code,customer.phone,customer.email].filter(Boolean).some(value=>String(value).toLowerCase().includes(needle));
};

export function customerOutstanding(state,customers=[],{asOf=today(),branch=ALL,customer=ALL,status=ALL,aging=ALL,search=''}={}){
  const books=normalizeAccounts(state||{});
  const asOfDate=String(asOf||'');
  const invoices=(books.invoices||[]).filter(invoice=>invoice.posted&&invoice.status!=='Cancelled'&&String(invoice.date||'')<=asOfDate);

  /* The allocation records, narrowed to what existed on the report date. A receipt or credit note
     dated after the report date has not yet reduced the receivable at that date. */
  const allocations=(books.receiptAllocations||[]).filter(row=>!row.voided&&receivedOnOrBefore(row,asOfDate));
  const legacy=(books.payments||[]).filter(row=>!row.reversed&&receivedOnOrBefore(row,asOfDate)&&!(books.receipts||[]).some(receipt=>receipt.id===row.id));
  const applications=(books.creditApplications||[]).filter(row=>!row.voided&&receivedOnOrBefore(row,asOfDate));
  const receipts=(books.receipts||[]).filter(row=>postedReceipt(row)&&receivedOnOrBefore(row,asOfDate));
  const notes=(books.creditNotes||[]).filter(row=>row.posted&&row.status!=='Cancelled'&&String(row.date||'')<=asOfDate);

  const allocatedFor=id=>sum(allocations.filter(row=>row.invoiceId===id),'amount')+sum(legacy.filter(row=>row.invoiceId===id),'amount');
  const creditedFor=id=>sum(applications.filter(row=>row.invoiceId===id),'amount');

  const index=branchIndex(books);
  const branchOf=row=>row?.branchId||row?.branch||index.get(row?.journalId)||'';
  const branchOptions=unique([...invoices.map(branchOf),...receipts.map(branchOf)]).sort();
  const inScope=row=>branch===ALL||branchOf(row)===branch;

  const scopedInvoices=invoices.filter(inScope);

  /* One row per posted invoice: what was billed, what has actually been applied to it, and what is
     therefore still owed. Outstanding is floored at zero so a customer never shows a negative
     balance - money paid ahead of an invoice is stated as an advance, not as negative debt. */
  const buildRow=invoice=>{
    const total=money(invoice.totals?.total);
    const paid=allocatedFor(invoice.id);
    const creditApplied=creditedFor(invoice.id);
    const rawOutstanding=total-paid-creditApplied;
    const outstanding=Math.max(0,rawOutstanding);
    const dueDate=invoice.dueDate||invoice.date||'';
    const days=daysPastDue(dueDate,asOfDate);
    return {
      id:invoice.id,
      number:invoice.number||'',
      date:invoice.date||'',
      dueDate,
      total,
      paid,
      creditApplied,
      outstanding,
      overApplied:Math.max(0,-rawOutstanding),
      daysOverdue:days===null?0:Math.max(0,days),
      bucket:agingBucket(days),
      status:invoiceStatus({outstanding,applied:paid+creditApplied,dueDate,asOf:asOfDate}),
      receiptIds:unique([...allocations.filter(row=>row.invoiceId===invoice.id).map(row=>row.receiptId),...legacy.filter(row=>row.invoiceId===invoice.id).map(row=>row.id)]),
      creditNoteIds:unique(applications.filter(row=>row.invoiceId===invoice.id).map(row=>row.creditNoteId))
    };
  };

  const allRows=scopedInvoices.map(buildRow);

  /* Availability as at the report date, so an advance written after it is not counted early. */
  const availableAt=receipt=>{
    if(receipt.status==='Reversed')return 0;
    const used=sum(allocations.filter(row=>row.receiptId===receipt.id),'amount');
    return Math.max(0,money(receipt.amount)-used);
  };
  const noteAvailableAt=note=>{
    const used=sum(applications.filter(row=>row.creditNoteId===note.id),'amount');
    return Math.max(0,money(note.totals?.total)-used);
  };

  const master=new Map((customers||[]).map(row=>[String(row.id),row]));
  const named=id=>master.get(String(id))||{};
  const nameOf=invoice=>named(invoice.customerId).name||invoice.customerName||'Unknown customer';
  const keyOf=invoice=>String(invoice.customerId||invoice.customerName||'unknown');

  const byCustomer=new Map();
  for(const invoice of scopedInvoices){
    const key=keyOf(invoice),master1=named(invoice.customerId);
    if(!byCustomer.has(key))byCustomer.set(key,{
      id:key,
      name:nameOf(invoice),
      code:master1.code||invoice.customerCode||'',
      phone:master1.phone||'',
      email:master1.email||'',
      rows:[],outstanding:0,overdue:0,dueToday:0,notYetDue:0,advance:0,unallocated:0,creditAvailable:0,
      buckets:Object.fromEntries(AGING_KEYS.map(bucketKey=>[bucketKey,0]))
    });
    const entry=byCustomer.get(key);
    entry.rows.push(buildRow(invoice));
  }

  /* Advances and unallocated receipts are read from the receipts themselves, not from an invoice. */
  for(const receipt of receipts){
    const entry=byCustomer.get(String(receipt.customerId||''));
    if(!entry||!inScope(receipt))continue;
    const free=availableAt(receipt);
    if(!free)continue;
    if(receipt.kind==='Advance')entry.advance+=free;else entry.unallocated+=free;
  }
  for(const note of notes){
    const entry=byCustomer.get(String(note.customerId||''));
    if(!entry||!inScope(note))continue;
    entry.creditAvailable+=noteAvailableAt(note);
  }

  /* Which of a customer's invoices the report speaks about. The Status filter names them and the
     default is the invoices still owed, so a settled invoice is stated only when the reader asks for
     Paid. The Aging filter deliberately does NOT narrow this set - it chooses which customers are
     listed while the Outstanding column goes on stating that customer's whole position, so a
     filtered bucket is never mistaken for the balance owed. The reconciliation below is deliberately
     computed on the whole branch scope instead, because that is the only basis on which the AR
     control can be compared. */
  const inStatus=row=>status===ALL?row.outstanding>0:row.status===status;
  const inAging=entry=>aging===ALL||entry.rows.some(row=>row.outstanding>0&&row.bucket===aging);

  const visibleCustomers=[];
  for(const entry of byCustomer.values()){
    if(customer!==ALL&&entry.id!==customer)continue;
    if(!matchesQuery(entry,search))continue;
    if(!inAging(entry))continue;
    const rows=entry.rows.filter(inStatus).sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))||String(a.number).localeCompare(String(b.number),undefined,{numeric:true}));
    if(!rows.length)continue;
    const buckets=Object.fromEntries(AGING_KEYS.map(bucketKey=>[bucketKey,0]));
    let outstanding=0,overdue=0,dueToday=0,notYetDue=0;
    for(const row of rows){
      buckets[row.bucket]+=row.outstanding;
      outstanding+=row.outstanding;
      const days=daysPastDue(row.dueDate,asOfDate);
      if(row.outstanding<=0)continue;
      if(days===null||days<0)notYetDue+=row.outstanding;
      else if(days===0)dueToday+=row.outstanding;
      else overdue+=row.outstanding;
    }
    visibleCustomers.push({...entry,rows,invoices:rows.length,outstanding,overdue,dueToday,notYetDue,buckets,agingAmount:aging===ALL?0:buckets[aging]});
  }
  visibleCustomers.sort((a,b)=>b.outstanding-a.outstanding||a.name.localeCompare(b.name));

  const buckets=Object.fromEntries(AGING_KEYS.map(bucketKey=>[bucketKey,visibleCustomers.reduce((total,entry)=>total+entry.buckets[bucketKey],0)]));
  const totals={
    customers:visibleCustomers.length,
    invoices:visibleCustomers.reduce((total,entry)=>total+entry.invoices,0),
    outstanding:visibleCustomers.reduce((total,entry)=>total+entry.outstanding,0),
    overdue:visibleCustomers.reduce((total,entry)=>total+entry.overdue,0),
    dueToday:visibleCustomers.reduce((total,entry)=>total+entry.dueToday,0),
    notYetDue:visibleCustomers.reduce((total,entry)=>total+entry.notYetDue,0),
    advance:visibleCustomers.reduce((total,entry)=>total+entry.advance,0),
    unallocated:visibleCustomers.reduce((total,entry)=>total+entry.unallocated,0),
    creditAvailable:visibleCustomers.reduce((total,entry)=>total+entry.creditAvailable,0),
    buckets
  };

  /* Reconciliation. The invoice subledger nets off only what was applied to an invoice; the control
     account already nets off the whole receipt and the whole credit note. The difference between the
     two is therefore exactly the money held but not yet applied - an unallocated receipt or an
     unapplied credit note - and it is stated, never absorbed. Advances sit outside the control
     account entirely (they post to a liability), which is why they are reported beside it. */
  const controlCodes=receivableAccounts(books);
  const control=controlCodes.length?controlBalance(books,controlCodes,asOfDate,branch):null;

  const scopeRows=allRows;
  const scopeOutstanding=scopeRows.reduce((total,row)=>total+Math.max(0,row.total-row.paid-row.creditApplied),0);
  const scopeUnallocated=receipts.reduce((total,receipt)=>receipt.kind==='Advance'||!inScope(receipt)?total:total+availableAt(receipt),0);
  const scopeUnapplied=notes.reduce((total,note)=>note.kind==='Advance'||!inScope(note)?total:total+noteAvailableAt(note),0);
  const expected=scopeOutstanding-scopeUnallocated-scopeUnapplied;
  const difference=control===null?null:control-expected;

  const filtersActive=[branch!==ALL,customer!==ALL,status!==ALL,aging!==ALL,Boolean(search)].some(Boolean);

  const checks=[
    {key:'customerTotals',ok:visibleCustomers.reduce((total,entry)=>total+entry.outstanding,0)===totals.outstanding},
    {key:'agingSum',ok:AGING_KEYS.reduce((total,bucketKey)=>total+buckets[bucketKey],0)===totals.outstanding},
    {key:'statusSplit',ok:totals.overdue+totals.dueToday+totals.notYetDue===totals.outstanding},
    {key:'invoiceTotals',ok:visibleCustomers.reduce((total,entry)=>total+entry.rows.reduce((rowTotal,row)=>rowTotal+row.outstanding,0),0)===totals.outstanding},
    {key:'rowMath',ok:visibleCustomers.every(entry=>entry.rows.every(row=>row.outstanding===Math.max(0,row.total-row.paid-row.creditApplied)))},
    {key:'noNegative',ok:visibleCustomers.every(entry=>entry.rows.every(row=>row.outstanding>=0))},
    {key:'bucketIsPastDue',ok:visibleCustomers.every(entry=>entry.rows.every(row=>row.bucket===agingBucket(daysPastDue(row.dueDate,asOfDate))))},
    {key:'paidHidden',ok:visibleCustomers.every(entry=>entry.rows.every(row=>row.outstanding>0||status==='Paid'))},
    {key:'noDoubleCount',ok:scopeRows.every(row=>row.paid===allocatedFor(row.id)&&row.creditApplied===creditedFor(row.id))},
    {key:'reconciles',ok:difference===null||difference===0}
  ];

  return {
    asOf:asOfDate,branch,customer,status,aging,search,
    branchOptions,
    customerOptions:(customers||[]).map(row=>({id:String(row.id),name:row.name||'',code:row.code||''})).sort((a,b)=>a.name.localeCompare(b.name)),
    customers:visibleCustomers,
    tables:{customer:visibleCustomers},
    totals,
    reconciliation:{controlAccount:controlCodes.join(', ')||'None configured',control,subledgerOutstanding:scopeOutstanding,unallocatedReceipts:scopeUnallocated,unappliedCredit:scopeUnapplied,expected,difference,reconciled:difference===null?null:difference===0},
    filtersActive,
    hasActivity:scopeRows.length>0,
    checks,
    valid:checks.every(check=>check.ok)
  };
}

/* The sheet the page and the export both walk: the scope the figures were produced for, then one
   line per customer with its invoice count, outstanding, overdue and not-yet-due money - the same
   five money facts the page prints, with no aging bucket exported as a column - then the totals and
   the invoice detail behind them. */
export function customerOutstandingExportRows(report,context={}){
  const header=['Customer','Customer ID','Invoices','Outstanding INR','Overdue INR','Not Yet Due INR'];
  const customerRow=entry=>[entry.name,entry.code,entry.invoices,entry.outstanding/100,entry.overdue/100,entry.notYetDue/100];
  const invoiceHeader=['Customer','Invoice Number','Invoice Date','Due Date','Invoice Amount INR','Amount Paid INR','Credit Applied INR','Outstanding INR','Status','Days Overdue'];
  const invoiceRow=(entry,row)=>[entry.name,row.number,row.date,row.dueDate,row.total/100,row.paid/100,row.creditApplied/100,row.outstanding/100,row.status,row.daysOverdue];
  return [
    ['Wayvida Books · Customer Outstanding','See what your customers currently owe you.'],
    ['Organisation',context.organisation||'', 'Branch',report.branch===ALL?'All branches':report.branch],
    ['As of',report.asOf,'Customer',report.customer===ALL?'All customers':(report.customers.find(entry=>entry.id===report.customer)?.name||report.customer)],
    ['Status',report.status===ALL?'All statuses':report.status,'Aging',report.aging===ALL?'All aging buckets':AGING_LABELS[report.aging]||report.aging],
    ['Search',report.search||'None','Documents',report.status===ALL?'Outstanding only':report.status],
    ['Generated by',context.generatedBy||'Local user','Generated at',context.generatedAt||''],
    [],
    header,
    ...report.customers.map(customerRow),
    ['Total','',report.totals.invoices,report.totals.outstanding/100,report.totals.overdue/100,report.totals.notYetDue/100],
    [],
    ['Accounts Receivable control',report.reconciliation.controlAccount,report.reconciliation.control===null?'':report.reconciliation.control/100],
    ['Subledger outstanding','',report.reconciliation.subledgerOutstanding/100],
    ['Unallocated receipts','',report.reconciliation.unallocatedReceipts/100],
    ['Unapplied credit notes','',report.reconciliation.unappliedCredit/100],
    ['Expected control balance','',report.reconciliation.expected/100],
    ['Difference','',report.reconciliation.difference===null?'':report.reconciliation.difference/100],
    [],
    invoiceHeader,
    ...report.customers.flatMap(entry=>entry.rows.map(row=>invoiceRow(entry,row)))
  ];
}
