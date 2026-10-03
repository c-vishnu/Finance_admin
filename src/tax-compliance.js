/* Tax & Compliance - one read-only projection of the GST and TDS facts the other modules already
   stored.

   WHY THIS IS A PROJECTION. GST and TDS are not a second set of books: the invoice, credit note,
   purchase bill and debit note engines already calculated the tax on each document and posted it to
   the ledger. This module only reads those documents back, in the shape the two Tax & Compliance
   report pages print and export. It never writes, never recalculates a tax amount, never posts a
   journal and never invents a GSTIN, a tax rate, a TDS section or a classification the document
   does not carry.

   WHERE THE GST ROWS COME FROM. `gstDocuments()` in the credit-note service is the application
   existing GST document reader: every posted invoice (sign +1), every posted credit note (sign -1),
   every posted purchase bill and purchase debit note, plus the reversal journals the engines wrote
   when a document was cancelled. Reusing it keeps this report and the GST register the Credit Notes
   module already shows in exact agreement, and it means one cancellation can never be counted twice.
   The cancellation pairs are then dropped here, so the report states the live postings only - the
   cancelled document and its reversal net to zero anyway, so no total moves.

   WHERE THE TDS ROWS COME FROM. The application records withholding on the vendor master (section
   and rate) - see `src/vendor-store.js` and the TDS section on the vendor form - and there is no TDS
   challan or deposit register in this prototype. The report therefore states, for every posted
   purchase bill whose vendor is TDS-applicable, the withholding the configured section and rate
   imply on the value of supply, and it says plainly on the page that deposits are not recorded yet.
   Nothing is fabricated: the section, the rate and the PAN are the vendor record's own values.

   WHAT IS DELIBERATELY ABSENT. Input tax credit status (Eligible / Ineligible / Reversed / Pending)
   is not part of this data model, so no ITC column is printed rather than a guessed one; the note on
   the Input GST tab says so. HSN / SAC is stated for outward supplies, because the inward bill lines
   carry one combined tax amount rather than a per-component split. */

import {gstDocuments} from './credit-note-service.js';

export const ALL='All';
export const DASH='\u2014';

/* The four GST document types the data model carries, in the words the filter and the Transaction
   Type column use. A purchase order or a sales order never appears: neither reaches the books. */
export const GST_TRANSACTION_TYPES=['Sales','Purchase','Credit Note','Debit Note'];

/* The four tax components. CESS is offered because the invoice and bill engines both calculate it,
   even though a rate of zero means it is usually absent from the rows. */
export const TAX_TYPES=['CGST','SGST','IGST','CESS'];

/* The two TDS states this prototype can actually derive: the withholding has been taken because the
   bill was settled, or it has not been taken yet. */
export const TDS_STATUSES=['Deducted','Pending'];

/* The TDS sections the vendor form offers (194C, 194H, 194I, 194J) plus 194Q, which existing vendor
   records carry, with their statutory subject. A section outside this list keeps its own code and
   reads as "Section <code>" rather than a description nobody wrote. */
export const TDS_SECTIONS={
 '194C':'Payment to contractors',
 '194H':'Commission or brokerage',
 '194I':'Rent',
 '194J':'Professional or technical services',
 '194Q':'Purchase of goods'
};

const list=(source,key)=>Array.isArray(source&&source[key])?source[key]:[];
const text=value=>String(value==null?'':value).trim();
const minor=value=>{const number=Number(value);return Number.isFinite(number)?Math.round(number):0};
const positive=value=>{const number=Number(value);return Number.isFinite(number)&&number>0?number:0};

/* `gstDocuments` reads the document stores directly, so a book without one of the collections is not
   an error - the report simply states the documents that do exist, the way the Transaction Register
   treats a store it cannot read. */
function gstSource(book){
 try{return gstDocuments(book||{})}catch{return []}
}

/* Which side of the return a document sits on, and which module owns it. The kind is the word
   `gstDocuments` already uses; the page each row opens on is reached through the same sessionStorage
   handshake the Transaction Register uses, so one document never opens in two different places. */
const KIND_META={
 'Invoice':{type:'Sales',direction:'output',page:'Invoices',handshake:'wayvida-open-invoice'},
 'Credit Note':{type:'Credit Note',direction:'output',page:'Credit Notes',handshake:'wayvida-open-credit'},
 'Purchase Bill':{type:'Purchase',direction:'input',page:'Purchase Bills',handshake:'wayvida-open-bill'},
 'Purchase Debit Note':{type:'Debit Note',direction:'input',page:'Debit Notes',handshake:'wayvida-open-debit-note'}
};

/* A document is stated as Cancelled when the engines cancelled it, and the reversal row it posted
   reads as Reversed. Both are dropped from the report: a cancelled document and its reversal are one
   correction, and their two signed contributions already cancel, so leaving them out changes no
   total while keeping a cancelled invoice out of the GST Summary. */
function gstStatus(doc){
 if(/\/\s*REV$/i.test(text(doc.number)))return 'Reversed';
 const raw=text(doc.status);
 if(/cancel/i.test(raw))return 'Cancelled';
 if(/void/i.test(raw))return 'Cancelled';
 return 'Posted';
}

/* The effective total GST rate the document charged: the four components over the taxable value. It
   is what the Tax Rate filter narrows by, and it is derived here rather than stored, because the
   document keeps component rates per line, not one headline rate. */
function effectiveRate(taxable,tax){
 const base=Math.abs(taxable);
 return base?Math.round(Math.abs(tax)/base*100*1e6)/1e6:0;
}

/* Every GST document, one row each, in the shape the report prints: what it is, who it is with, the
   five values its own engine calculated, and where it opens. The five amounts keep the document's
   own sign, so a credit note reads as the reduction it is and a total is a sum of effects - the same
   treatment the GST register in the Credit Notes module already gives them. */
export function collectGstDocuments({book={}}={}){
 return gstSource(book).map(doc=>{
  const meta=KIND_META[doc.kind]||{type:text(doc.kind)||'Document',direction:'output',page:'',handshake:''};
  const totals=doc.totals||{},sign=Number(doc.sign)||0;
  const taxable=minor(totals.taxable),cgst=minor(totals.cgst),sgst=minor(totals.sgst),igst=minor(totals.igst),cess=minor(totals.cess);
  const tax=cgst+sgst+igst+cess;
  return {
   id:'gst:'+text(doc.id||doc.number)+':'+sign,
   recordId:text(doc.id),
   kind:text(doc.kind),
   type:meta.type,
   direction:meta.direction,
   sign,
   date:text(doc.date),
   number:text(doc.number)||'Not numbered',
   party:text(doc.customerName||doc.vendorName),
   partyKind:meta.direction==='output'?'customer':'supplier',
   gstin:text(doc.customerGstin||doc.vendorGstin),
   place:text(doc.place||doc.placeOfSupply),
   reference:text(doc.reference||doc.vendorInvoice),
   state:gstStatus(doc),
   branch:text(doc.branch||doc.branchName),
   taxable:sign*taxable,
   cgst:sign*cgst,
   sgst:sign*sgst,
   igst:sign*igst,
   cess:sign*cess,
   tax:sign*tax,
   rate:effectiveRate(taxable,tax),
   lines:Array.isArray(totals.lines)?totals.lines:[],
   page:meta.page,
   handshake:meta.handshake
  };
 }).filter(entry=>entry.sign!==0&&entry.state!=='Cancelled');
}

const componentKey=name=>/^cess$/i.test(name)?'cess':String(name||'').toLowerCase();

/* The filters, applied together. Date range is inclusive at both ends, the component filter keeps the
   documents that actually charged that component, and the search reads the document number, the
   party, the GSTIN and the reference - the four things an accountant searches a GST register by. */
export function filterGstRows(rows,filters={}){
 const from=text(filters.from),to=text(filters.to),needle=text(filters.search).toLowerCase();
 const key=filters.taxType&&filters.taxType!==ALL?componentKey(filters.taxType):'';
 return (rows||[]).filter(row=>{
  if(from&&row.date<from)return false;
  if(to&&row.date>to)return false;
  if(filters.type&&filters.type!==ALL&&row.type!==filters.type)return false;
  if(filters.branch&&filters.branch!==ALL&&row.branch!==filters.branch)return false;
  if(filters.party&&filters.party!==ALL&&row.party!==filters.party)return false;
  if(filters.gstin&&filters.gstin!==ALL&&row.gstin!==filters.gstin)return false;
  if(filters.rate&&filters.rate!==ALL&&String(row.rate)!==String(filters.rate))return false;
  if(key&&!row[key])return false;
  if(needle&&![row.number,row.party,row.gstin,row.reference,row.type].filter(Boolean).join(' ').toLowerCase().includes(needle))return false;
  return true;
 });
}

const sum=(rows,key)=>rows.reduce((total,row)=>total+minor(row[key]),0);

/* The four cards. Taxable Sales is the taxable value of the outward documents, Output GST is the tax
   they charged, Input GST is the tax the inward documents recorded, and Net GST is the difference -
   the liability the business has to settle, which reads negative when input GST exceeds output GST.
   The three underlying figures stay on the other three cards, so Net GST never hides them. */
export function summarizeGst(rows){
 const entries=rows||[],outward=entries.filter(row=>row.direction==='output'),inward=entries.filter(row=>row.direction==='input');
 const outputGst=sum(outward,'tax'),inputGst=sum(inward,'tax');
 return {count:entries.length,taxableSales:sum(outward,'taxable'),outputGst,inputGst,netGst:outputGst-inputGst};
}

const unique=values=>[...new Set(values.filter(Boolean))];

/* What the GST filters can offer, derived from the rows themselves so a filter can never name a
   branch, a party, a GSTIN or a rate that no document carries. */
export function gstOptions(rows){
 const entries=rows||[];
 return {
  branches:unique(entries.map(row=>row.branch)).sort(),
  parties:unique(entries.map(row=>row.party)).sort(),
  gstins:unique(entries.map(row=>row.gstin)).sort(),
  rates:unique(entries.map(row=>row.rate).filter(value=>value>0)).sort((left,right)=>left-right).map(String),
  types:GST_TRANSACTION_TYPES.filter(type=>entries.some(row=>row.type===type))
 };
}

/* ---------- HSN / SAC ---------- */

/* Outward supplies grouped by the HSN or SAC each line carries, with the quantity, the taxable value
   and the four components. A line whose item has no code yet is stated as "Not specified" rather
   than dropped, so the grouped taxable value still agrees with the GST Summary. */
export function hsnSummary(rows){
 const groups=new Map();
 for(const row of (rows||[])){
  if(row.direction!=='output')continue;
  for(const line of row.lines){
   const code=text(line.hsnSac)||'Not specified';
   const entry=groups.get(code)||{code,description:'',quantity:0,taxable:0,cgst:0,sgst:0,igst:0,cess:0,tax:0,lines:0};
   const cgst=minor(line.cgst),sgst=minor(line.sgst),igst=minor(line.igst),cess=minor(line.cessAmount??line.cess);
   entry.quantity+=Number(line.qty)||0;
   entry.taxable+=row.sign*minor(line.taxable);
   entry.cgst+=row.sign*cgst;
   entry.sgst+=row.sign*sgst;
   entry.igst+=row.sign*igst;
   entry.cess+=row.sign*cess;
   entry.tax+=row.sign*(cgst+sgst+igst+cess);
   entry.lines+=1;
   if(!entry.description)entry.description=text(line.description);
   groups.set(code,entry);
  }
 }
 return [...groups.values()].map(entry=>({...entry,rate:effectiveRate(entry.taxable,entry.tax)})).sort((left,right)=>right.taxable-left.taxable||left.code.localeCompare(right.code));
}

/* ---------- GST reconciliation ---------- */

/* The documents against the ledger. Both sides are the application own numbers: the document side is
   what the invoice and bill engines calculated, the ledger side is what they posted to the GST
   accounts. A difference is stated, never forced away - the point of the line is to surface a real
   disagreement, not to assert a zero. */
export function gstReconciliation({book={},rows=[]}={}){
 const config=book.config||{},accounts=list(book,'accounts');
 const outputAccounts=new Set([config.cgst,config.sgst,config.igst,config.cess].filter(Boolean));
 for(const account of accounts)if(/output gst|gst payable/i.test(text(account.name)))outputAccounts.add(text(account.code));
 const inputAccounts=new Set(['1410','1420','1430','1440']);
 for(const bill of list(book,'purchaseBills'))for(const key of ['inputCgstAccount','inputSgstAccount','inputIgstAccount','inputCessAccount'])if(bill[key])inputAccounts.add(text(bill[key]));
 for(const account of accounts)if(/input/i.test(text(account.name))&&/gst|cess/i.test(text(account.name)))inputAccounts.add(text(account.code));
 let ledgerOutput=0,ledgerInput=0;
 for(const journal of list(book,'journals')){
  if(text(journal.status)!=='Posted')continue;
  for(const line of (Array.isArray(journal.lines)?journal.lines:[])){
   const debit=minor(line.debit),credit=minor(line.credit);
   if(outputAccounts.has(text(line.account)))ledgerOutput+=credit-debit;
   if(inputAccounts.has(text(line.account)))ledgerInput+=debit-credit;
  }
 }
 const documentOutput=sum((rows||[]).filter(row=>row.direction==='output'),'tax');
 const documentInput=sum((rows||[]).filter(row=>row.direction==='input'),'tax');
 return {ledgerOutput,ledgerInput,documentOutput,documentInput,difference:(ledgerOutput-documentOutput)+(ledgerInput-documentInput)};
}

/* ---------- TDS ---------- */

/* The withholding on one value of supply, to the rupee. It is the only place TDS is computed, and it
   cannot invent a rate: a vendor without a section or without a positive rate is not withholdable
   and is skipped by the collector below. */
export function tdsOn(value,rate){
 const amount=Number(value),percent=positive(rate);
 if(!Number.isFinite(amount)||!percent)return 0;
 return Math.round(amount*percent/100);
}

export function tdsSectionDescription(section){
 const code=text(section);
 return TDS_SECTIONS[code]||(code?'Section '+code:'No section configured');
}

/* Every posted purchase bill whose vendor is TDS-applicable, plus the posted debit notes to those
   same vendors as the reductions they are. The bill's value of supply - not its GST-inclusive total -
   is the base, because GST the vendor charged is not part of the consideration tax is withheld on.
   `settled` is the bill's own payment state, which is what makes a row Deducted or Pending. Each row
   also carries the vendor's id and code and the document's own reference, so the page can search a
   vendor code or a payment reference and it can open either the bill or the vendor the row names. */
export function collectTdsDocuments({book={},vendors=[]}={}){
 const index=new Map((Array.isArray(vendors)?vendors:[]).map(vendor=>[vendor.id,vendor]));
 const rows=[];
 const push=(doc,sign)=>{
  const vendor=index.get(doc.vendorId)||{};
  if(!vendor.tdsApplicable)return;
  const section=text(vendor.tdsSection),rate=positive(vendor.tdsRate);
  if(!section||!rate)return;
  const totals=doc.totals||{};
  const gross=minor(totals.taxable)||minor(doc.total)||minor(totals.total);
  const settled=text(doc.status)==='Paid';
  rows.push({
   id:'tds:'+text(doc.id)+':'+sign,
   recordId:text(doc.id),
   kind:sign>0?'Purchase Bill':'Purchase Debit Note',
   type:sign>0?'Purchase Bill':'Debit Note',
   sign,
   date:text(doc.date),
   number:text(doc.number)||'Not numbered',
   reference:text(doc.reference),
   vendor:text(doc.vendorName||vendor.name),
   vendorId:text(doc.vendorId||vendor.id),
   vendorCode:text(vendor.code),
   pan:text(vendor.pan),
   gstin:text(doc.vendorGstin||vendor.gstin),
   section,
   description:tdsSectionDescription(section),
   rate,
   gross:sign*gross,
   tds:sign*tdsOn(gross,rate),
   settled,
   state:settled?'Deducted':'Pending',
   branch:text(doc.branch||doc.branchName),
   page:'Purchase Bills',
   handshake:'wayvida-open-bill'
  });
 };
 for(const bill of list(book,'purchaseBills'))if(bill.posted&&bill.status!=='Cancelled')push(bill,1);
 for(const note of list(book,'debitNotes'))if(note.posted&&!['Cancelled','Voided','Reversed'].includes(text(note.status)))push(note,-1);
 return rows;
}

export function filterTdsRows(rows,filters={}){
 const from=text(filters.from),to=text(filters.to),needle=text(filters.search).toLowerCase();
 return (rows||[]).filter(row=>{
  if(from&&row.date<from)return false;
  if(to&&row.date>to)return false;
  if(filters.branch&&filters.branch!==ALL&&row.branch!==filters.branch)return false;
  if(filters.vendor&&filters.vendor!==ALL&&row.vendor!==filters.vendor)return false;
  if(filters.pan&&filters.pan!==ALL&&row.pan!==filters.pan)return false;
  if(filters.section&&filters.section!==ALL&&row.section!==filters.section)return false;
  if(filters.rate&&filters.rate!==ALL&&Number(row.rate)!==Number(filters.rate))return false;
  if(filters.status&&filters.status!==ALL&&row.state!==filters.status)return false;
  if(needle&&![row.vendor,row.vendorCode,row.pan,row.number,row.reference,row.section,row.description].filter(Boolean).join(' ').toLowerCase().includes(needle))return false;
  return true;
 });
}

/* The four cards. Applicable Amount is the value of supply TDS applies to, TDS Deducted is the
   withholding that value and those rates imply, TDS Paid is the withholding taken on the bills that
   have been settled, and TDS Payable is the remainder - the liability still to be deducted. */
export function summarizeTds(rows){
 const entries=rows||[],settled=entries.filter(row=>row.settled);
 const deducted=sum(entries,'tds'),paid=sum(settled,'tds');
 return {count:entries.length,applicable:sum(entries,'gross'),deducted,paid,payable:deducted-paid};
}

/* What one row has had taken and what it still owes. A settled bill has had its withholding taken, so
   TDS Paid is its own deduction and Balance Payable is zero; an unsettled bill has been paid nothing,
   so it owes the whole deduction. The Payable table keeps only a non-zero balance, which is why a
   fully paid bill never appears there and never reaches its total. */
export function tdsRowBalance(row){
 const tds=minor(row.tds),paid=row.settled?tds:0;
 return {tds,paid,balance:tds-paid};
}

/* The page's bottom reconciliation. Each figure is computed on its own - what the rows withhold, what
   has been taken on the settled bills, what the unsettled bills still owe - so the identity
   TDS Payable = TDS Deducted - TDS Paid is CHECKED rather than assumed, and a difference is stated
   instead of hidden. */
export function tdsReconciliation(rows){
 const entries=rows||[],settled=entries.filter(row=>row.settled);
 const deducted=sum(entries,'tds'),paid=sum(settled,'tds'),payable=sum(entries.filter(row=>!row.settled),'tds');
 return {deducted,paid,payable,difference:(deducted-paid)-payable};
}

export function tdsOptions(rows){
 const entries=rows||[];
 return {
  branches:unique(entries.map(row=>row.branch)).sort(),
  vendors:unique(entries.map(row=>row.vendor)).sort(),
  pans:unique(entries.map(row=>row.pan)).sort(),
  sections:unique(entries.map(row=>row.section)).sort(),
  rates:unique(entries.map(row=>row.rate)).sort((left,right)=>left-right),
  statuses:TDS_STATUSES.filter(state=>entries.some(row=>row.state===state))
 };
}

/* TDS grouped by vendor - the payee, its PAN, how many documents, the value of supply, the
   withholding, what has been taken and what is left. */
export function tdsByVendor(rows){
 const groups=new Map();
 for(const row of (rows||[])){
  const key=text(row.vendor)||DASH;
  const entry=groups.get(key)||{vendor:key,pan:text(row.pan),documents:0,gross:0,deducted:0,paid:0,payable:0};
  entry.documents+=1;
  entry.gross+=minor(row.gross);
  entry.deducted+=minor(row.tds);
  if(row.settled)entry.paid+=minor(row.tds);else entry.payable+=minor(row.tds);
  if(!entry.pan)entry.pan=text(row.pan);
  groups.set(key,entry);
 }
 return [...groups.values()].sort((left,right)=>right.deducted-left.deducted||left.vendor.localeCompare(right.vendor));
}

/* TDS grouped by section, with the rate the vendors in that section are configured at. A section
   whose vendors disagree on the rate states every rate rather than picking one of them. */
export function tdsBySection(rows){
 const groups=new Map();
 for(const row of (rows||[])){
  const key=text(row.section)||DASH;
  const entry=groups.get(key)||{section:key,description:tdsSectionDescription(row.section),documents:0,gross:0,deducted:0,rates:[]};
  entry.documents+=1;
  entry.gross+=minor(row.gross);
  entry.deducted+=minor(row.tds);
  if(!entry.rates.includes(row.rate))entry.rates.push(row.rate);
  groups.set(key,entry);
 }
 return [...groups.values()].map(entry=>({
  ...entry,
  rates:[...entry.rates].sort((left,right)=>left-right),
  rateText:entry.rates.length?[...entry.rates].sort((left,right)=>left-right).map(value=>value+'%').join(' / '):DASH
 })).sort((left,right)=>String(left.section).localeCompare(String(right.section)));
}

/* ---------- Export ---------- */

/* The report identity every export and every printed page states: the organisation, the branch, the
   period, the filters that were in force and when it was produced - the same block the Transaction
   Register writes, so two exports never disagree about what they contain. */
export function reportMetadata({title='',subtitle='',organisation='',branch=ALL,from='',to='',filters={},count='',generatedBy='Local user',generatedAt=''}={}){
 const applied=Object.entries(filters||{}).filter(([,value])=>value&&value!==ALL).map(([key,value])=>key+': '+value);
 return [
  [title||'Wayvida Books · Tax & Compliance',subtitle].filter(Boolean),
  ['Organisation',organisation],
  ['Branch',branch===ALL?'All branches':branch],
  ['Date range',(from||'Beginning')+' to '+(to||'Latest')],
  ['Applied filters',applied.length?applied.join(' · '):'None'],
  ...(count===''?[]:[['Rows',count]]),
  ['Generated by',generatedBy],
  ['Generated at',generatedAt]
 ];
}

/* One sheet builder for every tab on both pages: the identity block, a blank line, the tab's own
   header and the tab's own rows. Nothing here duplicates `daybook-export`, which still turns these
   rows into the Excel workbook. */
export function tableExport(header,rows,meta){
 return [...reportMetadata(meta),[''],[...header],...(rows||[])];
}
