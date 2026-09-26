import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {invoiceDisplayStatus,invoiceDisplayTone,INVOICE_DISPLAY_TONES} from '../src/invoice-register-display.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const workspace=read('src/InvoiceWorkspace.jsx');
const source=read('src/SalesOrders.jsx');
const styles=read('src/invoice-workspace.css');

test('the register states an invoice lifecycle in three words plus Cancelled',()=>{
 assert.equal(invoiceDisplayStatus({status:'Draft',posted:false}),'Draft');
 assert.equal(invoiceDisplayStatus({status:'Pending Approval',posted:false}),'Pending');
 assert.equal(invoiceDisplayStatus({status:'Approved',posted:true}),'Published');
 assert.equal(invoiceDisplayStatus({status:'Sent',posted:true}),'Published');
 assert.equal(invoiceDisplayStatus({status:'Partially Paid',posted:true}),'Published');
 assert.equal(invoiceDisplayStatus({status:'Paid',posted:true}),'Published');
 assert.equal(invoiceDisplayStatus({status:'Overdue',posted:true}),'Published');
 assert.equal(invoiceDisplayStatus({status:'Cancelled',posted:false}),'Cancelled');
 assert.equal(invoiceDisplayStatus({status:'Cancelled',posted:true}),'Cancelled','a cancelled invoice is never called Published, even if it had posted first');
 assert.equal(invoiceDisplayStatus({}),'Draft','a record with no status at all reads as a draft rather than a blank cell');
 assert.deepEqual(INVOICE_DISPLAY_TONES,{Draft:'neutral',Pending:'warn',Published:'info',Cancelled:'danger'});
 assert.equal(invoiceDisplayTone({status:'Paid',posted:true}),'info');
 assert.equal(invoiceDisplayTone({status:'Cancelled',posted:true}),'danger');
});

test('the invoice register reads that mapping in its own column, beside the payment status',()=>{
 assert.ok(workspace.includes("import {invoiceDisplayStatus,invoiceDisplayTone} from './invoice-register-display.js';"),'the register imports the display rule rather than inlining a second one');
 assert.ok(workspace.includes("['Invoice','Customer','Status','Invoice amount','Payment status','Organisation','Branch','Actions']"),'the header names Status before the amount and carries no Order ID column');
 assert.ok(workspace.includes('<StatusPill status={invoiceDisplayStatus(i)} tone={invoiceDisplayTone(i)}/>'),'and the cell renders the mapped lifecycle through the shared pill');
 assert.ok(!workspace.includes('<small>{i.date} · {i.status}</small>'),'the raw stored status no longer sits under the date, so one row cannot show two different words for the same state');
});

test('the invoice detail actions put Submit for approval on the primary fill and label Edit with an icon',()=>{
 assert.ok(workspace.includes("{invoice.status==='Draft'&&<><button onClick={()=>setForm({...invoice})}><IconEdit size={17}/>Edit</button>{invoiceAllowed(role,'submit')&&<button className=\"primary\" onClick={()=>run('submit',{id:invoice.id})}>Submit for approval</button>}</>}"),'a draft offers Edit with its icon and Submit for approval as the primary action');
 assert.ok(workspace.includes('Approve &amp; post'),'and the approval step for a pending invoice is unchanged');
});

test('the create page drafts, submits, or cancels, and never posts',()=>{
 assert.ok(workspace.includes("function saveInvoice(status){"),'one saver serves both create-page actions');
 assert.ok(workspace.includes("if(status==='Pending Approval'&&!run('submit',{id:saved.id})){setForm({...form,id:saved.id,number:saved.number});return}"),'a refused submit keeps the form open BOUND TO THE SAVED RECORD, so a retry edits that invoice instead of creating a second one');
 assert.ok(workspace.includes("onSubmit={e=>{e.preventDefault();saveInvoice('Draft')}}"),'the form submit is the draft path');
 assert.ok(workspace.includes('<button type="submit" className={invoiceAllowed(role,\'submit\')?\'\':\'primary\'}>Save draft</button>'),'Save draft carries the primary fill only when the acting role cannot submit, so the page always has exactly one primary action');
 assert.ok(workspace.includes('<button type="button" className="primary" onClick={()=>saveInvoice(\'Pending Approval\')}>Submit for approval</button>'),'and Submit for approval is the other');
 assert.ok(!workspace.includes("saveInvoice('post')")&&!/onClick=\{\(\)=>run\('post'/.test(workspace.slice(workspace.indexOf('soBarActions'), workspace.indexOf('soBarActions') + 400)),'the create page never posts: posting stays on the detail screen, for the role that holds the duty');
});

test('the sales order register row is an eye that opens the order preview, and the menu keeps the invoice',()=>{
 assert.ok(source.includes('<button className="soRowIconButton" aria-label={\'Preview \'+x.number} title={\'Preview \'+x.number} onClick={()=>setPrintDoc(x)}><IconEye size={17}/></button>'),'the row action opens DocumentPreview for that order');
 assert.ok(!source.includes('>View details</button>'),'the old text button is gone');
 assert.ok(source.includes('onOpenInvoice={()=>openInvoice(x)}'),'and the invoice hand-off moved into the row menu beside Edit and Convert to Invoice');
 const actions=read('src/SalesOrderActions.jsx');
 assert.ok(actions.includes("disabled={!order.invoice&&order.status!=='Confirmed'}"),'where the invoice entry is offered whenever the order already has one, instead of being disabled by it');
 assert.ok(actions.includes("onClick={order.invoice&&onOpenInvoice?()=>{setMenu(null);onOpenInvoice()}:convert}"),'opening the invoice when there is one and converting only when there is not');
});

test('both row actions are square icons of the same size',()=>{
 assert.ok(styles.includes('.invoiceWorkspace .ivRowActions button.ivIconButton{width:36px;height:36px;min-width:36px;min-height:36px;padding:0;color:#475467}'),'the invoice row eye matches the menu trigger beside it');
 assert.ok(read('src/sales-orders.css').includes('.soRowIconButton{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;min-width:36px;min-height:36px;padding:0;border:1px solid #d0d5dd;border-radius:7px;background:#fff;color:#344054;cursor:pointer'),'and so does the sales order row eye');
});
