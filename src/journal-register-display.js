import {normaliseStatus,transactionTypeLabel} from './simple-journal-transaction.js';

const named=(accounts,code,fallback)=>{if(!code)return fallback??'—';return (accounts||[]).find(account=>account.code===code)?.name||fallback||code};

/* The register resolves one row's business cells from either a simple
   transaction or the advanced journal editor, without mutating the stored
   record: the plain name, the money account, the user-facing amount and the
   lifecycle status. A row that predates the simple vocabulary still reads
   through its stored label. */
export function journalRegisterDisplay(journal={},accounts=[]){
 const simple=journal.simpleTransaction||{},lines=journal.lines||[];
 const distinct=[...new Set(lines.map(line=>line.account).filter(Boolean))];
 const type=simple.label||transactionTypeLabel(simple.transactionType)||journal.type||'Journal';
 const name=simple.name||journal.narration||journal.reference||journal.number||'Transaction';
 let account='—';
 if(simple.transactionType==='transfer'&&simple.moneyAccount&&simple.toAccount)account=`${named(accounts,simple.moneyAccount)} → ${named(accounts,simple.toAccount)}`;
 else if(simple.moneyAccount)account=named(accounts,simple.moneyAccount);
 else if(simple.paymentStatus==='paid_later')account=['money_in','sale'].includes(simple.transactionType)?'Accounts Receivable':'Accounts Payable';
 else if(distinct.length)account=distinct.map(code=>named(accounts,code)).join(' / ');
 return {
  name,
  type,
  party:simple.partyName||(simple.counterpartyAccount&&!accounts.some(account=>account.code===simple.counterpartyAccount)?simple.counterpartyAccount:'')||'—',
  category:simple.categoryLabel||(simple.categoryAccount?named(accounts,simple.categoryAccount):'—'),
  account,
  status:normaliseStatus(journal.status)
 };
}

/* The user-facing amount is the transaction amount the operator entered; a row
   without one states the larger side of its own lines. Register lines are stored
   in rupees, so the fallback returns integer paise the way money() expects. */
export function journalRecordAmount(journal={}){
 if(Number(journal.amount)>0)return Number(journal.amount);
 const lines=journal.lines||[];
 const debit=lines.reduce((total,line)=>total+(Number(line.debit)||0),0);
 const credit=lines.reduce((total,line)=>total+(Number(line.credit)||0),0);
 return Math.round(Math.max(debit,credit)*100);
}
