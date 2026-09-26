import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const workspace=read('src/InvoiceWorkspace.jsx');
const menu=read('src/InvoiceRowActions.jsx');
const css=read('src/invoice-workspace.css');
const credits=read('src/CreditNotes.jsx');
const engine=read('src/invoice-engine.js');

test('every invoice row carries the register row menu beside its View icon',()=>{
 assert.match(workspace,/<td><div className="ivRowActions"><button className="ivIconButton" aria-label=\{'View '\+i\.number\} title=\{'View '\+i\.number\} onClick=\{\(\)=>\{setSelected\(i\.id\);setTab\('Overview'\)\}\}><IconEye size=\{17\}\/><\/button><InvoiceRowActions invoice=\{i\} outstanding=\{outstandingAmount\}/,'the actions cell is the eye icon for View, which is labelled for a screen reader, and the row menu');
 assert.ok(css.includes('.ivRowActions{display:flex;align-items:center;justify-content:flex-end;gap:6px;white-space:nowrap}'),'kept on one line and right-aligned in the cell');
 assert.ok(menu.includes("import './sales-order-actions.css';"),'the menu reuses the sales order register menu sheet rather than inventing a second one');
 assert.ok(menu.includes('createPortal'),'and is portalled, because the register is an .ivScroll box that would clip an absolutely positioned menu');
 assert.match(menu,/<button ref=\{trigger\} type="button" className="soMoreButton" aria-label=\{'More actions for '\+invoice\.number\} aria-haspopup="menu" aria-expanded=\{!!menu\}/,'the trigger is the shared 34px kebab, labelled for the invoice it belongs to');
});

test('the menu offers the six actions the register was asked for, each disabled with its reason',()=>{
 for(const label of ['Approve and post','Record payment','Make Recurring','Create Credit Note','Duplicate','Cancel Invoice'])
  assert.ok(menu.includes("label:'"+label+"'"),label+' is one of the entries');
 assert.ok(menu.indexOf("label:'Approve and post'")<menu.indexOf("label:'Cancel Invoice'"),'and they read in that order');
 assert.ok(menu.includes("disabled:posted||cancelled,reason:posted?'This invoice is already posted.':'Cancelled invoices cannot be posted.'"),'Approve and post applies to a saved invoice only');
 assert.ok(menu.includes("disabled:!posted||cancelled||!unpaid,reason:!posted?'Post the invoice before recording a payment.':cancelled?'Cancelled invoices cannot receive payments.':'Nothing is outstanding on this invoice.'"),'Record payment follows the engine: posted, not cancelled, something outstanding');
 assert.ok(menu.includes("disabled:!posted||cancelled,reason:!posted?'Post the invoice before making it recurring.':'A cancelled invoice cannot be made recurring.'"),'Make Recurring follows the engine rule');
 assert.ok(menu.includes("disabled:!posted||cancelled||!unpaid,reason:!posted?'Post the invoice before raising a credit note.':cancelled?'Cancelled invoices cannot be credited.':'Nothing is left outstanding to credit.'"),'Create Credit Note follows the same posting and outstanding rule');
 assert.ok(menu.includes("disabled:false,reason:''"),'Duplicate is always available');
 assert.ok(menu.includes("disabled:cancelled,danger:true,reason:'This invoice is already cancelled.'"),'Cancel Invoice is offered until the invoice is cancelled, as the destructive entry');
 assert.ok(menu.includes('title={entry.disabled?entry.reason:undefined}'),'a disabled entry says what has to happen first, rather than disappearing');
});

test('each entry is wired to the action the rest of the app already owns',()=>{
 assert.match(workspace,/onPost=\{\(\)=>postInvoice\(i\)\}/,'Approve and post goes through the page');
 assert.ok(workspace.includes("function postInvoice(i){run('post',{id:i.id})}"),'which is the same engine command the detail screen uses');
 assert.ok(workspace.includes('onPayment={()=>startPayment(i)}')&&workspace.includes("function startPayment(i){sessionStorage.setItem('wayvida-receive-invoice',i.id);onNavigate('Payments Received')}"),'Record payment reuses the existing receipt handoff');
 assert.ok(workspace.includes('onCreditNote={()=>openCreditNote(i)}'),'Create Credit Note goes through the page');
 assert.ok(workspace.includes("function openCreditNote(i){try{sessionStorage.setItem('wayvida-credit-customer',i.customerId);sessionStorage.setItem('wayvida-credit-invoice',i.id)}catch{}sessionStorage.setItem(QUICK_CREATE_KEY,'credit-note');onNavigate('Credit Notes')}"),'which is the credit note quick-create handoff, naming the customer and the invoice');
 assert.ok(workspace.includes('onDuplicate={()=>duplicateInvoice(i)}'),'Duplicate is the existing duplicate-invoice action');
 assert.ok(workspace.includes("onCancel={()=>{setError('');setCancel({id:i.id,reason:''})}}"),'and Cancel Invoice opens the page\'s own cancellation dialog, so the reason and the reversal are the same as the detail screen\'s');
});

test('the credit note opens on the invoice the register sent',()=>{
 assert.ok(credits.includes("const source=sessionStorage.getItem('wayvida-credit-invoice')||'';sessionStorage.removeItem('wayvida-credit-invoice');start();if(source)selectInvoice(source)"),'the quick-create handoff reads the invoice once, then opens the form on it');
 assert.ok(credits.includes('function selectInvoice(id){if(!id){setForm(form=>({...form,originalInvoiceId:\'\',lines:[]}));return}'),'and selectInvoice updates functionally, so queuing it behind start() sees the blank form it just set');
 assert.ok(!credits.includes('setForm({...form,originalInvoiceId:id'),'the closure form is no longer read, which is what would have dropped the seeded fields');
});

test('the recurring schedule is a real setting with an honest limit',()=>{
 assert.ok(engine.includes("export const RECURRING_FREQUENCIES=['Monthly','Quarterly','Half-Yearly','Yearly'];"),'one vocabulary lives in the engine');
 assert.ok(engine.includes("}else if(action==='recurring'){"),'and the schedule is written by an engine action, so it cannot bypass the command contract');
 assert.ok(engine.includes("if(!i.posted)fail('Post the invoice before setting a recurring schedule.')"),'only a posted invoice can be scheduled');
 assert.ok(engine.includes('i.recurring={frequency:p.frequency,nextDate:p.nextDate,endDate:p.endDate||\'\',setAt:new Date().toISOString()};'),'the cadence and the next date are stored on the invoice');
 assert.ok(engine.includes('if(p.off){i.recurring=null;}'),'and the schedule can be turned off');
 assert.match(workspace,/onRecurring=\{\(\)=>openRecurring\(i\)\}/,'the row menu opens the schedule dialog');
 assert.ok(workspace.includes("RECURRING_FREQUENCIES.map(f=><option key={f}>{f}</option>)"),'the dialog offers exactly the engine vocabulary');
 assert.ok(workspace.includes('This prototype keeps the schedule only - it does not generate or post the future invoices.'),'and states the limit where the operator sets it');
 assert.ok(workspace.includes("{recurring.existing&&<button type=\"button\" onClick={()=>{if(run('recurring',{id:recurring.id,off:true,reason:'Recurring schedule removed'}))setRecurring(null)}}>Turn off recurring</button>}"),'an existing schedule can be turned off from the same dialog');
 assert.ok(workspace.includes("{i.recurring?.frequency&&<small>Recurring · {i.recurring.frequency}</small>}"),'and the register shows the schedule under the invoice number');
 assert.ok(workspace.includes("function openRecurring(i){setError('');setRecurring({id:i.id,number:i.number,frequency:i.recurring?.frequency||RECURRING_FREQUENCIES[0],nextDate:i.recurring?.nextDate||nextPeriod(i.date),endDate:i.recurring?.endDate||'',existing:!!i.recurring})}"),'reopening it seeds the stored schedule and defaults the next date one period on');
 assert.ok(workspace.includes("const nextPeriod=date=>{const d=new Date((date||today())+'T12:00:00Z');if(Number.isNaN(d.getTime()))return today();d.setUTCMonth(d.getUTCMonth()+1);return d.toISOString().slice(0,10)};"),'from the invoice date, never from the clock');
});
