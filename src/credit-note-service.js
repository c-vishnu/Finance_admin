import {calculate,account,journal,minor,outstanding,today,ledger} from './invoice-engine.js';
import {purchaseTaxDocuments} from './purchase-service.js';
import {lineTaxes} from './invoice-tax.js';
export const reasons=['Sales Return','Price Adjustment','Tax Adjustment','Other Customer Adjustment'];
const copy=x=>JSON.parse(JSON.stringify(x));
const dateOK=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export const issued=s=>(s.creditNotes||[]).filter(c=>c.posted&&c.status!=='Cancelled');
export const applied=(s,c)=>(s.creditApplications||[]).filter(a=>a.creditNoteId===c.id&&!a.voided).reduce((n,a)=>n+a.amount,0);
export const available=(s,c)=>c.posted&&c.status!=='Cancelled'?c.totals.total-applied(s,c):0;
export const adjustmentStatus=(s,c)=>!applied(s,c)?'Unapplied':available(s,c)?'Partially Applied':'Fully Applied';
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
export function creditLine(invoice,index){const l=invoice.lines[index];return {...copy(l),invoiceItemIndex:index,description:l.description,unit:l.unit,taxes:lineTaxes(l,invoice.totals.intra)}}
export function calculateCredit(s,form){
 const invoice=s.invoices.find(i=>i.id===form.originalInvoiceId);if(!invoice||!invoice.posted||invoice.status==='Cancelled')throw Error('Select a posted, non-cancelled invoice.');
 if(form.customerId!==invoice.customerId)throw Error('Credit note customer must match the original invoice.');
 if(!reasons.includes(form.reason))throw Error('Select a credit note reason.');
 if(form.place!==invoice.place)throw Error('Place of supply must match the original invoice.');
 // Returns and price corrections must reverse the source invoice's tax treatment.
 // Ignore stale or edited component rates carried by the credit-note form.
 const calculationForm=form.reason==='Tax Adjustment'?form:{...form,lines:form.lines.map(line=>{const source=invoice.lines[line.invoiceItemIndex];return source?{...line,taxes:lineTaxes(source,invoice.totals.intra)}:line})};
 const totals=calculate(calculationForm,invoice.taxPolicy||s.config);
 if(form.reason==='Tax Adjustment'){totals.subtotal=0;totals.discount=0;totals.taxable=0;totals.roundOff=0;totals.lines=totals.lines.map(l=>({...l,gross:0,off:0,taxable:0,total:l.cgst+l.sgst+l.igst+l.cessAmount}));totals.total=totals.cgst+totals.sgst+totals.igst+totals.cess;}
 const previous=issued(s).filter(c=>c.originalInvoiceId===invoice.id&&c.id!==form.id),seen=new Set();
 for(const l of totals.lines){const index=l.invoiceItemIndex,original=invoice.totals.lines[index];if(!Number.isInteger(index)||!original||seen.has(index))throw Error('Select unique original invoice items.');seen.add(index);const prior=previous.flatMap(c=>c.totals.lines).filter(x=>x.invoiceItemIndex===index);
  for(const k of ['taxable','cgst','sgst','igst','cessAmount'])if(l[k]+prior.reduce((n,x)=>n+x[k],0)>original[k])throw Error('Credit exceeds the remaining '+k+' on '+original.description+'.');
  if(form.reason==='Sales Return'){const returned=previous.filter(c=>c.reason==='Sales Return').flatMap(c=>c.lines).filter(x=>x.invoiceItemIndex===index).reduce((n,x)=>n+Number(x.qty),0);if(Number(l.qty)+returned>Number(original.qty)+1e-9)throw Error('Returned quantity exceeds the available invoice quantity.');if(l.taxable>Math.round(original.taxable*Number(l.qty)/Number(original.qty)))throw Error('Return value exceeds the original per-unit value.');}
 }
 if(totals.total<=0||totals.total+previous.reduce((n,c)=>n+c.totals.total,0)>invoice.totals.total)throw Error('Credit must be positive and within the remaining original invoice amount.');
 return totals;
}
export function creditCommand(state,action,payload){const s=copy(state),p=copy(payload);s.creditNotes||=[];s.creditApplications||=[];let c=s.creditNotes.find(c=>c.id===p.id);const now=new Date().toISOString();let entry;
 if(action==='save'){
  if(c&&(c.status!=='Draft'||c.revision!==p.revision))throw Error('Only the latest draft can be edited.');if(!dateOK(p.date))throw Error('Enter a valid credit note date.');const invoice=s.invoices.find(i=>i.id===p.originalInvoiceId);if(invoice&&p.date<invoice.date)throw Error('Credit note date cannot precede the invoice.');const totals=calculateCredit(s,p);let n=1;while(s.creditNotes.some(c=>c.number===`CN-${String(n).padStart(4,'0')}`))n++;const number=p.number?.trim()||`CN-${String(n).padStart(4,'0')}`;if(s.creditNotes.some(x=>x.id!==p.id&&x.number.toLowerCase()===number.toLowerCase()))throw Error('Credit note number already exists.');const old=c;c={...p,id:c?.id||crypto.randomUUID(),number,totals,customerName:invoice.customerName,revision:(c?.revision||0)+1,posted:false,status:'Draft',createdAt:c?.createdAt||now,createdBy:c?.createdBy||'Admin',updatedAt:now,updatedBy:'Admin'};s.creditNotes=old?s.creditNotes.map(x=>x.id===c.id?c:x):[...s.creditNotes,c];
 }else{
  if(!c)throw Error('Credit note not found.');
  if(action==='submit'){if(c.status!=='Draft')throw Error('Only drafts may be submitted.');c.status='Pending Approval';}
  else if(action==='approve'){if(c.status==='Approved')return {state:s,result:c};if(c.status!=='Pending Approval')throw Error('Submit for approval first.');calculateCredit(s,c);Object.assign(c,{status:'Approved',approvedAt:now,approvedBy:'Admin'});}
  else if(action==='issue'){
   if(c.posted&&c.status!=='Cancelled')return {state:s,result:c};if(c.status!=='Approved')throw Error('Approve the credit note before issuing.');const t=calculateCredit(s,c),invoice=s.invoices.find(i=>i.id===c.originalInvoiceId);const mapping=s.config.creditMappings||{};const role=c.reason==='Sales Return'?'salesReturn':c.reason==='Price Adjustment'?'salesAdjustment':'otherAdjustment';const lines=[];
   const salesAccount=mapping[role]||mapping.salesAdjustment,gstAccount=mapping.gstAdjustment,receivable=mapping.ar||invoice.arAccount||s.config.ar,taxTotal=t.cgst+t.sgst+t.igst+t.cess;
   if((t.taxable&&!salesAccount)||(taxTotal&&!gstAccount&&!['cgst','sgst','igst','cess'].every(k=>!t[k]||mapping[k]||s.config[k]))||!receivable)throw Error('Credit Note account mapping is incomplete. Configure account mapping before posting.');
   if(t.taxable)lines.push({account:account(s,salesAccount,['Income']),debit:t.taxable,credit:0,description:c.reason});
   for(const k of ['cgst','sgst','igst','cess'])if(t[k])lines.push({account:account(s,gstAccount||mapping[k]||s.config[k],['Liabilities']),debit:t[k],credit:0,description:k.toUpperCase()});
   if(t.roundOff)lines.push({account:account(s,s.config.round,['Expenses']),debit:Math.max(t.roundOff,0),credit:Math.max(-t.roundOff,0),description:'Round off'});
   const ar=account(s,receivable,['Assets']);lines.push({account:ar,debit:0,credit:t.total});entry=journal(s,{...c,creditNoteId:c.id},'Credit Note',lines,c.date,'credit-note:'+c.id);Object.assign(c,{posted:true,status:'Issued',totals:t,arAccount:ar,journalId:entry.id,issuedAt:now,issuedBy:'Admin'});
  }else if(action==='apply'){
   if(c.status!=='Issued'||!c.posted)throw Error('Only issued credit notes can be applied.');if(!p.token)throw Error('Application request ID is required.');if(s.creditApplications.some(a=>a.token===p.token))return {state:s,result:c};if(!dateOK(p.date)||p.date<c.date)throw Error('Application date cannot precede the credit note.');if(!p.allocations?.length)throw Error('Select at least one invoice.');let total=0;const seen=new Set();
   for(const a of p.allocations){const i=s.invoices.find(i=>i.id===a.invoiceId),check=creditInvoiceEligibility(s,c,i);if(!check.eligible)throw Error('Invoice is not eligible: '+check.reason+'.');if(p.date<i.date)throw Error('Application cannot precede the invoice.');if(seen.has(i.id))throw Error('Select each invoice only once.');seen.add(i.id);const amount=minor(a.amount);if(amount<=0||amount>outstanding(s,i))throw Error('Application exceeds the invoice outstanding amount.');total+=amount;a.minorAmount=amount;}
   if(total>available(s,c))throw Error('Application exceeds available credit.');for(const a of p.allocations)s.creditApplications.push({id:crypto.randomUUID(),creditNoteId:c.id,invoiceId:a.invoiceId,amount:a.minorAmount,date:p.date,createdAt:now,createdBy:'Admin',token:p.token});
  }else if(action==='cancel'){
   if(c.status==='Cancelled')return {state:s,result:c};if(!p.reason?.trim())throw Error('Cancellation reason is required.');if(c.posted){const original=s.journals.find(j=>j.id===c.journalId);entry=journal(s,{...c,creditNoteId:c.id},'Credit Note Reversal',original.lines.map(l=>({...l,debit:l.credit,credit:l.debit})),today(),'credit-reversal:'+c.id);s.creditApplications.filter(a=>a.creditNoteId===c.id&&!a.voided).forEach(a=>{a.voided=true;a.voidedAt=now});}Object.assign(c,{status:'Cancelled',cancelledAt:now,cancelledBy:'Admin',cancellationReason:p.reason});
  }else throw Error('Unknown credit note action.');
  c.updatedAt=now;c.updatedBy='Admin';
 }
 s.audit.push({id:crypto.randomUUID(),creditNoteId:c.id,invoiceId:c.originalInvoiceId,action:'credit-'+action,at:now,by:'Admin',journalId:entry?.id||null,reason:p.reason||'',snapshot:action==='save'?copy(c):undefined});return {state:s,result:c};
}
export function customerCreditSummary(s,id){const invoices=s.invoices.filter(i=>i.customerId===id&&i.posted&&i.status!=='Cancelled'),credits=issued(s).filter(c=>c.customerId===id);const invoiced=invoices.reduce((n,i)=>n+i.totals.total,0),paid=s.payments.filter(p=>p.customerId===id&&!p.reversed).reduce((n,p)=>n+p.amount,0)+(s.receipts||[]).filter(r=>r.customerId===id&&!r.legacy&&r.status==='Posted').reduce((n,r)=>n+r.amount,0),credit=credits.reduce((n,c)=>n+c.totals.total,0),free=credits.reduce((n,c)=>n+available(s,c),0);return {invoiced,paid,credit,available:free,outstanding:invoiced-paid-credit,invoiceOutstanding:invoices.reduce((n,i)=>n+outstanding(s,i),0)}}
export function customerStatement(s,id){const financial=ledger(s).filter(r=>r.customerId===id&&((s.invoices.find(i=>i.id===r.invoiceId)?.arAccount===r.account)||(s.creditNotes||[]).find(c=>c.id===r.creditNoteId)?.arAccount===r.account||(s.receipts||[]).some(c=>c.id===r.receiptId&&[c.arAccount,c.advanceAccount].includes(r.account)))).map(r=>({...r,statementKind:'posting'})),allocations=(s.creditApplications||[]).filter(a=>!a.voided&&(s.creditNotes||[]).find(c=>c.id===a.creditNoteId)?.customerId===id).map(a=>({id:a.id,date:a.date,createdAt:a.createdAt,reference:(s.invoices.find(i=>i.id===a.invoiceId)?.number||'Invoice')+' credit allocation',source:'Credit Application',debit:0,credit:0,allocationAmount:a.amount,invoiceId:a.invoiceId,creditNoteId:a.creditNoteId,statementKind:'allocation'}));let balance=0;return [...financial,...allocations].sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt||'').localeCompare(b.createdAt||'')).map(r=>({...r,balance:r.statementKind==='posting'?balance+=r.debit-r.credit:balance}))}
export function gstDocuments(s){const originals=[...s.invoices.filter(i=>i.posted).map(i=>({...i,kind:'Invoice',sign:1})),...(s.creditNotes||[]).filter(c=>c.posted).map(c=>({...c,kind:'Credit Note',sign:-1})),...purchaseTaxDocuments(s).map(b=>({...b,customerId:b.vendorId,customerName:b.vendorName,customerGstin:b.vendorGstin,place:b.placeOfSupply}))];const reversals=s.journals.filter(j=>['Invoice Reversal','Credit Note Reversal'].includes(j.source)).flatMap(j=>{const d=originals.find(d=>d.id===(j.creditNoteId||j.invoiceId));return d?[{...d,id:j.id,sourceDocumentId:d.id,number:d.number+' / REV',date:j.date,sign:-d.sign}]:[]});return [...originals,...reversals]}
