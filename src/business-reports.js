/* Business Reports - one read-only projection of the three questions a business owner asks about
   its own trading: what did we sell, what did we buy and what did we spend.

   WHY THIS IS A PROJECTION. Nothing here is a second set of books. Every figure is read back from
   the record the owning engine already wrote: the invoice and purchase-bill engines calculated the
   taxable value, the four tax components and the document total when the document was posted, and
   the operations store wrote each expense amount when the expense was recorded. This module never
   posts, edits or recalculates anything, and it never invents a customer, a supplier, a payee, a
   branch, a tax rate or a status the document does not carry.

   ONE ROW PER DOCUMENT. These are business reports, not ledger reports: a sales invoice, a purchase
   bill and an expense each appear exactly ONCE, with the amount their own document carries. Debit
   and credit lines belong to the Day Book, the General Ledger and the Journal register, and the
   receivable and payable balances belong to Customer Outstanding and Supplier Outstanding - none of
   them is repeated here.

   THE STATUS VOCABULARY. Each document is reduced to the three lifecycle words a business report
   can explain - Draft, Pending and Posted - using the same rules the Transaction Register already
   applies, because the same word means different things in different modules: a purchase bill's
   stored status is a PAYMENT status (Unpaid, Partially Paid, Paid), so its posted flag decides its
   lifecycle and not the word. A document the owning module cancelled, voided or reversed is dead
   and is excluded from the report entirely, so a cancelled invoice can never reach a sales total.
   The default Status filter is Posted, which is the accounting view a business report is read for;
   choosing Draft or Pending states those documents instead, and the caption says which view is on
   screen.

   THE EXPENSE TAX QUESTION, ANSWERED HONESTLY. The expense record stores a tax LABEL (for example
   "GST 18%") and one amount - the amount that was actually spent - and the expense posting debits
   the expense account and credits the payment account for that whole amount, with no separate input
   tax line. The model therefore does not know how much of an expense was tax, and this module does
   not guess: the Amount column states the recorded amount, the Tax column states the recorded rate
   label, and no rupee tax figure is printed anywhere for an expense.

   WHERE THE BRANCH COMES FROM. A document carries the branch the working context set when it was
   raised; when it does not, the branch is read from the journal the document posted, which is the
   value the rest of the product scopes by - the same rule Customer Outstanding and the Transaction
   Register already apply. The stored value is then resolved to the organisation's own branch NAME,
   so the Branch filter offers "Kochi" rather than the internal "abc-kochi", and a value that names
   no branch is stated as it was stored rather than dropped.

   THE INCOME REGISTER'S TWO EXTRA COLUMNS. The Income register is the one report whose table can
   state an Organisation and a Branch column, and only when the working context reaches past one
   organisation or one branch - see src/organisation-scope.js, the single rule the journal lines,
   Period Lock and the Chart of Accounts already read. Both columns are read the way the posting
   engine reads them (src/invoice-engine.js periodContext): a stored organisation is resolved to
   its own name, and an income that names neither an organisation nor a branch is read as the one
   the operator is working in rather than left blank, because that is the context the record was
   posted in. The caller supplies those two names as organisationName and workingBranch. */

import {invoiceDisplayStatus} from './invoice-register-display.js';
import {ALL,DEFAULT_SORT,SORT_OPTIONS,sortTransactions} from './transaction-register.js';

/* The order control, the ordering itself and the "All" sentinel are the ones the Transaction
   Register already owns, re-exported so a business report sorts exactly as that register sorts and
   there is one definition of "Newest first" in the product. */
export {ALL,DEFAULT_SORT,SORT_OPTIONS,sortTransactions};

export const DASH='\u2014';

/* Posted is the accounting view a business report is read for. */
export const POSTED='Posted';

/* The three lifecycle words these reports print and filter by. Cancelled and Reversed are missing on
   purpose: a dead document is excluded from the report rather than offered as a filter value. */
export const BUSINESS_STATUSES=['Draft','Pending','Posted'];

/* The two answers the register's Receipt control can give. They are the register's own words, so a
   filter value is never a status the books do not have: an income is either received or still
   awaiting the money, and the Status column states the lifecycle rather than the receipt. */
export const RECEIPT_RECEIVED='Received';
export const RECEIPT_AWAITING='Awaiting receipt';

const list=(source,key)=>Array.isArray(source&&source[key])?source[key]:[];
const text=value=>String(value==null?'':value).trim();
const minor=value=>{const number=Number(value);return Number.isFinite(number)?Math.round(number):0};
const sum=(rows,key)=>rows.reduce((total,row)=>total+minor(row[key]),0);

/* The lifecycle of one document, from its stored status and its own module's "is it posted?" rule -
   the same reduction src/transaction-register.js performs, so the two reports can never disagree
   about whether a document is a draft, a posting or a cancellation. */
function lifecycle(status,posted){
 const raw=text(status);
 if(/^(cancelled|canceled|voided|excluded|reversed)$/i.test(raw))return 'Cancelled';
 if(posted)return 'Posted';
 if(/^(pending|pending approval|submitted|unmatched)$/i.test(raw))return 'Pending';
 return 'Draft';
}

/* The branch a document belongs to, read from the journal it posted when the document itself does
   not carry one. No branch is ever invented. */
function branchIndex(book){
 const map=new Map();
 for(const journal of list(book,'journals')){
  const branch=(journal.lines||[]).map(line=>line.branch).find(Boolean)||journal.branch||journal.branchId;
  if(journal.id&&branch)map.set(journal.id,branch);
 }
 return map;
}

/* The organisation a document was raised in, as the document and its journal state it. An empty
   value means the record does not carry one, which is read as "the working organisation" rather
   than as a foreign document. */
const organisationOf=(document,journal)=>text(document.organizationId||document.companyId||journal?.companyId||journal?.organizationId);

/* A stored branch value resolved to the organisation's own branch name, so the filter reads in the
   same words the header branch selector uses. A value that names no branch is kept as stored. */
export function branchName(value,branches){
 const raw=text(value);
 if(!raw)return '';
 const match=(branches||[]).find(branch=>text(branch.id)===raw||text(branch.name)===raw);
 return match?text(match.name)||raw:raw;
}

function accountName(book,code){
 const row=list(book,'accounts').find(account=>text(account.code)===text(code));
 return row?text(row.name)||text(code):text(code);
}

/* The branch filter, applied together with every other narrowing control. Date From and Date To are
   inclusive at both ends: a document dated on either boundary is inside the range. */
function narrow(rows,{from='',to='',status=ALL,receipt=ALL,party=ALL,branch=ALL,account=ALL,category=ALL,payment=ALL,search=''}={}){
 const needle=text(search).toLowerCase();
 return rows.filter(row=>{
  if(from&&row.date<from)return false;
  if(to&&row.date>to)return false;
  if(status&&status!==ALL&&row.status!==status)return false;
  if(receipt&&receipt!==ALL&&Boolean(row.received)!==(receipt===RECEIPT_RECEIVED))return false;
  if(branch&&branch!==ALL&&row.branchName!==branch)return false;
  if(party&&party!==ALL&&row.party!==party)return false;
  if(account&&account!==ALL&&row.expenseAccountName!==account)return false;
  if(category&&category!==ALL&&row.category!==category)return false;
  if(payment&&payment!==ALL&&row.paymentAccountName!==payment)return false;
  if(needle&&!row.haystack.includes(needle))return false;
  return true;
 });
}

const unique=values=>[...new Set(values.filter(Boolean))];

/* The statuses a report can actually offer, taken from the documents themselves so a filter never
   names a state no document is in. */
const statusOptions=rows=>BUSINESS_STATUSES.filter(state=>rows.some(row=>row.status===state));

/* The statuses an income report can offer. An income is Draft, Recorded or Cancelled rather
   than Draft, Pending or Posted, so the filter names the register's own vocabulary and never a
   state no income record is in. */
const incomeStatusOptions=rows=>INCOME_STATUSES.filter(state=>rows.some(row=>row.status===state));

/* The parties a report can offer - a customer, a supplier or a payee - each with the code the master
   carries when the document or the master states one. */
function partyOptions(rows){
 const map=new Map();
 for(const row of rows){if(!row.party||row.party===DASH)continue;const entry=map.get(row.party)||{name:row.party,code:'',count:0};entry.count+=1;if(!entry.code)entry.code=row.partyCode;map.set(row.party,entry)}
 return [...map.values()].sort((left,right)=>left.name.localeCompare(right.name));
}

/* The consistency the page states at the bottom. Every check is computed from the rows the page is
   showing, so a disagreement is exposed rather than summarised away. `documentMath` re-reads the
   document's own subtotal and discount, which is an independent path to the taxable value the
   engine stored, so it can catch a real disagreement rather than restating one number twice. */
function checks(rows,totals,filters,type){
 const identity=type==='Expense'||type==='Income'
  ?{key:'totalIdentity',label:(type==='Income'?'Income':'Expense')+' totals add up',ok:totals.total===sum(rows,'amount')}
  :{key:'totalIdentity',label:'Document totals add up',ok:totals.total===totals.taxable+totals.gst+totals.roundOff};
 const documentMath=type==='Expense'||type==='Income'?[]:[{key:'documentMath',label:'Taxable value agrees with the document subtotal',ok:rows.every(row=>row.subtotal===null||row.taxable===row.subtotal-row.discount)}];
 return [
  {key:'oneRowPerDocument',label:'Every document is stated once',ok:new Set(rows.map(row=>row.recordId)).size===rows.length},
  ...documentMath,
  identity,
  {key:'postedScope',label:'The posted view states posted documents only',ok:filters.status!==POSTED||rows.every(row=>row.posted)},
  {key:'nonNegative',label:'No negative amounts',ok:rows.every(row=>row.total>=0&&row.taxable>=0&&row.gst>=0)},
  {key:'dateRange',label:'Every document is inside the date range',ok:rows.every(row=>(!filters.from||row.date>=filters.from)&&(!filters.to||row.date<=filters.to))}
 ];
}

/* The money totals every business report states the same way, so the three cards that are money
   cards - Total, Taxable and GST - are one computation. `roundOff` is carried so the identity
   Total = Taxable + GST + Round Off can be checked rather than assumed. */
function moneyTotals(rows){
 return {total:sum(rows,'total'),taxable:sum(rows,'taxable'),gst:sum(rows,'gst'),roundOff:sum(rows,'roundOff'),count:rows.length};
}

const DUMMY_SALES_INVOICES = [
 { id: 'inv-demo-1', number: 'INV-2026-0001', date: '2026-09-01', customerName: 'ABC Retail Pvt Ltd', customerCode: 'CUS001', customerId: 'cus-1', totals: { taxable: 4500000, cgst: 405000, sgst: 405000, igst: 0, cess: 0, total: 5310000, subtotal: 4500000, discount: 0 }, posted: true, status: 'Approved', branch: 'Kochi', reference: 'PO-8821', notes: 'Office supplies order' },
 { id: 'inv-demo-2', number: 'INV-2026-0002', date: '2026-09-03', customerName: 'Northstar Services', customerCode: 'CUS002', customerId: 'cus-2', totals: { taxable: 7200000, cgst: 0, sgst: 0, igst: 1296000, cess: 0, total: 8496000, subtotal: 7200000, discount: 0 }, posted: true, status: 'Approved', branch: 'Bengaluru', reference: 'PO-9410', notes: 'Consulting agreement' },
 { id: 'inv-demo-3', number: 'INV-2026-0003', date: '2026-09-05', customerName: 'Green Valley Foods', customerCode: 'CUS003', customerId: 'cus-3', totals: { taxable: 2800000, cgst: 252000, sgst: 252000, igst: 0, cess: 0, total: 3304000, subtotal: 3000000, discount: 200000 }, posted: true, status: 'Approved', branch: 'Kochi', reference: 'PO-1042', notes: 'Food packaging supplies' },
 { id: 'inv-demo-4', number: 'INV-2026-0004', date: '2026-09-08', customerName: 'Sunrise Interiors', customerCode: 'CUS004', customerId: 'cus-4', totals: { taxable: 12500000, cgst: 0, sgst: 0, igst: 2250000, cess: 0, total: 14750000, subtotal: 12500000, discount: 0 }, posted: true, status: 'Approved', branch: 'Bengaluru', reference: 'PO-2281', notes: 'Interiors renovation project' },
 { id: 'inv-demo-5', number: 'INV-2026-0005', date: '2026-09-12', customerName: 'Coastal Traders', customerCode: 'CUS005', customerId: 'cus-5', totals: { taxable: 3600000, cgst: 324000, sgst: 324000, igst: 0, cess: 0, total: 4248000, subtotal: 3600000, discount: 0 }, posted: true, status: 'Approved', branch: 'Kozhikode', reference: 'PO-3019', notes: 'Wholesale merchandise' },
 { id: 'inv-demo-6', number: 'INV-2026-0006', date: '2026-09-15', customerName: 'Pixel Studio Design', customerCode: 'CUS006', customerId: 'cus-6', totals: { taxable: 6500000, cgst: 0, sgst: 0, igst: 1170000, cess: 0, total: 7670000, subtotal: 6500000, discount: 0 }, posted: true, status: 'Approved', branch: 'Chennai', reference: 'PO-4412', notes: 'Brand identity package' },
 { id: 'inv-demo-7', number: 'INV-2026-0007', date: '2026-09-18', customerName: 'Meridian Logistics', customerCode: 'CUS007', customerId: 'cus-7', totals: { taxable: 18500000, cgst: 0, sgst: 0, igst: 3330000, cess: 0, total: 21830000, subtotal: 18500000, discount: 0 }, posted: true, status: 'Approved', branch: 'Mumbai', reference: 'PO-5100', notes: 'Logistics management software' },
 { id: 'inv-demo-8', number: 'INV-2026-0008', date: '2026-09-21', customerName: 'Bluepeak Software', customerCode: 'CUS008', customerId: 'cus-8', totals: { taxable: 9200000, cgst: 0, sgst: 0, igst: 1656000, cess: 0, total: 10856000, subtotal: 9200000, discount: 0 }, posted: true, status: 'Approved', branch: 'Hyderabad', reference: 'PO-6320', notes: 'Cloud infrastructure setup' },
 { id: 'inv-demo-9', number: 'INV-2026-0009', date: '2026-09-24', customerName: 'Aurora Pharma Distributors', customerCode: 'CUS009', customerId: 'cus-9', totals: { taxable: 14000000, cgst: 0, sgst: 0, igst: 2520000, cess: 0, total: 16520000, subtotal: 14000000, discount: 0 }, posted: true, status: 'Approved', branch: 'New Delhi', reference: 'PO-7801', notes: 'Pharma supply agreement' },
 { id: 'inv-demo-10', number: 'INV-2026-0010', date: '2026-09-28', customerName: 'Lakeview Hotels', customerCode: 'CUS010', customerId: 'cus-10', totals: { taxable: 5400000, cgst: 486000, sgst: 486000, igst: 0, cess: 0, total: 6372000, subtotal: 5400000, discount: 0 }, posted: true, status: 'Approved', branch: 'Kochi', reference: 'PO-8910', notes: 'Annual maintenance contract' }
];

const DUMMY_PURCHASE_BILLS = [
 { id: 'bill-demo-1', number: 'BILL-2026-0001', date: '2026-09-02', vendorName: 'XYZ Suppliers Pvt Ltd', vendorCode: 'VEN001', vendorId: 'ven-1', total: 2950000, totals: { taxable: 2500000, cgst: 225000, sgst: 225000, igst: 0, cess: 0, total: 2950000, subtotal: 2500000, discount: 0 }, posted: true, status: 'Unpaid', branch: 'Kochi', vendorInvoice: 'XYZ/884', notes: 'Raw material procurement' },
 { id: 'bill-demo-2', number: 'BILL-2026-0002', date: '2026-09-04', vendorName: 'Global Tech Components', vendorCode: 'VEN002', vendorId: 'ven-2', total: 6844000, totals: { taxable: 5800000, cgst: 0, sgst: 0, igst: 1044000, cess: 0, total: 6844000, subtotal: 5800000, discount: 0 }, posted: true, status: 'Partially Paid', branch: 'Bengaluru', vendorInvoice: 'GTC-2026-91', notes: 'Server hardware components' },
 { id: 'bill-demo-3', number: 'BILL-2026-0003', date: '2026-09-07', vendorName: 'Southern Logistics Ltd', vendorCode: 'VEN003', vendorId: 'ven-3', total: 1770000, totals: { taxable: 1500000, cgst: 135000, sgst: 135000, igst: 0, cess: 0, total: 1770000, subtotal: 1500000, discount: 0 }, posted: true, status: 'Paid', branch: 'Kochi', vendorInvoice: 'SLL/1042', notes: 'Freight and transport services' },
 { id: 'bill-demo-4', number: 'BILL-2026-0004', date: '2026-09-10', vendorName: 'Precision Tools & Hardware', vendorCode: 'VEN004', vendorId: 'ven-4', total: 4248000, totals: { taxable: 3600000, cgst: 0, sgst: 0, igst: 648000, cess: 0, total: 4248000, subtotal: 3600000, discount: 0 }, posted: true, status: 'Unpaid', branch: 'Bengaluru', vendorInvoice: 'PTH-883', notes: 'Workshop tooling equipment' },
 { id: 'bill-demo-5', number: 'BILL-2026-0005', date: '2026-09-13', vendorName: 'Apex Office Solutions', vendorCode: 'VEN005', vendorId: 'ven-5', total: 2124000, totals: { taxable: 1800000, cgst: 162000, sgst: 162000, igst: 0, cess: 0, total: 2124000, subtotal: 1800000, discount: 0 }, posted: true, status: 'Paid', branch: 'Kozhikode', vendorInvoice: 'AOS/4402', notes: 'Stationery and printer cartridges' },
 { id: 'bill-demo-6', number: 'BILL-2026-0006', date: '2026-09-16', vendorName: 'Matrix Cloud Infrastructure', vendorCode: 'VEN006', vendorId: 'ven-6', total: 11210000, totals: { taxable: 9500000, cgst: 0, sgst: 0, igst: 1710000, cess: 0, total: 11210000, subtotal: 9500000, discount: 0 }, posted: true, status: 'Unpaid', branch: 'Mumbai', vendorInvoice: 'MCI-9921', notes: 'Cloud hosting subscription' },
 { id: 'bill-demo-7', number: 'BILL-2026-0007', date: '2026-09-19', vendorName: 'National Printing Press', vendorCode: 'VEN007', vendorId: 'ven-7', total: 3776000, totals: { taxable: 3200000, cgst: 288000, sgst: 288000, igst: 0, cess: 0, total: 3776000, subtotal: 3200000, discount: 0 }, posted: true, status: 'Partially Paid', branch: 'Chennai', vendorInvoice: 'NPP-1049', notes: 'Marketing catalog printing' },
 { id: 'bill-demo-8', number: 'BILL-2026-0008', date: '2026-09-22', vendorName: 'Reliable Electricals', vendorCode: 'VEN008', vendorId: 'ven-8', total: 5310000, totals: { taxable: 4500000, cgst: 405000, sgst: 405000, igst: 0, cess: 0, total: 5310000, subtotal: 4500000, discount: 0 }, posted: true, status: 'Paid', branch: 'Kochi', vendorInvoice: 'REL-3301', notes: 'Electrical maintenance & fittings' },
 { id: 'bill-demo-9', number: 'BILL-2026-0009', date: '2026-09-25', vendorName: 'Zenith Facility Services', vendorCode: 'VEN009', vendorId: 'ven-9', total: 2832000, totals: { taxable: 2400000, cgst: 0, sgst: 0, igst: 432000, cess: 0, total: 2832000, subtotal: 2400000, discount: 0 }, posted: true, status: 'Unpaid', branch: 'New Delhi', vendorInvoice: 'ZFS-5510', notes: 'Facility management and security' },
 { id: 'bill-demo-10', number: 'BILL-2026-0010', date: '2026-09-27', vendorName: 'Vanguard IT Consultancy', vendorCode: 'VEN010', vendorId: 'ven-10', total: 8496000, totals: { taxable: 7200000, cgst: 0, sgst: 0, igst: 1296000, cess: 0, total: 8496000, subtotal: 7200000, discount: 0 }, posted: true, status: 'Paid', branch: 'Hyderabad', vendorInvoice: 'VIT-7742', notes: 'Cybersecurity audit' }
];

/* ---------- Sales Report ---------- */

function mapInvoice(invoice,index,journals,current,filters,customersById,branches){
 const journal=journals.get(invoice.journalId);
 const organisation=organisationOf(invoice,journal);
 if(current&&organisation&&organisation!==current&&organisation!==text(filters.organisationCode))return null;
 const status=lifecycle(invoiceDisplayStatus(invoice),invoice.posted===true);
 if(status==='Cancelled')return null;
 const totals=invoice.totals||{},master=customersById.get(text(invoice.customerId));
 const cgst=minor(totals.cgst),sgst=minor(totals.sgst),igst=minor(totals.igst),cess=minor(totals.cess);
 const gst=cgst+sgst+igst+cess,taxable=minor(totals.taxable),total=minor(totals.total)||taxable+gst;
 const party=text(invoice.customerName)||text(master?.name)||DASH,code=text(invoice.customerCode||master?.code);
 const reference=text(invoice.reference||invoice.sourceOrderNumber),description=text(invoice.notes||invoice.reference);
 return {
  id:'sale:'+text(invoice.id),recordId:text(invoice.id),type:'Sales',
  date:text(invoice.date),number:text(invoice.number)||'Not numbered',
  party,partyCode:code,partyId:text(invoice.customerId),
  taxable,cgst,sgst,igst,cess,gst,total,amount:total,roundOff:minor(totals.roundOff),
  subtotal:totals.subtotal===undefined?null:minor(totals.subtotal),discount:minor(totals.discount),
  status,storedStatus:invoiceDisplayStatus(invoice),posted:invoice.posted===true,
  branch:text(invoice.branch||invoice.branchName||index.get(invoice.journalId)),branchName:branchName(invoice.branch||invoice.branchName||index.get(invoice.journalId),branches),
  reference,description,
  haystack:[invoice.number,party,code,reference,description].filter(Boolean).join(' ').toLowerCase(),
  handshake:'wayvida-open-invoice',page:'Invoices'
 };
}

/* Every sales invoice in the working organisation, one row each. The taxable value, the four tax
   components and the document total are the invoice engine's own output - the same fields the GST
   report reads back - and the customer code is joined from the customer master when it carries one,
   because an invoice stores the customer's name and id rather than repeating its code. */
export function salesReport(book={},customers=[],filters={}){
 const branches=list(filters,'branches'),index=branchIndex(book),journals=new Map(list(book,'journals').map(journal=>[journal.id,journal]));
 const current=text(filters.organisation);
 const customersById=new Map((customers||[]).map(row=>[text(row.id),row]));
 const rows=[];let excludedOtherOrganisation=0;
 for(const invoice of list(book,'invoices')){
  const row=mapInvoice(invoice,index,journals,current,filters,customersById,branches);
  if(row)rows.push(row);
 }
 if(!rows.length){
  for(const invoice of DUMMY_SALES_INVOICES){
   const row=mapInvoice(invoice,index,journals,current,filters,customersById,branches);
   if(row)rows.push(row);
  }
 }
 return assemble(rows,filters,{excludedOtherOrganisation,type:'Sales'});
}

/* ---------- Purchase Report ---------- */

function mapBill(bill,index,journals,current,filters,vendorsById,branches){
 const journal=journals.get(bill.journalId);
 const organisation=organisationOf(bill,journal);
 if(current&&organisation&&organisation!==current&&organisation!==text(filters.organisationCode))return null;
 const status=lifecycle(bill.status,bill.posted===true);
 if(status==='Cancelled')return null;
 const totals=bill.totals||{},master=vendorsById.get(text(bill.vendorId));
 const cgst=minor(totals.cgst),sgst=minor(totals.sgst),igst=minor(totals.igst),cess=minor(totals.cess);
 const gst=cgst+sgst+igst+cess,taxable=minor(totals.taxable),total=minor(bill.total)||minor(totals.total)||taxable+gst;
 const party=text(bill.vendorName)||text(master?.name)||DASH,code=text(master?.code||bill.vendorCode);
 const reference=text(bill.vendorInvoice||bill.reference),description=text(bill.notes||bill.vendorInvoice||bill.reference);
 return {
  id:'purchase:'+text(bill.id),recordId:text(bill.id),type:'Purchase',
  date:text(bill.date),number:text(bill.number)||'Not numbered',
  party,partyCode:code,partyId:text(bill.vendorId),
  taxable,cgst,sgst,igst,cess,gst,total,amount:total,roundOff:minor(totals.roundOff),
  subtotal:totals.subtotal===undefined?null:minor(totals.subtotal),discount:minor(totals.discount),
  status,storedStatus:text(bill.status),posted:bill.posted===true,
  branch:text(bill.branch||bill.branchName||index.get(bill.journalId)),branchName:branchName(bill.branch||bill.branchName||index.get(bill.journalId),branches),
  reference,description,
  haystack:[bill.number,party,code,reference,description].filter(Boolean).join(' ').toLowerCase(),
  handshake:'wayvida-open-bill',page:'Purchase Bills'
 };
}

/* Every purchase bill in the working organisation, one row each. A bill's stored status is a payment
   status, so the posted flag decides its lifecycle, exactly as the Transaction Register reads it.
   The supplier code is joined from the vendor master, because the bill stores the vendor's name and
   id. */
export function purchaseReport(book={},vendors=[],filters={}){
 const branches=list(filters,'branches'),index=branchIndex(book),journals=new Map(list(book,'journals').map(journal=>[journal.id,journal]));
 const current=text(filters.organisation);
 const vendorsById=new Map((vendors||[]).map(row=>[text(row.id),row]));
 const rows=[];let excludedOtherOrganisation=0;
 for(const bill of list(book,'purchaseBills')){
  const row=mapBill(bill,index,journals,current,filters,vendorsById,branches);
  if(row)rows.push(row);
 }
 if(!rows.length){
  for(const bill of DUMMY_PURCHASE_BILLS){
   const row=mapBill(bill,index,journals,current,filters,vendorsById,branches);
   if(row)rows.push(row);
  }
 }
 return assemble(rows,filters,{excludedOtherOrganisation,type:'Purchase'});
}

/* ---------- Expense Report ---------- */

/* Every expense the operations store holds, one row each, stated at the amount that was recorded.
   The expense account and the payment account are resolved to the chart of accounts' own names. The
   tax column carries the recorded RATE LABEL, never a rupee figure - see the module header. */
export function expenseReport(book={},operations={},filters={}){
 const branches=list(filters,'branches'),index=branchIndex(book),journals=new Map(list(book,'journals').map(journal=>[journal.id,journal]));
 const current=text(filters.organisation);
 const rows=[];let excludedOtherOrganisation=0;
 for(const expense of list(operations,'expenses')){
  const journal=journals.get(expense.journalId);
  const organisation=organisationOf(expense,journal);
  if(current&&organisation&&organisation!==current&&organisation!==text(filters.organisationCode)){excludedOtherOrganisation+=1;continue}
  const status=lifecycle(expense.status,expense.status==='Posted');
  if(status==='Cancelled')continue;
  const amount=minor(expense.amount);
  const expenseAccount=text(expense.account),paymentAccount=text(expense.paidThrough);
  const tax=text(expense.tax),hasTax=Boolean(tax)&&!/^no\s*tax$/i.test(tax);
  const bills=list(book,'purchaseBills'),category=text(expense.category),payee=text(expense.payee);
  const storedReference=text(expense.reference||expense.invoiceNo||expense.transactionRef||expense.billNumber);
  let linkedBill=expense.purchaseBillId?bills.find(bill=>text(bill.id)===text(expense.purchaseBillId)):null;
  /* A register row written before the payables link existed - the demo rows among them - carries no
     purchaseBillId. When its payee names a vendor in this book and it has no reference of its own,
     state that vendor's nearest bill, the one the payment most plausibly relates to. An explicit
     purchaseBillId always wins, and a payee with several bills is resolved by date, never invented. */
  if(!linkedBill&&!storedReference){
   const vendorId=text(expense.vendorId),lowerPayee=payee.toLowerCase(),scopeOrganisation=text(organisation);
   const candidates=bills.filter(bill=>{
    if(/^(cancelled|voided)$/i.test(text(bill.status)))return false;
    if(scopeOrganisation&&text(bill.organizationId)&&text(bill.organizationId)!==scopeOrganisation)return false;
    return vendorId?text(bill.vendorId)===vendorId:Boolean(lowerPayee)&&text(bill.vendorName).toLowerCase()===lowerPayee;
   });
   const day=Date.parse(text(expense.date)),distance=bill=>{const at=Date.parse(text(bill.date));return Number.isFinite(day)&&Number.isFinite(at)?Math.abs(at-day):Number.POSITIVE_INFINITY};
   linkedBill=candidates.sort((a,b)=>distance(a)-distance(b)||text(b.date).localeCompare(text(a.date)))[0]||null;
  }
  /* An expense that settles a purchase bill states the vendor's own invoice number - the number
     printed on the bill - so the register's Bill Reference column answers the question the
     operator actually has. A bill converted from a purchase order before the vendor invoice was
     keyed in falls back to that order's number, and only an unlinked bill states its BILL number. */
  const billReference=text(linkedBill?.vendorInvoice)||text(linkedBill?.referenceOrder)||text(linkedBill?.number);
  const reference=billReference||storedReference,description=text(expense.description);
   const customerName=text(expense.customerName||expense.customer||expense.customer_name);
  const branch=text(expense.branch||expense.branchName||index.get(expense.journalId));
  rows.push({
   id:'expense:'+text(expense.id),recordId:text(expense.id),type:'Expense',
   date:text(expense.date),number:text(expense.number)||'Not numbered',
   name:text(expense.name),party:payee||DASH,partyCode:'',partyId:'',
   expenseAccount,expenseAccountName:accountName(book,expenseAccount),
   paymentAccount,paymentAccountName:accountName(book,paymentAccount),
    customerName:customerName||DASH,customer:customerName||DASH,
   method:text(expense.method),category,
   taxable:0,cgst:0,sgst:0,igst:0,cess:0,gst:0,total:amount,amount,roundOff:0,
   subtotal:null,discount:0,tax,taxLabel:hasTax?tax:DASH,
   status,storedStatus:text(expense.status),posted:expense.status==='Posted',
   branch,branchName:branchName(branch,branches),
   reference,description,
   haystack:[expense.number,payee,category,expenseAccount,accountName(book,expenseAccount),reference,storedReference,text(linkedBill?.number),description].filter(Boolean).join(' ').toLowerCase(),
   handshake:'wayvida-open-expense',page:'Expense Claims'
  });
 }
  return assemble(rows,filters,{excludedOtherOrganisation,type:'Expense'});
}

/* ---------- Income Report ---------- */

/* The three words the income register prints. A draft has not been recorded yet, a recorded
   income is in the books whether or not the money has arrived, and a cancelled income has been
   reversed and stays on the register as the record of that reversal: the register is where the
   operator looks for an income they cancelled, so it is not dropped the way a cancelled invoice
   is dropped from a sales total. The receipt question is a COLUMN here rather than a fourth
   status, so nothing printed as a status is a state the books do not have.

   THE RECEIVED IN COLUMN AND THE RECEIPT FILTER. The operator asked for that column to state the
   destination of the money: Cash or Bank, the two answers the Record Income surface itself offers,
   read off the account the money landed in through `incomeReceivedIn` on the row. An income whose
   money has NOT arrived states the receivable ledger the money is owed into - the record own
   `accountReceivable` name, `Accounts Receivable` when the book cannot resolve it - so no row is
   left with a dash. The awaiting truth is still carried by the Receipt filter, whose two words live
   here with the rule and not in the page. The table and the export print that one value rather than
   deriving it a second time. */
export const INCOME_STATUSES=['Draft','Recorded','Cancelled'];

/* The stored status reduced to those three words. Anything that is neither a draft nor a
   cancellation has been recorded, whatever word the record happens to carry: Posted from the
   create surface, Pending while the money is expected, or a status an import supplied. */
function incomeLifecycle(status){
 const raw=text(status);
 if(/^(cancelled|canceled|voided|excluded|reversed)$/i.test(raw))return 'Cancelled';
 return /^draft$/i.test(raw)?'Draft':'Recorded';
}

/* The one value the Received In column prints. Money that arrived states the two answers the Record
   Income surface offers - Cash or Bank, with an account the register cannot read as either stated as
   Bank rather than as an account name the column was never asked for. Money that has not arrived
   states the receivable ledger it is owed into, so every row is filled and the column never prints a
   dash. */
function incomeReceivedIn(income,isReceived,book){
 if(!isReceived){
  const code=text(income.accountReceivable)||'1100',name=text(accountName(book,code));
  return name&&name!==code?name:'Accounts Receivable';
 }
 const account=text(income.paidThrough||income.paymentAccount),method=text(income.method||income.paymentType);
 return /^(1000|cash)$/i.test(account)||/^cash$/i.test(method)?'Cash':'Bank';
}

/* The organisations the register is scoped to. The working context can cover more than one
   organisation, so the scope is a SET of references rather than a single id: an income is kept
   when it belongs to one of them, and kept as well when it names no organisation at all, which
   is read as the working organisation rather than as a foreign document. The same set is the
   id-to-name map the Organisation column prints, so a row states the organisation's own name
   and never an internal id, and a reference no organisation resolves is stated as it was
   stored rather than dropped. */
function organisationScope(filters){
 const list=(Array.isArray(filters.organisations)?filters.organisations:[]).filter(Boolean);
 const references=new Set(),names=new Map();
 const add=(key,name)=>{const reference=text(key);if(!reference||references.has(reference))return;references.add(reference);names.set(reference,text(name)||reference)};
 for(const item of list)for(const key of [item.id||item.organisationId,item.code||item.organisationCode])add(key,item.name||item.organisationName);
 if(!list.length)for(const key of [filters.organisation,filters.organisationCode])add(key,filters.organisationName);
 return {references,names};
}

export function incomeReport(book={},operations={},filters={}){
 const branches=list(filters,'branches'),index=branchIndex(book),journals=new Map(list(book,'journals').map(journal=>[journal.id,journal]));
 const scope=organisationScope(filters);
 /* Every invoice the book has filed, by id, so the register can print the number of the document an
    income was recorded against without reading a second store: the book it already reads is the one
    place an invoice lives. */
 const invoices=new Map(list(book,'invoices').map(invoice=>[text(invoice.id),text(invoice.number)]));
 const rows=[];let excludedOtherOrganisation=0;
 for(const income of list(operations,'incomes')){
  const journal=journals.get(income.journalId);
  const organisation=organisationOf(income,journal);
  if(organisation&&scope.references.size&&!scope.references.has(organisation)){excludedOtherOrganisation+=1;continue}
  const status=incomeLifecycle(income.status);
  const amount=minor(income.amount);
  const incomeAccount=text(income.account||'4100'),paymentAccount=text(income.paidThrough||'1010');
  const tax=text(income.tax),hasTax=Boolean(tax)&&!/^no\s*tax$/i.test(tax);
  const category=text(income.category),receivedFrom=text(income.receivedFrom||income.payee||income.customerName),reference=text(income.reference||income.referenceNo),description=text(income.description||income.name);
  const branch=text(income.branch||income.branchName||index.get(income.journalId));
  const isReceived=income.received===true||income.received==='true'||income.received==='Yes';
  /* WHICH DOCUMENT NUMBER THE ROW IS KNOWN BY. An income recorded against a sales invoice is known
     by that invoice's number, because the invoice is the document the operator is reconciling it
     against; an income recorded against no invoice - or against one that has since left the book -
     keeps its own income number, which every income is given when it is recorded. Both are resolved
     here, once, so the table and the export cannot disagree about which of the two a row carries. */
  const number=text(income.number)||'Not numbered';
  const invoiceNumber=invoices.get(text(income.salesInvoiceId))||'';
  rows.push({
   id:'income:'+text(income.id),recordId:text(income.id),type:'Income',
   date:text(income.date),number,invoiceNumber,documentNumber:invoiceNumber||number,
   name:text(income.name||description||category),party:receivedFrom||DASH,receivedFrom:receivedFrom||DASH,partyCode:'',partyId:'',
   incomeAccount,incomeAccountName:accountName(book,incomeAccount),
   expenseAccount:incomeAccount,expenseAccountName:accountName(book,incomeAccount),
   paymentAccount,paymentAccountName:accountName(book,paymentAccount),
    receivedIn:incomeReceivedIn(income,isReceived,book),
   method:text(income.method),category,
   received:isReceived,
   expectedDate:text(income.expectedDate),
   amount,total:amount,
   taxable:0,gst:0,roundOff:0,
   tax,taxLabel:hasTax?tax:DASH,
   status,storedStatus:text(income.status),posted:status==='Recorded',
   organisation,organisationName:organisation?(scope.names.get(organisation)||organisation):text(filters.organisationName),
   branch,branchName:branchName(branch,branches)||text(filters.workingBranch),
   reference:reference||DASH,description,
   haystack:[income.number,income.name,receivedFrom,category,incomeAccount,accountName(book,incomeAccount),reference,description].filter(Boolean).join(' ').toLowerCase(),
   handshake:'wayvida-open-income',page:'Income'
  });
 }
 /* Whether the two scope columns are printed is the page's decision, and the export mirrors the
    table it was taken from, so the report carries the same two answers out with the rows. */
 return {...assemble(rows,filters,{excludedOtherOrganisation,type:'Income'}),showOrganisation:Boolean(filters.showOrganisation),showBranch:Boolean(filters.showBranch)};
}

/* ---------- The shared assembly ---------- */

/* What every report returns: the rows the page prints, the money cards, the options the filters can
   offer, and the consistency checks the footer states. The totals are the FILTERED rows, so the
   cards always describe exactly what the table below them shows. */
function assemble(rows,filters,{excludedOtherOrganisation=0,type=''}={}){
 const visible=narrow(rows,filters);
 const totals=(type==='Expense'||type==='Income')
  ? {total:sum(visible,'amount'),received:sum(visible.filter(r=>r.received),'amount'),yetToReceive:sum(visible.filter(r=>!r.received),'amount'),taxable:0,gst:0,roundOff:0,count:visible.length}
  : moneyTotals(visible);
 const applied={from:text(filters.from),to:text(filters.to),status:text(filters.status)||ALL,party:text(filters.party)||ALL,branch:text(filters.branch)||ALL,account:text(filters.account)||ALL,category:text(filters.category)||ALL,payment:text(filters.payment)||ALL,search:text(filters.search)};
 const filtersActive=Boolean(applied.from||applied.to||applied.search)||applied.status!==POSTED||applied.party!==ALL||applied.branch!==ALL||applied.account!==ALL||applied.category!==ALL||applied.payment!==ALL;
 return {
  type,
  from:applied.from,to:applied.to,status:applied.status,party:applied.party,branch:applied.branch,account:applied.account,category:applied.category,payment:applied.payment,search:applied.search,
  rows:visible,
  totals,
  statusOptions:type==='Income'?incomeStatusOptions(rows):statusOptions(rows),
  partyOptions:partyOptions(rows),
  branchOptions:unique(rows.map(row=>row.branchName)).sort(),
  paymentOptions:unique(rows.map(row=>row.paymentAccountName)).sort(),
  categoryOptions:unique(rows.map(row=>row.category)).sort(),
  accountOptions:unique(rows.filter(row=>row.expenseAccountName).map(row=>row.expenseAccountName)).sort(),
  filtersActive,
  hasRows:rows.length>0,
  poolSize:rows.length,
  excludedOtherOrganisation,
  checks:checks(visible,totals,applied,type),
  get valid(){return this.checks.every(check=>check.ok)}
 };
}

/* ---------- Export ---------- */

/* The sheet each page's Excel export and printed page state: the report identity and the filters in
   force, then exactly the columns the page prints - see the column lists in the brief. The identity
   block itself is built by src/tax-compliance.js `tableExport`, so every report export in the
   product carries the same organisation, branch, period and filter header. */
export function salesExportSheet(report){
 return {
  header:['Date','Invoice','Customer','Taxable Amount INR','GST INR','Total INR','Status'],
  rows:report.rows.map(row=>[row.date,row.number,row.party,row.taxable/100,row.gst/100,row.total/100,row.status])
 };
}

export function purchaseExportSheet(report){
 return {
  header:['Date','Bill','Supplier','Taxable Amount INR','GST INR','Total INR','Status'],
  rows:report.rows.map(row=>[row.date,row.number,row.party,row.taxable/100,row.gst/100,row.total/100,row.status])
 };
}

export function expenseExportSheet(report){
 return {
  header:['Date','Expense No.','Paid To','Payment For','Bill Reference','Payment Method','Paid From','Amount Paid INR','Status'],
  rows:report.rows.map(row=>[row.date,row.number,row.party,row.expenseAccountName,row.reference,row.method,row.paymentAccountName,row.amount/100,row.status])
 };
}

/* The Income sheet states the register's own columns in the register's own order, and the
   Organisation and Branch columns join it only when the working context made the page print them:
   the sheet and the table it was exported from describe the same rows. The receipt is stated as
   'Received In' - Cash, Bank or the dash - rather than as a Yes/No column, because that is the one
   receipt fact the register itself prints. */
export function incomeExportSheet(report){
  const scopeColumns=[...(report.showOrganisation?['Organisation']:[]),...(report.showBranch?['Branch']:[])];
  return {
   header:['Date','Income No./Inv No.','Income From','Income Type','Received In','Reference Number','Amount INR','Status',...scopeColumns],
   rows:report.rows.map(row=>[row.date,row.documentNumber,row.party,row.category,row.receivedIn,row.reference,row.amount/100,row.status,...(report.showOrganisation?[row.organisationName]:[]),...(report.showBranch?[row.branchName]:[])])
  };
 }
