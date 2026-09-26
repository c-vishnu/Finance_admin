// Reporting projection only: never writes, recalculates or posts accounting entries.
export const TRANSACTION_TYPES=['Sales Invoice','Purchase Invoice','Receipt','Payment','Journal Entry','Credit Note','Debit Note','Transfer'];
export const UNASSIGNED='Unassigned';
const list=(s,key)=>Array.isArray(s[key])?s[key]:[];
const value=v=>v==null||v===''?UNASSIGNED:String(v);
export function transactionType(source=''){
  if(/Credit Note/i.test(source))return 'Credit Note';
  if(/Debit Note/i.test(source))return 'Debit Note';
  if(/Invoice/i.test(source))return 'Sales Invoice';
  if(/Bill|Purchase/i.test(source))return 'Purchase Invoice';
  if(/Customer Payment|Receipt|Payment Received/i.test(source))return 'Receipt';
  if(/Payment|Refund/i.test(source))return 'Payment';
  if(/Expense/i.test(source))return 'Expense';
  if(/Opening/i.test(source))return 'Opening Balance';
  if(/Transfer|Bank|Cash/i.test(source))return 'Transfer';
  return 'Journal Entry';
}
export function fiscalYear(date){const y=Number(date?.slice(0,4)),m=Number(date?.slice(5,7));return y&&m?'FY '+(m<4?y-1:y)+'–'+String(m<4?y:y+1).slice(2):UNASSIGNED;}
function findSource(s,j){
  const type=transactionType(j.source);
  if(j.receiptId)return {doc:list(s,'receipts').find(r=>r.id===j.receiptId),collection:'receipts'};
  if(j.creditNoteId)return {doc:list(s,'creditNotes').find(c=>c.id===j.creditNoteId),collection:'creditNotes'};
  const specific={Receipt:'payments',Payment:'paymentsMade','Purchase Bill':'bills',Expense:'expenses','Debit Note':'debitNotes','Bank Transaction':'bankTransactions','Opening Balance':'openings'}[type];
  if(specific){const doc=list(s,specific).find(d=>(j.id&&d.journalId===j.id)||(j.sourceId&&d.id===j.sourceId));return {doc,collection:specific};}
  if(type==='Sales Invoice')return {doc:list(s,'invoices').find(i=>i.id===j.invoiceId||i.id===j.sourceId),collection:'invoices'};
  return {doc:null,collection:'journals'};
}
function dimension(j,doc,line,key){return value(line?.[key]??line?.[key+'Id']??j[key]??j[key+'Id']??doc?.[key]??doc?.[key+'Id']);}
export function daybookRows(s){
  return list(s,'journals').filter(j=>j.status==='Posted').map(j=>{
    const {doc,collection}=findSource(s,j),invoice=list(s,'invoices').find(i=>i.id===j.invoiceId);
    const lines=Array.isArray(j.lines)?j.lines:[],reversal=/Reversal/i.test(j.source||'');
    const amount=k=>lines.reduce((n,l)=>n+(Number.isSafeInteger(l[k])?l[k]:0),0);
    const invalid=lines.some(l=>!Number.isSafeInteger(l.debit)||!Number.isSafeInteger(l.credit)||l.debit<0||l.credit<0||!list(s,'accounts').some(a=>a.code===l.account))||!lines.length;
    const dims=lines.map(l=>Object.fromEntries(['branch','costCentre','department','project'].map(k=>[k,dimension(j,doc,l,k)])));
    const company=value(j.companyId??j.company??doc?.companyId??doc?.company);
    const debit=amount('debit'),credit=amount('credit');
    const voucher=doc?.number||j.reference||j.number||'Missing voucher';
    const party=doc?.customerName||doc?.vendorName||doc?.partyName||invoice?.customerName||'—';
    return {id:j.id,journal:j,doc,collection,date:j.date||'',voucher,journalNumber:j.number||'—',type:transactionType(j.source),source:j.source||'Journal Entry',reference:doc?.reference||j.reference||'—',party,customer:doc?.customerName||invoice?.customerName||'',supplier:doc?.vendorName||'',description:doc?.narration||doc?.description||doc?.reference||lines.map(l=>l.description).filter(Boolean).join(' · ')||j.source||'Journal entry',debit,credit,amount:debit,company,year:fiscalYear(j.date),dimensions:dims,accounts:lines.map(l=>String(l.account)),createdBy:j.createdBy||'Not recorded',createdAt:j.createdAt||'',modifiedBy:doc?.modifiedBy||j.modifiedBy||'',modifiedAt:doc?.modifiedAt||j.modifiedAt||'',approvedBy:doc?.approvedBy||j.approvedBy||'Not recorded',approval:doc?.approvalStatus||j.approvalStatus||(doc?.approvedBy?'Approved':'Not recorded'),status:reversal?'Reversal':doc?.status==='Cancelled'?'Cancelled':'Posted',reversal,balanced:!invalid&&debit===credit,invalid,missingSource:collection!=='journals'&&!doc,posted:true};
  }).sort((a,b)=>a.date.localeCompare(b.date)||String(a.createdAt).localeCompare(String(b.createdAt))||a.id.localeCompare(b.id));
}
export function unpostedRows(s){
  return ['receipts','invoices','creditNotes','bills','paymentsMade','expenses','debitNotes','bankTransactions'].flatMap(collection=>list(s,collection).filter(d=>!d.posted&&!list(s,'journals').some(j=>j.status==='Posted'&&j.id===d.journalId)).map(d=>({id:collection+':'+d.id,doc:d,collection,date:d.date||'',voucher:d.number||'Unnumbered',journalNumber:'—',type:transactionType({receipts:'Customer Receipt',invoices:'Sales Invoice',creditNotes:'Credit Note',bills:'Purchase Bill',paymentsMade:'Payment',expenses:'Expense',debitNotes:'Debit Note',bankTransactions:'Bank Transaction'}[collection]),source:'Unposted document',reference:d.reference||'—',party:d.customerName||d.vendorName||'—',description:d.narration||d.description||'Not included in the ledger',debit:0,credit:0,amount:0,company:value(d.companyId??d.company),year:fiscalYear(d.date),dimensions:[Object.fromEntries(['branch','costCentre','department','project'].map(k=>[k,dimension({},d,null,k)]))],createdBy:d.createdBy||'Not recorded',createdAt:d.createdAt||'',approvedBy:d.approvedBy||'Not recorded',approval:d.approvalStatus||d.status||'Not recorded',status:d.status||'Draft',posted:false,balanced:true}))).sort((a,b)=>a.date.localeCompare(b.date));
}
export function filterDaybook(rows,f={}){
  if(f.from&&f.to&&f.from>f.to)throw Error('Start date must be on or before end date.');
  return rows.filter(r=>{
    if(f.from&&r.date<f.from||f.to&&r.date>f.to)return false;
    for(const key of ['company','year','type','status','createdBy','approval','customer','supplier'])if(f[key]&&f[key]!=='All'&&r[key]!==f[key])return false;
    if(f.account&&f.account!=='All'&&!r.accounts?.includes(f.account))return false;
    if(!f.includeCancelled&&r.status==='Cancelled')return false;
    // Match dimensions together on a line, but retain the complete voucher for balanced totals.
    if(['branch','costCentre','department','project'].some(k=>f[k]&&f[k]!=='All')&&!r.dimensions.some(d=>['branch','costCentre','department','project'].every(k=>!f[k]||f[k]==='All'||d[k]===f[k])))return false;
    return !f.search||[r.voucher,r.journalNumber,r.reference,r.party,r.description].join(' ').toLowerCase().includes(f.search.toLowerCase());
  });
}
export function summarizeDaybook(rows){
  const posted=rows.filter(r=>r.posted),sum=k=>posted.reduce((n,r)=>n+r[k],0);
  const activity=type=>posted.filter(r=>r.type===type).reduce((n,r)=>n+(r.reversal?-1:1)*r.amount,0);
  return {count:posted.length,debit:sum('debit'),credit:sum('credit'),sales:activity('Sales Invoice'),purchases:activity('Purchase Bill'),receipts:activity('Receipt'),payments:activity('Payment'),balanced:posted.every(r=>r.balanced)&&sum('debit')===sum('credit'),issues:posted.filter(r=>!r.balanced||r.missingSource).length};
}
export function rowDimension(r,k){return [...new Set(r.dimensions.map(d=>d[k]))].join(', ');}
export function daybookAudit(s,row){
  const j=row.journal,d=row.doc;
  return [...list(s,'audit').filter(e=>(j?.id&&e.journalId===j.id)||(d?.id&&row.collection==='receipts'&&e.receiptId===d.id)||(d?.id&&row.collection==='invoices'&&e.invoiceId===d.id)||(d?.id&&row.collection==='creditNotes'&&e.creditNoteId===d.id)),...list(s,'accountAudit').filter(e=>j?.id&&e.after?.journalId===j.id)].sort((a,b)=>String(a.at).localeCompare(String(b.at)));
}
