import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,command,outstanding} from '../src/invoice-engine.js';
import {receiptCommand} from '../src/receipt-engine.js';
import {receiptPreview,receiptLedger,receiptBankSuggestions} from '../src/receipt-insights.js';

const ctx={role:'Admin',actor:'Administrator',customers:[{id:'c',name:'Customer',account:'1100'}]};
function fixture(kind='Normal',amount='100',allocate=false){
 let s=initial();s.accounts=[['1100','Receivables','Assets'],['1010','Bank','Assets'],['4100','Sales','Income'],['2100','GST','Liabilities'],['2200','Advances','Liabilities']].map(([code,name,type])=>({code,name,type,active:true}));s.config.receipts={advanceAccount:'2200',threshold:0};
 let o=command(s,'save',{customerId:'c',customerName:'Customer',date:'2026-09-01',dueDate:'2026-09-30',place:'Kerala',lines:[{description:'Service',qty:1,unit:'service',rate:'1000',discount:0,tax:'18',cess:0}]});s=command(o.state,'post',{id:o.result.id}).state;
 return receiptCommand(s,'save',{customerId:'c',date:'2026-09-04',amount,bank:'1010',mode:'UPI',reference:'UTR-1',kind,allocations:allocate?[{invoiceId:s.invoices[0].id,amount}]:[]},ctx);
}
function post(o){for(const action of ['submit','approve','post'])o=receiptCommand(o.state,action,{id:o.result.id},ctx);return o;}
test('preview uses posting validations and never mutates or posts saved drafts',()=>{
 const o=fixture('Advance','100',true),before=JSON.stringify(o.state),preview=receiptPreview(o.state,o.result,ctx);
 assert.equal(preview.error,'');assert.equal(preview.journals.length,2);assert.equal(JSON.stringify(o.state),before);
 const actual=post(o);assert.deepEqual(preview.journals.map(j=>j.lines),actual.state.journals.slice(1).map(j=>j.lines));
 for(const j of preview.journals)assert.equal(j.lines.reduce((n,l)=>n+l.debit-l.credit,0),0);
 o.state.config.receipts.closedThrough='2026-09-05';assert.match(receiptPreview(o.state,o.result,ctx).error,/closed/);
});
test('explicit receipt roles guard command calls, not only UI controls',()=>{
 const o=fixture(),id=o.result.id,accountant={...ctx,role:'Accountant'},manager={...ctx,role:'Finance Manager'};
 const submitted=receiptCommand(o.state,'submit',{id},accountant);
 assert.throws(()=>receiptCommand(submitted.state,'approve',{id},accountant),/role/);
 const approved=receiptCommand(submitted.state,'approve',{id},manager);
 assert.throws(()=>receiptCommand(approved.state,'post',{id},accountant),/role/);
 const posted=receiptCommand(approved.state,'post',{id},manager);
 assert.throws(()=>receiptCommand(posted.state,'reverse',{id,date:'2026-09-05',reason:'Error'},manager),/role/);
 assert.throws(()=>receiptCommand(posted.state,'settings',{threshold:'0'},manager),/role/);
 assert.throws(()=>receiptCommand(posted.state,'allocate',{id},{...ctx,role:'Unknown'}),/role/);
 assert.equal(receiptCommand(posted.state,'reverse',{id,date:'2026-09-05',reason:'Error'},ctx).result.status,'Reversed');
});
test('customer ledger shows source vouchers; normal allocations never double credit',()=>{
 let o=post(fixture()),r=o.result,i=o.state.invoices[0];
 const before=receiptLedger(o.state,r);assert.equal(before.length,2);assert.equal(before[0].transactionType,'Invoice');assert.equal(before[1].transactionType,'Receipt');assert.equal(before[1].voucherNumber,r.number);assert.equal(before[1].externalReference,'UTR-1');assert.equal(before[1].balance,108000);
 o=receiptCommand(o.state,'allocate',{id:r.id,date:'2026-09-04',token:'allocation',allocations:[{invoiceId:i.id,amount:'100'}]},ctx);
 const rows=receiptLedger(o.state,r);assert.equal(rows.length,2);assert.equal(rows.at(-1).balance,108000);assert.equal(outstanding(o.state,i),108000);assert.match(rows.at(-1).externalReference,/INV/);
});
test('advance liability stays out of trade AR until allocation; reversal restores balances',()=>{
 let o=post(fixture('Advance')),r=o.result;
 assert.equal(receiptLedger(o.state,r).at(-1).balance,118000);
 assert.equal(receiptLedger(o.state,r,'Bank/Cash Ledger').at(-1).transactionType,'Advance Receipt');
 o=receiptCommand(o.state,'allocate',{id:r.id,date:'2026-09-04',token:'advance',allocations:[{invoiceId:o.state.invoices[0].id,amount:'100'}]},ctx);
 assert.equal(receiptLedger(o.state,r).at(-1).transactionType,'Receipt Allocation');assert.equal(receiptLedger(o.state,r).at(-1).balance,108000);
 o=receiptCommand(o.state,'reverse',{id:r.id,date:'2026-09-05',reason:'Correction'},ctx);
 assert.equal(receiptLedger(o.state,r).at(-1).balance,118000);assert.equal(receiptLedger(o.state,r,'Bank/Cash Ledger').at(-1).balance,0);
});
test('bank ledger includes other posted movements, excludes drafts and retains real running balance',()=>{
 const o=post(fixture()),r=o.result,j=o.state.journals.at(-1);
 o.state.journals.push({...j,id:'other',receiptId:undefined,date:'2026-09-05',customerId:'someone-else',source:'Adjustment',lines:[{account:'1010',debit:5000,credit:0},{account:'4100',debit:0,credit:5000}]});
 o.state.journals.push({...j,id:'draft',status:'Draft',date:'2026-09-06'});
 const rows=receiptLedger(o.state,r,'Bank/Cash Ledger');assert.equal(rows.length,2);assert.equal(rows.at(-1).balance,15000);assert.equal(receiptLedger(o.state,r).length,2);
});
test('bank suggestions consume remaining amounts and do not create matches',()=>{
 let o=post(fixture());o=receiptCommand(o.state,'import-bank',{lines:[{id:'b',date:'2026-09-04',amount:'100',bank:'1010',reference:'UTR-1'}]},ctx);
 const r=o.state.receipts[0],before=JSON.stringify(o.state),suggestions=receiptBankSuggestions(o.state,r);
 assert.equal(suggestions[0].score,8);assert.equal(suggestions[0].suggestedAmount,10000);assert.equal(JSON.stringify(o.state),before);
 o=receiptCommand(o.state,'match',{id:r.id,bankLineId:'b',amount:'100'},ctx);assert.equal(receiptBankSuggestions(o.state,o.result).length,0);
});
test('lifecycle audit records actors, modification and status transitions',()=>{
 const o=post(fixture()),r=o.result;
 assert.equal(r.modifiedBy,ctx.actor);assert.ok(r.submittedAt);assert.ok(r.postedAt);assert.ok(r.modifiedAt);
 assert.equal(o.state.journals.at(-1).createdBy,ctx.actor);
 assert.deepEqual(o.state.audit.filter(a=>a.receiptId===r.id).map(a=>a.toStatus),['Draft','Submitted','Approved','Posted']);
 const d=fixture();const cancelled=receiptCommand(d.state,'cancel',{id:d.result.id,reason:'Duplicate'},ctx);assert.ok(cancelled.result.cancelledAt);assert.equal(cancelled.result.cancelledBy,ctx.actor);
});
