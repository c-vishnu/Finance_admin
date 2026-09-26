import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,seedAccounts,command,reports,outstanding} from '../src/invoice-engine.js';
import {creditCommand,creditLine,available,adjustmentStatus,customerCreditSummary,customerStatement,gstDocuments,creditInvoiceEligibility,creditNoteStatus,refunded,creditedQuantity,creditedValue,returnedQuantity,returnableQuantity,creditPostingPlan,creditMappingDefaults,noteType,creditMethod,CREDIT_METHODS,INVENTORY_IMPACTS,billedTaxRates} from '../src/credit-note-service.js';
import {ADJUSTMENT_REASONS} from '../src/inventory-adjustments.js';
const seed={Assets:[['ar','Receivable'],['bank','Bank']],Income:[['sales','Sales'],['returns','Sales adjustment']],Liabilities:[['gst','GST']]};
function setup(){let s=seedAccounts(initial(),seed);s.config={...s.config,ar:'ar',sales:'sales',cgst:'gst',sgst:'gst',igst:'gst',cess:'gst',creditMappings:{salesAdjustment:'returns',salesReturn:'returns',otherAdjustment:'returns'}};let d=command(s,'save',{date:'2026-09-04',dueDate:'2026-10-04',customerId:'xyz',customerName:'XYZ Solutions',place:'Kerala',lines:[{description:'Service',qty:'1',unit:'service',rate:'100000',discount:'0',discountType:'%',tax:'18',cess:'0'}]});s=command(d.state,'post',{id:d.result.id}).state;return {s,i:s.invoices[0]}}
function create(s,i,rate='20000',reason='Price Adjustment'){return creditCommand(s,'save',{customerId:i.customerId,originalInvoiceId:i.id,date:'2026-09-04',reason,place:i.place,lines:[{...creditLine(i,0),rate}]})}
function issue(s,c){s=creditCommand(s,'submit',{id:c.id}).state;s=creditCommand(s,'approve',{id:c.id}).state;return creditCommand(s,'issue',{id:c.id}).state}
test('credit lifecycle posts once, reports and statement reconcile; allocations do not double post',()=>{let {s,i}=setup();let d=create(s,i);assert.equal(d.result.totals.total,2360000);assert.equal(d.result.totals.cgst+d.result.totals.sgst,360000);assert.equal(d.state.journals.length,1);s=issue(d.state,d.result);const c=s.creditNotes[0];assert.equal(customerCreditSummary(s,'xyz').outstanding,9440000);assert.equal(reports(s).assets,9440000);assert.equal(reports(s).revenue,8000000);assert.equal(reports(s).debit,reports(s).credit);assert.equal(customerStatement(s,'xyz').at(-1).balance,9440000);assert.equal(gstDocuments(s).filter(x=>x.kind==='Credit Note').length,1);assert.equal(creditCommand(s,'issue',{id:c.id}).state.journals.length,2);const p={id:c.id,date:'2026-09-04',token:'first',allocations:[{invoiceId:i.id,amount:'10000'}]};s=creditCommand(s,'apply',p).state;assert.equal(available(s,c),1360000);assert.equal(adjustmentStatus(s,c),'Partially Applied');assert.equal(outstanding(s,i),10800000);assert.equal(customerCreditSummary(s,'xyz').outstanding,9440000);assert.equal(s.journals.length,2);assert.equal(creditCommand(s,'apply',p).state.creditApplications.length,1);s=creditCommand(s,'apply',{...p,token:'second',allocations:[{invoiceId:i.id,amount:'13600'}]}).state;assert.equal(adjustmentStatus(s,c),'Fully Applied');assert.equal(outstanding(s,i),9440000);assert.equal(s.journals.length,2);s=creditCommand(s,'cancel',{id:c.id,reason:'Duplicate'}).state;assert.equal(outstanding(s,i),11800000);assert.equal(customerCreditSummary(s,'xyz').outstanding,11800000);assert.equal(s.journals.length,3);assert.equal(s.creditApplications.filter(a=>!a.voided).length,0)});
test('excess credits, duplicate number, quantity and missing mappings are rejected atomically',()=>{let {s,i}=setup();assert.throws(()=>create(s,i,'100001'),/left to credit/,'an over-credit states what is left');const d=create(s,i);assert.throws(()=>creditCommand(d.state,'save',{...d.result,id:undefined}),/already exists/);s=issue(d.state,d.result);assert.throws(()=>create(s,i,'90000'),/left to credit/,'and the second over-credit does too');assert.throws(()=>creditCommand(s,'save',{...s.creditNotes[0],notes:'edit'}),/draft/);assert.throws(()=>creditCommand(s,'apply',{id:d.result.id,date:'2026-09-04',token:'excess',allocations:[{invoiceId:i.id,amount:'30000'}]}),/available/);const d2=create(s,i,'10000');s=creditCommand(d2.state,'submit',{id:d2.result.id}).state;s=creditCommand(s,'approve',{id:d2.result.id}).state;s.config.creditMappings={};s.config.sales='';assert.throws(()=>creditCommand(s,'issue',{id:d2.result.id}),/Configure/);assert.equal(s.journals.length,2);assert.throws(()=>creditCommand(s,'save',{customerId:i.customerId,originalInvoiceId:i.id,date:'2026-09-04',place:i.place,reason:'Sales Return',lines:[{...creditLine(i,0),qty:'2',rate:'1000'}]}),/quantity/)});
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
 assert.equal(d.result.type,'Standalone Credit Note','the earlier Without Invoice label normalises to the current one');
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
test('a credit note posts with no configured mapping, reversing the income account its invoice used',()=>{
 let {s,i}=setup();
 s.config.creditMappings={};
 const withIncome={...i,lines:i.lines.map(l=>({...l,income:'returns'})),totals:{...i.totals,lines:i.totals.lines.map(l=>({...l,income:'returns'}))}};
 s={...s,invoices:[withIncome]};
 const d=create(s,withIncome),out=issue(d.state,d.result),c=out.creditNotes.find(x=>x.id===d.result.id),entry=out.journals.find(j=>j.creditNoteId===c.id);
 assert.ok(c.totals.taxable>0,'the note carries a taxable value');
 assert.ok(entry.lines.some(l=>l.account==='returns'&&l.debit===c.totals.taxable),'so the revenue line reverses the income account the invoice itself used');
 assert.equal(entry.lines.reduce((n,l)=>n+l.debit-l.credit,0),0,'and the entry balances');
 assert.equal(entry.lines.find(l=>l.credit>0).account,'ar','while the customer receivable is credited');
 assert.deepEqual(creditMappingDefaults(s),{salesAdjustment:'sales',gstAdjustment:'gst',ar:'ar',inventoryAsset:'',stockAdjustment:'',salesReturn:'',taxAdjustment:'',otherAdjustment:''},'the mapping dialog opens on the accounts the engine already falls back to, with the reason-specific routes blank so they inherit');
});
test('a reason-specific account wins for its own reason while the shared account covers the rest',()=>{
 const {s,i}=setup();
 const configured={...s,config:{...s.config,creditMappings:{salesAdjustment:'returns',salesReturn:'sales'}}};
 const ret=create(configured,i,'20000','Sales Return'),other=create(configured,i,'20000','Pricing Correction');
 assert.equal(creditPostingPlan(configured,ret.result,ret.result.totals).lines[0].accountRef,'sales','the Sales Return reason credits its own account');
 assert.equal(creditPostingPlan(configured,other.result,other.result.totals).lines[0].accountRef,'returns','while every other reason credits the shared sales-adjustment account');
 const out=issue(ret.state,ret.result),c=out.creditNotes.find(x=>x.id===ret.result.id),entry=out.journals.find(j=>j.creditNoteId===c.id);
 assert.ok(entry.lines.some(l=>l.account==='sales'&&l.debit===c.totals.taxable),'and the posted journal follows the reason-specific account');
 assert.equal(entry.lines.reduce((n,l)=>n+l.debit-l.credit,0),0,'with the entry still balanced');
});
test('the printer scenario: a credit note for one returned unit reduces the balance, reverses revenue and GST, and never creates revenue or stock',()=>{
 let s=seedAccounts(initial(),seed);
 s.config={...s.config,ar:'ar',sales:'sales',cgst:'gst',sgst:'gst',igst:'gst',cess:'gst',creditMappings:{salesAdjustment:'returns'}};
 const printer={description:'HP Laser Printer',qty:'2',unit:'pcs',rate:'50000',discount:'0',discountType:'%',tax:'18',cess:'0',income:'sales'};
 const saved=command(s,'save',{date:'2026-09-10',dueDate:'2026-10-10',customerId:'abc',customerName:'ABC Retail Pvt Ltd',place:'Kerala',lines:[printer]});
 s=command(saved.state,'post',{id:saved.result.id}).state;
 const inv=s.invoices[0];
 assert.equal(inv.totals.total,11800000,'2 x 50,000 plus 18% is 1,18,000');
 assert.equal(inv.totals.cgst+inv.totals.sgst,1800000,'of which 18,000 is output GST');
 assert.equal(outstanding(s,inv),11800000,'and that is what the customer owes');
 const draft=creditCommand(s,'save',{customerId:'abc',originalInvoiceId:inv.id,date:'2026-09-12',reason:'Sales Return',place:inv.place,lines:[{...creditLine(inv,0),qty:'1'}]});
 assert.equal(draft.result.totals.total,5900000,'one returned printer credits 59,000');
 const out=issue(draft.state,draft.result),c=out.creditNotes[0],entry=out.journals.find(j=>j.creditNoteId===c.id);
 assert.equal(customerCreditSummary(out,'abc').outstanding,5900000,'the customer balance falls to 59,000 and never rises');
 assert.equal(outstanding(out,inv),11800000,'while the invoice itself waits for the credit to be applied to it');
 const settled=creditCommand(out,'apply',{id:c.id,date:'2026-09-12',token:'printer',allocations:[{invoiceId:inv.id,amount:'59000'}]}).state;
 assert.equal(outstanding(settled,inv),5900000,'and applying the credit settles that invoice down to 59,000');
 assert.deepEqual(entry.lines.map(l=>[l.account,l.debit,l.credit]),[['returns',5000000,0],['gst',450000,0],['gst',450000,0],['ar',0,5900000]],'Dr Sales Return 50,000 + Dr Output GST 9,000 (4,500 CGST + 4,500 SGST), Cr Customer Receivable 59,000');
 assert.equal(reports(out).revenue,5000000,'revenue falls by the credited value and is never added to');
 assert.equal(reports(out).liabilities,900000,'and the GST liability falls by 9,000');
 assert.equal((out.salesReturns||[]).length,0,'a credit note on its own moves no stock - the Sales Return document owns that');
 assert.throws(()=>creditCommand(out,'save',{customerId:'abc',originalInvoiceId:inv.id,date:'2026-09-12',reason:'Sales Return',place:inv.place,lines:[{...creditLine(inv,0),qty:'2'}]}),/left to credit/,'crediting more than the invoice is refused');
 assert.equal(creditLine(inv,0).taxes.cgst,9,'the rate is read from the invoice line, so it cannot be typed over');
 const pricing=creditCommand(out,'save',{customerId:'abc',originalInvoiceId:inv.id,date:'2026-09-12',reason:'Pricing Correction',place:inv.place,lines:[{...creditLine(inv,0),qty:'1',rate:'45000'}]});
 const priced=issue(pricing.state,pricing.result),c2=priced.creditNotes.find(x=>x.id===pricing.result.id),e2=priced.journals.find(j=>j.creditNoteId===c2.id);
 assert.equal(c2.totals.total,5310000,'a price correction from 50,000 to 45,000 credits 5,900 with its GST');
 assert.equal((priced.salesReturns||[]).length,0,'and a price correction moves no stock either');
 assert.ok(e2.lines.some(l=>l.account==='returns'&&l.debit===4500000),'the price difference reverses revenue on the adjustment account');
});
test('the current type and method vocabulary keeps the earlier labels readable',()=>{
 assert.equal(noteType('Standalone Credit Note'),'Standalone Credit Note');
 assert.equal(noteType('Without Invoice'),'Standalone Credit Note','the earlier label still reads as standalone, never as an against-invoice note');
 assert.equal(noteType('nonsense'),'Against Invoice');
 assert.deepEqual(CREDIT_METHODS,['Item Based Credit','Amount Based Credit']);
 assert.equal(creditMethod(undefined),'Item Based Credit');
 assert.equal(creditMethod('Amount Based Credit'),'Amount Based Credit');
 assert.deepEqual(INVENTORY_IMPACTS,['Return Stock To Inventory','Financial Adjustment Only']);
});

test('a value-only credit reverses the invoice own tax and can never exceed what is left',()=>{
 let {s,i}=setup();
 const base={type:'Against Invoice',creditMethod:'Amount Based Credit',customerId:i.customerId,originalInvoiceId:i.id,date:'2026-09-04',reason:'Pricing Correction',place:i.place};
 assert.throws(()=>creditCommand(s,'save',{...base,adjustmentAmount:'0'}),/greater than zero/,'an empty adjustment is refused');
 const d=creditCommand(s,'save',{...base,adjustmentAmount:'500'});
 assert.equal(d.result.creditMethod,'Amount Based Credit','the method is stored on the note');
 assert.equal(d.result.totals.taxable,50000);
 assert.equal(d.result.totals.cgst,4500,'the invoice own 9% CGST is reversed');
 assert.equal(d.result.totals.sgst,4500,'and its 9% SGST');
 assert.equal(d.result.totals.total,59000);
 assert.equal(d.result.totals.lines.length,1,'a value-only note carries one synthetic line');
 assert.equal(d.result.totals.lines[0].invoiceItemIndex,-1,'which can never be mistaken for a credited invoice line');
 assert.equal(billedTaxRates(i).cgst,9,'and the rate it used is the invoice blended rate');
 const plan=creditPostingPlan(s,d.result,d.result.totals);
 assert.equal(plan.lines.reduce((n,l)=>n+l.debit,0),plan.lines.reduce((n,l)=>n+l.credit,0),'its journal balances');
 const chosen=creditCommand(s,'save',{...base,adjustmentAmount:'500',adjustmentAccount:'sales'});
 assert.equal(creditPostingPlan(s,chosen.result,chosen.result.totals).lines[0].accountRef,'sales','an adjustment account chosen on the note wins over the configured mapping');
 s=issue(d.state,d.result);
 assert.throws(()=>creditCommand(s,'save',{...base,adjustmentAmount:'100001'}),/still creditable/,'a second value-only credit cannot exceed the invoice');
 const rest=creditCommand(s,'save',{...base,adjustmentAmount:'99500'});
 assert.equal(rest.result.totals.total,11741000,'while the whole of what is left is still creditable');
});

test('a standalone value-only credit takes its tax treatment from the operator',()=>{
 const {s}=setup();
 const base={type:'Standalone Credit Note',creditMethod:'Amount Based Credit',customerId:'xyz',customerName:'XYZ Solutions',date:'2026-09-05',reason:'Discount Adjustment'};
 assert.throws(()=>creditCommand(s,'save',{...base,place:'Kerala',adjustmentAmount:'0'}),/greater than zero/);
 const intra=creditCommand(s,'save',{...base,place:'Kerala',adjustmentAmount:'1000',adjustmentTax:'GST 18%'});
 assert.equal(intra.result.type,'Standalone Credit Note');
 assert.equal(intra.result.originalInvoiceId,'','no invoice is invented');
 assert.equal(intra.result.totals.cgst,9000);
 assert.equal(intra.result.totals.sgst,9000);
 assert.equal(intra.result.totals.igst,0);
 assert.equal(intra.result.totals.total,118000);
 const inter=creditCommand(s,'save',{...base,place:'Karnataka',adjustmentAmount:'1000',adjustmentTax:'GST 18%'});
 assert.equal(inter.result.totals.igst,18000,'outside the company state the same rate becomes IGST');
 assert.equal(inter.result.totals.cgst,0);
 const exempt=creditCommand(s,'save',{...base,place:'Kerala',adjustmentAmount:'1000',adjustmentTax:'Exempt'});
 assert.equal(exempt.result.totals.total,100000,'an exempt adjustment carries no tax');
});
