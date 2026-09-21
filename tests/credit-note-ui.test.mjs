import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {initial,KEY} from '../src/invoice-engine.js';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('vite'))('esbuild');
const output=await build({entryPoints:['src/CreditNotes.jsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'});
const mod={exports:{}};new Function('require','module','exports',output.outputFiles[0].text)(require,mod,mod.exports);

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('src/CreditNotes.jsx');
const service=read('src/credit-note-service.js');
const invoices=read('src/InvoiceWorkspace.jsx');

test('a credit note names its type, and the normal workflow is the default',()=>{
 assert.ok(service.includes("export const CREDIT_NOTE_TYPES=['Against Invoice','Without Invoice'];"),'both types live in the service');
 assert.ok(service.includes("export const DEFAULT_CREDIT_NOTE_TYPE='Against Invoice';"),'and against an invoice is the default');
 assert.ok(page.includes('<label>Credit note type<select aria-label="Credit note type" value={noteType(form.type)}'),'the form asks for the type');
 assert.ok(page.includes('{CREDIT_NOTE_TYPES.map(x=><option key={x}>{x}</option>)}'),'with both options');
 assert.ok(page.includes("function start(){setError('');setForm({number:'',date:today(),type:DEFAULT_CREDIT_NOTE_TYPE,"),'a new note opens on the default');
 assert.ok(page.includes("{form.type==='Against Invoice'&&<label>Original invoice"),'the invoice picker belongs to the against-invoice flow');
});

test('the reason is the structured list, and Other carries its own sentence',()=>{
 assert.ok(service.includes("export const CREDIT_REASONS=['Sales Return','Damaged Goods','Wrong Item','Excess Quantity','Pricing Correction','Post-Sale Discount','Tax Correction','Other'];"),'one reason vocabulary, in the service');
 assert.ok(service.includes("const LEGACY_REASONS={'Price Adjustment':'Pricing Correction','Other Customer Adjustment':'Other','Tax Adjustment':'Tax Correction'};"),'labels the earlier prototype wrote still resolve');
 assert.ok(service.includes("export const canonicalReason=value=>CREDIT_REASONS.includes(value)?value:LEGACY_REASONS[value]||'';"),'through one canonicaliser');
 assert.ok(page.includes('{CREDIT_REASONS.map(r=><option key={r}>{r}</option>)}'),'the form offers the structured list');
 assert.ok(page.includes("{form.reason==='Other'&&<label>Reason detail<input required value={form.reasonNote||''}"),'Other reveals the free-text reason');
 assert.ok(page.includes('<div className="ivCard ivFields"><label>Notes<textarea value={form.notes'),'and notes stay available for the explanation');
 assert.ok(service.includes("if(reason==='Other'&&!String(form.reasonNote||'').trim())throw Error('Enter the reason for this credit note.');"),'the engine refuses Other without one');
});

test('an invoice-backed note loads what the invoice already knows and caps the credit',()=>{
 assert.ok(page.includes("setForm(form=>({...form,originalInvoiceId:id,customerId:i.customerId,billing:i.billing||'',shipping:i.shipping||'',place:i.place,"),'choosing an invoice fills the customer, both addresses and the place of supply');
 assert.ok(service.includes("if(form.place!==invoice.place)throw Error('Place of supply must match the original invoice.');"),'and the engine keeps the credit note on the invoice place of supply');
 assert.ok(page.includes("{form.type==='Without Invoice'&&<label>Place of supply<select required"),'the place of supply is chosen only when there is no invoice to inherit it from');
 assert.ok(page.includes('<dt>Place of supply</dt><dd>{placeLabel(form.place)'),'and against an invoice it is shown read-only with its GST state code and the addresses');
 assert.ok(page.includes('<dt>Customer GST treatment</dt><dd>{customers.find'),'the note states the customer GST treatment, which is what a GST document is read for');
 assert.ok(page.includes('<dt>Tax treatment</dt><dd>'),'and the treatment actually applied to the note, so a master with no treatment never reads as an untaxed note');
 assert.ok(page.includes('<dt>GSTIN</dt><dd>{form.customerGstin||'),'and the GSTIN it was taxed under');
 assert.ok(page.includes("['Invoice item','Description','Credit quantity','Original qty','Previously credited','Available qty','Unit','Rate ₹','Discount','Tax','Taxable amount','Amount','']"),'the items table states the original, previously credited and available quantity beside the editable credit quantity');
 assert.ok(page.includes('cnPriorCell'),'the Previously credited column is its own cell');
 assert.ok(page.includes('creditedQuantity(db,original,l.invoiceItemIndex,{exclude:form.id})'),'which reads the credited quantity for that line');
 assert.ok(page.includes('left</small>'),'and how much of the line is still available to credit, so the refusal is rarely reached');
 assert.ok(service.includes('if(Number(l.qty)+returned>Number(original.qty)+1e-9)throw Error(\'Returned quantity exceeds the available invoice quantity.\');'),'and the engine refuses more units than the invoice has left');
 assert.ok(service.includes("for(const k of ['taxable','cgst','sgst','igst','cessAmount']){const used=prior.reduce"),'and more value than is left, per tax component');
});

test('a credit without an invoice keeps its own lines and asks for what it needs',()=>{
 assert.ok(service.includes("if(!form.customerId||!String(form.customerName||'').trim())throw Error('Select a customer.');"),'a customer is required');
 assert.ok(service.includes("if(!form.place)throw Error('Select the place of supply.');"),'as is the place of supply');
 assert.ok(service.includes("if(!(form.lines||[]).length)throw Error('Add at least one credit line.');"),'and at least one line');
 assert.ok(page.includes("{form.type==='Without Invoice'&&<div className=\"ivCard\"><div className=\"ivHeading\"><h3>Credit lines</h3>"),'the form opens its own line editor');
 assert.ok(page.includes('Nothing is copied or guessed.'),'and says so');
 assert.ok(service.includes("const calculationForm=taxOnly||type!=='Against Invoice'?form:{...form,lines:form.lines.map"),'both flows go through the one tax engine');
 assert.ok(service.includes("const totals=calculate(calculationForm,(invoice&&invoice.taxPolicy)||s.config);"),'through calculate(), never a second implementation');
});

test('the detail page uses the Item Details tab row and the four sections',()=>{
 assert.ok(page.includes('<nav className="itemDetailTabs ivDetailTabs" aria-label="Credit note sections">'),'the tab row is the shared Item Details row, as the invoice detail uses');
 assert.ok(page.includes("{['Overview','Applications','Accounting','Activity'].map(t=><button key={t} type=\"button\" className={tab===t?'active':''} aria-current={tab===t?'page':undefined}"),'with Overview, Applications, Accounting and Activity');
 assert.ok(!page.includes('Audit trail'),'the old Audit trail label is gone');
 assert.ok(invoices.includes('<nav className="itemDetailTabs ivDetailTabs" aria-label="Invoice detail sections">'),'which is the same row the invoice detail renders');
});

test('the applications tab states the four figures and offers apply and refund',()=>{
 assert.ok(page.includes("<span>Credit note total<strong>{money(note.totals.total)}</strong></span><span>Applied<strong>{money(applied(db,note))}</strong></span><span>Refunded<strong>{money(refunded(db,note))}</strong></span><span>Remaining credit<strong>{money(available(db,note))}</strong></span>"),'total, applied, refunded and remaining credit');
 assert.ok(page.includes("{available(db,note)>0&&<button onClick={()=>setModal({action:'refund',id:note.id,date:today(),amount:String(available(db,note)/100),method:'Bank transfer',bank:'',reference:'',token:crypto.randomUUID()})}>Refund</button>}"),'a refund is offered while credit is left');
 assert.ok(page.includes("(db.creditRefunds||[]).filter(r=>r.creditNoteId===note.id).map(r=><div className=\"ivPaymentRow\" key={r.id}>"),'and the refund history is listed beside the applications');
 assert.ok(page.includes("modal.action==='refund'?'Refund customer?'"),'the shared dialog handles it');
 assert.ok(page.includes("if(commit(modal.action,p))setModal(null)"),'and posts through the same commit the other actions use');
});

test('the register prints one derived status and filters on it',()=>{
 assert.ok(service.includes("export const CREDIT_NOTE_STATUSES=['Draft','Pending Approval','Issued','Partially Applied','Fully Applied','Partially Refunded','Refunded','Cancelled'];"),'the statuses the workflow can reach');
 assert.ok(service.includes('export function creditNoteStatus(s,c){'),'are derived, not stored');
 assert.ok(page.includes("<td><StatusPill status={creditNoteStatus(db,c)} tone={CREDIT_TONES[creditNoteStatus(db,c)]||'neutral'}/>"),'the register prints the derived status on the shared pill every other register uses');
 assert.ok(page.includes('{CREDIT_NOTE_STATUSES.map(x=><option key={x}>{x}</option>)}'),'and filters by it');
 assert.ok(page.includes('canonicalReason(c.reason)===canonicalReason(reason)'),'a legacy reason label still filters');
 assert.ok(page.includes("({invoiced:'Total invoiced',paid:'Total paid',credit:'Issued credit notes',available:'Available credit',refunded:'Refunded',outstanding:'Net receivable'})[k]"),'the customer statement names the refund line too');
});

test('the invoice and the credit note point at each other',()=>{
 assert.ok(invoices.includes("const relatedCredits=(db.creditNotes||[]).filter(c=>c.originalInvoiceId===invoice.id&&c.status!=='Draft');"),'the invoice detail reads its credit notes');
 assert.ok(invoices.includes("<h2>Related credit notes</h2>"),'and shows them in their own card');
 assert.ok(invoices.includes("sessionStorage.setItem('wayvida-open-credit',c.id);onNavigate('Credit Notes')"),'each one opening the note through the existing handoff');
 assert.ok(invoices.includes('{money(c.totals.total)} · {creditNoteStatus(db,c)}'),'with its amount and status');
 assert.ok(page.includes("['Original invoice',originalInvoice?.number]"),'and the note states its original invoice in the Overview card');
});

test('nothing in the credit note page posts, taxes or moves stock on its own',()=>{
 assert.ok(!/journal\(/.test(page),'the page never writes a journal itself');
 assert.ok(!/calculate\(/.test(page),'and never calculates tax itself');
 assert.ok(page.includes('isReturnReason(form.reason)&&<p>Returned quantity is validated against the original invoice, and this note never moves stock.'),'a goods reason states that stock moves through the sales return, not here');
 assert.ok(service.includes("if(p.salesReturnId){const linked=(s.salesReturns||[]).find(r=>r.id===p.salesReturnId);"),'the note can point at a sales return, which is its own document');
 assert.ok(service.includes("throw Error('The linked sales return belongs to a different customer.')"),'and the link is validated');
});

test('the credit note register is the merged one register row',()=>{
 const css=read('src/register-head.css');
 assert.ok(page.includes('<div className="ivHeading registerHead"><div className="registerHeadText"><h2>Credit Notes <span className="registerHeadCount">({notes.length})</span></h2><p>Manage returns and customer adjustments with automatic accounting.</p></div>{filterBar}'),'the page title and its description lead the shared merged row, which holds the register toolbar');
 assert.ok(page.indexOf('{filterBar}<div className="ivActions">')>page.indexOf('ivHeading registerHead'),'the toolbar and the actions are merged into the heading row');
 assert.ok(page.includes('<div className="ivCard ivRegisterCard"><div className="ivScroll">'),'and the register card opens after that row rather than between the title and the toolbar');
 assert.ok(page.includes('<div className="registerSplit"><button type="button" className="primary registerSplitMain" onClick={start}><IconPlus size={17}/>New credit note</button><details className="registerSplitMore">'),'the add action is the shared split button over the page start');
 assert.ok(page.includes('<button type="button" onClick={menuRun(()=>setMapping({...db.config.creditMappings}))}><IconSettings size={16}/>Account mapping</button></div></details>'),'whose caret holds the page own secondary action and closes itself through menuRun');
 assert.ok(page.includes('const menuRun=handler=>event=>{event.currentTarget.closest(\'details\')?.removeAttribute(\'open\');handler()};'),'the caret closer is the shared one');
 assert.ok(page.includes('<summary aria-label="More credit note actions" title="More credit note actions"><IconChevronDown size={16}/></summary>'),'with the shared caret glyph and label');
 assert.ok(page.includes('<details className="soFiltersMore"><summary aria-label="Open filters"><IconFilter size={17}/>Filters'),'the Filters disclosure keeps the funnel icon and its count badge');
 assert.ok(page.includes('<label>Status<select aria-label="Filter status"'),'and every filter the register owns, including Status, stays inside the panel');
 assert.ok(page.includes("{!filtered.length&&<div className=\"ivEmpty\">"),'the empty state stays in the card under the table');
 assert.ok(page.includes('<div className="ivActions"><button disabled={current===1}'),'and the pagination row stays in the card, not in the heading');
 assert.match(css,/\.registerHead\.ivHeading \.registerHeadText h2\{margin:0;font-size:24px;font-weight:700/, 'the row carries the Journal Entries title size');
 assert.match(css,/\.registerHead\.ivHeading \.registerHeadText p\{margin:5px 0 0;color:#667085;font-size:12px\}/,'and the Journal Entries description size');
 assert.match(css,/\.registerHead details:has\(>summary\[aria-label="Open filters"\]\)\{flex:0 0 auto\}/,'and the funnel cannot be squashed by the toolbar');
});

test('the credit note register opens on one Credit Note Id & Date column',()=>{
 assert.ok(page.includes("['Credit Note Id & Date','Customer','Original invoice','Reason','Amount','Applied','Remaining credit','Status','Actions'].map(x=><th key={x}>{x}</th>)"),'the note number and its date share the first column, which is named for both');
 assert.ok(!page.includes("['Credit note','Date',"),'and the separate Date column is gone rather than left orphaned');
 assert.ok(page.includes('<td><button className="ivLink" onClick={()=>openCredit(c.id)}>{c.number}</button><small>{c.date}</small></td>'),'the cell stacks the number over the date, the way every other register states a document and its date');
 assert.ok(page.includes("<td>{c.customerName}</td><td>{db.invoices.find(i=>i.id===c.originalInvoiceId)?.number}</td>"),'with the customer now directly after it');
 const css=read('src/invoice-workspace.css');
 const widths=[...css.matchAll(/\.creditNotes \.ivInvoiceTable th:nth-child\((\d)\)\{width:(\d+)%\}/g)];
 const effective={};
 for(const [,col,value] of widths)effective[col]=Number(value);
 const cols=Object.keys(effective).map(Number).sort((a,b)=>a-b);
 assert.equal(cols.length,9,'the register declares nine column widths, one per column');
 assert.equal(cols.reduce((total,col)=>total+effective[col],0),100,'and they total exactly 100%, so the browser never has to scale them');
 assert.ok(css.includes('.creditNotes .ivInvoiceTable td:nth-child(5),.creditNotes .ivInvoiceTable td:nth-child(6),.creditNotes .ivInvoiceTable td:nth-child(7),'),'the three money columns are right-aligned');
 assert.ok(css.includes('.creditNotes .ivInvoiceTable th:nth-child(1),.creditNotes .ivInvoiceTable th:nth-child(3),.creditNotes .ivInvoiceTable th:nth-child(4){text-align:left}'),'and the merged column, the invoice and the reason are left-aligned, because the invoice sheet own nth-child(4) and nth-child(7) rules would otherwise land on the reason and remaining-credit columns once the merge shifts them');
});

test('a refunded credit note states its status and its refund in full',()=>{
 const s=initial();
 s.accounts=[{code:'1100',name:'Receivables',type:'Assets',active:true}];
 s.invoices=[{id:'inv1',number:'INV-00002',customerName:'Northstar Services',posted:true,status:'Issued'}];
 s.creditNotes=[{id:'cn1',number:'CN-0004',date:'2026-09-19',customerId:'c1',customerName:'Northstar Services',originalInvoiceId:'inv1',reason:'Pricing Correction',status:'Issued',posted:true,createdAt:'2026-09-19T09:00:00.000Z',totals:{total:295000},lines:[]},{id:'cn2',number:'CN-0003',date:'2026-09-19',customerId:'c1',customerName:'ABC Retail Pvt Ltd',originalInvoiceId:'inv1',reason:'Excess Quantity',status:'Issued',posted:true,createdAt:'2026-09-19T10:00:00.000Z',totals:{total:52500},lines:[]}];
 s.creditRefunds=[{id:'r1',creditNoteId:'cn1',amount:295000,reversed:false}];
 s.creditApplications=[{id:'a1',creditNoteId:'cn2',invoiceId:'inv1',amount:20000,voided:false}];
 globalThis.localStorage={getItem:k=>k===KEY?JSON.stringify(s):null};
 globalThis.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
 const html=renderToString(React.createElement(mod.exports.default,{accounts:[],onNavigate(){},notify(){}}));
 delete globalThis.localStorage;delete globalThis.sessionStorage;
 assert.ok(html.includes('Refunded'),'a fully refunded note reads Refunded');
 assert.match(html,/Refunded (?:<!-- -->)?₹2,950\.00/,'and the amount beside it is written in full rather than cut off - React splits the word and the figure into two text nodes, so the marker is allowed for');
 assert.ok(html.includes('Partially Applied'),'a partly applied note names the longer status in full');
 assert.ok(html.includes('CN-0004')&&html.includes('2026-09-19'),'the note number and its date share the merged first cell');
});
