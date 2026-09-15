import {ledger} from './invoice-engine.js';
import {receiptRows,receiptAllocations,receiptCommand} from './receipt-engine.js';

const postedState=s=>({...s,journals:s.journals.filter(j=>j.status==='Posted')});
export function receiptJournals(s,r){return s.journals.filter(j=>j.status==='Posted'&&(j.receiptId===r.id||j.id===r.journalId));}

// Run the very same posting validations on an isolated copy. Never write this result.
export function receiptPreview(s,r,context={}){
 if(r.posted)return {journals:receiptJournals(s,r),preview:false,error:''};
 if(r.status==='Cancelled')return {journals:[],preview:false,error:'Cancelled receipts have no accounting impact.'};
 try{
  const clone=JSON.parse(JSON.stringify(s));
  const candidate=clone.receipts?.find(x=>x.id===r.id);
  if(!candidate)throw Error('Save the draft to preview accounting.');
  candidate.status='Approved';
  const out=receiptCommand(clone,'post',{id:r.id},{...context,role:'Finance Manager',actor:'Preview only'});
  return {journals:receiptJournals(out.state,out.result).filter(j=>!s.journals.some(old=>old.id===j.id)),preview:true,error:''};
 }catch(e){return {journals:[],preview:true,error:e.message};}
}

function metadata(s,l){
 const receipt=receiptRows(s).find(r=>r.id===l.receiptId||r.journalId===l.journalId);
 const invoice=s.invoices.find(i=>i.id===l.invoiceId);
 const credit=(s.creditNotes||[]).find(c=>c.id===l.creditNoteId);
 let transactionType=/revers|cancel/i.test(l.source)?'Reversal':/allocation/i.test(l.source)?'Receipt Allocation':receipt?(receipt.kind==='Advance'?'Advance Receipt':'Receipt'):credit?'Credit Note':/invoice/i.test(l.source)?'Invoice':'Adjustment';
 const sourceDocument=receipt?'Receipt':credit?'Credit Note':invoice?'Invoice':'Journal';
 const references=receipt?receiptAllocations(s,receipt).filter(a=>!a.voided).map(a=>s.invoices.find(i=>i.id===a.invoiceId)?.number).filter(Boolean):[];
 return {...l,transactionType,sourceDocument,voucherNumber:receipt?.number||credit?.number||invoice?.number||l.number,externalReference:receipt?[...new Set([receipt.reference,...references].filter(Boolean))].join(', '):l.reference||'',journalNumber:l.number};
}

export function receiptLedger(s,r,kind='Customer Ledger'){
 const invoices=s.invoices.filter(i=>i.customerId===r.customerId);
 // Trade receivables only. Customer advances are a liability, not negative trade AR.
 const ar=new Set([...invoices.map(i=>i.arAccount),...receiptRows(s).filter(x=>x.customerId===r.customerId).map(x=>x.arAccount)].filter(Boolean));
 let balance=0;
 return ledger(postedState(s)).filter(l=>kind==='Bank/Cash Ledger'?l.account===r.bank:l.customerId===r.customerId&&ar.has(l.account)).map(l=>({...metadata(s,l),balance:balance+=l.debit-l.credit}));
}

export function receiptBankSuggestions(s,r){
 if(r.status!=='Posted')return [];
 const matches=(s.receiptMatches||[]).filter(m=>!m.voided);
 const remaining=r.amount-matches.filter(m=>m.receiptId===r.id).reduce((n,m)=>n+m.amount,0);
 if(remaining<=0)return [];
 return (s.receiptBankLines||[]).filter(b=>b.bank===r.bank).map(b=>{
  const available=b.amount-matches.filter(m=>m.bankLineId===b.id).reduce((n,m)=>n+m.amount,0);
  const exact=available===remaining,reference=Boolean(r.reference&&b.reference&&r.reference.trim().toLowerCase()===b.reference.trim().toLowerCase()),sameDate=b.date===r.date;
  return {...b,available,suggestedAmount:Math.min(available,remaining),score:(exact?4:0)+(reference?3:0)+(sameDate?1:0),reason:[exact?'Amount matches':'Partial amount',reference?'Reference matches':'',sameDate?'Same date':''].filter(Boolean).join(' · ')};
 }).filter(b=>b.available>0&&b.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,3);
}
