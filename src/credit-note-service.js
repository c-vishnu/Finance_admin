import {calculate,account,journal,minor,money,outstanding,today,ledger} from './invoice-engine.js';
import {purchaseTaxDocuments} from './purchase-service.js';
import {lineTaxes} from './invoice-tax.js';
/* The credit note is a financial adjustment against a customer, not a negative invoice: it always
   names a type, a structured reason and (when it adjusts a sale) the invoice it belongs to. */
export const CREDIT_NOTE_TYPES=['Against Invoice','Standalone Credit Note'];
export const DEFAULT_CREDIT_NOTE_TYPE='Against Invoice';
/* A credit note either reverses a posted sale line by line, or adjusts a value with no item behind
   it. The method is stored on the note so the form, the validation and the posting read one field. */
export const CREDIT_METHODS=['Item Based Credit','Amount Based Credit'];
export const DEFAULT_CREDIT_METHOD='Item Based Credit';
export const creditMethod=value=>CREDIT_METHODS.includes(value)?value:DEFAULT_CREDIT_METHOD;
/* Whether a goods note takes the stock back or is a financial adjustment only. A pricing correction
   never moves stock; a sales return normally does. The choice is stored on the note. */
export const INVENTORY_IMPACTS=['Return Stock To Inventory','Financial Adjustment Only'];
export const DEFAULT_INVENTORY_IMPACT='Financial Adjustment Only';
export const inventoryImpact=value=>INVENTORY_IMPACTS.includes(value)?value:DEFAULT_INVENTORY_IMPACT;
export const CREDIT_REASONS=['Sales Return','Pricing Correction','Wrong Billing','Discount Adjustment','Damaged Goods','Service Cancellation','GST Correction','Other'];
/* Labels the earlier prototype wrote are still readable: a stored note keeps its own string, and a
   new one is always written in the current vocabulary. */
const LEGACY_REASONS={'Price Adjustment':'Pricing Correction','Other Customer Adjustment':'Other','Tax Adjustment':'GST Correction','Tax Correction':'GST Correction','Post-Sale Discount':'Discount Adjustment','Wrong Item':'Wrong Billing','Excess Quantity':'Sales Return'};
export const canonicalReason=value=>CREDIT_REASONS.includes(value)?value:LEGACY_REASONS[value]||'';
export const reasons=CREDIT_REASONS;
/* "Without Invoice" is what the earlier prototype called a standalone note: a stored one still reads
   as itself and is normalised on the way through this one function. */
const LEGACY_NOTE_TYPES={'Without Invoice':'Standalone Credit Note','Standalone':'Standalone Credit Note'};
export const noteType=value=>CREDIT_NOTE_TYPES.includes(value)?value:LEGACY_NOTE_TYPES[value]||DEFAULT_CREDIT_NOTE_TYPE;
/* A tax-only correction must never reduce revenue, and a goods reason must never credit more than
   the invoice still allows. Both rules read the reason, in one place. */
export const isTaxOnlyReason=value=>canonicalReason(value)==='GST Correction';
export const isReturnReason=value=>['Sales Return','Damaged Goods'].includes(canonicalReason(value));
/* The reason picks the configured account mapping role. A tax correction keeps a role of its own so
   it can be mapped to a tax adjustment account instead of a revenue one. */
export function creditMappingRole(value){const reason=canonicalReason(value);if(reason==='Sales Return')return 'salesReturn';if(reason==='GST Correction')return 'taxAdjustment';if(['Pricing Correction','Discount Adjustment','Wrong Billing','Damaged Goods','Service Cancellation'].includes(reason))return 'salesAdjustment';return 'otherAdjustment'}
const copy=x=>JSON.parse(JSON.stringify(x));
const dateOK=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export const issued=s=>(s.creditNotes||[]).filter(c=>c.posted&&c.status!=='Cancelled');
export const applied=(s,c)=>(s.creditApplications||[]).filter(a=>a.creditNoteId===c.id&&!a.voided).reduce((n,a)=>n+a.amount,0);
export const refunded=(s,c)=>(s.creditRefunds||[]).filter(r=>r.creditNoteId===c.id&&!r.reversed).reduce((n,r)=>n+r.amount,0);
/* Available credit is what is left after both ways of using it: applied to an invoice, or refunded. */
export const available=(s,c)=>c.posted&&c.status!=='Cancelled'?Math.max(0,c.totals.total-applied(s,c)-refunded(s,c)):0;
export const adjustmentStatus=(s,c)=>!applied(s,c)?'Unapplied':available(s,c)?'Partially Applied':'Fully Applied';
/* The statuses the register filters on and the detail page prints. The stored field stays the
   lifecycle the approval workflow writes (Draft / Pending Approval / Approved / Issued / Cancelled);
   what has happened to the money is derived, so the two can never disagree. */
export const CREDIT_NOTE_STATUSES=['Draft','Pending Approval','Approved','Issued','Partially Applied','Fully Applied','Partially Refunded','Refunded','Cancelled'];
export function creditNoteStatus(s,c){
 if(c.status==='Cancelled')return 'Cancelled';
 if(c.status==='Draft')return 'Draft';
 if(c.status==='Pending Approval')return 'Pending Approval';
 if(c.status==='Approved'&&!c.posted)return 'Approved';
 const total=c.totals.total,used=applied(s,c),back=refunded(s,c);
 if(used>=total&&total>0)return 'Fully Applied';
 if(back>0&&available(s,c)<=0)return 'Refunded';
 if(back>0)return 'Partially Refunded';
 if(used>0)return 'Partially Applied';
 return 'Issued';
}
export function creditInvoiceEligibility(s,c,i){
 if(!i)return {eligible:false,reason:'Invoice not found'};
 if(i.customerId!==c.customerId)return {eligible:false,reason:'Different customer'};
 if(i.companyId&&c.companyId&&i.companyId!==c.companyId)return {eligible:false,reason:'Different company'};
 if((i.currency||'INR')!==(c.currency||'INR'))return {eligible:false,reason:'Different currency'};
 if(!i.posted)return {eligible:false,reason:'Draft or unposted invoice'};
 if(i.status==='Cancelled')return {eligible:false,reason:'Cancelled invoice'};
 if(i.arAccount!==c.arAccount)return {eligible:false,reason:'Different receivable account'};
 if(outstanding(s,i)<=0)return {eligible:false,reason:'Already paid or fully adjusted'};
 return {eligible:true,reason:''};
}
export const credited=(s,i)=>issued(s).filter(c=>c.originalInvoiceId===i.id).reduce((n,c)=>n+c.totals.total,0);
/* How much of one invoice line has already been credited, by quantity and by value. The create form
   prints the first as its Previously Credited column and the second as the remaining eligible value. */
export function creditedQuantity(s,i,index,{exclude}={}){
 return issued(s).filter(c=>c.originalInvoiceId===i.id&&c.id!==exclude).flatMap(c=>c.totals.lines).filter(l=>l.invoiceItemIndex===index).reduce((n,l)=>n+Number(l.qty||0),0);
}
export function creditedValue(s,i,index,{exclude}={}){
 return issued(s).filter(c=>c.originalInvoiceId===i.id&&c.id!==exclude).flatMap(c=>c.totals.lines).filter(l=>l.invoiceItemIndex===index).reduce((n,l)=>n+Number(l.taxable||0),0);
}
export const salesReturnOf=(s,c)=>(s.salesReturns||[]).find(r=>r.id===c.salesReturnId)||null;
/* The sales returns recorded against one invoice, and how much of an invoice line they have already
   taken back. A cancelled return never counts: it did not move stock. */
export const salesReturnsOf=(s,invoiceId)=>(s.salesReturns||[]).filter(r=>r.invoiceId===invoiceId&&r.status!=='Cancelled');
export function returnedQuantity(s,invoice,index){
 return salesReturnsOf(s,invoice?.id).flatMap(r=>r.lines||[]).filter(l=>l.invoiceItemIndex===index).reduce((n,l)=>n+Number(l.qty||0),0);
}
export function returnableQuantity(s,invoice,index){
 return Math.max(0,Number(invoice?.lines?.[index]?.qty||0)-returnedQuantity(s,invoice,index));
}
export const creditReturns=(s,c)=>issued(s).filter(other=>other.id!==c.id&&other.originalInvoiceId===c.originalInvoiceId&&isReturnReason(other.reason)).reduce((n,other)=>n+other.totals.total,0);
export function creditLine(invoice,index){const l=invoice.lines[index];return {...copy(l),invoiceItemIndex:index,description:l.description,unit:l.unit,taxes:lineTaxes(l,invoice.totals.intra)}}
/* The tax a value-only adjustment reverses: the invoice's own blended component rates, so an
   amount-based credit on a single-rate invoice reverses exactly what the invoice charged. */
export const billedTaxRates=invoice=>{const t=(invoice&&invoice.totals)||{},taxable=Number(t.taxable||0),pct=k=>taxable?Math.round(Number(t[k]||0)/taxable*100*1e6)/1e6:0;return t.intra?{cgst:pct('cgst'),sgst:pct('sgst'),igst:0,cess:pct('cess')}:{cgst:0,sgst:0,igst:pct('igst'),cess:pct('cess')}};
/* A standalone note has no invoice to inherit from, so the operator's Tax treatment decides: the
   rate splits into CGST + SGST inside the company state and becomes IGST outside it. */
export function chosenTaxRates(form,taxPolicy){const intra=String(form.place||'').trim().toLowerCase()===String((taxPolicy||{}).state||'').trim().toLowerCase(),rate=Number(String(form.adjustmentTax||'').replace(/[^0-9.]/g,''))||0;return intra?{cgst:rate/2,sgst:rate/2,igst:0,cess:0}:{cgst:0,sgst:0,igst:rate,cess:0}}
export function calculateCredit(s,form){
 const type=noteType(form.type),reason=canonicalReason(form.reason);
 if(!reason)throw Error('Select a credit note reason.');
 if(reason==='Other'&&!String(form.reasonNote||'').trim())throw Error('Enter the reason for this credit note.');
 /* Against an invoice the note reverses that invoice's own tax treatment, so the invoice, its
    customer and its place of supply are read from it and never guessed. Without an invoice the
    operator must supply the customer and the place of supply: nothing is inferred. */
 const invoice=type==='Against Invoice'?s.invoices.find(i=>i.id===form.originalInvoiceId):null;
 if(type==='Against Invoice'){
  if(!invoice||!invoice.posted||invoice.status==='Cancelled')throw Error('Select a posted, non-cancelled invoice.');
  if(form.customerId!==invoice.customerId)throw Error('Credit note customer must match the original invoice.');
  if(form.place!==invoice.place)throw Error('Place of supply must match the original invoice.');
 }else{
  if(!form.customerId||!String(form.customerName||'').trim())throw Error('Select a customer.');
  if(!form.place)throw Error('Select the place of supply.');
  if(creditMethod(form.creditMethod)==='Amount Based Credit'){
   if(!(minor(form.adjustmentAmount||'0')>0))throw Error('Enter an adjustment amount greater than zero.');
  }else if(!(form.lines||[]).length)throw Error('Add at least one credit line.');
 }
 // A note against an invoice reverses that invoice's own tax treatment: stale or edited component
 // rates carried by the form are ignored. A note without an invoice keeps the rates the operator
 // chose, and both go through the one tax engine.
 const method=creditMethod(form.creditMethod);
 /* An amount-based credit adjusts a value, not quantities, so it has no invoice item to point at: the
    tax is the invoice's own blended rate (or the rate chosen for a standalone note) and the caps are
    checked in total, per tax component, instead of line by line. */
 if(method==='Amount Based Credit'){
  const amount=minor(form.adjustmentAmount||'0'),taxPolicy=(invoice&&invoice.taxPolicy)||s.config;
  if(!(amount>0))throw Error('Enter an adjustment amount greater than zero.');
  if(type==='Against Invoice'&&invoice.companyId&&form.companyId&&invoice.companyId!==form.companyId)throw Error('The credit note organisation must be the invoice organisation.');
  const rates=type==='Against Invoice'?billedTaxRates(invoice):chosenTaxRates(form,taxPolicy);
  const totals=calculate({...form,lines:[{description:reason,unit:'NOS',qty:1,rate:String(amount/100),taxes:rates,invoiceItemIndex:-1,priceTaxMode:'exclusive'}]},taxPolicy);
  if(type==='Against Invoice'){
   const previous=issued(s).filter(c=>c.originalInvoiceId===invoice.id&&c.id!==form.id);
   for(const k of ['taxable','cgst','sgst','igst','cess']){const used=previous.reduce((n,c)=>n+Number(c.totals[k]||0),0),left=Math.max(0,Number(invoice.totals[k]||0)-used);if(Number(totals[k]||0)+used>Number(invoice.totals[k]||0))throw Error('This adjustment exceeds the '+money(left)+' of '+(k==='taxable'?'taxable value':'GST')+' still creditable on '+invoice.number+'. Reduce the amount.');}
   if(totals.total+previous.reduce((n,c)=>n+c.totals.total,0)>invoice.totals.total)throw Error('Credit must be within the remaining original invoice amount.');
  }
  if(totals.total<=0)throw Error('Credit must be positive.');
  return totals;
 }
 const taxOnly=isTaxOnlyReason(reason),returns=isReturnReason(reason);
 const calculationForm=taxOnly||type!=='Against Invoice'?form:{...form,lines:form.lines.map(line=>{const source=invoice.lines[line.invoiceItemIndex];return source?{...line,taxes:lineTaxes(source,invoice.totals.intra)}:line})};
 const totals=calculate(calculationForm,(invoice&&invoice.taxPolicy)||s.config);
 if(taxOnly){totals.subtotal=0;totals.discount=0;totals.taxable=0;totals.roundOff=0;totals.lines=totals.lines.map(l=>({...l,gross:0,off:0,taxable:0,total:l.cgst+l.sgst+l.igst+l.cessAmount}));totals.total=totals.cgst+totals.sgst+totals.igst+totals.cess;}
 if(type==='Against Invoice'){
  const previous=issued(s).filter(c=>c.originalInvoiceId===invoice.id&&c.id!==form.id),seen=new Set();
  for(const l of totals.lines){const index=l.invoiceItemIndex,original=invoice.totals.lines[index];if(!Number.isInteger(index)||!original||seen.has(index))throw Error('Select unique original invoice items.');seen.add(index);const prior=previous.flatMap(c=>c.totals.lines).filter(x=>x.invoiceItemIndex===index);
   for(const k of ['taxable','cgst','sgst','igst','cessAmount']){const used=prior.reduce((n,x)=>n+x[k],0),left=Math.max(0,original[k]-used);if(l[k]+used>original[k])throw Error('This line already has '+money(used)+' credited against '+money(original[k])+' on '+original.description+', so there is '+money(left)+' of '+(k==='taxable'?'taxable value':'GST')+' left to credit. Reduce the credited quantity or amount, or credit a different line.');}
   /* A goods reason may not credit more units than the invoice still has to give. */
   if(returns){const returned=previous.filter(c=>isReturnReason(c.reason)).flatMap(c=>c.totals.lines).filter(x=>x.invoiceItemIndex===index).reduce((n,x)=>n+Number(x.qty||0),0);if(Number(l.qty)+returned>Number(original.qty)+1e-9)throw Error('Returned quantity exceeds the available invoice quantity.');if(l.taxable>Math.round(original.taxable*Number(l.qty)/Number(original.qty)))throw Error('Return value exceeds the original per-unit value.');}
  }
  if(totals.total+previous.reduce((n,c)=>n+c.totals.total,0)>invoice.totals.total)throw Error('Credit must be within the remaining original invoice amount.');
 }
 if(totals.total<=0)throw Error('Credit must be positive.');
 return totals;
}
/* The accounts one credit note posts to, in the order the journal states them, derived from the same
   mapping resolution issue() uses. Pure: it reads the note, its invoice and the configured mappings and
   writes nothing, so the Accounting Preview on the form and the posting itself cannot disagree. `expects`
   is the account type the resolver must accept, and `complete` is false when a mapping the note needs is
   missing - which is exactly when the posting refuses, so the preview can say why before the operator tries. */
export function creditPostingPlan(s,note,totals){
 const invoice=s.invoices.find(i=>i.id===note.originalInvoiceId),mapping=s.config.creditMappings||{},role=creditMappingRole(note.reason);
 /* The revenue or adjustment account is the only mapping a credit note cannot do without, and an
    invoice-backed note already knows which income account it is reversing, so the resolution ends at
    the invoice line own income account and then at the configured sales account rather than refusing.
    A configured role account - salesReturn, taxAdjustment, otherAdjustment or the shared
    salesAdjustment - still wins, which is how an accountant keeps a dedicated sales-return ledger. */
 const lineIncome=(totals.lines||[]).map(l=>invoice?.lines?.[l.invoiceItemIndex]?.income||invoice?.totals?.lines?.[l.invoiceItemIndex]?.income).filter(Boolean),salesAccount=note.adjustmentAccount||mapping[role]||mapping.salesAdjustment||lineIncome[0]||s.config.sales,gstAccount=mapping[role+'Gst']||mapping.gstAdjustment,receivable=mapping.ar||invoice?.arAccount||s.config.ar;
 const tax=[['cgst','CGST'],['sgst','SGST'],['igst','IGST'],['cess','Cess']].filter(([k])=>totals[k]).map(([k,label])=>({k,label,accountRef:gstAccount||mapping[k]||s.config[k],amount:totals[k]}));
 const lines=[];
 if(totals.taxable)lines.push({role:'revenue',label:note.reason,accountRef:salesAccount,expects:['Income'],debit:totals.taxable,credit:0});
 for(const row of tax)lines.push({role:row.k,label:row.label+' reversal',accountRef:row.accountRef,expects:['Liabilities'],debit:row.amount,credit:0});
 if(totals.roundOff)lines.push({role:'roundOff',label:'Round off',accountRef:s.config.round,expects:['Expenses'],debit:Math.max(totals.roundOff,0),credit:Math.max(-totals.roundOff,0)});
 lines.push({role:'receivable',label:'Customer receivable',accountRef:receivable,expects:['Assets'],debit:0,credit:totals.total});
 const missing=[];
 if(totals.taxable&&!salesAccount)missing.push('the revenue adjustment account');
 if(tax.length&&!tax.every(row=>row.accountRef))missing.push('the GST adjustment account');
 if(!receivable)missing.push('the customer receivable account');
 return {lines,tax,mappings:{role,salesAccount,gstAccount,receivable},complete:!missing.length,missing};
}
/* What the Credit account mapping dialog opens with: the accounts the engine already falls back to, so
   an operator reads the effective mapping instead of five empty selects. A stored value always wins. */
/* What the Credit account mapping dialog opens with: the accounts the engine already falls back to, so
   an operator reads the effective mapping instead of blank selects. TWO routes are offered side by side:
   the shared sales-adjustment account, which every reason uses unless it names an account of its own, and
   the three reason-specific accounts (Sales Return, Tax Adjustment, Other Adjustment). A reason-specific
   account wins for its own reason - which is how a dedicated sales-return ledger is kept - and a blank
   one means "use the shared account". A stored value always wins over these defaults. */
export function creditMappingDefaults(s){const mapping=s.config.creditMappings||{};return {salesAdjustment:mapping.salesAdjustment||s.config.sales||'',gstAdjustment:mapping.gstAdjustment||s.config.cgst||s.config.sgst||s.config.igst||s.config.cess||'',ar:mapping.ar||s.config.ar||'',inventoryAsset:mapping.inventoryAsset||'',stockAdjustment:mapping.stockAdjustment||'',salesReturn:mapping.salesReturn||'',taxAdjustment:mapping.taxAdjustment||'',otherAdjustment:mapping.otherAdjustment||''}}
export function creditCommand(state,action,payload){const s=copy(state),p=copy(payload);s.creditNotes||=[];s.creditApplications||=[];s.creditRefunds||=[];let c=s.creditNotes.find(c=>c.id===p.id);const now=new Date().toISOString();let entry;
 if(action==='save'){
  if(c&&(c.status!=='Draft'||c.revision!==p.revision))throw Error('Only the latest draft can be edited.');if(!dateOK(p.date))throw Error('Enter a valid credit note date.');
  const type=noteType(p.type),reason=canonicalReason(p.reason),invoice=type==='Against Invoice'?s.invoices.find(i=>i.id===p.originalInvoiceId):null;
  if(invoice&&p.date<invoice.date)throw Error('Credit note date cannot precede the invoice.');
  /* A linked sales return is its own document, written by the inventory side: the note points at it
     and never creates one, so nothing moves stock here. */
  if(p.salesReturnId){const linked=(s.salesReturns||[]).find(r=>r.id===p.salesReturnId);if(!linked)throw Error('The linked sales return was not found.');if(linked.customerId&&p.customerId&&linked.customerId!==p.customerId)throw Error('The linked sales return belongs to a different customer.');if(linked.invoiceId&&p.originalInvoiceId&&linked.invoiceId!==p.originalInvoiceId)throw Error('The linked sales return belongs to a different invoice.');}
  const totals=calculateCredit(s,{...p,type,reason});let n=1;while(s.creditNotes.some(c=>c.number===`CN-${String(n).padStart(4,'0')}`))n++;const number=p.number?.trim()||`CN-${String(n).padStart(4,'0')}`;if(s.creditNotes.some(x=>x.id!==p.id&&x.number.toLowerCase()===number.toLowerCase()))throw Error('Credit note number already exists.');const old=c;c={...p,type,reason,creditMethod:creditMethod(p.creditMethod),inventoryImpact:type==='Against Invoice'&&p.originalInvoiceId&&isReturnReason(reason)?'Return Stock To Inventory':'Financial Adjustment Only',salesReturnId:p.salesReturnId||'',originalInvoiceId:type==='Against Invoice'?p.originalInvoiceId:'',customerName:p.customerName||invoice?.customerName||'',id:c?.id||crypto.randomUUID(),number,totals,revision:(c?.revision||0)+1,posted:false,status:'Draft',createdAt:c?.createdAt||now,createdBy:c?.createdBy||'Admin',updatedAt:now,updatedBy:'Admin'};s.creditNotes=old?s.creditNotes.map(x=>x.id===c.id?c:x):[...s.creditNotes,c];
 }else{
  if(!c)throw Error('Credit note not found.');
  if(action==='submit'){if(c.status!=='Draft')throw Error('Only drafts may be submitted.');c.status='Pending Approval';}
  else if(action==='approve'){if(c.status==='Approved')return {state:s,result:c};if(c.status!=='Pending Approval')throw Error('Submit for approval first.');calculateCredit(s,c);Object.assign(c,{status:'Approved',approvedAt:now,approvedBy:'Admin'});}
  else if(action==='issue'){
   if(c.posted&&c.status!=='Cancelled')return {state:s,result:c};if(c.status!=='Approved')throw Error('Approve the credit note before issuing.');const t=calculateCredit(s,c),plan=creditPostingPlan(s,c,t),lines=[];
   if(!plan.complete)throw Error('Credit Note account mapping is incomplete. Configure account mapping before posting.');
    for(const row of plan.lines)lines.push({account:account(s,row.accountRef,row.expects),debit:row.debit,credit:row.credit,description:row.label});
    const ar=lines[lines.length-1].account;entry=journal(s,{...c,creditNoteId:c.id},'Credit Note',lines,c.date,'credit-note:'+c.id);Object.assign(c,{posted:true,status:'Issued',totals:t,arAccount:ar,journalId:entry.id,issuedAt:now,issuedBy:'Admin'});
   if(p.salesReturnId)c.salesReturnId=p.salesReturnId;
  }else if(action==='apply'){
   if(c.status!=='Issued'||!c.posted)throw Error('Only issued credit notes can be applied.');if(!p.token)throw Error('Application request ID is required.');if(s.creditApplications.some(a=>a.token===p.token))return {state:s,result:c};if(!dateOK(p.date)||p.date<c.date)throw Error('Application date cannot precede the credit note.');if(!p.allocations?.length)throw Error('Select at least one invoice.');let total=0;const seen=new Set();
   for(const a of p.allocations){const i=s.invoices.find(i=>i.id===a.invoiceId),check=creditInvoiceEligibility(s,c,i);if(!check.eligible)throw Error('Invoice is not eligible: '+check.reason+'.');if(p.date<i.date)throw Error('Application cannot precede the invoice.');if(seen.has(i.id))throw Error('Select each invoice only once.');seen.add(i.id);const amount=minor(a.amount);if(amount<=0||amount>outstanding(s,i))throw Error('Application exceeds the invoice outstanding amount.');total+=amount;a.minorAmount=amount;}
   if(total>available(s,c))throw Error('Application exceeds available credit.');for(const a of p.allocations)s.creditApplications.push({id:crypto.randomUUID(),creditNoteId:c.id,invoiceId:a.invoiceId,amount:a.minorAmount,date:p.date,createdAt:now,createdBy:'Admin',token:p.token});
  }else if(action==='refund'){
   /* The credit is real money out, so it posts through the same journal every other ledger entry
      uses and lands on a bank or cash account the Chart of Accounts already holds. Only credit that
      is still available can be refunded: anything already applied to an invoice is settled there. */
   if(!c.posted||c.status==='Cancelled')throw Error('Only an issued credit note can be refunded.');
   if(!p.token)throw Error('A refund request ID is required.');
   if(s.creditRefunds.some(r=>r.token===p.token))return {state:s,result:c};
   if(!dateOK(p.date)||p.date<c.date)throw Error('Refund date cannot precede the credit note.');
   const amount=minor(p.amount);
   if(amount<=0||amount>available(s,c))throw Error('Refund must be positive and cannot exceed the available credit.');
   const bank=s.accounts.find(a=>a.code===p.bank&&a.active&&a.type==='Assets'&&/bank|cash/i.test(a.name));
   if(!bank)throw Error('Select an active cash or bank account.');
   const method=String(p.method||'').trim();if(!method)throw Error('Select a refund method.');
   entry=journal(s,{...c,creditNoteId:c.id},'Customer Refund',[{account:c.arAccount,debit:amount,credit:0,description:'Refund to '+c.customerName},{account:bank.code,debit:0,credit:amount,description:method}],p.date,'credit-refund:'+p.token);
   s.creditRefunds.push({id:crypto.randomUUID(),number:'RF-'+String(s.creditRefunds.length+1).padStart(4,'0'),creditNoteId:c.id,customerId:c.customerId,customerName:c.customerName,amount,date:p.date,bank:bank.code,method,reference:String(p.reference||'').trim(),journalId:entry.id,token:p.token,createdAt:now,createdBy:'Admin'});
  }else if(action==='cancel'){
   if(c.status==='Cancelled')return {state:s,result:c};if(!p.reason?.trim())throw Error('Cancellation reason is required.');if(refunded(s,c)>0)throw Error('This credit note has been refunded. Reverse the refund before cancelling it.');if(c.posted){const original=s.journals.find(j=>j.id===c.journalId);entry=journal(s,{...c,creditNoteId:c.id},'Credit Note Reversal',original.lines.map(l=>({...l,debit:l.credit,credit:l.debit})),today(),'credit-reversal:'+c.id);s.creditApplications.filter(a=>a.creditNoteId===c.id&&!a.voided).forEach(a=>{a.voided=true;a.voidedAt=now});}Object.assign(c,{status:'Cancelled',cancelledAt:now,cancelledBy:'Admin',cancellationReason:p.reason});
  }else throw Error('Unknown credit note action.');
  c.updatedAt=now;c.updatedBy='Admin';
 }
 s.audit.push({id:crypto.randomUUID(),creditNoteId:c.id,invoiceId:c.originalInvoiceId,action:'credit-'+action,at:now,by:'Admin',journalId:entry?.id||null,reason:p.reason||'',snapshot:action==='save'?copy(c):undefined});return {state:s,result:c};
}
export function customerCreditSummary(s,id){const invoices=s.invoices.filter(i=>i.customerId===id&&i.posted&&i.status!=='Cancelled'),credits=issued(s).filter(c=>c.customerId===id);const invoiced=invoices.reduce((n,i)=>n+i.totals.total,0),paid=s.payments.filter(p=>p.customerId===id&&!p.reversed).reduce((n,p)=>n+p.amount,0)+(s.receipts||[]).filter(r=>r.customerId===id&&!r.legacy&&r.status==='Posted').reduce((n,r)=>n+r.amount,0),credit=credits.reduce((n,c)=>n+c.totals.total,0),free=credits.reduce((n,c)=>n+available(s,c),0),back=credits.reduce((n,c)=>n+refunded(s,c),0);return {invoiced,paid,credit,available:free,refunded:back,outstanding:invoiced-paid-credit+back,invoiceOutstanding:invoices.reduce((n,i)=>n+outstanding(s,i),0)}}
export function customerStatement(s,id){const financial=ledger(s).filter(r=>r.customerId===id&&((s.invoices.find(i=>i.id===r.invoiceId)?.arAccount===r.account)||(s.creditNotes||[]).find(c=>c.id===r.creditNoteId)?.arAccount===r.account||(s.receipts||[]).some(c=>c.id===r.receiptId&&[c.arAccount,c.advanceAccount].includes(r.account)))).map(r=>({...r,statementKind:'posting'})),allocations=(s.creditApplications||[]).filter(a=>!a.voided&&(s.creditNotes||[]).find(c=>c.id===a.creditNoteId)?.customerId===id).map(a=>({id:a.id,date:a.date,createdAt:a.createdAt,reference:(s.invoices.find(i=>i.id===a.invoiceId)?.number||'Invoice')+' credit allocation',source:'Credit Application',debit:0,credit:0,allocationAmount:a.amount,invoiceId:a.invoiceId,creditNoteId:a.creditNoteId,statementKind:'allocation'}));let balance=0;return [...financial,...allocations].sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt||'').localeCompare(b.createdAt||'')).map(r=>({...r,balance:r.statementKind==='posting'?balance+=r.debit-r.credit:balance}))}
export function gstDocuments(s){const originals=[...s.invoices.filter(i=>i.posted).map(i=>({...i,kind:'Invoice',sign:1})),...(s.creditNotes||[]).filter(c=>c.posted).map(c=>({...c,kind:'Credit Note',sign:-1})),...purchaseTaxDocuments(s).map(b=>({...b,customerId:b.vendorId,customerName:b.vendorName,customerGstin:b.vendorGstin,place:b.placeOfSupply}))];const reversals=s.journals.filter(j=>['Invoice Reversal','Credit Note Reversal'].includes(j.source)).flatMap(j=>{const d=originals.find(d=>d.id===(j.creditNoteId||j.invoiceId));return d?[{...d,id:j.id,sourceDocumentId:d.id,number:d.number+' / REV',date:j.date,sign:-d.sign}]:[]});return [...originals,...reversals]}
