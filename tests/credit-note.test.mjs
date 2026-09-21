import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,seedAccounts,command,reports,outstanding} from '../src/invoice-engine.js';
import {creditCommand,creditLine,available,adjustmentStatus,customerCreditSummary,customerStatement,gstDocuments,creditInvoiceEligibility,creditNoteStatus,refunded,creditedQuantity,creditedValue,returnedQuantity,returnableQuantity} from '../src/credit-note-service.js';
import {ADJUSTMENT_REASONS} from '../src/inventory-adjustments.js';
const seed={Assets:[['ar','Receivable'],['bank','Bank']],Income:[['sales','Sales'],['returns','Sales adjustment']],Liabilities:[['gst','GST']]};
function setup(){let s=seedAccounts(initial(),seed);s.config={...s.config,ar:'ar',sales:'sales',cgst:'gst',sgst:'gst',igst:'gst',cess:'gst',creditMappings:{salesAdjustment:'returns',salesReturn:'returns',otherAdjustment:'returns'}};let d=command(s,'save',{date:'2026-09-04',dueDate:'2026-10-04',customerId:'xyz',customerName:'XYZ Solutions',place:'Kerala',lines:[{description:'Service',qty:'1',unit:'service',rate:'100000',discount:'0',discountType:'%',tax:'18',cess:'0'}]});s=command(d.state,'post',{id:d.result.id}).state;return {s,i:s.invoices[0]}}
function create(s,i,rate='20000',reason='Price Adjustment'){return creditCommand(s,'save',{customerId:i.customerId,originalInvoiceId:i.id,date:'2026-09-04',reason,place:i.place,lines:[{...creditLine(i,0),rate}]})}
function issue(s,c){s=creditCommand(s,'submit',{id:c.id}).state;s=creditCommand(s,'approve',{id:c.id}).state;return creditCommand(s,'issue',{id:c.id}).state}
test('credit lifecycle posts once, reports and statement reconcile; allocations do not double post',()=>{let {s,i}=setup();let d=create(s,i);assert.equal(d.result.totals.total,2360000);assert.equal(d.result.totals.cgst+d.result.totals.sgst,360000);assert.equal(d.state.journals.length,1);s=issue(d.state,d.result);const c=s.creditNotes[0];assert.equal(customerCreditSummary(s,'xyz').outstanding,9440000);assert.equal(reports(s).assets,9440000);assert.equal(reports(s).revenue,8000000);assert.equal(reports(s).debit,reports(s).credit);assert.equal(customerStatement(s,'xyz').at(-1).balance,9440000);assert.equal(gstDocuments(s).filter(x=>x.kind==='Credit Note').length,1);assert.equal(creditCommand(s,'issue',{id:c.id}).state.journals.length,2);const p={id:c.id,date:'2026-09-04',token:'first',allocations:[{invoiceId:i.id,amount:'10000'}]};s=creditCommand(s,'apply',p).state;assert.equal(available(s,c),1360000);assert.equal(adjustmentStatus(s,c),'Partially Applied');assert.equal(outstanding(s,i),10800000);assert.equal(customerCreditSummary(s,'xyz').outstanding,9440000);assert.equal(s.journals.length,2);assert.equal(creditCommand(s,'apply',p).state.creditApplications.length,1);s=creditCommand(s,'apply',{...p,token:'second',allocations:[{invoiceId:i.id,amount:'13600'}]}).state;assert.equal(adjustmentStatus(s,c),'Fully Applied');assert.equal(outstanding(s,i),9440000);assert.equal(s.journals.length,2);s=creditCommand(s,'cancel',{id:c.id,reason:'Duplicate'}).state;assert.equal(outstanding(s,i),11800000);assert.equal(customerCreditSummary(s,'xyz').outstanding,11800000);assert.equal(s.journals.length,3);assert.equal(s.creditApplications.filter(a=>!a.voided).length,0)});
test('excess credits, duplicate number, quantity and missing mappings are rejected atomically',()=>{let {s,i}=setup();assert.throws(()=>create(s,i,'100001'),/left to credit/,'an over-credit states what is left');const d=create(s,i);assert.throws(()=>creditCommand(d.state,'save',{...d.result,id:undefined}),/already exists/);s=issue(d.state,d.result);assert.throws(()=>create(s,i,'90000'),/left to credit/,'and the second over-credit does too');assert.throws(()=>creditCommand(s,'save',{...s.creditNotes[0],notes:'edit'}),/draft/);assert.throws(()=>creditCommand(s,'apply',{id:d.result.id,date:'2026-09-04',token:'excess',allocations:[{invoiceId:i.id,amount:'30000'}]}),/available/);const d2=create(s,i,'10000');s=creditCommand(d2.state,'submit',{id:d2.result.id}).state;s=creditCommand(s,'approve',{id:d2.result.id}).state;s.config.creditMappings={};assert.throws(()=>creditCommand(s,'issue',{id:d2.result.id}),/Configure/);assert.equal(s.journals.length,2);assert.throws(()=>creditCommand(s,'save',{customerId:i.customerId,originalInvoiceId:i.id,date:'2026-09-04',place:i.place,reason:'Sales Return',lines:[{...creditLine(i,0),qty:'2',rate:'1000'}]}),/quantity/)});
test('tax-only adjustment reduces tax not revenue; cancellation prevents application',()=>{let {s,i}=setup();const d=create(s,i,'20000','Tax Adjustment');assert.equal(d.result.totals.taxable,0);assert.equal(d.result.totals.total,360000);s=issue(d.state,d.result);assert.equal(reports(s).revenue,10000000);s=creditCommand(s,'cancel',{id:d.result.id,reason:'Correction'}).state;assert.throws(()=>creditCommand(s,'apply',{id:d.result.id,date:'2026-09-04',token:'x',allocations:[{invoiceId:i.id,amount:'10'}]}),/issued/)});
test('price and return credits inherit source invoice tax rates',()=>{const {s,i}=setup(),line={...creditLine(i,0),rate:'1000',taxes:{cgst:18,sgst:18,igst:0,cess:0}},saved=creditCommand(s,'save',{customerId:i.customerId,originalInvoiceId:i.id,date:i.date,reason:'Price Adjustment',place:i.place,lines:[line]});assert.equal(saved.result.totals.cgst,9000);assert.equal(saved.result.totals.sgst,9000);assert.equal(saved.result.totals.total,118000)});
test('credit applies to another invoice for the same customer, never across customers',()=>{let {s,i}=setup();const d=create(s,i);s=issue(d.state,d.result);const next=command(s,'save',{date:i.date,dueDate:i.dueDate,customerId:i.customerId,customerName:i.customerName,place:i.place,lines:[{...i.lines[0],rate:'40000'}]});s=command(next.state,'post',{id:next.result.id}).state;const count=s.journals.length;s=creditCommand(s,'apply',{id:d.result.id,date:i.date,token:'other-invoice',allocations:[{invoiceId:next.result.id,amount:'10000'}]}).state;assert.equal(outstanding(s,s.invoices.find(x=>x.id===next.result.id)),3720000);assert.equal(available(s,s.creditNotes.find(c=>c.id===d.result.id)),1360000);assert.equal(s.journals.length,count);assert.equal(customerStatement(s,'xyz').at(-1).source,'Credit Application');const wrong=command(s,'save',{date:i.date,dueDate:i.dueDate,customerId:'different',customerName:'Different customer',place:i.place,lines:i.lines});s=command(wrong.state,'post',{id:wrong.result.id}).state;assert.equal(creditInvoiceEligibility(s,s.creditNotes[0],wrong.result).reason,'Different customer');assert.throws(()=>creditCommand(s,'apply',{id:d.result.id,date:i.date,token:'wrong',allocations:[{invoiceId:wrong.result.id,amount:'100'}]}),/Different customer/);assert.throws(()=>command(s,'cancel',{id:i.id,reason:'Delete source'}),/credit notes/);s=creditCommand(s,'cancel',{id:d.result.id,reason:'Correction'}).state;const rows=gstDocuments(s).filter(x=>x.id===d.result.id||x.sourceDocumentId===d.result.id);assert.equal(rows.length,2);assert.equal(rows.reduce((n,x)=>n+x.sign*x.totals.total,0),0)});

test('the note type and the structured reason drive the workflow',()=>{
 let {s,i}=setup();
 assert.throws(()=>creditCommand(s,'save',{...create(s,i).result,customerId:i.customerId,originalInvoiceId:i.id,date:i.date,reason:'Not a reason',place:i.place,lines:[creditLine(i,0)]}),/reason/,'an unknown reason is refused');
 assert.throws(()=>creditCommand(s,'save',{customerId:i.customerId,originalInvoiceId:i.id,date:i.date,reason:'Other',place:i.place,lines:[creditLine(i,0)]}),/Enter the reason/,'Other needs its own sentence');
 const draft=creditCommand(s,'save',{customerId:i.customerId,originalInvoiceId:i.id,date:i.date,reason:'Other',reasonNote:'Goodwill',place:i.place,lines:[creditLine(i,0)]});
 assert.equal(draft.result.type,'Against Invoice','the type defaults to the normal workflow');
 assert.equal(draft.result.reason,'Other');
 assert.equal(draft.result.reasonNote,'Goodwill');
 const legacy=create(s,i,'20000','Price Adjustment');
 assert.equal(legacy.result.reason,'Pricing Correction','the earlier label is canonicalised on save');
});

test('a credit without an invoice carries its own lines and needs no invoice',()=>{
 const {s}=setup();
 const line={description:'Post-sale discount',qty:'1',unit:'pcs',rate:'1000',discount:'0',discountType:'%',taxes:{cgst:9,sgst:9,igst:0,cess:0}};
 assert.throws(()=>creditCommand(s,'save',{type:'Without Invoice',customerId:'xyz',customerName:'XYZ Solutions',date:'2026-09-05',place:'',reason:'Post-Sale Discount',lines:[line]}),/place of supply/,'the place of supply is required, never inferred');
 const d=creditCommand(s,'save',{type:'Without Invoice',customerId:'xyz',customerName:'XYZ Solutions',date:'2026-09-05',place:'Kerala',reason:'Post-Sale Discount',notes:'Agreed after delivery',lines:[line]});
 assert.equal(d.result.type,'Without Invoice');
 assert.equal(d.result.originalInvoiceId,'','no invoice is invented');
 assert.equal(d.result.customerName,'XYZ Solutions');
 assert.equal(d.result.totals.taxable,100000,'the line is taxed through the shared engine');
 assert.equal(d.result.totals.cgst+d.result.totals.sgst,18000);
 assert.equal(d.result.totals.total,118000);
 const issuedState=issue(d.state,d.result);
 assert.equal(issuedState.creditNotes[0].posted,true,'and it posts a balanced journal like any other note');
});

test('credit can be refunded, and only the credit that is still available',()=>{
 let {s,i}=setup();let d=create(s,i);s=issue(d.state,d.result);
 assert.equal(creditNoteStatus(s,s.creditNotes[0]),'Issued');
 assert.throws(()=>creditCommand(s,'refund',{id:d.result.id,date:i.date,token:'r0',amount:'30000',method:'Bank transfer',bank:'bank'}),/available credit/,'a refund cannot exceed the remaining credit');
 assert.throws(()=>creditCommand(s,'refund',{id:d.result.id,date:i.date,token:'r0',amount:'10000',method:'Bank transfer',bank:'nope'}),/cash or bank account/,'and it must land on a real account');
 const journals=s.journals.length;
 s=creditCommand(s,'refund',{id:d.result.id,date:i.date,token:'r1',amount:'10000',method:'Bank transfer',bank:'bank',reference:'UTR-1'}).state;
 assert.equal(s.journals.length,journals+1,'the refund posts through the same journal helper everything else uses');
 assert.equal(s.creditRefunds[0].amount,1000000);
 assert.equal(s.creditRefunds[0].method,'Bank transfer');
 assert.equal(s.creditRefunds.length,creditCommand(s,'refund',{id:d.result.id,date:i.date,token:'r1',amount:'10000',method:'Bank transfer',bank:'bank'}).state.creditRefunds.length,'and the token makes it idempotent');
 assert.equal(customerCreditSummary(s,'xyz').refunded,1000000);
 assert.equal(customerCreditSummary(s,'xyz').available,1360000);
 assert.equal(creditNoteStatus(s,s.creditNotes[0]),'Partially Refunded');
 assert.equal(customerStatement(s,'xyz').filter(r=>r.source==='Customer Refund').length,1,'the ledger shows the refund as a transaction');
 assert.throws(()=>creditCommand(s,'cancel',{id:d.result.id,reason:'Too late'}),/refunded/,'a refunded note is not cancelled away');
 s=creditCommand(s,'refund',{id:d.result.id,date:i.date,token:'r2',amount:'13600',method:'Cash',bank:'bank'}).state;
 assert.equal(available(s,s.creditNotes[0]),0);
 assert.equal(creditNoteStatus(s,s.creditNotes[0]),'Refunded');
});

test('the printed status follows what has actually been used',()=>{
 let {s,i}=setup();let d=create(s,i);s=issue(d.state,d.result);
 assert.equal(creditNoteStatus(s,s.creditNotes[0]),'Issued');
 s=creditCommand(s,'apply',{id:d.result.id,date:i.date,token:'p1',allocations:[{invoiceId:i.id,amount:'10000'}]}).state;
 assert.equal(creditNoteStatus(s,s.creditNotes[0]),'Partially Applied');
 s=creditCommand(s,'apply',{id:d.result.id,date:i.date,token:'p2',allocations:[{invoiceId:i.id,amount:'13600'}]}).state;
 assert.equal(creditNoteStatus(s,s.creditNotes[0]),'Fully Applied');
 assert.equal(adjustmentStatus(s,s.creditNotes[0]),'Fully Applied');
 assert.equal(creditNoteStatus(s,{...s.creditNotes[0],status:'Cancelled'}),'Cancelled','the register and the detail page read one status');
});

test('previously credited quantity and value are readable per invoice line',()=>{
 let {s,i}=setup();const first=create(s,i,'20000');s=issue(first.state,first.result);
 assert.equal(creditedQuantity(s,i,0),1);
 assert.equal(creditedValue(s,i,0,i.totals.lines[0].taxable),2000000);
 const second=create(s,i,'10000');s=issue(second.state,second.result);
 assert.equal(creditedQuantity(s,i,0),2,'the second note sees the first');
 assert.equal(creditedQuantity(s,i,0,{exclude:second.result.id}),1,'a draft being edited does not count itself');
});

test('a sales return is what the next return on the same line is measured against',()=>{
 const {s,i}=setup();
 assert.ok(ADJUSTMENT_REASONS.includes('Sales Return'),'the inventory engine carries Sales Return as one of its reasons, so the stock increase needs no second engine');
 assert.equal(returnableQuantity(s,i,0),1,'a line nothing has been returned against is fully returnable');
 /* a recorded return takes one unit back and leaves nothing returnable on a one-unit line */
 let withReturn={...s,salesReturns:[{id:'sr-1',status:'Posted',invoiceId:i.id,customerId:i.customerId,lines:[{invoiceItemIndex:0,qty:1}]}]};
 assert.equal(returnedQuantity(withReturn,i,0),1);
 assert.equal(returnableQuantity(withReturn,i,0),0,'so nothing is left to return');
 /* a cancelled return never counts: it did not move stock */
 const cancelled={...withReturn,salesReturns:[{...withReturn.salesReturns[0],status:'Cancelled'}]};
 assert.equal(returnedQuantity(cancelled,i,0),0);
 assert.equal(returnableQuantity(cancelled,i,0),1);
 /* partial returns leave the remainder */
 const partial={...withReturn,salesReturns:[...withReturn.salesReturns,{id:'sr-2',status:'Posted',invoiceId:i.id,lines:[{invoiceItemIndex:0,qty:0.4}]}]};
 assert.equal(returnedQuantity(partial,i,0),1.4,'two returns on one line add up');
 assert.equal(returnableQuantity(partial,i,0),0);
});
