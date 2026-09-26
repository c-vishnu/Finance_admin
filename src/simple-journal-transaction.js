/* Simple journal transactions - the plain-language layer over the accounting engine.

   A normal user answers one question: what happened? They pick a transaction
   type, name it, enter an amount, then pick the money account and either a
   category or a party. This module turns that answer into the balanced
   double-entry lines src/invoice-engine.js posts, and it owns the transaction
   status lifecycle and the local approval-duty simulation.

   Nothing here touches storage or the DOM: the page keeps persistence, the
   engine keeps the posting and period rules, and the Chart of Accounts keeps the
   account mapping, so a simple transaction can never grow a second accounting
   path and no debit/credit vocabulary leaks into the form. */
import {formatRupees} from './number-format.js';

/* The one storage key for manual and simple transactions, shared by the page and
   the demo bootstrap so the register and the seed can never disagree. */
export const MANUAL_JOURNAL_KEY='wayvida-manual-journals-v2';

const uuid=()=>crypto.randomUUID();
const round2=value=>Math.round((Number(value)||0)*100)/100;
const CASH=/cash|bank|wallet/i;

/* ---------- Vocabulary ---------- */

export const TRANSACTION_TYPES=[['expense','Expense'],['income','Income'],['transfer','Transfer'],['customer_payment','Customer Payment'],['vendor_payment','Vendor Payment']];
export const TRANSACTION_TYPE_LABEL=Object.fromEntries(TRANSACTION_TYPES);
export const transactionTypeLabel=value=>TRANSACTION_TYPE_LABEL[value]||value||'Transaction';

/* The status lifecycle: Draft -> Pending Approval -> Approved, Pending Approval
   -> Rejected, Rejected -> Draft by resubmitting, and Approved -> Reversed
   through the ledger's own reversal mechanism. A submitted journal can also be
   Cancelled while it is still unposted. Approved is the only status that owns a
   posting. The words are the ones the rest of the application already uses -
   budgets, credit notes, invoices and inventory adjustments all say Pending
   Approval and Approved - so Period Lock's pending-approval count sees these
   rows too. */
export const TRANSACTION_STATUSES=['Draft','Pending Approval','Approved','Rejected','Reversed','Cancelled'];
/* Rows written before this vocabulary existed keep working: Pending and
   Published were this module's earlier spelling of Pending Approval and
   Approved, and Posted was the register's. */
const STATUS_ALIASES={Pending:'Pending Approval',Published:'Approved',Posted:'Approved'};
export const normaliseStatus=value=>{const raw=String(value||'').trim();return TRANSACTION_STATUSES.includes(raw)?raw:(STATUS_ALIASES[raw]||'Draft')};
export const canEditStatus=value=>['Draft','Rejected'].includes(normaliseStatus(value));

/* Only the approved status owns a ledger posting. Draft, Pending, Rejected and
   Reversed are operational records: they never reach the General Ledger, the
   Trial Balance, Profit and Loss, the Balance Sheet or any account balance. */
export const POSTING_STATUS='Approved';
export const postsToLedger=value=>normaliseStatus(value)===POSTING_STATUS;

/* The acting role simulates approval duty for the prototype; it is never
   authentication. src/inventory-adjustments.js draws the same boundary, and the
   page derives this role from the View as switch rather than a second control. */
export const JOURNAL_ROLES=['Accountant','Finance Manager','Admin'];
const JOURNAL_PERMISSIONS={
 Accountant:['save','submit','export','delete'],
 'Finance Manager':['save','submit','export','delete','approve','post','reverse','cancel'],
 Admin:['save','submit','export','delete','approve','post','reverse','cancel']
};
export const journalAllowed=(role,action)=>(JOURNAL_PERMISSIONS[role]||[]).includes(action);

export const JOURNAL_ACTIONS={
 Draft:['Edit','Preview','Duplicate','Submit for Approval','Approve','Delete'],
 'Pending Approval':['Preview','Duplicate','Approve','Reject','Cancel journal'],
 Approved:['Preview','Duplicate','Reverse'],
 Rejected:['Edit','Preview','Duplicate','Resubmit','Delete'],
 Reversed:['Preview','Duplicate'],
 Cancelled:['Preview','Duplicate']
};
export const JOURNAL_ACTION_DUTY={Edit:'save','Submit for Approval':'submit',Resubmit:'submit',Approve:'post',Reject:'approve','Cancel journal':'cancel',Reverse:'reverse',Delete:'delete'};
/* The words the business view shows for the same stored status. Reversed is a
   corrected posting, which is not the same thing as a cancelled one. */
export const BUSINESS_STATUS_LABELS={'Pending Approval':'Waiting for Approval',Approved:'Completed',Reversed:'Corrected'};
export const statusText=(value,business=false)=>{const status=normaliseStatus(value);return business?(BUSINESS_STATUS_LABELS[status]||status):status};

/* ---------- Presentation helpers ---------- */

export const formatMoney=value=>formatRupees(value);
export const accountName=(accounts=[],code,fallback='Not selected')=>(accounts||[]).find(account=>account.code===code)?.name||fallback;
export const isMoneyAccount=account=>Boolean(account?.active)&&!account?.isGroup&&account?.type==='Assets'&&CASH.test([account.name,account.group,account.accountNature,account.accountPurpose].filter(Boolean).join(' '));
export const moneyAccounts=(accounts=[])=>(accounts||[]).filter(isMoneyAccount);

/* The category list is the Chart of Accounts itself, narrowed to the side of the
   Profit and Loss the chosen transaction type belongs to, so no separate fake
   category system exists. */
export function categoryAccounts(accounts=[],type){
 const wanted=type==='income'?'Income':type==='expense'?'Expenses':null;
 if(!wanted)return [];
 return (accounts||[]).filter(account=>account.active&&!account.isGroup&&account.type===wanted);
}

/* ---------- Counterparty and document resolution ---------- */

export function counterpartyAccount(state={},ctx={}){
 const accounts=ctx.accounts||[];
 if(state.transactionType==='customer_payment')return (ctx.customers||[]).find(row=>row.id===state.partyId)?.account||accounts.find(account=>account.name==='Accounts Receivable')?.code||'1100';
 if(state.transactionType==='vendor_payment')return (ctx.vendors||[]).find(row=>row.id===state.partyId)?.payableAccountId||accounts.find(account=>account.name==='Accounts Payable')?.code||'2000';
 return '';
}
export function partyName(state={},ctx={}){
 if(state.transactionType==='customer_payment')return (ctx.customers||[]).find(row=>row.id===state.partyId)?.name||state.partyName||'';
 if(state.transactionType==='vendor_payment')return (ctx.vendors||[]).find(row=>row.id===state.partyId)?.name||state.partyName||'';
 return '';
}
export const selectedDocument=(state={},ctx={})=>(ctx.documents||[]).find(row=>row.id===state.documentId)||null;
export const settlementTypes=['customer_payment','vendor_payment'];

/* ---------- Validation ---------- */

export function getValidationErrors(state={},ctx={}){
 const accounts=ctx.accounts||[],errors={},type=state.transactionType;
 const present=key=>Boolean(String(state[key]??'').trim());
 const require=(key,message)=>{if(!present(key))errors[key]=message};
 if(!present('transactionType'))errors.transactionType='Select a transaction type';
 require('name','Enter a transaction name');
 require('date','Select a date');
 const entered=String(state.amount??'').trim();
 if(!entered)errors.amount='Enter an amount';
 else if(!/^\d+(\.\d{1,2})?$/.test(entered))errors.amount='Enter a valid amount with at most two decimals';
 else if(Number(entered)<=0)errors.amount='Enter an amount greater than zero';
 else if(Number(entered)>1e11)errors.amount='Enter a smaller amount';
 if(type==='expense'){require('moneyAccount','Select where the money was paid from');require('category','Choose a category')}
 if(type==='income'){require('moneyAccount','Select where the money was received');require('category','Choose a category')}
 if(type==='transfer'){
  require('moneyAccount','Select the account the money moved from');
  require('toAccount','Select the account the money moved to');
  if(present('moneyAccount')&&state.moneyAccount===state.toAccount)errors.toAccount='Choose a different account to move the money into';
 }
 if(type==='customer_payment'){require('partyId','Choose the customer');require('moneyAccount','Select where the money was received')}
 if(type==='vendor_payment'){require('partyId','Choose the vendor');require('moneyAccount','Select where the money was paid from')}
 for(const key of ['moneyAccount','toAccount','category'])if(present(key)&&!errors[key]){
  const account=accounts.find(row=>row.code===state[key]);
  if(!account)errors[key]='Choose an account from your Chart of Accounts';
  else if(!account.active||account.isGroup)errors[key]='That account cannot receive postings';
 }
 if(settlementTypes.includes(type)&&present('partyId')){
  const list=(type==='customer_payment'?ctx.customers:ctx.vendors)||[];
  if(list.length&&!list.some(row=>row.id===state.partyId))errors.partyId=type==='customer_payment'?'Choose the customer':'Choose the vendor';
  const code=counterpartyAccount(state,ctx),account=accounts.find(row=>row.code===code);
  if(!errors.partyId&&(!account||!account.active||account.isGroup))errors.partyId='This party has no active ledger account in the Chart of Accounts';
 }
 const document=selectedDocument(state,ctx);
 if(present('documentId')&&!document)errors.documentId='Choose an invoice or bill from this organisation';
 if(document&&!errors.amount&&Number(entered)>0&&Number(document.outstanding)/100+0.005<Number(entered))errors.amount=`Amount exceeds the open ${document.kind==='Bill'?'bill':'invoice'} balance of ${formatMoney(Number(document.outstanding)/100)}`;
 return errors;
}

/* ---------- Plain-language summary and preview ---------- */

export function generateSummary(state={},ctx={}){
 const accounts=ctx.accounts||[],type=state.transactionType,value=formatMoney(state.amount);
 if(!type)return 'Select a transaction type to continue.';
 const money=accountName(accounts,state.moneyAccount,'the selected account'),category=accountName(accounts,state.category,'the selected category');
 const document=selectedDocument(state,ctx),party=partyName(state,ctx)||'the party';
 if(type==='expense')return `${value} paid from ${money} for ${category}.`;
 if(type==='income')return `${value} received into ${money} as ${category}.`;
 if(type==='transfer')return `${value} moved from ${money} to ${accountName(accounts,state.toAccount,'the selected account')}.`;
 if(type==='customer_payment')return document?`${value} received from ${party} into ${money}, applied to ${document.number}.`:`${value} received from ${party} into ${money}, held against their account until an invoice is chosen.`;
 if(type==='vendor_payment')return document?`${value} paid to ${party} from ${money}, settling ${document.number}.`:`${value} paid to ${party} from ${money}, held against their account until a bill is chosen.`;
 return `${value} recorded.`;
}

export function getAccountingPreview(state={},ctx={}){
 const accounts=ctx.accounts||[],lines=getSimplePostingLines(state,ctx);
 const debit=lines.find(line=>Number(line.debit)>0),credit=lines.find(line=>Number(line.credit)>0);
 return {debit:accountName(accounts,debit?.account,'Not selected'),credit:accountName(accounts,credit?.account,'Not selected'),amount:Number(state.amount)||0};
}

/* ---------- The balanced postings ---------- */

/* One double entry per transaction type. This is the only place a simple
   transaction becomes accounting, and the engine still validates balance,
   period locks, control accounts and branch rules when it posts. */
export function getSimplePostingLines(state={},ctx={}){
 const value=round2(state.amount),type=state.transactionType,lines=[];
 const add=(account,debit,credit)=>{if(account&&(debit||credit))lines.push({account,debit:debit||'',credit:credit||''})};
 if(type==='expense'){add(state.category,value,0);add(state.moneyAccount,0,value)}
 else if(type==='income'){add(state.moneyAccount,value,0);add(state.category,0,value)}
 else if(type==='transfer'){add(state.toAccount,value,0);add(state.moneyAccount,0,value)}
 else if(type==='customer_payment'){add(state.moneyAccount,value,0);add(counterpartyAccount(state,ctx),0,value)}
 else if(type==='vendor_payment'){add(counterpartyAccount(state,ctx),value,0);add(state.moneyAccount,0,value)}
 return lines;
}

export function buildSimpleJournal({state={},ctx={},organization='',branch=''}={}){
 const document=selectedDocument(state,ctx);
 /* A payment against an invoice or bill is settled by that document's own
   engine, which already owns the receivable/payable posting and the balance
   update, so this module never posts a second journal for it. */
 if(document&&settlementTypes.includes(state.transactionType))return {linked:true,lines:[]};
 const description=state.description||state.name||'';
 const lines=getSimplePostingLines(state,ctx).map(line=>({id:uuid(),account:line.account,debit:line.debit,credit:line.credit,organization,branch,costCentre:'Operations',description}));
 const debit=lines.reduce((total,line)=>total+(Number(line.debit)||0),0),credit=lines.reduce((total,line)=>total+(Number(line.credit)||0),0);
 if(lines.length<2||Math.abs(debit-credit)>0.005)throw Error('Unable to post this transaction. Please check the selected account and category.');
 if(lines.some((line,index)=>lines.some((other,otherIndex)=>otherIndex>index&&line.account===other.account)))throw Error('Choose different accounts for the two sides of this transaction.');
 return {linked:false,debit,credit,lines};
}

/* ---------- Journal identity ---------- */

export const financialYearLabel=date=>{const year=Number(String(date||'').slice(0,4))||new Date().getFullYear();const month=Number(String(date||'').slice(5,7))||1;return month>=4?year:year-1};
export function nextJournalNumber(rows=[],date=''){
 const year=financialYearLabel(date);
 const used=(rows||[]).map(row=>{const match=String(row.number||'').match(/^JE-(\d{4})-(\d+)$/);return match&&Number(match[1])===year?Number(match[2]):0});
 return `JE-${year}-${String(Math.max(0,...used)+1).padStart(6,'0')}`;
}

/* A duplicate is a fresh Draft: a new journal identity, and none of the
   original's approval, posting or reversal history. */
export function duplicateTransaction(record={}){
 const stamp=new Date().toISOString();
 const copy={...record,id:uuid(),number:'',status:'Draft',date:stamp.slice(0,10),createdAt:stamp,createdBy:'Admin',modifiedAt:stamp,audit:[],lines:(record.lines||[]).map(line=>({...line,id:uuid()}))};
 for(const key of ['submittedBy','submittedAt','approvedBy','approvedAt','rejectedBy','rejectedAt','rejectionReason','publishedBy','publishedAt','postedBy','postedAt','ledgerJournalId','reversalOf','reversalJournalId','reversalReason','reversedBy','reversedAt'])delete copy[key];
 return copy;
}

/* The reversal a Published transaction gets: equal and opposite lines, a REV-
   journal identity and a link back to the original, which keeps its own posting
   and audit trail. */
export function reversalRecord(record={},date='',reason=''){
 const stamp=new Date().toISOString();
 return {...record,id:uuid(),number:'REV-'+record.number,date:date||stamp.slice(0,10),type:'Reversal',reference:'Reversal of '+record.number,narration:'Reversal: '+reason,status:'Approved',createdAt:stamp,modifiedAt:stamp,createdBy:'Admin',publishedBy:'Admin',publishedAt:stamp,reversalOf:record.id,reversalReason:reason,audit:[],lines:(record.lines||[]).map(line=>({...line,id:uuid(),debit:line.credit,credit:line.debit}))};
}

/* ---------- Demo content ---------- */

/* The register's default content. Every row is described exactly the way the
   form describes a transaction, so a seeded row and a typed row share one shape.
   Codes map onto the existing Chart of Accounts; the names carry the narrative.
   The two settlement rows are posted by src/demo-data.js through the invoice and
   purchase engines so their documents and balances stay truthful. */
export const SAMPLE_TRANSACTIONS=[
 {number:'JE-2026-000121',date:'2026-09-08',transactionType:'expense',name:'Office electricity bill',moneyAccount:'1010',category:'5300',amount:'8500',status:'Approved',reference:'KSEB-0912',description:'September electricity for the Kochi office'},
 {number:'JE-2026-000122',date:'2026-09-04',transactionType:'customer_payment',name:'Customer payment - ABC Retail Pvt Ltd',partyId:'cus-1',moneyAccount:'1010',amount:'590',status:'Approved',documentNumber:'INV-00001'},
 {number:'JE-2026-000123',date:'2026-09-12',transactionType:'expense',name:'Office printer purchase',moneyAccount:'1010',category:'5000',amount:'50000',status:'Pending Approval',reference:'QTN-2291',description:'Multifunction printer for the finance desk'},
 {number:'JE-2026-000124',date:'2026-09-16',transactionType:'income',name:'Consulting income',moneyAccount:'1010',category:'4100',amount:'75000',status:'Draft',description:'Implementation consulting billed in September'},
 {number:'JE-2026-000125',date:'2026-09-04',transactionType:'transfer',name:'Cash to bank transfer',moneyAccount:'1000',toAccount:'1010',amount:'20000',status:'Rejected',rejectionReason:'The deposit slip is for a different date. Please re-check and resubmit.',rejectedBy:'Admin'},
 {number:'JE-2026-000126',date:'2026-09-03',transactionType:'expense',name:'Software subscription',moneyAccount:'1010',category:'5600',amount:'4999',status:'Reversed',reversalReason:'The subscription was charged twice by the vendor.',reversalDate:'2026-09-05'},
 {number:'JE-2026-000127',date:'2026-09-05',transactionType:'vendor_payment',name:'Vendor payment - Kerala Office Supplies',partyId:'ven-1',moneyAccount:'1010',amount:'4080',status:'Approved',documentNumber:'BILL-00001'},
 {number:'JE-2026-000128',date:'2026-09-10',transactionType:'expense',name:'Duplicate subscription charge',moneyAccount:'1010',category:'5600',amount:'4999',status:'Cancelled',reference:'SUB-0910',description:'Withdrawn before approval because the charge was already recorded.',cancellationReason:'Duplicate of the September software subscription',cancelledBy:'Admin'}
];

const sampleState=row=>({transactionType:row.transactionType,name:row.name,date:row.date,amount:row.amount,moneyAccount:row.moneyAccount||'',toAccount:row.toAccount||'',category:row.category||'',partyId:row.partyId||'',documentId:'',description:row.description||'',reference:row.reference||''});

export function sampleJournalRecords({accounts=[],organization='Wayvida Learning',branch='Kochi',createdBy='Admin'}={}){
 const ctx={accounts};
 const stamp='2026-09-20T09:00:00.000Z';
 return SAMPLE_TRANSACTIONS.filter(row=>!settlementTypes.includes(row.transactionType)).map(row=>{
  const state=sampleState(row);
  const built=buildSimpleJournal({state,ctx,organization,branch});
  return {
   id:uuid(),number:row.number,date:row.date,type:'Business Transaction',reference:row.reference||'',narration:row.name,
   attachments:[],status:row.status,createdBy,createdAt:stamp,modifiedAt:stamp,
   lines:built.lines,
   simpleTransaction:{...state,label:transactionTypeLabel(row.transactionType),name:row.name,moneyAccount:row.moneyAccount,counterpartyAccount:row.partyId||'',categoryLabel:accountName(accounts,row.category,''),categoryAccount:row.category||''},
   ...(row.rejectionReason?{rejectionReason:row.rejectionReason,rejectedBy:row.rejectedBy||createdBy,rejectedAt:stamp}:{}),
   ...(row.reversalReason?{reversalReason:row.reversalReason,reversalDate:row.reversalDate||row.date}:{}),
   ...(row.cancellationReason?{cancellationReason:row.cancellationReason,cancelledBy:row.cancelledBy||createdBy,cancelledAt:stamp}:{}),
   audit:[{id:uuid(),user:createdBy,at:stamp,action:'Created',oldValue:'',newValue:row.status,reason:''}]
  };
 });
}

/* ---------- Audit timeline ---------- */

/* How long ago something happened, in the words a person reads: just now, 19m
   ago, 4h ago, Yesterday, 3d ago, then a date once it is older than a month. */
export function relativeTime(value,now=new Date()){
 const at=new Date(value);
 if(!value||Number.isNaN(at.getTime()))return '';
 const startOfDay=date=>new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime(),day=86400000,
  minutes=Math.floor((now.getTime()-at.getTime())/60000);
 if(minutes<1)return 'just now';
 if(minutes<60)return minutes+'m ago';
 if(startOfDay(now)===startOfDay(at))return Math.floor(minutes/60)+'h ago';
 if(startOfDay(now)-startOfDay(at)===day)return 'Yesterday';
 const days=Math.round((startOfDay(now)-startOfDay(at))/day);
 if(days<30)return days+'d ago';
 return at.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}

/* The kind chooses the mark and the tint on the timeline, and the sentence says
   what happened without repeating the actor. */
const TIMELINE_KINDS={Created:'created','Pending Approval':'submitted',Resubmitted:'resubmitted',Approved:'approved',Posted:'posted',Rejected:'rejected',Reversed:'reversed',Cancelled:'cancelled'};
const timelineKind=action=>TIMELINE_KINDS[action]||'status';
export function timelineSentence(event={}){
 const action=String(event.action||'').trim();
 if(action==='Created')return 'created this journal';
 if(event.oldValue&&event.newValue)return 'changed the status from '+event.oldValue+' to '+event.newValue;
 if(event.newValue)return 'set the status to '+event.newValue;
 return action?'recorded '+action.toLowerCase():'updated this journal';
}

/* One entry per material event, newest first. A record with no audit array is
   described from its own stamps, so an imported or projected row still tells the
   same story in the same shape. */
export function journalTimeline(journal={},now=new Date()){
 const rows=[],add=(kind,actor,at,text,note,from,to)=>{const entry={key:kind+':'+(at||rows.length)+':'+rows.length,kind,actor:actor||'Admin',at:at||'',when:relativeTime(at,now),text,note:note||'',from:from||'',to:to||''};rows.push(entry)};
 const audit=Array.isArray(journal.audit)?journal.audit:[];
 if(audit.length){
  for(const event of audit)add(timelineKind(event.action),event.user,event.at,timelineSentence(event),event.reason,event.oldValue,event.newValue);
 }else{
  add('created',journal.createdBy,journal.createdAt,'created this journal');
  if(journal.submittedBy)add('submitted',journal.submittedBy,journal.submittedAt||journal.createdAt,'submitted this journal for approval');
  const approver=journal.publishedBy||journal.approvedBy;
  if(approver)add('approved',approver,journal.publishedAt||journal.approvedAt,'approved this journal');
  if(journal.rejectedBy)add('rejected',journal.rejectedBy,journal.rejectedAt,'rejected this journal',journal.rejectionReason);
  if(journal.cancelledBy)add('cancelled',journal.cancelledBy,journal.cancelledAt,'cancelled this journal',journal.cancellationReason);
  if(journal.postedBy)add('posted',journal.postedBy,journal.postedAt,'posted this journal to the ledger');
 }
 return rows.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
}
