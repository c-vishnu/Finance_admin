/* Transaction Register - one read-only index of every business transaction the modules already
   wrote.

   The report answers one question: which business transactions and documents happened? It is a
   document index, not a second accounting report, so it states each transaction ONCE with the
   amount its own document carries. It never touches debit or credit - those lines belong to the Day
   Book, the General Ledger and the Journal register - and it never posts, edits or reverses
   anything. Nothing here recalculates an amount, a status or a balance: every value is read from the
   record the owning engine already stored.

   WHY THE DEDUPLICATION EXISTS. A single business event often leaves two records behind: the
   document (the invoice, the bill, the receipt) and the journal the engine posted for it. Both are
   real, but they are one transaction, so the journal is listed only when no document claims it. The
   documents are collected first, each one naming the journal it posted, and that set of journal ids
   is then used to suppress the accounting rows that would otherwise duplicate them. Manual journals
   are the mirror image: the manual record is the document, so its ledger entry is suppressed through
   its own ledgerJournalId instead. The result is one row per transaction, never two.

   THE STATUS VOCABULARY. A stored status carries detail a list column cannot explain, so every
   document is reduced to the five lifecycle words the register filters and counts by: Draft,
   Pending, Posted, Reversed and Cancelled. Each type contributes its own "is it posted?" rule -
   a receipt is posted only when its status is Posted, a purchase bill only when its posted flag is
   set, a journal when it is Approved - because the same word means different things in different
   modules (Approved is a posting for a journal and a waiting state for a receipt). Nothing is
   invented: the rules below are the ones the owning engines already apply. */

import {invoiceDisplayStatus} from './invoice-register-display.js';
import {journalRecordAmount} from './journal-register-display.js';
import {receiptRows} from './receipt-engine.js';
import {normaliseStatus} from './simple-journal-transaction.js';
/* The transaction types this application's data model actually carries. Every one of them is a
   business document with its own module; a sales or purchase order is deliberately absent, because
   an order is a commitment rather than a transaction and it never reaches the books. */
export const TRANSACTION_TYPES=[
 'Sales Invoice',
 'Credit Note',
 'Customer Receipt',
 'Purchase Bill',
 'Debit Note',
 'Supplier Payment',
 'Expense',
 'Journal',
 'Bank Transaction'
];

/* The lifecycle words the Status filter offers and the summary cards count. */
export const TRANSACTION_STATUSES=['Draft','Pending','Posted','Reversed','Cancelled'];

export const ALL='All';

/* The page each type is opened on, and the sessionStorage handshake that page reads to open the
   named record. A supplier payment has no document page of its own by design - a payment is recorded
   from its posted bill - so it opens the Payments Made register that lists it, with no handshake,
   exactly as the Day Book already opens that collection. Nothing here is a second document page.

   The handshake carries a handoffId that is not always the record's own id: the Banking feed is
   selected by BANK ACCOUNT, so a statement line hands off the account it belongs to rather than the
   line, which the Banking page cannot resolve as a selection. */
export const TRANSACTION_SOURCES={
 'Sales Invoice':{page:'Invoices',handshake:'wayvida-open-invoice'},
 'Credit Note':{page:'Credit Notes',handshake:'wayvida-open-credit'},
 'Customer Receipt':{page:'Payments Received',handshake:'wayvida-open-receipt'},
 'Purchase Bill':{page:'Purchase Bills',handshake:'wayvida-open-bill'},
 'Debit Note':{page:'Debit Notes',handshake:'wayvida-open-debit-note'},
 'Supplier Payment':{page:'Payments Made'},
 'Expense':{page:'Expense Claims',handshake:'wayvida-open-expense'},
 'Journal':{page:'Journal Entries',handshake:'wayvida-open-journal'},
 'Bank Transaction':{page:'Bank Transactions',handshake:'wayvida-open-bank'}
};

const list=(source,key)=>Array.isArray(source&&source[key])?source[key]:[];
const text=value=>String(value==null?'':value).trim();
const minor=value=>{const number=Number(value);return Number.isFinite(number)?Math.round(number):0};
const sum=(rows,key)=>rows.reduce((total,row)=>total+minor(row[key]),0);
const missing='—';

/* The lifecycle of one document, from its stored status and its own module's "is it posted?" rule.
   A cancelled or voided document is dead whatever else it says, a reversed one was posted and then
   corrected, and anything unposted that names a waiting state is pending approval rather than an
   untouched draft. */
function lifecycle(status,posted){
 const raw=text(status);
 if(/^(cancelled|canceled|voided|excluded)$/i.test(raw))return 'Cancelled';
 if(/^reversed$/i.test(raw))return 'Reversed';
 if(posted)return 'Posted';
 if(/^(pending|pending approval|submitted|unmatched)$/i.test(raw))return 'Pending';
 return 'Draft';
}

/* The branch a document belongs to. The document carries it when the working context set one;
   otherwise it is read from the journal the document posted, which is the value the rest of the
   product scopes by. No branch is ever invented. */
const branchIndex=book=>{const map=new Map();for(const journal of list(book,'journals')){const branch=journal.lines?.map(line=>line.branch).find(Boolean)||journal.branch||journal.branchId;if(journal.id&&branch)map.set(journal.id,branch)}return map};

/* One row, in the shape every later step reads: what the document is, who it is with, what it is
   worth, and where it is opened. `party` is a customer for a sale and a supplier for a purchase, so
   the Customer and Supplier filters can each narrow the same column without a second list. */
function row(entry){
 return {
  id:entry.type+':'+entry.recordId,
  recordId:entry.recordId,
  type:entry.type,
  date:text(entry.date),
  number:text(entry.number)||'Not numbered',
  party:text(entry.party),
  partyKind:entry.partyKind||'',
  reference:text(entry.reference),
  description:text(entry.description),
  amount:minor(entry.amount),
  status:entry.status,
  storedStatus:text(entry.storedStatus),
  branch:text(entry.branch),
  handoffId:text(entry.handoffId||entry.recordId),
  page:TRANSACTION_SOURCES[entry.type]?.page||'',
  handshake:TRANSACTION_SOURCES[entry.type]?.handshake||''
 };
}

/* Every transaction, one row each, newest first. The four stores are passed in rather than read
   here so the projection stays pure and can be tested without a browser. */
export function collectTransactions({book={},operations={},banking={},manual=[]}={}){
 const index=branchIndex(book);
 const journalBranch=id=>text(index.get(id));
 const documents=[];
 const represented=new Set();

 const push=(entry,journalId)=>{documents.push(row(entry));if(journalId)represented.add(journalId)};

 /* A sales invoice. Its reference is already the source order number when it was converted from
    one, so no second lookup is needed. */
 for(const invoice of list(book,'invoices'))push({
  type:'Sales Invoice',recordId:invoice.id,date:invoice.date,number:invoice.number,
  party:invoice.customerName,partyKind:'customer',reference:invoice.reference||invoice.sourceOrderNumber,
  description:invoice.notes||invoice.reference,amount:invoice.totals?.total,
  status:lifecycle(invoiceDisplayStatus(invoice),invoice.posted===true),storedStatus:invoiceDisplayStatus(invoice),
  branch:invoice.branch||invoice.branchName||journalBranch(invoice.journalId)
 },invoice.journalId);

 /* A customer receipt. receiptRows() is the receipt module's own reader, so a legacy payment that
    predates the receipts store is stated exactly as the Payments Received register states it. */
 for(const receipt of receipts(book))push({
  type:'Customer Receipt',recordId:receipt.id,date:receipt.date,number:receipt.number||receipt.reference,
  party:receipt.customerName,partyKind:'customer',reference:receipt.reference,
  description:receipt.notes||receipt.mode,amount:receipt.amount,
  status:lifecycle(receipt.status,receipt.status==='Posted'),storedStatus:receipt.status,
  branch:receipt.branch||receipt.branchId||journalBranch(receipt.journalId)
 },receipt.journalId);

 /* A credit note. */
 for(const note of list(book,'creditNotes'))push({
  type:'Credit Note',recordId:note.id,date:note.date,number:note.number,
  party:note.customerName,partyKind:'customer',reference:note.reference,
  description:note.reason||note.notes,amount:note.totals?.total??note.total,
  status:lifecycle(note.status,note.posted===true),storedStatus:note.status,
  branch:note.branch||note.branchName||journalBranch(note.journalId)
 },note.journalId);

 /* A purchase bill. Its stored status is a PAYMENT status - Unpaid, Partially Paid, Paid - so the
    posted flag, not the word, decides the lifecycle. */
 for(const bill of purchaseBills(book))push({
  type:'Purchase Bill',recordId:bill.id,date:bill.date,number:bill.number,
  party:bill.vendorName,partyKind:'supplier',reference:bill.vendorInvoice||bill.reference,
  description:bill.notes||bill.vendorInvoice,amount:bill.total??bill.totals?.total,
  status:lifecycle(bill.status,bill.posted===true),storedStatus:bill.status,
  branch:bill.branch||bill.branchName||journalBranch(bill.journalId)
 },bill.journalId);

 /* A debit note. */
 for(const note of debitNotes(book))push({
  type:'Debit Note',recordId:note.id,date:note.date,number:note.number,
  party:note.vendorName,partyKind:'supplier',reference:note.vendorInvoiceReference||note.reference,
  description:note.reasonDescription||note.reason,amount:note.total??note.totals?.total,
  status:lifecycle(note.status,note.posted===true),storedStatus:note.status,
  branch:note.branch||note.branchName||journalBranch(note.journalId)
 },note.journalId);

 /* A supplier payment. It is posted the moment it is recorded, and its document is the bill it
    settles, so it opens that bill. */
 for(const payment of vendorPayments(book))push({
  type:'Supplier Payment',recordId:payment.id,date:payment.date,number:payment.number,
  party:vendorOf(book,payment.billId),partyKind:'supplier',reference:payment.reference,
  description:'Payment to '+vendorOf(book,payment.billId),amount:payment.amount,
  status:lifecycle(payment.status,true),storedStatus:payment.status,
  branch:payment.branch||journalBranch(payment.journalId)
 },payment.journalId);

 /* An expense claim, which lives in the operations store rather than the accounting book. */
 for(const expense of list(operations,'expenses'))push({
  type:'Expense',recordId:expense.id,date:expense.date,number:expense.number,
  party:expense.payee,partyKind:'supplier',reference:expense.reference||expense.method,
  description:expense.name||expense.category,amount:expense.amount,
  status:lifecycle(expense.status,expense.status==='Posted'),storedStatus:expense.status,
  branch:expense.branch||journalBranch(expense.journalId)
 },expense.journalId);

 /* A manual journal, which is its own document: the record is listed and the ledger entry it
    posted is suppressed through ledgerJournalId, so the two can never both appear. */
 for(const journal of Array.isArray(manual)?manual:[])push({
  type:'Journal',recordId:journal.id,date:journal.date,number:journal.number,
  party:journalParty(journal),partyKind:'',reference:journal.reference,
  description:journal.narration||journal.simpleTransaction?.name||journal.type,
  amount:journalAmount(journal),
  status:lifecycle(journal.status,normaliseStatus(journal.status)==='Approved'),storedStatus:journal.status,
  branch:journal.branchId||journal.lines?.[0]?.branch
 },journal.ledgerJournalId);

 /* A bank statement line. Its status is the banking module's own review state - Unmatched, Matched,
    Categorized, Excluded - which is why the lifecycle is read from that state rather than from a
    posted flag: a categorised line posts, a matched line is accounted for, and an unmatched one is
    still waiting. */
 for(const line of list(banking,'bankTransactions'))push({
  type:'Bank Transaction',recordId:line.id,handoffId:line.bankAccountId||line.id,date:line.date,number:line.reference||line.id,
  party:line.counterparty||'',partyKind:'',reference:line.reference,
  description:line.description,amount:minor(line.debit)||minor(line.credit),
  status:lifecycle(line.status,['Matched','Categorized'].includes(text(line.status))),storedStatus:line.status,
  branch:line.branch||branchOfBankAccount(banking,line.bankAccountId)
 },'');

 /* The accounting journals no document claimed. A journal a document posted is already stated as
    that document, so only the ones left over - opening balances, adjustments, anything posted
    outside a module - appear here, and they are the Journal type. */
 for(const journal of list(book,'journals')){
  if(journal.id&&represented.has(journal.id))continue;
  if(journal.token&&represented.has(journal.token))continue;
  push({
   type:'Journal',recordId:journal.id,date:journal.date,number:journal.number||journal.reference,
   party:'',partyKind:'',reference:journal.reference,
   description:journal.source||journal.narration,
   amount:Math.max(sum(journal.lines||[],'debit'),sum(journal.lines||[],'credit')),
   status:lifecycle(journal.status,journal.status==='Posted'),storedStatus:journal.status,
   branch:journal.branch||journal.branchId||journalBranch(journal.id)
  },'');
 }

 const seen=new Set();
 return documents.filter(entry=>{if(seen.has(entry.id))return false;seen.add(entry.id);return true})
  .sort((left,right)=>right.date.localeCompare(left.date)||left.number.localeCompare(right.number));
}

export function filterTransactions(rows,filters={}){
 const from=text(filters.from),to=text(filters.to),needle=text(filters.search).toLowerCase();
 const type=text(filters.type)||ALL,status=text(filters.status)||ALL,branch=text(filters.branch)||ALL;
 const customer=text(filters.customer)||ALL,supplier=text(filters.supplier)||ALL;
 return rows.filter(entry=>{
  if(from&&entry.date<from)return false;
  if(to&&entry.date>to)return false;
  if(type!==ALL&&entry.type!==type)return false;
  if(status!==ALL&&entry.status!==status)return false;
  if(branch!==ALL&&entry.branch!==branch)return false;
  if(customer!==ALL&&!(entry.partyKind==='customer'&&entry.party===customer))return false;
  if(supplier!==ALL&&!(entry.partyKind==='supplier'&&entry.party===supplier))return false;
  if(!needle)return true;
  return [entry.number,entry.reference,entry.party,entry.description,entry.type]
   .some(value=>text(value).toLowerCase().includes(needle));
 });
}

/* The orderings the Sort control offers. Newest first is the register's own order - the same
   date-then-number order collectTransactions returns - so choosing it changes nothing, and every
   other ordering re-sorts the rows already in hand rather than reading anything again. Document
   number is the tie-breaker everywhere, so two documents dated the same day always keep one stable
   order instead of swapping on each render. */
export const SORT_OPTIONS=[
 {value:'newest',label:'Newest first'},
 {value:'oldest',label:'Oldest first'},
 {value:'amount-desc',label:'Highest amount'},
 {value:'amount-asc',label:'Lowest amount'},
 {value:'number',label:'Document number'}
];

export const DEFAULT_SORT='newest';

const byNumber=(left,right)=>left.number.localeCompare(right.number)||right.date.localeCompare(left.date);

export function sortTransactions(rows,sort=DEFAULT_SORT){
 const list=[...rows];
 if(sort==='oldest')return list.sort((left,right)=>left.date.localeCompare(right.date)||byNumber(left,right));
 if(sort==='amount-desc')return list.sort((left,right)=>right.amount-left.amount||right.date.localeCompare(left.date)||byNumber(left,right));
 if(sort==='amount-asc')return list.sort((left,right)=>left.amount-right.amount||right.date.localeCompare(left.date)||byNumber(left,right));
 if(sort==='number')return list.sort(byNumber);
 return list.sort((left,right)=>right.date.localeCompare(left.date)||byNumber(left,right));
}

/* The four cards the page states. Posted, Draft and Cancelled are the spec's words; Draft covers
   the documents that have not posted yet, including the ones waiting for approval, and Cancelled
   covers the ones that are no longer live, including a reversed posting. Nothing else is counted,
   so the four cards always add up to the total. */
export function summarizeTransactions(rows){
 const total=rows.length;
 return {
  total,
  posted:rows.filter(entry=>entry.status==='Posted').length,
  draft:rows.filter(entry=>entry.status==='Draft'||entry.status==='Pending').length,
  cancelled:rows.filter(entry=>entry.status==='Cancelled'||entry.status==='Reversed').length
 };
}

/* What the register can be narrowed by, derived from the rows themselves so a filter can never offer
   a value no transaction carries. */
export function registerOptions(rows){
 const unique=values=>[...new Set(values.filter(Boolean))].sort();
 return {
  types:unique(rows.map(entry=>entry.type)),
  branches:unique(rows.map(entry=>entry.branch)),
  customers:unique(rows.filter(entry=>entry.partyKind==='customer').map(entry=>entry.party)),
  suppliers:unique(rows.filter(entry=>entry.partyKind==='supplier').map(entry=>entry.party))
 };
}

/* The sheet both exports walk: the report identity, the filters in force, then one line per
   transaction - the same seven columns the page prints. */
export function transactionRegisterExportRows(rows,{organisation='',branch=ALL,from='',to='',filters={},generatedBy='Local user',generatedAt=''}={}){
 const header=['Date','Transaction Type','Document No.','Party / Description','Reference','Amount INR','Status'];
 const applied=Object.entries(filters).filter(([,value])=>value&&value!==ALL).map(([key,value])=>key+': '+value);
 return [
  ['Wayvida Books · Transaction Register','Find and review your business transactions in one place.'],
  ['Organisation',organisation],
  ['Branch',branch===ALL?'All branches':branch],
  ['Date range',(from||'Beginning')+' to '+(to||'Latest')],
  ['Applied filters',applied.length?applied.join(' · '):'None'],
  ['Transactions',rows.length],
  ['Generated by',generatedBy],
  ['Generated at',generatedAt],
  [],
  header,
  ...rows.map(entry=>[entry.date,entry.type,entry.number,entry.party||entry.description||missing,entry.reference||missing,entry.amount/100,entry.status])
 ];
}

/* ---------- Readers for the stores this projection joins ---------- */

/* Receipts and their legacy payments, read through the receipt module's own reader so a payment
   that predates the receipts store is stated exactly as the Payments Received register states it. */
function receipts(book){
 try{return receiptRows(book)}catch{return list(book,'receipts')}
}

function purchaseBills(book){return list(book,'purchaseBills')}
function debitNotes(book){return list(book,'debitNotes')}
function vendorPayments(book){return list(book,'vendorPayments')}
function vendorOf(book,id){return text(list(book,'purchaseBills').find(bill=>bill.id===id)?.vendorName)||missing}
function branchOfBankAccount(banking,id){return text(list(banking,'bankAccounts').find(account=>account.id===id)?.branch)}

/* A manual journal stores its party on the simple-transaction layer, which is where the operator
   named it, and falls back to the ledger party name. */
function journalParty(journal){
 return text(journal.simpleTransaction?.partyName||journal.partyName||journal.party);
}

/* The operator-entered transaction amount when the record carries one, otherwise the larger side of
   its own lines - the same rule the Journal Entries register reads its Amount column by, so the two
   registers can never disagree. */
function journalAmount(journal){
 try{const value=journalRecordAmount(journal);if(value>0)return value}catch{}
 return Math.max(sum(journal.lines||[],'debit'),sum(journal.lines||[],'credit'));
}
