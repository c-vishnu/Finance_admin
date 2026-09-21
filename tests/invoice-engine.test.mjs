import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,seedAccounts,command,reports,outstanding,paymentStatus,calculate} from '../src/invoice-engine.js';
const seed={Assets:[['1100','Accounts Receivable'],['1010','HDFC Bank']],Income:[['4100','Service Income']],Liabilities:[['2100','GST Payable']],Expenses:[['5900','Rounding']]};
const draft={customerId:'abc',customerName:'ABC Technologies',date:'2026-09-04',dueDate:'2026-10-04',place:'Kerala',lines:[{description:'Website Development',qty:'1',unit:'service',rate:'100000',discount:'0',discountType:'%',tax:'18',cess:'0'}]};
function saved(){return command(seedAccounts(initial(),seed),'save',draft)}
test('Invoice → journal → ledger reports → full payment',()=>{let {state:s,result:i}=saved();assert.equal(i.totals.total,11800000);assert.equal(s.journals.length,0);s=command(s,'post',{id:i.id}).state;let r=reports(s);assert.equal(r.revenue,10000000);assert.equal(r.liabilities,1800000);assert.equal(r.assets,11800000);assert.equal(r.debit,r.credit);assert.equal(r.assets,r.liabilities+r.equity+r.profit);assert.equal(command(s,'post',{id:i.id}).state.journals.length,1);const p={id:i.id,amount:'118000',date:'2026-09-05',bank:'1010',token:'p1'};s=command(s,'pay',p).state;i=s.invoices[0];assert.equal(outstanding(s,i),0);assert.equal(paymentStatus(s,i),'Paid');r=reports(s);assert.equal(r.rows.find(a=>a.code==='1100').balance,0);assert.equal(r.rows.find(a=>a.code==='1010').balance,11800000);assert.equal(r.debit,r.credit);assert.equal(command(s,'pay',p).state.payments.length,1)});
test('invoice posting repairs reserved 1100 Accounts Receivable in legacy data',()=>{let {state:s,result:i}=saved();s.accounts=s.accounts.map(a=>a.code==='1100'?{...a,active:false,isGroup:true,type:'Expenses'}:a);const posted=command(s,'post',{id:i.id}).state,ar=posted.accounts.find(a=>a.code==='1100');assert.equal(ar.active,true);assert.equal(ar.isGroup,false);assert.equal(ar.type,'Assets');assert.equal(ar.nature,'Debit');assert.equal(ar.controlAccount,true);assert.ok(posted.journals[0].lines.some(l=>l.account==='1100'&&l.debit===11800000))});
test('invoice posting repairs reserved 4100 Income and 2100 GST accounts',()=>{let {state:s,result:i}=saved();s.accounts=s.accounts.map(a=>['4100','2100'].includes(a.code)?{...a,active:false,isGroup:true,type:'Assets'}:a);const posted=command(s,'post',{id:i.id}).state,income=posted.accounts.find(a=>a.code==='4100'),gst=posted.accounts.find(a=>a.code==='2100');assert.deepEqual([income.active,income.isGroup,income.type,income.nature],[true,false,'Income','Credit']);assert.deepEqual([gst.active,gst.isGroup,gst.type,gst.nature,gst.controlAccount],[true,false,'Liabilities','Credit',true]);assert.equal(posted.journals[0].lines.reduce((n,l)=>n+l.debit-l.credit,0),0)});
test('invoice posting provisions reserved 4000 Sales for item revenue',()=>{let s=seedAccounts(initial(),seed),savedInvoice=command(s,'save',{...draft,lines:[{...draft.lines[0],income:'4000'}]});s=savedInvoice.state;const posted=command(s,'post',{id:savedInvoice.result.id}).state,sales=posted.accounts.find(a=>a.code==='4000');assert.deepEqual([sales.active,sales.isGroup,sales.type,sales.nature],[true,false,'Income','Credit']);assert.ok(posted.journals[0].lines.some(l=>l.account==='4000'&&l.credit===10000000));assert.equal(posted.journals[0].lines.reduce((n,l)=>n+l.debit-l.credit,0),0)});
test('partial, overdue and excess payment protection',()=>{let {state:s,result:i}=saved();s=command(s,'post',{id:i.id}).state;s=command(s,'pay',{id:i.id,amount:'50000',date:'2026-09-05',bank:'1010',token:'p2'}).state;i=s.invoices[0];assert.equal(outstanding(s,i),6800000);assert.equal(paymentStatus(s,i,'2026-09-06'),'Partially Paid');assert.equal(paymentStatus(s,i,'2026-11-01'),'Overdue');assert.throws(()=>command(s,'pay',{id:i.id,amount:'70000',date:'2026-09-05',bank:'1010',token:'p3'}),/exceed/);assert.throws(()=>command(s,'cancel',{id:i.id,reason:'Cancel'}),/payments/)});
test('reversal retains original journal, missing mapping is atomic',()=>{let {state:s,result:i}=saved();s.config.sales='';assert.throws(()=>command(s,'post',{id:i.id}),/Configure/);assert.equal(s.journals.length,0);s.config.sales='4100';s=command(s,'post',{id:i.id}).state;assert.throws(()=>command(s,'save',{...i,customerName:'changed'}),/draft/);s=command(s,'cancel',{id:i.id,reason:'Duplicate order'}).state;assert.equal(s.journals.length,2);assert.equal(reports(s).assets,0);assert.equal(reports(s).revenue,0)});
test('interstate tax, discounts, cess, duplicate number and invalid lines',()=>{const t=calculate({...draft,place:'Karnataka'},initial().config);assert.equal(t.igst,1800000);assert.equal(t.cgst,0);assert.equal(t.sgst,0);assert.throws(()=>calculate({...draft,lines:[{...draft.lines[0],qty:'0'}]},initial().config),/quantity/);const {state:s,result:i}=saved();assert.throws(()=>command(s,'save',{...draft,number:i.number}),/already exists/);const c=calculate({...draft,lines:[{...draft.lines[0],discount:'10',cess:'1'}]},initial().config);assert.equal(c.taxable,9000000);assert.equal(c.cess,90000)});
test('tax-inclusive item prices are converted to taxable value without double charging tax',()=>{const result=calculate({...draft,lines:[{...draft.lines[0],rate:'1180',priceTaxMode:'inclusive',taxes:{cgst:9,sgst:9,igst:0,cess:0}}]},initial().config);assert.equal(result.taxable,100000);assert.equal(result.cgst,9000);assert.equal(result.sgst,9000);assert.equal(result.total,118000)});
test('explicit component tax selection posts balanced accounts including cess',()=>{let s=seedAccounts(initial(),seed);const d={...draft,lines:[{...draft.lines[0],taxes:{cgst:9,sgst:9,igst:0,cess:1}}]};const saved=command(s,'save',d);s=command(saved.state,'post',{id:saved.result.id}).state;assert.equal(s.invoices[0].totals.total,11900000);assert.equal(s.invoices[0].totals.cess,100000);assert.equal(reports(s).liabilities,1900000);assert.equal(reports(s).debit,reports(s).credit);assert.throws(()=>calculate({...d,place:'Karnataka'},s.config),/Inter-state/);assert.throws(()=>calculate({...d,lines:[{...d.lines[0],taxes:{cgst:9,sgst:0,igst:0,cess:0}}]},s.config),/equal CGST/);const inter=calculate({...d,place:'Karnataka',lines:[{...d.lines[0],taxes:{cgst:0,sgst:0,igst:18,cess:1}}]},s.config);assert.equal(inter.total,11900000);assert.equal(inter.igst,1800000)});

test('the invoice posts to the customer own receivable ledger when one is set',()=>{
 let {state:s,result:i}=saved();
 s.accounts=[...s.accounts,{code:'1110',name:'Customer Ledger - ABC',type:'Assets',nature:'Debit',active:true,isGroup:false,system:false,revision:1}];
 s=command(s,'save',{...i,receivableAccount:'1110'}).state;
 s=command(s,'post',{id:s.invoices[0].id}).state;
 assert.ok(s.journals[0].lines.some(l=>l.account==='1110'&&l.debit===11800000),'the customer ledger is debited, not the generic 1100');
 assert.equal(s.invoices[0].arAccount,'1110');
});
test('the invoice falls back to the configured receivable account when the customer has none',()=>{
 let {state:s,result:i}=saved();
 s=command(s,'post',{id:i.id}).state;
 assert.ok(s.journals[0].lines.some(l=>l.account==='1100'&&l.debit===11800000),'config.ar still posts when no customer ledger is carried');
});

test('a recurring schedule is a setting on a posted invoice, refused elsewhere and reversible',()=>{
 let {state:s,result:i}=saved();
 assert.throws(()=>command(s,'recurring',{id:i.id,frequency:'Monthly',nextDate:'2026-10-04'}),/Post the invoice/,'a draft cannot be made recurring');
 s=command(s,'post',{id:i.id}).state;
 assert.throws(()=>command(s,'recurring',{id:i.id,frequency:'Fortnightly',nextDate:'2026-10-04'}),/how often/,'only the shared vocabulary is accepted');
 assert.throws(()=>command(s,'recurring',{id:i.id,frequency:'Monthly',nextDate:'4 October'}),/next invoice date/,'the next date must be a real date');
 assert.throws(()=>command(s,'recurring',{id:i.id,frequency:'Monthly',nextDate:'2026-10-04',endDate:'2026-09-04'}),/on or after/,'the end date cannot precede the next date');
 const out=command(s,'recurring',{id:i.id,frequency:'Quarterly',nextDate:'2026-10-04',endDate:'2027-10-04',reason:'Recurring Quarterly from 2026-10-04'});
 assert.equal(out.result.recurring.frequency,'Quarterly');
 assert.equal(out.result.recurring.nextDate,'2026-10-04');
 assert.equal(out.result.recurring.endDate,'2027-10-04');
 assert.ok(out.result.recurring.setAt,'the schedule records when it was set');
 assert.equal(out.state.journals.length,1,'setting a schedule posts nothing');
 assert.equal(out.state.payments.length,0,'and records no payment');
 assert.equal(out.state.audit.at(-1).action,'recurring','the write still leaves an audit line');
 assert.match(out.state.audit.at(-1).reason,/Recurring Quarterly/,true,'with the schedule the operator set');
 const off=command(out.state,'recurring',{id:i.id,off:true,reason:'Recurring schedule removed'});
 assert.equal(off.result.recurring,null,'turning the schedule off writes null rather than dropping the key');
 assert.equal(off.state.audit.at(-1).action,'recurring');
 const cancelled=command(off.state,'cancel',{id:i.id,reason:'Duplicate invoice'}).state;
 assert.throws(()=>command(cancelled,'recurring',{id:i.id,frequency:'Monthly',nextDate:'2026-11-04'}),/cancelled/,'a cancelled invoice cannot be scheduled');
});
