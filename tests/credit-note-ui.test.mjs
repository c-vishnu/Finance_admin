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
 assert.ok(service.includes("export const CREDIT_NOTE_TYPES=['Against Invoice','Standalone Credit Note'];"),'both types live in the service');
 assert.ok(service.includes("export const DEFAULT_CREDIT_NOTE_TYPE='Against Invoice';"),'and against an invoice is the default');
 assert.ok(page.includes('<label>Credit note type<select aria-label="Credit note type" value={noteType(form.type)}'),'the form asks for the type');
 assert.ok(page.includes('{CREDIT_NOTE_TYPES.map(x=><option key={x}>{x}</option>)}'),'with both options');
 assert.ok(page.includes("function start(){setError('');const {company,branch}=getCurrentOrganizationContext();setForm({number:'',date:today(),type:DEFAULT_CREDIT_NOTE_TYPE,"),'a new note opens on the default');
 assert.ok(page.includes('<h3>Original invoice details</h3>'),'the invoice picker lives in its own Original invoice details section');
 assert.ok(page.includes('<label>Original invoice<select required aria-label="Original invoice"'),'with the picker as that section own control');
 assert.ok(page.includes("{form.type==='Against Invoice'?<div className=\"ivCard soFormSection\"><div className=\"soSectionHead\"><h3>Original invoice details</h3>"),'rendered only by the against-invoice flow');
 const details=page.slice(page.indexOf('<h3>Credit note details</h3>'), page.indexOf("{form.type==='Against Invoice'?<div className=\"ivCard soFormSection\">"));
 const seq=['<label>Credit note type','<label>Original invoice','<label>Reason','<label>Credit note date','<label>Reference number','<label>Credit note number'];
 const pos=seq.map(x=>details.indexOf(x));
 assert.ok(pos.every(i=>i>=0),'every field of the details row is present');
 assert.deepEqual([...pos].sort((a,b)=>a-b),pos,'the details read credit note type, the original invoice, reason, date, reference, then the generated number');
 assert.ok(page.includes('<label>Credit note number<input readOnly aria-label="Credit note number" placeholder="Generated automatically'),'with the number generated automatically and read-only');
 const flow=['<h3>Credit note details</h3>','<h3>Original invoice details</h3>','<h3>Credit items</h3>','<span>Additional details</span>'];
 const at=flow.map(heading=>page.indexOf(heading));
 assert.ok(at.every(index=>index>=0),'every section of the create page is present');
 assert.deepEqual([...at].sort((a,b)=>a-b),at,'and they read in flow order: details, the invoice, the items, the tax, the posting, then the collapsed tail');
 assert.ok(page.indexOf('<h3>Customer *</h3>')<page.indexOf('<label>Original invoice<select required'),'the customer is asked for before the invoice, so the invoice list can be narrowed to that customer');
 assert.ok(page.includes('<CustomerSearch customers={customers} value={form.customerId} onSelect={id=>chooseCustomer(id)}/>'),'the customer is the shared sales-document search box rather than a select');
 assert.ok(page.includes('<div className="soCustomerMeta" title="What this customer still owes the business"><div><span>Net receivable</span><strong>{money(customerCreditSummary(db,form.customerId).outstanding)}</strong>'),'and the chosen customer reads as the shared profile strip with its net receivable, the way Create Sales Order states it');
 assert.ok(page.includes('<div className="ivCard soFormSection"><div className="soSectionHead">'),'every create-page card is a sales-document section card, so the page wears the same style as Create Sales Order and Create Sales Invoice');
});

test('the reason is the structured list, and Other carries its own sentence',()=>{
 assert.ok(service.includes("export const CREDIT_REASONS=['Sales Return','Pricing Correction','Wrong Billing','Discount Adjustment','Damaged Goods','Service Cancellation','GST Correction','Other'];"),'one reason vocabulary, in the service, in the order the workflow asks for');
 assert.ok(service.includes("const LEGACY_REASONS={'Price Adjustment':'Pricing Correction','Other Customer Adjustment':'Other','Tax Adjustment':'GST Correction','Tax Correction':'GST Correction','Post-Sale Discount':'Discount Adjustment','Wrong Item':'Wrong Billing','Excess Quantity':'Sales Return'};"),'every label an earlier prototype wrote still resolves to the closest reason in the current list');
 assert.ok(service.includes("export const canonicalReason=value=>CREDIT_REASONS.includes(value)?value:LEGACY_REASONS[value]||'';"),'through one canonicaliser');
 assert.ok(page.includes('{CREDIT_REASONS.map(r=><option key={r}>{r}</option>)}'),'the form offers the structured list');
 assert.ok(page.includes("{form.reason==='Other'&&<label>Reason detail<input required value={form.reasonNote||''}"),'Other reveals the free-text reason');
 assert.ok(page.includes('<label>Customer note<textarea value={form.notes'),'and the customer note stays available for the explanation');
 assert.ok(service.includes("if(reason==='Other'&&!String(form.reasonNote||'').trim())throw Error('Enter the reason for this credit note.');"),'the engine refuses Other without one');
});

test('an invoice-backed note loads what the invoice already knows and caps the credit',()=>{
 assert.ok(page.includes("setForm(form=>({...form,originalInvoiceId:id,customerId:i.customerId,billing:i.billing||'',shipping:i.shipping||'',place:i.place,"),'choosing an invoice fills the customer, both addresses and the place of supply');
 assert.ok(service.includes("if(form.place!==invoice.place)throw Error('Place of supply must match the original invoice.');"),'and the engine keeps the credit note on the invoice place of supply');
 assert.ok(page.includes("<div className=\"ivFields soFieldRow\"><label>Place of supply<select required value={form.place||''}"),'the place of supply is chosen only when there is no invoice to inherit it from');
 assert.ok(page.includes('<dt>Place of supply</dt><dd>{placeLabel(form.place)'),'and against an invoice it is shown read-only with its GST state code and the addresses');
 assert.ok(page.includes('<dt>Customer GST treatment</dt><dd>{customers.find'),'the note states the customer GST treatment, which is what a GST document is read for');
 assert.ok(page.includes('<dt>Tax treatment</dt><dd>'),'and the treatment actually applied to the note, so a master with no treatment never reads as an untaxed note');
 assert.ok(page.includes('<dt>GSTIN</dt><dd>{form.customerGstin||'),'and the GSTIN it was taxed under');
 assert.ok(page.includes('<div className="cnItemList">')&&page.includes('<article className="cnItemCard"'),'each credit item is a stacked card, not a wide table row');
 assert.ok(page.includes('<dt>Original qty</dt>')&&page.includes('<dt>Previously credited</dt>')&&page.includes('<dt>Available qty</dt>'),'stating the original, previously credited and available quantity beside the editable credit quantity');
 assert.ok(page.includes('max={avail}'),'the credit quantity input is capped at the quantity the invoice still allows');
 assert.ok(!page.includes("aria-label={'Invoice item '"),'and the card no longer offers an invoice-item picker, because the rows ARE the invoice items');
 assert.ok(page.includes('<dt>Previously credited</dt>'),'the previously credited quantity is stated on the card');
 assert.ok(page.includes('creditedQuantity(db,original,l.invoiceItemIndex,{exclude:form.id})'),'which reads the credited quantity for that line');
 assert.ok(page.includes('<span className="cnItemLeft">Credit amount <strong>{totals?money(totals.lines[n].total):'),'and how much of the line is still available to credit, so the refusal is rarely reached');
 assert.ok(service.includes('if(Number(l.qty)+returned>Number(original.qty)+1e-9)throw Error(\'Returned quantity exceeds the available invoice quantity.\');'),'and the engine refuses more units than the invoice has left');
 assert.ok(service.includes("for(const k of ['taxable','cgst','sgst','igst','cessAmount']){const used=prior.reduce"),'and more value than is left, per tax component');
});

test('a credit without an invoice keeps its own lines and asks for what it needs',()=>{
 assert.ok(service.includes("if(!form.customerId||!String(form.customerName||'').trim())throw Error('Select a customer.');"),'a customer is required');
 assert.ok(service.includes("if(!form.place)throw Error('Select the place of supply.');"),'as is the place of supply');
 assert.ok(service.includes("if(!(form.lines||[]).length)throw Error('Add at least one credit line.');"),'and at least one line');
 assert.ok(page.includes("{form.type!=='Against Invoice'&&!amountBased&&<div className=\"ivCard soFormSection\"><div className=\"soSectionHead\"><h3>Credit lines</h3>"),'the form opens its own line editor');
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
 assert.ok(service.includes("export const CREDIT_NOTE_STATUSES=['Draft','Pending Approval','Approved','Issued','Partially Applied','Fully Applied','Partially Refunded','Refunded','Cancelled'];"),'the statuses the workflow can reach, including an approved note that is not posted yet');
 assert.ok(service.includes("if(c.status==='Approved'&&!c.posted)return 'Approved';"),'an approved but unposted note reads Approved rather than Issued, which is what the posting step creates');
 assert.ok(page.includes("Approved:'info'"),'and the pill has a tone for it');
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
 assert.ok(page.includes('<button type="button" onClick={menuRun(()=>setMapping(creditMappingDefaults(db)))}><IconSettings size={16}/>Account mapping</button></div></details>'),'whose caret holds the page own secondary action, closes itself through menuRun, and opens the mapping dialog on the accounts the engine already falls back to');
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

test('the credit note register states the date, the number, the reference, the customer, the invoice, the status, the amount and the balance',()=>{
 assert.ok(page.includes("['Date','Credit note id','Reference','Customer name','Invoice','Status','Amount','Balance','Actions'].map(x=><th key={x}>{x}</th>)"),'the register lists Date, Credit note id, Reference, Customer name, Invoice, Status, Amount, Balance and Actions');
 assert.ok(page.includes('<td>{c.date}</td><td><button className="ivLink" onClick={()=>openCredit(c.id)}>{c.number}</button></td><td>{c.reference||\'—\'}</td><td>{c.customerName}</td><td>{db.invoices.find(i=>i.id===c.originalInvoiceId)?.number||\'—\'}</td>'),'the date, the number link, the reference, the customer and the invoice in that order');
 assert.ok(page.includes('<td>{money(c.totals.total)}</td><td>{money(available(db,c))}</td>'),'with the credit amount and the balance still available on it');
 assert.ok(!page.includes("['Credit Note Id & Date'"),'and the earlier column set is gone rather than left orphaned');
 const css=read('src/invoice-workspace.css');
 const widths=[...css.matchAll(/\.creditNotes \.ivInvoiceTable th:nth-child\((\d+)\)\{width:(\d+)%\}/g)];
 const effective={};for(const [,col,value] of widths)effective[col]=Number(value);
 const cols=Object.keys(effective).map(Number).sort((a,b)=>a-b);
 assert.equal(cols.length,9,'the register declares nine column widths, one per column');
 assert.equal(cols.reduce((total,col)=>total+effective[col],0),100,'and they total exactly 100%, so the browser never has to scale them');
 assert.ok(css.includes('.creditNotes .ivInvoiceTable td:nth-child(7),.creditNotes .ivInvoiceTable td:nth-child(8),'),'the amount and the balance are right-aligned');
 assert.ok(css.includes('.creditNotes .ivInvoiceTable th:nth-child(6){text-align:left}'),'and the text columns stay left-aligned');
});

test('the row menu carries Edit, Preview, Duplicate and Delete, and only those',()=>{
 const row=read('src/CreditNoteRowActions.jsx').replace(/\s+/g,' ');
 for(const label of ["label:'Edit'","label:'Preview'","label:'Duplicate'","label:'Delete'"])assert.ok(row.includes(label),label);
 assert.ok(!/label:'Submit for approval'|label:'Approve'|label:'Issue credit note'|label:'Refund'|label:'Cancel credit note'/.test(row),'the lifecycle steps and the refund stay on the detail page and the Applications tab instead of the row');
 assert.ok(row.includes("disabled:!draft,reason:'Only the latest draft can be edited.'"),'Edit is offered for a draft only');
 assert.ok(row.includes("key:'delete',label:'Delete',icon:IconTrash,run:onDelete,disabled:cancelled,danger:true"),'and Delete is the destructive entry, disabled on a note already cancelled');
 assert.ok(page.includes('onDuplicate={()=>duplicateCredit(c)}'),'the register wires Duplicate to the page helper');
 assert.ok(page.includes('function duplicateCredit(source){')&&page.includes("number:'',date:today(),status:'Draft',posted:false"),'which opens a fresh draft from the stored note rather than editing it');
});
test('the posting plan is the one engine, and the create page shows neither the tax summary nor the preview',()=>{
 assert.ok(!page.includes('creditPostingPlan(db,{...form,totals},totals)'),'the create page no longer plans anything: the Tax summary and the Accounting Impact Preview cards were removed on request');
 assert.ok(service.includes('export function creditPostingPlan(s,note,totals){'),'which lives in the service');
 assert.ok(service.includes("if(!plan.complete)throw Error('Credit Note account mapping is incomplete. Configure account mapping before posting.');"),'and the posting refuses exactly when the preview reports the mapping incomplete');
 assert.ok(service.includes('for(const row of plan.lines)lines.push({account:account(s,row.accountRef,row.expects),debit:row.debit,credit:row.credit,description:row.label});'),'so the journal is built from the plan, line for line');
 assert.ok(!page.includes('<h3>Tax summary</h3>')&&!page.includes('Accounting Impact Preview'),'neither removed section is left on the create page');
 assert.ok(!page.includes('cnImpactToggle')&&!read('src/credit-notes.css').includes('cnImpactToggle'),'their markup and their css are gone together, so no dead token is left');
 assert.ok(page.includes('soPostingNote'),'while the note that nothing posts on its own stays in the credit summary');
 assert.ok(!page.includes('aria-label="Credit tax"'),'no GST field is offered on the credit note');
});

test('additional details collapse the customer note, the internal note and the attachments',()=>{
 assert.ok(page.includes('<details className="ivCard soFormSection cnAdditional"><summary aria-label="Open additional details"><span>Additional details</span>'),'the tail is one collapsed disclosure');
 assert.ok(page.includes('<label>Customer note<textarea value={form.notes'),'holding the note shown on the credit note');
 assert.ok(page.includes('<label>Internal note<input value={form.internalNote'),'the internal note that is never shown to the customer');
 assert.ok(page.includes('type="file" multiple aria-label="Attach return proof, approval documents or customer communication"'),'and an attachment control that names what it is for');
 assert.ok(page.includes('Attachments are recorded by name on this prototype.'),'which says how the prototype treats what is attached');
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
test('the items and the totals wear the sales-document tokens without a sideways scroll',()=>{
 const styles=read('src/credit-notes.css');
 assert.ok(styles.includes('.cnItemList{display:grid')&&styles.includes('grid-template-columns:repeat(auto-fit,minmax(132px,1fr))'),'the item cards are a wrapping grid, so the section never scrolls sideways');
 const itemsSection=page.slice(page.indexOf('<h3>Credit items</h3>'), page.indexOf('<section className=\"ivCard soBillingSummary\">'));
 assert.ok(!itemsSection.includes('<table')&&!itemsSection.includes('ivScroll')&&!itemsSection.includes('soAddItem'),'and neither a wide table, a scroll box nor an Add item menu remains in the items section');
 assert.ok(page.includes('Adjust only the credit quantity'),'the section says that only the quantity is adjustable on an invoice-backed note');
 assert.ok(page.includes('<label className="cnItemQty"><span>Credit qty *</span>'),'the one editable field of a card is the credit quantity');
 assert.ok(page.includes('<section className="ivCard soBillingSummary"><div className="soSummaryGrid">'),'and the figures close in the shared billing-summary card');
 assert.ok(page.includes('<div className="soSummaryRight"><div className="soSummaryHead"><h3>Credit summary</h3>'),'with a summary head of its own');
 assert.ok(page.includes('<span className="soCurrencyChip" title="Every amount on this document is in Indian rupees">INR ₹</span>'),'the currency chip the sales pages carry');
 assert.ok(page.includes('<p className="soPostingNote">A credit note reaches the ledger when it is posted from the register'),'and a posting note stating that nothing on the page posts on its own');
});
test('the mapping dialog offers both the shared account and a reason-specific one',()=>{
 assert.ok(page.includes("['salesAdjustment','Sales Adjustment Account *','Income','Select account']"),'the shared sales-adjustment account every reason uses by default');
 assert.ok(page.includes("['salesReturn','Sales Return Account','Income','Use the Sales Adjustment account']"),'beside a dedicated Sales Return account for the Sales Return reason');
 assert.ok(page.includes("['taxAdjustment','Tax Adjustment Account','Income','Use the Sales Adjustment account']")&&page.includes("['otherAdjustment','Other Adjustment Account','Income','Use the Sales Adjustment account']"),'and the other reason-specific routes, each inheriting the shared account while it is blank');
 assert.ok(page.includes("required={['salesAdjustment','ar'].includes(k)}"),'only the two accounts a credit note cannot do without are required, so a blank reason-specific account means inherit and the inventory accounts do not block the save');
 assert.ok(page.includes('Leave it on the Sales Adjustment account unless the return needs a ledger of its own.'),'and the dialog says what leaving it blank does');
});
test('the footer offers Cancel, Save draft and Post credit note, and posting runs the engine workflow',()=>{
 assert.ok(page.includes('<button type="button" onClick={()=>setForm(null)}>Cancel</button><button type="submit">Save draft</button><button type="button" className="primary" onClick={postCreditNote}>Post credit note</button>'),'the three footer actions in order');
 assert.ok(page.includes('function postCreditNote(){')&&page.includes("commit('save',form)")&&page.includes("commit('submit',{id})")&&page.includes("commit('approve',{id})")&&page.includes('issueCreditNote(id)'),'and Post saves, submits, approves and issues through the module own engine, so a goods return still posts first');
});
test('the invoice id opens the original-invoice facts in a right-side popup, not an inline panel',()=>{
 const styles=read('src/credit-notes.css');
 assert.ok(!page.includes('<details className="cnInvoiceFacts">'),'the facts are no longer a disclosure that unfolds inside the card, where they took the height a credit-entry page needs');
 assert.ok(page.includes('<span className="cnInvoiceFacts"><button type="button" className="cnInvoiceLink"'),'the invoice id is one clickable link');
 assert.ok(page.includes('aria-haspopup="dialog" aria-expanded={invoiceFactsId===form.originalInvoiceId} onClick={()=>setInvoiceFactsId(form.originalInvoiceId)}'),'that opens the popup on click and says whether it is open');
 assert.ok(page.includes('{invoiceFactsId===form.originalInvoiceId&&createPortal(<div className="cnInvoiceLayer">'),'the popup is portalled, so no card can clip it');
 assert.ok(page.includes('</div></div></div>,document.body)}</>'),'onto the document body');
 assert.ok(page.includes('<div className="cnInvoiceDrawer" role="dialog" aria-modal="true" aria-label="Original invoice details">'),'as a modal dialog named for what it shows');
 assert.ok(!page.includes('<aside className="cnInvoiceDrawer"'),'and never an aside, because the prototype global rule hides every aside below 700px and threw the popup off the left edge');
 assert.ok(read('src/styles.css').includes('aside{transform:translateX(-100%)'),'which is the legacy mobile rule that caused it');
 assert.ok(page.includes('<button type="button" className="cnInvoiceBackdrop" aria-label="Close invoice details" onClick={()=>setInvoiceFactsId(null)}/>'),'the backdrop closes it');
 assert.ok(page.includes('<button type="button" className="cnInvoiceDrawerClose" aria-label="Close invoice details" onClick={()=>setInvoiceFactsId(null)}><IconX size={18}/></button>'),'so does its close button');
 assert.ok(page.includes("if(e.key==='Escape')setInvoiceFactsId(null)"),'and so does Escape');
 assert.ok(page.includes("import {createPortal} from 'react-dom';")&&page.includes('IconTrash,IconX}'),'the portal and the close icon are imported');
 assert.ok(styles.includes('.cnInvoiceLayer{position:fixed;inset:0;z-index:120;display:flex;justify-content:flex-end}'),'the layer is a fixed, right-aligned overlay');
 assert.ok(styles.includes('.cnInvoiceDrawer{position:relative;display:flex;flex-direction:column;width:min(430px,94vw);height:100%;'),'and the drawer is pinned to the right edge at a readable width');
 assert.ok(!/\.cnInvoiceDrawer\{[^}]*transform/.test(styles),'it carries no transform of its own, so it can never slide out of view');
 assert.ok(styles.includes('@media(max-width:560px){.cnInvoiceDrawer{width:100%}}'),'folding to the full width on a narrow screen');
 assert.ok(styles.includes('.cnInvoiceDrawerBody{flex:1;min-height:0;overflow:auto;padding:18px}'),'with one scrolling body, so the facts never push the page sideways');
 assert.ok(styles.includes('.cnInvoiceDrawerBody .soFactList{display:grid;grid-template-columns:minmax(0,1fr)'),'and the fact list in a single column');
});
test('the credit note states its method, and a value-only note asks for amount, tax and account',()=>{
 assert.ok(service.includes("export const CREDIT_METHODS=['Item Based Credit','Amount Based Credit'];"),'both methods live in the service');
 assert.ok(page.includes("<label>Credit method<select aria-label=\"Credit method\" value={method}"),'the details card asks for the method');
 assert.ok(page.includes('{CREDIT_METHODS.map(x=><option key={x}>{x}</option>)}'),'offering both');
 assert.ok(service.includes("export const creditMethod=value=>CREDIT_METHODS.includes(value)?value:DEFAULT_CREDIT_METHOD;"),'through one normaliser');
 assert.ok(page.includes("CREDIT_METHODS,creditMethod,DEFAULT_CREDIT_METHOD} from './credit-note-service.js';"),'and the two constants the form seeds a new note with are imported, not left as free identifiers - the bundle build does not catch that, the running app does');
 assert.ok(page.includes("{amountBased&&<div className=\"ivCard soFormSection\"><div className=\"soSectionHead\"><h3>Adjustment</h3>"),'a value-only note opens its own Adjustment card');
 assert.ok(page.includes("<label>Adjustment amount *<input required type=\"number\" min=\"0\" step=\"0.01\" aria-label=\"Adjustment amount\""),'with the adjustment amount');
 assert.ok(page.includes("<label>Tax treatment{form.type==='Against Invoice'?<input readOnly aria-label=\"Tax treatment\""),'a tax treatment that is inherited and read-only against an invoice');
 assert.ok(page.includes("['Exempt','GST 5%','GST 12%','GST 18%','GST 28%'].map"),'and chosen by the operator only on a standalone note');
 assert.ok(page.includes("<label>Adjustment account<select aria-label=\"Adjustment account\""),'and the account the adjustment posts to');
 assert.ok(page.includes("db.accounts.filter(a=>a.active&&a.type==='Income').map"),'offering only income accounts, which is the type the posting plan validates against');
 assert.ok(service.includes(',salesAccount=note.adjustmentAccount||'),'which the posting plan uses ahead of the configured mapping');
 assert.ok(page.includes("{original&&!amountBased&&<div className=\"ivCard soFormSection\"><div className=\"soSectionHead\"><h3>Credit items</h3>"),'a value-only note hides the invoice item cards, which it has no quantities for');
 assert.ok(page.includes("{form.type!=='Against Invoice'&&!amountBased&&<div className=\"ivCard soFormSection\"><div className=\"soSectionHead\"><h3>Credit lines</h3>"),'and the standalone line editor too');
});

test('the goods decision is derived, and the item card states what it is',()=>{
 assert.ok(service.includes("export const INVENTORY_IMPACTS=['Return Stock To Inventory','Financial Adjustment Only'];"),'both inventory decisions still live in the service, because the stored value and the report vocabulary are unchanged');
 assert.ok(!page.includes('Inventory impact'),'the Inventory impact card is gone from the create page - the operator asked for it to be removed');
 assert.ok(!page.includes('INVENTORY_IMPACTS')&&!page.includes('aria-label="Inventory impact"'),'with no picker, no option list and no import left behind');
 assert.ok(service.includes("inventoryImpact:type==='Against Invoice'&&p.originalInvoiceId&&isReturnReason(reason)?'Return Stock To Inventory':'Financial Adjustment Only',"),'because the engine now derives it: a goods reason against an invoice returns the stock, everything else is a financial adjustment');
 assert.ok(page.includes("const plan=target.inventoryImpact==='Return Stock To Inventory'||target.salesReturn?.enabled?{...(target.salesReturn||{}),enabled:true}:null;"),'and issuing reads that derived decision, so a goods return still posts its Sales Return document first');
 assert.ok(page.includes('<article className="cnItemCard"')&&page.includes('<dl className="cnItemFacts cnItemFactsQty">')&&page.includes('<dl className="cnItemFacts">'),'the item card reads in three bands: identity, quantity, then value and posting');
 assert.ok(page.includes('<span>HSN/SAC <b>{src.hsnSac||\'Not recorded\'}</b></span>'),'the HSN/SAC is always stated, reading Not recorded rather than disappearing when the invoice line has none');
 assert.ok(page.includes('<span>Unit <b>{src.unit||\'Not recorded\'}</b></span>'),'as are the unit and the invoice line');
 assert.ok(page.includes('<b className="cnItemName">{src.description||\'Invoice item\'}</b>'),'with the item name named as such at the top of the card');
 assert.ok(!page.includes('cnItemAmount'),'and the duplicate amount that used to sit in the header is gone, leaving the one labelled Credit amount in the foot');
});

test('the credit summary states every figure, and the removed cards are gone',()=>{
 assert.ok(!page.includes('<h3>Tax summary</h3>'),'the Tax summary card was removed from the create page on request');
 assert.ok(!page.includes('Accounting Impact Preview'),'and the Accounting Impact Preview with it');
 assert.ok(!page.includes('impactOpen'),'including the disclosure state it needed');
 assert.ok(page.includes("['Total tax',t.cgst+t.sgst+t.igst+t.cess]"),'while the credit summary still states a total tax line, so no figure is lost with the card');
 assert.ok(page.includes('const summary=t=><dl className="ivTotals">'),'through the one summary helper');
 assert.ok(read('src/credit-notes.css').includes('.creditNotes .cnInvoiceSummary{'),'and the invoice summary tokens are untouched by the removal');
});

test('the invoice summary, the head status and the posting scope are stated on the page',()=>{
 assert.ok(page.includes('<dl className="cnInvoiceSummary"><div><dt>Invoice number</dt><dd>{original.number}</dd></div>'),'the invoice facts the brief asks to keep visible lead the card');
 assert.ok(page.includes('<dt>Available credit</dt><dd>{money(original.totals.total-credited(db,original))}</dd>'),'including the available credit');
 assert.ok(page.includes("<dt>Place of supply</dt><dd>{placeLabel(form.place)||'Not recorded'}</dd></div></dl>"),'and the place of supply, seven facts in all');
 assert.ok(page.includes('cnInvoiceFacts')&&page.includes('cnInvoiceDrawer'),'while the link still opens the full snapshot in the right-side popup');
 assert.ok(page.includes('className="soHeadStatus"')&&page.includes("tone={CREDIT_TONES[formStatus]||'neutral'}"),'the head carries the document status');
 assert.ok(page.includes('const formStatus=form&&form.id?'),'read from the note own lifecycle');
 assert.ok(page.includes('<span>Available credit</span><strong>{money(customerCreditSummary(db,form.customerId).available)}</strong>'),'the customer strip states available credit beside the net receivable');
 assert.ok(page.includes('className="cnContextRow"')&&page.includes('<small>Organisation</small>')&&page.includes('<small>Branch</small>'),'and the organisation and branch the note posts to are on the details card');
 assert.ok(read('src/credit-notes.css').includes('.creditNotes .cnInvoiceSummary{'),'with compact summary tokens');
});
