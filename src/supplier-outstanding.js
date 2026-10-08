/* Supplier Outstanding - a read-only payables subledger over the posted accounting records.

   The report answers one question: how much do we owe each supplier as of a date. It is a
   subledger, not a second General Ledger. It never posts, edits or reverses anything, and it never
   re-derives payables from the UI documents: outstanding comes from the records the purchasing
   engine already wrote - the bill's own total, the vendor payments actually tied to that bill, and
   the debit notes actually applied to it. That is the same arithmetic src/purchase-service.js
   `vendorOutstanding()` performs, narrowed to an As-of date so the position is the one that existed
   on the report date rather than today's.

   A payment is never spread across bills by this module. A vendor payment names exactly one bill
   (`vendorPayments[].billId`), so only that bill is reduced. A payment with no bill behind it stays
   identifiable as exactly that - Supplier Advance / Unallocated payment - instead of quietly paying
   down a bill nobody applied it to. */
import {normalizeAccounts} from './account-master.js';
import {today} from './invoice-engine.js';

/* The aging vocabulary. A bucket is a range of DAYS PAST DUE, never a range of bill age: a supplier
   on 30-day terms is not overdue on the day the bill is raised. `notDue` is everything still inside
   its terms and `dueToday` is the day they end, so the payable day is stated on its own rather than
   folded into the bucket behind it. The ranges are contiguous and never overlap - one ends at 30 and
   the next begins at 31 - so no day is counted twice or missed. */
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

/* The bill statuses the report prints and the Status filter accepts, listed the way the filter
   offers them: the open states first, Paid last. Paid wins on money alone; after that the due date
   decides, so a bill past its due date with money still owed is Overdue even when part of it has
   been paid, and Partially Paid is the not-yet-due case. */
export const BILL_STATUSES=['Not Yet Due','Due Today','Overdue','Partially Paid','Paid'];

const ALL='All';
const DAY=86400000;
const sum=(rows,key)=>rows.reduce((total,row)=>total+(Number(row[key])||0),0);
const unique=values=>[...new Set(values.filter(Boolean))];
const money=value=>Number(value)||0;

const dayNumber=value=>{const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));return match?Date.UTC(+match[1],+match[2]-1,+match[3])/DAY:null};

/* Days past due, counted from the DUE date. A null means one of the two dates is unusable, which the
   caller treats as "not due" rather than silently aging a bill from its bill date. */
export function daysPastDue(dueDate,asOf){const due=dayNumber(dueDate),at=dayNumber(asOf);return due===null||at===null?null:Math.round(at-due)}

export function agingBucket(days){
  if(days===null||days<0)return 'notDue';
  if(days===0)return 'dueToday';
  if(days<=30)return 'd1_30';
  if(days<=60)return 'd31_60';
  if(days<=90)return 'd61_90';
  return 'd90plus';
}

/* Where a bill sits: paid, past due, due today, partially paid or not yet due. */
export function billStatus({outstanding,applied,dueDate,asOf}){
  if(money(outstanding)<=0)return 'Paid';
  const days=daysPastDue(dueDate,asOf);
  if(days===null)return 'Not Yet Due';
  if(days>0)return 'Overdue';
  if(days===0)return 'Due Today';
  return money(applied)>0?'Partially Paid':'Not Yet Due';
}

/* The branch a bill, payment or debit note was posted in. The document carries it when the working
   context set one; otherwise the branch is read from the journal the document posted, which is the
   value the rest of the product scopes by. No branch is ever invented. */
const branchIndex=books=>{const map=new Map();for(const journal of books.journals||[]){const branch=(journal.lines||[]).map(line=>line.branch).find(Boolean)||journal.branch||journal.branchId;if(journal.id&&branch)map.set(journal.id,branch)}return map};
const posted=row=>!row?.status||row.status==='Posted';
const postedPayment=row=>row&&row.status==='Posted';
const paidOnOrBefore=(row,asOf)=>!row?.date||String(row.date)<=asOf;
const liveNote=row=>row&&row.posted&&!['Voided','Reversed','Cancelled'].includes(row.status);

/* The Accounts Payable control accounts the Chart of Accounts already describes, plus the payable
   account the accounting configuration names. The Chart of Accounts is the authority: an account
   counts when it is flagged as a control account and reads as a payable or creditor ledger, or when
   its own account nature is the payables nature. No report-specific code list - which is what keeps
   'GST Payable' out of the payables control even though its name contains the word. */
export function payableAccounts(books){
  const named=(books.accounts||[]).filter(account=>{const text=[account.name,account.displayName,account.group].filter(Boolean).join(' ');if(!/payable|creditor/i.test(text))return false;return account.controlAccount===true||account.control===true||account.accountNature==='Accounts Payable'||account.accountNature==='Supplier Payable'});
  const configured=(books.config||{}).ap;
  return unique([...named.map(account=>account.code),configured]);
}

/* The posted AP control balance as of a date, read from the same posted journal every other report
   reads and scoped by the branch the same way the Trial Balance scopes its movement. The balance is
   stated as a payable - credits less debits - so a positive figure is money the company owes. This
   is the number the subledger is checked against, never a number the report writes. */
function controlBalance(books,codes,asOf,branch){
  const wanted=new Set(codes.map(String));
  let balance=0;
  for(const journal of books.journals||[]){
    if(!posted(journal)||String(journal.date||'')>asOf)continue;
    for(const line of journal.lines||[]){
      if(!wanted.has(String(line.account)))continue;
      if(branch!==ALL&&(line.branch||journal.branch||journal.branchId)!==branch)continue;
      balance+=money(line.credit)-money(line.debit);
    }
  }
  return balance;
}

const matchesQuery=(supplier,query)=>{
  if(!query)return true;
  const needle=query.trim().toLowerCase();
  return [supplier.name,supplier.code,supplier.phone,supplier.email].filter(Boolean).some(value=>String(value).toLowerCase().includes(needle));
};

export function supplierOutstanding(state,vendors=[],{asOf=today(),branch=ALL,supplier=ALL,status=ALL,aging=ALL,search=''}={}){
  const books=normalizeAccounts(state||{});
  const asOfDate=String(asOf||'');
  const bills=(books.purchaseBills||[]).filter(bill=>bill.posted&&bill.status!=='Cancelled'&&String(bill.date||'')<=asOfDate);

  /* The settlement records, narrowed to what existed on the report date. A payment or debit note
     dated after the report date has not yet reduced the payable at that date. */
  const payments=(books.vendorPayments||[]).filter(row=>postedPayment(row)&&paidOnOrBefore(row,asOfDate));
  const notes=(books.debitNotes||[]).filter(row=>liveNote(row)&&String(row.date||'')<=asOfDate);

  const allocatedFor=id=>sum(payments.filter(row=>row.billId===id),'amount');
  /* A debit note that has been applied to a bill carries that application in appliedAmount; a note
     that was only issued has not reduced anything yet and stays an available credit. */
  const appliedAmount=note=>money(note.appliedAmount)||money(note.total);
  const creditedFor=id=>notes.filter(row=>row&&row.billId===id&&row.status==='Adjusted').reduce((total,row)=>total+appliedAmount(row),0);

  const index=branchIndex(books);
  const branchOf=row=>row?.branchId||row?.branch||index.get(row?.journalId)||'';
  const branchOptions=unique([...bills.map(branchOf),...payments.map(branchOf)]).sort();
  const inScope=row=>branch===ALL||branchOf(row)===branch;

  const scopedBills=bills.filter(inScope);
  const scopedIds=new Set(scopedBills.map(bill=>bill.id));

  /* One row per posted bill: what was billed, what has actually been applied to it, and what is
     therefore still owed. Outstanding is floored at zero so a supplier never shows a negative
     balance - money paid ahead of a bill is stated as an advance, not as negative debt. The supplied
     vendor invoice number is carried through so the reader can match the bill to the supplier's own
     document. */
  const buildRow=bill=>{
    const total=money(bill.total);
    const paid=allocatedFor(bill.id);
    const creditApplied=creditedFor(bill.id);
    const rawOutstanding=total-paid-creditApplied;
    const outstanding=Math.max(0,rawOutstanding);
    const dueDate=bill.dueDate||bill.date||'';
    const days=daysPastDue(dueDate,asOfDate);
    return {
      id:bill.id,
      number:bill.number||'',
      vendorInvoice:bill.vendorInvoice||'',
      date:bill.date||'',
      dueDate,
      total,
      paid,
      creditApplied,
      outstanding,
      overApplied:Math.max(0,-rawOutstanding),
      daysOverdue:days===null?0:Math.max(0,days),
      bucket:agingBucket(days),
      status:billStatus({outstanding,applied:paid+creditApplied,dueDate,asOf:asOfDate}),
      paymentIds:unique(payments.filter(row=>row.billId===bill.id).map(row=>row.id)),
      debitNoteIds:unique(notes.filter(row=>row&&row.billId===bill.id&&row.status==='Adjusted').map(row=>row.id))
    };
  };

  const allRows=scopedBills.map(buildRow);

  /* What a posted payment or debit note still carries as at the report date. A payment tied to a
     bill that is stated is an allocation, never free money; anything else is money the supplier
     holds without a bill behind it. */
  const billExists=id=>(books.purchaseBills||[]).some(row=>row.id===id);
  const freePayment=row=>{
    if(scopedIds.has(row.billId))return 0;
    return Math.max(0,money(row.amount));
  };
  const isAdvance=row=>!row.billId||!billExists(row.billId);
  const noteAvailable=note=>Math.max(0,money(note.total)-money(note.appliedAmount));

  const master=new Map((vendors||[]).map(row=>[String(row.id),row]));
  const named=id=>master.get(String(id))||{};
  const nameOf=bill=>named(bill.vendorId).name||bill.vendorName||'Unknown supplier';
  const keyOf=bill=>String(bill.vendorId||bill.vendorName||'unknown');

  const bySupplier=new Map();
  for(const bill of scopedBills){
    const key=keyOf(bill),record=named(bill.vendorId);
    if(!bySupplier.has(key))bySupplier.set(key,{
      id:key,
      name:nameOf(bill),
      code:record.code||bill.vendorCode||'',
      phone:record.phone||'',
      email:record.email||'',
      rows:[],outstanding:0,overdue:0,dueToday:0,notYetDue:0,advance:0,unallocated:0,debitNoteAvailable:0,
      buckets:Object.fromEntries(AGING_KEYS.map(bucketKey=>[bucketKey,0]))
    });
    const entry=bySupplier.get(key);
    entry.rows.push(buildRow(bill));
  }

  /* Advances, unallocated payments and unapplied debit notes are read from their own documents, not
     from a bill. */
  for(const payment of payments){
    const entry=bySupplier.get(String(payment.vendorId||''));
    if(!entry||!inScope(payment))continue;
    const free=freePayment(payment);
    if(!free)continue;
    if(isAdvance(payment))entry.advance+=free;else entry.unallocated+=free;
  }
  for(const note of notes){
    const entry=bySupplier.get(String(note.vendorId||''));
    if(!entry||!inScope(note))continue;
    entry.debitNoteAvailable+=noteAvailable(note);
  }

  /* Which of a supplier's bills the report speaks about. The Status filter names them and the
     default is the bills still owed, so a settled bill is stated only when the reader asks for
     Paid. The Aging filter deliberately does NOT narrow this set - it chooses which suppliers are
     listed while the Outstanding column goes on stating that supplier's whole position, so a
     filtered bucket is never mistaken for the balance owed. The reconciliation below is deliberately
     computed on the whole branch scope instead, because that is the only basis on which the AP
     control can be compared. */
  const inStatus=row=>status===ALL?row.outstanding>0:row.status===status;
  const inAging=entry=>aging===ALL||entry.rows.some(row=>row.outstanding>0&&row.bucket===aging);

  const visibleSuppliers=[];
  for(const entry of bySupplier.values()){
    if(supplier!==ALL&&entry.id!==supplier)continue;
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
    visibleSuppliers.push({...entry,rows,bills:rows.length,outstanding,overdue,dueToday,notYetDue,buckets,agingAmount:aging===ALL?0:buckets[aging]});
  }
  visibleSuppliers.sort((a,b)=>b.outstanding-a.outstanding||a.name.localeCompare(b.name));

  const buckets=Object.fromEntries(AGING_KEYS.map(bucketKey=>[bucketKey,visibleSuppliers.reduce((total,entry)=>total+entry.buckets[bucketKey],0)]));
  const totals={
    suppliers:visibleSuppliers.length,
    bills:visibleSuppliers.reduce((total,entry)=>total+entry.bills,0),
    outstanding:visibleSuppliers.reduce((total,entry)=>total+entry.outstanding,0),
    overdue:visibleSuppliers.reduce((total,entry)=>total+entry.overdue,0),
    dueToday:visibleSuppliers.reduce((total,entry)=>total+entry.dueToday,0),
    notYetDue:visibleSuppliers.reduce((total,entry)=>total+entry.notYetDue,0),
    advance:visibleSuppliers.reduce((total,entry)=>total+entry.advance,0),
    unallocated:visibleSuppliers.reduce((total,entry)=>total+entry.unallocated,0),
    debitNoteAvailable:visibleSuppliers.reduce((total,entry)=>total+entry.debitNoteAvailable,0),
    buckets
  };

  /* Reconciliation. The bill subledger nets off only what was applied to a bill; the control account
     already nets off the whole payment and the whole debit note. The difference between the two is
     therefore exactly the money held but not yet applied - an unallocated payment or an unapplied
     debit note - and it is stated, never absorbed. */
  const controlCodes=payableAccounts(books);
  const control=controlCodes.length?controlBalance(books,controlCodes,asOfDate,branch):null;

  const scopeRows=allRows;
  const scopeOutstanding=scopeRows.reduce((total,row)=>total+Math.max(0,row.total-row.paid-row.creditApplied),0);
  const scopeUnallocated=payments.reduce((total,row)=>!inScope(row)?total:total+freePayment(row),0);
  const scopeUnapplied=notes.reduce((total,note)=>!inScope(note)?total:total+noteAvailable(note),0);
  const expected=scopeOutstanding-scopeUnallocated-scopeUnapplied;
  const difference=control===null?null:control-expected;

  const filtersActive=[branch!==ALL,supplier!==ALL,status!==ALL,aging!==ALL,Boolean(search)].some(Boolean);

  const checks=[
    {key:'supplierTotals',ok:visibleSuppliers.reduce((total,entry)=>total+entry.outstanding,0)===totals.outstanding},
    {key:'agingSum',ok:AGING_KEYS.reduce((total,bucketKey)=>total+buckets[bucketKey],0)===totals.outstanding},
    {key:'statusSplit',ok:totals.overdue+totals.dueToday+totals.notYetDue===totals.outstanding},
    {key:'billTotals',ok:visibleSuppliers.reduce((total,entry)=>total+entry.rows.reduce((rowTotal,row)=>rowTotal+row.outstanding,0),0)===totals.outstanding},
    {key:'rowMath',ok:visibleSuppliers.every(entry=>entry.rows.every(row=>row.outstanding===Math.max(0,row.total-row.paid-row.creditApplied)))},
    {key:'noNegative',ok:visibleSuppliers.every(entry=>entry.rows.every(row=>row.outstanding>=0))},
    {key:'bucketIsPastDue',ok:visibleSuppliers.every(entry=>entry.rows.every(row=>row.bucket===agingBucket(daysPastDue(row.dueDate,asOfDate))))},
    {key:'paidHidden',ok:visibleSuppliers.every(entry=>entry.rows.every(row=>row.outstanding>0||status==='Paid'))},
    {key:'noDoubleCount',ok:scopeRows.every(row=>row.paid===allocatedFor(row.id)&&row.creditApplied===creditedFor(row.id))},
    {key:'reconciles',ok:difference===null||difference===0}
  ];

  return {
    asOf:asOfDate,branch,supplier,status,aging,search,
    branchOptions,
    supplierOptions:(vendors||[]).map(row=>({id:String(row.id),name:row.name||'',code:row.code||''})).sort((a,b)=>a.name.localeCompare(b.name)),
    suppliers:visibleSuppliers,
    tables:{supplier:visibleSuppliers},
    totals,
    reconciliation:{controlAccount:controlCodes.join(', ')||'None configured',control,subledgerOutstanding:scopeOutstanding,unallocatedPayments:scopeUnallocated,unappliedDebitNotes:scopeUnapplied,expected,difference,reconciled:difference===null?null:difference===0},
    filtersActive,
    hasActivity:scopeRows.length>0,
    checks,
    valid:checks.every(check=>check.ok)
  };
}

/* The sheet the page and the export both walk: the scope the figures were produced for, then one
   line per supplier with its bill count, outstanding, overdue and not-yet-due money - the same
   five money facts the page prints, with no aging bucket exported as a column - then the totals and
   the bill detail behind them. */
export function supplierOutstandingExportRows(report,context={}){
  const header=['Supplier','Supplier ID','Bills','Outstanding INR','Overdue INR','Not Yet Due INR'];
  const supplierRow=entry=>[entry.name,entry.code,entry.bills,entry.outstanding/100,entry.overdue/100,entry.notYetDue/100];
  const billHeader=['Supplier','Bill Number','Vendor Invoice','Bill Date','Due Date','Bill Amount INR','Amount Paid INR','Debit Note Applied INR','Outstanding INR','Status','Days Overdue'];
  const billRow=(entry,row)=>[entry.name,row.number,row.vendorInvoice,row.date,row.dueDate,row.total/100,row.paid/100,row.creditApplied/100,row.outstanding/100,row.status,row.daysOverdue];
  return [
    ['Wayvida Books · Supplier Outstanding','See what you currently owe your suppliers.'],
    ['Organisation',context.organisation||'', 'Branch',report.branch===ALL?'All branches':report.branch],
    ['As of',report.asOf,'Supplier',report.supplier===ALL?'All suppliers':(report.suppliers.find(entry=>entry.id===report.supplier)?.name||report.supplier)],
    ['Status',report.status===ALL?'All statuses':report.status,'Aging',report.aging===ALL?'All aging buckets':AGING_LABELS[report.aging]||report.aging],
    ['Search',report.search||'None','Documents',report.status===ALL?'Outstanding only':report.status],
    ['Generated by',context.generatedBy||'Local user','Generated at',context.generatedAt||''],
    [],
    header,
    ...report.suppliers.map(supplierRow),
    ['Total','',report.totals.bills,report.totals.outstanding/100,report.totals.overdue/100,report.totals.notYetDue/100],
    [],
    ['Accounts Payable control',report.reconciliation.controlAccount,report.reconciliation.control===null?'':report.reconciliation.control/100],
    ['Subledger outstanding','',report.reconciliation.subledgerOutstanding/100],
    ['Unallocated payments','',report.reconciliation.unallocatedPayments/100],
    ['Unapplied debit notes','',report.reconciliation.unappliedDebitNotes/100],
    ['Expected control balance','',report.reconciliation.expected/100],
    ['Difference','',report.reconciliation.difference===null?'':report.reconciliation.difference/100],
    [],
    billHeader,
    ...report.suppliers.flatMap(entry=>entry.rows.map(row=>billRow(entry,row)))
  ];
}
