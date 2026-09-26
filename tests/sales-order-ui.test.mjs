import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';

const source=await readFile(new URL('../src/SalesOrders.jsx',import.meta.url),'utf8');
const styles=await readFile(new URL('../src/sales-orders.css',import.meta.url),'utf8');

/* The row is two icons now: an eye that opens THIS order preview - the only detail screen a sales
   order has - and the action menu beside it, whose invoice entry hands the document to the Invoices module. */
test('every sales order row carries one eye that opens the order preview, beside its action menu',()=>{
 assert.match(source,/New sales order/);
 assert.ok(!source.includes('/>Edit</button>')&&!source.includes('/>Preview</button>'),'the per-row Edit and Preview buttons are gone');
 assert.match(source,/<button className="soRowIconButton" aria-label=\{'Preview '\+x\.number\} title=\{'Preview '\+x\.number\} onClick=\{\(\)=>setPrintDoc\(x\)\}><IconEye size=\{17\}\/><\/button>/,'the row action is an icon-only eye that opens DocumentPreview for that order, so no order is unreachable for want of an invoice');
 assert.match(source,/function invoiceIdOf\(order\)\{if\(order\.invoice\?\.id\)return order\.invoice\.id;/,'the invoice is resolved from the order record first');
 assert.match(source,/return \(stored\.invoices\|\|\[\]\)\.find\(i=>i\.sourceOrder===order\.id\)\?\.id\|\|''\}catch\{return ''\}\}/,'and then from the invoice store by sourceOrder, the same lookup convertSalesOrder makes');
 assert.match(source,/function openInvoice\(order\)\{const id=invoiceIdOf\(order\);if\(!id\)return;sessionStorage\.setItem\('wayvida-open-invoice',id\);onNavigate\('Invoices'\)\}/,'and the row menu still hands the invoice over through the same sessionStorage key, which is why the icon is free to open the order itself');
 assert.ok(!styles.includes('.soPreviewButton'),'the Preview button rule is deleted rather than left dead');
 assert.match(styles,/\.soGridActions\{display:(?:inline-)?flex/);
 assert.match(styles,/\.soOrdersTable th:nth-child\(8\)\{width:12%\}/,'the Actions column keeps the width the eye and the row menu need');
});

/* Removing the row button must not remove the capability, so editing moves into the row menu. */
test('the row menu still offers editing, which the row button used to carry',()=>{
 const actions=readFileSync(new URL('../src/SalesOrderActions.jsx',import.meta.url),'utf8');
 assert.match(actions,/onPreview,onOpenInvoice,onEdit,onDuplicate,onExport,onDelete,role='Admin'\}/,'the menu receives the editor the row gave up, the invoice hand-off the eye no longer performs, and the acting role so a conversion carries its context');
 assert.match(actions,/<button role="menuitem" disabled=\{!!order\.invoice\|\|\['Completed','Cancelled'\]\.includes\(order\.status\)\} title=/,'Edit order leads the menu on the exact condition the row button was disabled by');
 assert.match(actions,/onClick=\{\(\)=>\{setMenu\(null\);onEdit\(\)\}\}><IconEdit size=\{17\} aria-hidden="true"\/><span>Edit order<\/span><\/button>/,'and it opens the same editor');
 assert.match(source,/<SalesOrderActions role=\{role\} onPreview=\{\(\)=>setPrintDoc\(x\)\} onOpenInvoice=\{\(\)=>openInvoice\(x\)\} onEdit=\{\(\)=>open\(x\)\}/,'wired to the page editor, and given the acting role so a conversion carries its context');
});

test('sales order register lists the agreed eight columns',()=>{
 assert.match(source,/\['Order','Customer','Organisation','Branch','Amount','Status','Payment status','Actions'\]\.map/,'the recommended column set: organisation and branch apart, and no Created by');
 assert.ok(!/\['Order','Customer'[^\]]*Expected shipment/.test(source),'Expected shipment is no longer a column');
 assert.match(source,/<b className="soOrderNumber">\{x\.number\}<\/b><small>\{fmtDate\(x\.date\)\}<\/small>/,'the order number and date share one cell');
 assert.match(source,/<td>\{x\.organizationName\|\|'Not recorded'\}<\/td><td>\{x\.branchName\|\|'Not recorded'\}<\/td>/,'organisation and branch are cells of their own, in that order, matching the invoices register');
 assert.match(source,/className="soAmount">\{money\(x\.total\)\}/,'the order value keeps its own cell');
 assert.ok(!source.includes("<td>{x.createdBy||'Not recorded'}</td>"),'Created by has no cell in the grid - the register filter still offers it, because filtering by who raised an order is a search, not a column');
 assert.ok(!source.includes("'Reference'"),'the Reference column is gone from the grid');
});

test('the blue Sales eyebrow and the record count are gone',()=>{
 assert.ok(!source.includes('soEyebrow'),'the eyebrow span is removed');
 assert.ok(!styles.includes('.soEyebrow'),'its rule is removed');
 assert.ok(!source.includes("visible.length===1?'order':'orders'"),'the one-order count is removed');
 assert.ok(!styles.includes('.salesOrdersPage .itemsTools>span'),'the count styling is removed');
});

test('status and payment status use the shared pill',()=>{
 assert.match(source,/<StatusPill status=\{x\.status\} tone=\{ORDER_TONES\[x\.status\]\|\|'neutral'\}\/>/,'Status renders the shared pill');
 assert.match(source,/<StatusPill status=\{x\.payment\} tone=\{PAYMENT_TONES\[x\.payment\]\|\|'neutral'\}\/>/,'Payment status renders the shared pill');
 assert.match(source,/const ORDER_TONES=\{Draft:'neutral',Confirmed:'info',Completed:'ok',Cancelled:'danger'\};/,'the order statuses keep their colours');
 assert.match(source,/const PAYMENT_TONES=\{Paid:'ok','Partially Paid':'warn',Unpaid:'neutral',Overdue:'danger','Not invoiced':'neutral'\};/,'the payment states keep their colours');
 assert.ok(!source.includes('soStatus'),'the bespoke status badge is gone');
 assert.ok(!styles.includes('.soStatus'),'its rules are gone');
});

test('payment status comes from the linked invoice, never from a guess',()=>{
 assert.match(source,/import \{KEY,initial,paymentStatus,calculate\} from '\.\/invoice-engine\.js';/,'the engine helpers are imported, including calculate for the running total in the action bar');
 assert.match(source,/const invoice=\(live\.invoices\|\|\[\]\)\.find\(entry=>entry\.sourceOrder===x\.id\)/,'the order is matched to its invoice');
 assert.match(source,/payment:invoice\?paymentStatus\(live,invoice\):'Not invoiced'/,'an uninvoiced order says so instead of being called unpaid');
});

test('the register filters on order, date, statuses, customer and scope',()=>{
 /* The shipment filter went with the shipment fields the create page no longer records: it could
    only ever return an empty register. */
 assert.ok(!source.includes('Expected shipment'),'no filter asks for a shipment date nothing can set');
 /* The shipment filter went with the shipment fields the create page no longer records: it could only
    ever return an empty register. */
 for(const label of ['Payment status','Customer','Organisation','Branch','Created by','Order date from','Order date to'])
  assert.ok(source.includes('aria-label="'+label+'"'),'the filter panel carries '+label);
 assert.match(source,/const activeFilters=\[/,'the panel reports how many filters are on');
 assert.match(source,/<\/summary><div className="soFiltersPanel">/,'the filters live behind one disclosure');
 assert.match(source,/onClick=\{clearFilters\}>Clear filters<\/button>/,'Clear filters is offered');
 assert.match(source,/const visible=decorated\.filter\(/,'the row set is filtered');
 const clauses=[
  "payStatus==='All payment statuses'||x.payment===payStatus",
  "customerFilter==='All customers'||x.customerName===customerFilter",
  "orgFilter==='All organisations'||x.organizationName===orgFilter",
  "branchFilter==='All branches'||x.branchName===branchFilter",
  "creatorFilter==='All users'||x.createdBy===creatorFilter",
  '(!from||x.date>=from)&&(!to||x.date<=to)',
 ];
 for(const clause of clauses)assert.ok(source.includes(clause),'the filter is applied: '+clause);
});

test('the working context and the acting role are stamped on save',()=>{
 assert.match(source,/import \{getAccessibleOrganizations,getCurrentOrganizationContext\} from '\.\/organisation-context\.js';/,'the working context is read');
 assert.match(source,/const role=mode==='business'\?'Admin':'Accountant';/,'the acting role mirrors the View as switch');
 assert.match(source,/organizationId:form\.organizationId\|\|company\?\.id\|\|''/,'the organisation is stamped');
 assert.match(source,/branchName:form\.branchName\|\|branch\?\.name\|\|''/,'the branch is stamped');
 assert.match(source,/createdBy:form\.createdBy\|\|role/,'the creator is stamped');
 assert.match(source,/saveSalesOrder\(read\('wayvida-sales-orders',\[\]\),stamped,config,status\)/,'the stamped order is saved');
});

test('sales order register preserves accessible search and more actions',()=>{
 assert.match(source,/aria-label="Search sales orders"/);
 assert.match(source,/aria-label="Order status"/);
 assert.match(source,/<SalesOrderActions/);
});

test('the filter panel and merged cells are styled with the page tokens',()=>{
 assert.match(styles,/\.soOrdersTable td small\{display:block;margin-top:3px;color:#667085;font-size:12px;font-weight:400\}/,'the merged second line reads as a muted 12px line');
 assert.match(styles,/\.soFiltersMore>summary\{display:inline-flex;align-items:center;gap:7px;min-height:38px/,'the Filters control matches the bar');
 assert.match(styles,/\.soFiltersPanel\{position:absolute;right:0;top:calc\(100% \+ 6px\);z-index:75/,'the panel floats under its control');
 assert.match(styles,/\.soClearFilters\{grid-column:1\/-1/,'Clear filters spans the panel');
 assert.match(styles,/\.salesOrdersPage \.soFiltersPanel label\{display:flex;flex-direction:column;align-items:stretch;gap:7px;width:auto;max-width:none;min-width:0;padding:0;border:0;border-radius:0/,'the panel resets the bordered search-box label that the shared .itemsTools rule would otherwise apply to every field');
 assert.match(readFileSync(new URL('../src/items.css',import.meta.url),'utf8'),/\.itemsTools label\{display:flex;gap:8px;align-items:center;border:1px solid #d0d5dd/,'which is a real rule the panel has to beat');
 assert.match(styles,/\.soListCard\{overflow:visible/,'the register card must not clip the panel that opens inside its toolbar');
 assert.match(styles,/\.salesOrdersPage \.soFiltersPanel select,\.salesOrdersPage \.soFiltersPanel input\{width:100%;height:38px/,'the panel controls share one size');
 assert.match(styles,/@media\(max-width:680px\)\{\.soFiltersPanel\{position:static/,'the panel stops floating on a narrow screen');
 const sizes=[...styles.matchAll(/font-size:([\d.]+)px/g)].map(match=>Number(match[1]));
 assert.ok(sizes.every(size=>size>=12),'the twelve pixel floor holds: '+sizes.filter(size=>size<12).join(', '));
});

test('the create page opens with a back arrow and title under the working-context bar',()=>{
 assert.match(source,/<div className="soCreateHead"><div className="soHeadIdentity"><button type="button" className="soBack" aria-label="Back to sales orders" onClick=\{\(\)=>setForm\(null\)\}><IconArrowLeft size=\{19\}\/><\/button>/,'the head leads with one square back button');
 assert.match(source,/<h2 id="soCreateTitle">\{form\.id\?'Edit sales order':'New sales order'\}<\/h2>/,'the title switches between New and Edit');
 assert.match(source,/<small className="soHeadHint">Editing \{form\.number\}<\/small>/,'the hint names the order when editing, exactly as the Customers and Items heads do');
 assert.match(source,/\{form\.id&&<small className="soHeadHint">/,'the hint renders only while editing');
 assert.ok(!source.includes('Order only — generate an invoice when ready'),'the create-page explanation sentence is gone');
 assert.ok(!source.includes('className="ivLink"'),'the inline back link is gone');
 assert.ok(!styles.includes('.soCreatePage .ivHeading'),'its rule is gone');
 assert.match(styles,/body:has\(\.soCreatePage\) \.app main\{max-width:none!important;padding:0!important\}/,'the shell box is given up so the head reaches the top');
 assert.match(styles,/\.soCreatePage>\.soCreateHead\{display:grid;grid-template-columns:minmax\(0,1fr\) auto;align-items:center;gap:14px;width:100%;min-height:56px;margin:0;padding:8px 24px;background:#fff;border-top:1px solid #dfe6ef;border-bottom:1px solid #dfe6ef;border-radius:0;box-shadow:none\}/,'the head is the same 56px white bar the other create pages use');
 assert.match(styles,/\.soCreatePage>:not\(\.soCreateHead\)\{margin-left:clamp\(16px,2\.2vw,24px\)/,'every other child gets the gutter back');
 assert.match(styles,/\.soBack\{display:inline-grid;place-items:center;flex:none;width:40px;height:40px;padding:0;border:1px solid #d7e0eb;border-radius:8px/,'the back button keeps the shared geometry');
 assert.match(styles,/@media\(max-width:760px\)\{\s+\.soCreateHead\{padding:8px 12px\}/,'the head narrows with the working-context bar');
});

test('a selected customer shows the read-only tax facts and both addresses with an edit action',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.match(fields,/import \{useEffect,useRef,useState\} from 'react';/,'the editor needs local state, the card pencil menu needs one effect to close itself, and the customer search holds the field it releases the caret from');
 assert.match(fields,/const \[addressEdit,setAddressEdit\]=useState\(''\);/,'the editor opens on demand');
 assert.match(fields,/const selectedCustomer=customers\.find\(entry=>entry\.id===form\.customerId\)\|\|null;/,'the panel reads the selected customer');
 assert.ok(fields.includes('<div className="ivCard soFormSection"><div className="soSectionHead"><h3>Customer *</h3></div>'),'the customer card is the shared one, used by the order and the invoice alike');
 assert.ok(!fields.includes("kind==='order'?<>"),'the layout is no longer branched on kind, which is what kept the two create pages from drifting');
 assert.ok(fields.includes('<p className="soFactCaption">Read from the customer record.'),'the panel says where the facts come from, so a read-only value is never mistaken for an empty field');
 assert.match(fields,/<dl className="soFactList">/,'the read-only facts are a definition list, the same shape the Item Details page uses');
 assert.match(fields,/<div className="soFactItem"><dt>GST treatment<\/dt><dd>\{selectedCustomer\?\.gstTreatment\|\|'Not recorded'\}<\/dd><\/div>/,'the tax treatment is stated as a fact');
 assert.match(fields,/<div className="soFactItem"><dt>GSTIN<\/dt><dd>\{selectedCustomer\?\.gstin\|\|'Not registered'\}/,'the GSTIN is stated as a fact');
 assert.match(fields,/<div className="soFactItem"><dt>PAN<\/dt><dd>\{selectedCustomer\?\.pan\|\|'Not recorded'\}<\/dd><\/div>/,'PAN completes the read-only row');
 assert.ok(!/<dt>(?:GST treatment|GSTIN|PAN)<\/dt><dd><input/.test(fields),'none of them is an input, because they are set on the customer');
 assert.match(fields,/<dt>Billing address<\/dt>.*<dt>Shipping address<\/dt>/,'both addresses are listed as facts in the customer strip');
 assert.match(fields,/<summary aria-label="Edit address" title="Edit address">/,'the card carries one pencil, at its top right, and it names what it edits because it is an icon on its own');
 assert.ok(fields.includes('<div className="soCustomerActions"><details className="soFactEdit">'),'the pencil appears on the actions row with a chosen customer only, because picking one overwrites both addresses from the master and the row is inside that branch');
 assert.match(fields,/<dd>\{billingText\|\|'Not provided'\}\{sameAddress&&<small className="soAddressSameNote">/,'the address is the fact value, with its note as the line underneath it');
 assert.ok(!fields.includes('so-place-of-supply'),'Place of supply is not in the read-only panel at all');
 assert.match(fields,/<input placeholder=\{autoNumber\|\|'Automatic'\} value=\{form\.number\|\|''\}/,'the number field keeps its own field, stating the number the save will take and staying editable');

});

test('the order draft survives the same detour',()=>{
  assert.ok(source.includes("const DRAFT_KEY='wayvida-draft-order';"),'the order keeps its own draft key');
  assert.ok(source.includes("sessionStorage.setItem('wayvida-return-to','Sales Orders')"),'the detour stashes the draft and the return marker before it leaves');
  assert.ok(source.includes("const customer=read('wayvida-customers',customerSeeds).find(c=>c.id===draft.customerId);return customer?applyCustomerSnapshot(draft,customer):draft"),'and the restore reads the customer list from storage rather than a binding declared after the initializer');
});

test('the customer card shows an animated empty state until a customer is chosen',()=>{
  const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/sales-orders.css',import.meta.url),'utf8');
  assert.ok(fields.includes("import EmptyState from './EmptyState.jsx';"),'the card uses the shared empty state rather than rolling its own');
  assert.match(fields,/<div className="soCustomerRef">\{selectedCustomer\?<>/,'the read-out is the selected-customer branch of the card');
  assert.match(fields,/<EmptyState variant="customer" className="soCustomerEmpty" title="No customer selected"/,'with no customer chosen the card states the one thing left to do');
  assert.ok(fields.includes('description={`Search for a customer above to load their tax identity, contact and addresses onto this ${docWord}.`}'),'and names the document that is open');
  assert.match(fields,/credit limit\.<\/p>\}<\/>:<EmptyState variant="customer"/,'the branch closes after the facts, so the empty state can never render beside them');
  const branchOpen=fields.indexOf('{selectedCustomer?<>',fields.indexOf('soCustomerRef'));
  const branchClose=fields.indexOf('</>:<EmptyState variant="customer"',branchOpen);
  assert.ok(branchOpen>0&&branchClose>branchOpen,'the read-out is one branch of the card');
  const list=fields.indexOf('<dl className="soFactList">',branchOpen);
  assert.ok(list>branchOpen&&list<branchClose,'the definition list sits inside that branch, so no placeholder can render before a customer is chosen');
  for(const value of ["'Not recorded'","'Not registered'","'Not provided'","'Not set'"])
    assert.ok(fields.lastIndexOf(value)>branchOpen&&fields.lastIndexOf(value)<branchClose,value+' is reachable only inside the branch, and the one shared default outside it is the due-date read-out');
  assert.ok(css.includes('.soCreatePage .soCustomerEmpty{grid-column:1/-1;min-height:168px;padding:16px;gap:8px}'),'the block is a slot in the card rather than a page-level empty screen, so a full-width card is not mostly whitespace');
  assert.ok(css.includes('.soCreatePage .soCustomerEmpty .emptyArt{width:78px;height:78px}'),'and its illustration is a size down inside the card');
  assert.ok(css.includes('.soCreatePage .soFactList{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))'),'the fact read-out is three columns of short facts on the full-width card, unchanged for a chosen customer');
});

test('the Billing summary closes the items card without a rule above it',()=>{
  assert.ok(!/\.soCreatePage \.soBillingSummary\{[^}]*border-top/.test(styles),'and it no longer draws the hairline above its heading that was reported as an unwanted line');
  assert.ok(!/\.soCreatePage \.soBillingSummary\{[^}]*padding-top/.test(styles),'nor the padding that stood in for it');
});

test('the address editor gives its fields the dialog gutter',()=>{
  const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
  assert.match(fields,/<div className="soAddressFields">/,'the six address parts are one grid inside the dialog');
  assert.ok(styles.includes('.soAddressDialog>.soAddressFields{padding:16px 18px 0}'),'and that grid takes the same 18px gutter as the heading, the note and the footer, so the inputs no longer touch the dialog edges');
  assert.ok(!styles.includes('.soAddressDialog>label{'),'the dead direct-label rule went with the markup it styled');
});

test('the address editor is an accessible popup that changes only this order',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.match(fields,/\{addressEdit&&<div className="soAddressLayer" role="dialog" aria-modal="true" aria-labelledby="soAddressTitle">/,'the editor is an accessible dialog on both sales documents');
 assert.match(fields,/<button type="button" className="soAddressBackdrop" aria-label="Close address editor" onClick=\{\(\)=>setAddressEdit\(''\)\}\/>/,'the backdrop closes it');
 assert.match(fields,/<button type="button" className="soAddressClose" aria-label="Close address editor"/,'the close button closes it');
 assert.match(fields,/<div className="soAddressFields">/,'the editor is six fields - Address 1, Address 2, City, State, PIN code and Country - not one text blob');
 assert.ok(fields.includes('const composed=composeAddress(address);'),'the six parts are composed into the one string the engine and the templates read, through the same composer the customer master uses');
 assert.ok(fields.includes('const next={...current,[slot]:address,[which]:composed,'),'and both halves - the structured address and the composed string - are written together');
 assert.ok(fields.includes('return applyPlace(next);'),'with the place of supply re-derived from the composed result');
 assert.match(fields,/<p className="soAddressNote">This changes the address on this \{docWord\} only\./,'the note says the edit is local to the document, worded for whichever one is open');
 assert.match(fields,/'The customer master keeps its own address\.'/,'and that the master is untouched');
 assert.match(styles,/\.soAddressLayer\{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:24px\}/,'the layer matches the account drawer recipe');
 assert.match(styles,/\.soCreatePage \.soFactList\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);align-items:start;gap:16px 24px;margin:0;padding:14px 18px;border:1px solid #e4e9f0;border-radius:10px;background:#fbfcfe\}/,'the short facts share one bordered panel three across, and align-items:start keeps a short value from leaving a tall empty box');
 assert.match(styles,/\.soCreatePage \.soFactItem dt\{display:flex;align-items:center;min-height:30px;color:#6b7789;font-size:12px;font-weight:500/,'a muted label over a strong value is the app read-only fact pattern');
 assert.match(styles,/\/\* Every label occupies the same 30px line[\s\S]*?instead of dropping below them\. \*\//,'and every label keeps the same 30px line, so an address label - whose row also carries the Edit button - sits on the same baseline as the values beside it');
 assert.match(styles,/\.soCreatePage \.soFactItem dd\{margin:0;color:#172033;font-size:13px;font-weight:600/,'with no per-field border, so nothing reads as an input');
 assert.ok(!styles.includes('soFactField'),'Place of supply is not a fact in this row any more - it is an ordinary field in the Order details section');
 assert.match(styles,/@media\(max-width:1100px\)\{\.soCreatePage \.soFactList\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/,'it folds to two columns on a narrower screen');
 assert.match(styles,/@media\(max-width:560px\)\{\.soCreatePage \.soFactList\{grid-template-columns:minmax\(0,1fr\)\}/,'and to one column at the smallest width');
});

test('the order panel never renders a bare header element',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.ok(!/<header[ >]/.test(fields),'a bare <header> is painted as the fixed app bar by src/styles.css, so the card and dialog use divs');
 assert.match(fields,/<div className="soSectionHead"><h3>Customer \*<\/h3><\/div>/,'the card head is a div holding a heading, never a bare header element');
 assert.match(fields,/<div className="soAddressDialogHead"><h3 id="soAddressTitle">/,'the dialog head is a div');
 assert.match(styles,/\.soCreatePage \.soFactAddrHead\{display:flex/,'the address head is styled through its own class');
 assert.match(styles,/\.soAddressDialog>\.soAddressDialogHead\{display:flex/,'the dialog head is styled through its own class');
});

test('the create-page controls outrank the shared invoice button rule',()=>{
 assert.match(readFileSync(new URL('../src/invoice-workspace.css',import.meta.url),'utf8'),/\.invoiceWorkspace button\{[^}]*background:#fff/,'the page really does carry that rule, in invoice-workspace.css');
 assert.ok(!styles.includes('.soCreatePage .soAddressEdit{display:inline-flex'),'the labelled Edit button rule is gone rather than left dead beside the icon-only pencil that replaced it');

 assert.match(styles,/\.soCreatePage \.soAddressClose\{[^}]*width:32px;height:32px;min-height:0/,'the dialog close resets it too');
 assert.match(styles,/\.soCreatePage \.soAddressLayer \.soAddressBackdrop\{[^}]*background-color:rgba\(15,23,42,\.28\)!important/,'the backdrop pins its fill, exactly as the account drawer does');
 assert.match(styles,/\.soCreatePage \.soAddressLayer \.soAddressBackdrop\{[^}]*backdrop-filter:none/,'and does not apply a backdrop filter');
});

test('the order page leads with the document header, then the scope, every field carrying its mark',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.match(styles,/@media\(max-width:560px\)\{\.soCreatePage \.soFieldRow,\.soCreatePage \.soFieldRow2,\.soCreatePage \.soFieldRow3,\.soCreatePage \.soFieldRow4\{grid-template-columns:minmax\(0,1fr\)\}\}/,'every field row folds to one column on a narrow screen');
 assert.match(styles,/\.soCreatePage \.soSectionHead h3\{margin:0;color:#172033;font-size:14px;font-weight:650\}/,'each section carries its own small heading');
 assert.match(fields,/<div className="ivFields soFieldRow soFieldRow4"><Field label=\{docTitle\+' ID'\} icon=\{IconHash\}>/,'the header row leads with the document ID, filled automatically and still editable');
 assert.match(fields,/<input placeholder=\{autoNumber\|\|'Automatic'\} value=\{form\.number\|\|''\}/,'holding the automatic number as its placeholder so the operator sees the ID before it is taken, and still editable');
 assert.match(fields,/\{field\('date',docTitle\+' date \*','date',IconCalendar\)\}/,'then the document date');
 assert.match(fields,/\{field\('reference','Reference number','text',IconFileText\)\}/,'then the reference number');
 assert.match(fields,/<Field label="Payment terms" icon=\{IconClock\}/,'closing the row on the payment terms');
 assert.match(fields,/<div className="ivFields soFieldRow soFieldRow3"><Field label="Organisation \*" icon=\{IconBuildingBank\}>/,'and the scope row holds the organisation beneath the document header');
 assert.match(fields,/<Field label="Branch \*" icon=\{IconSitemap\}>/,'beside the branch');
 assert.match(fields,/<PlaceOfSupplyField form=\{form\} setForm=\{setForm\} customer=\{selectedCustomer\}\/><\/div>/,'and the place of supply sits on the same row, beside the branch, so the scope the tax is decided by is never behind a disclosure');
 assert.match(fields,/function Field\(\{label,icon:Icon,hint,children\}\)\{/,'every field is the one Record Transaction control, so it is recognised by its mark as well as its word');
 assert.match(styles,/\.soCreatePage \.soControl\{position:relative;display:flex;align-items:center;gap:10px;min-width:0;min-height:42px;padding:0 11px;border:1px solid #d6e0ec;border-radius:8px;background:#fff;color:#475467\}/,'on the same control tokens the journal create page uses');
 assert.ok(!fields.includes('soFieldRow5'),'the five-field row is gone');
 assert.ok(!fields.includes('soAdvancedAccounting'),'and so is the accounting disclosure, whose place of supply the host pages now render in Additional details');
});

test('the customer field is typed into directly, and the chosen customer reads as a profile',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.ok(!fields.includes("import SearchSelect"),'the dropdown picker is gone from this page');
 assert.match(fields,/function CustomerSearch\(\{customers,value,onSelect,onEditCustomer\}\)\{/,'replaced by one search box');
 assert.match(fields,/<input role="combobox" aria-label="Search customers" aria-expanded=\{open\} aria-autocomplete="list" aria-controls="so-customer-list" placeholder="Search a customer by name, phone or GSTIN"/,'that is typed into in place rather than a trigger that opens a panel');
 assert.match(fields,/<div className="soCustomerResults" id="so-customer-list" role="listbox" aria-label="Customers">/,'with its matches listed under the field');
 assert.match(fields,/<span className="soCustomerAvatar" aria-hidden="true">\{customerInitials\(selectedCustomer\?\.name\)\}<\/span>/,'and the chosen customer is led by a profile mark carrying their initials');
 assert.match(fields,/const customerInitials=name=>String\(name\|\|''\)\.trim\(\)\.split\(\/\\s\+\/\)\.slice\(0,2\)/,'built from the name rather than a generic glyph');
 assert.match(fields,/<span className="soCustomerAvatar" aria-hidden="true">\{customerInitials\(selectedCustomer\?\.name\)\}<\/span><div className="soCustomerLines"><span className="soCustomerHead"><strong className="soCustomerName">/,'the initials mark leads the strip, then the two lines');
 assert.match(fields,/<span className="soCustomerAddress"><b>Billing Address:<\/b> \{addressLine\('billing'\)\|\|'Not provided'\}<\/span>/,'the second line names itself Billing Address and holds the whole address, in the format asked for');
 assert.match(fields,/const addressLine=which=>\{const a=addressOf\(which\),clean=value=>String\(value\|\|''\)\.trim\(\),country=clean\(a\.country\);/,'built from the structured address the document already stores');
 assert.match(fields,/filter\(part=>part&&part!==country\)/,'dropping a part that repeats the country, because a record can hold it in its city field and it would print twice');
 assert.match(fields,/return \[\.\.\.body,\.\.\.\(country\?\[country\]:\[\]\)\]\.join\(', '\)\};/,'and closing the address with the country');
 assert.ok(!fields.includes('soCustomerFacts'),'the separate facts strip is gone: the name and the address are the two lines the card shows');
 assert.match(styles,/\.soCreatePage \.soCustomerProfile\{display:flex;align-items:center;gap:14px;max-height:80px;/,'inside the same 80px ceiling as before, so the card height does not change');
});

test('the address cards stay compact instead of stretching for a multi-line address',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.match(fields,/const inlineAddress=value=>String\(value\|\|''\)\.split\(\/\\r\?\\n\/\)/,'the stored multi-line address is flattened for display');
 assert.match(fields,/<dd>\{inlineAddress\(form\.shipping\)\|\|'Not provided'\}<\/dd>/,'the address fact prints the flattened form, like every other fact value');
 assert.match(styles,/\.soCreatePage \.soFactItem dd\{[^}]*line-height:1\.45/,'and no longer forces one part per line');
 assert.ok(!styles.includes('white-space:pre-line'),'the pre-line rule that made the card as tall as the address is gone');
 assert.match(styles,/\.soCreatePage \.soFactList\{[^}]*padding:14px 18px/,'the panel uses the tighter padding');
});
test('the create page carries the same shell padding as the other create pages',()=>{
 assert.match(styles,/body:has\(\.soCreatePage\) \.app main\{max-width:none!important;padding:0!important\}/,'the shell box is given up');
 assert.match(styles,/body:has\(\.soCreatePage\) \.app>main\{height:auto;max-height:none;overflow:visible;scrollbar-gutter:auto\}/,'the scrollbar gutter is released, or the head bar stops 15px short of the right edge');
 assert.match(styles,/\.soCreatePage>\.soCreateHead\{display:grid;grid-template-columns:minmax\(0,1fr\) auto;align-items:center;gap:14px;width:100%;min-height:56px;margin:0;padding:8px 24px/,'the head keeps the 24px gutter its own bar uses');
 assert.match(styles,/\.soCreatePage>:not\(\.soCreateHead\)\{margin-left:clamp\(16px,2\.2vw,24px\);margin-right:clamp\(16px,2\.2vw,24px\)\}/,'every other child sits on the shared 24px gutter');
 assert.match(styles,/\.soCreatePage \.salesOrderForm\{width:auto;max-width:none;margin-top:12px;margin-bottom:0;/,'the form fills the remaining width rather than 100% plus margins, and leaves the standard 12px under the head');
 assert.ok(!/\.soCreatePage \.salesOrderForm\{[^}]*margin:0\b/.test(styles),'and it must not set a margin shorthand: that resets the side margins and beats the .soCreatePage>:not(.soCreateHead) gutter, which left the order page flush against the sidebar and pushed the action bar 24px past the right edge');

 assert.ok(!styles.includes('.salesOrderForm{width:100%'),'width:100% is what pushed the form past the content edge');
});
test('the create page actually scrolls, because html is released with the body',()=>{
 assert.match(styles,/html:has\(\.soCreatePage\)\{height:auto;min-height:100%;overflow-y:auto\}/,'the html element is released, which is what lets the document scroll');
 assert.match(styles,/body:has\(\.soCreatePage\)\{height:auto;min-height:100%;overflow:visible\}/,'the body keeps its height released');
 assert.match(styles,/body:has\(\.soCreatePage\) #root\{height:auto;min-height:100%;overflow:visible\}/,'and #root must stay overflow:visible - any other overflow makes it the sticky scrollport and the action bar scrolls off the screen');
 assert.match(readFileSync(new URL('../src/items.css',import.meta.url),'utf8'),/html:has\(\.itemCreatePage\),body:has\(\.itemCreatePage\)/,'which is exactly what the Create Item page does - copying only the body selector left html at height:100% and overflow:hidden, so a real wheel anywhere moved the page 0px');
 assert.match(styles,/body:has\(\.soCreatePage\) \.app\{height:auto;min-height:100vh;overflow:visible\}/,'the app frame is released');
 assert.match(styles,/body:has\(\.soCreatePage\) \.app>main\{height:auto;max-height:none;overflow:visible;scrollbar-gutter:auto\}/,'and so is main');
});

test('the tax selector and the price tax treatment share one line',()=>{
 assert.match(styles,/\.soCreatePage \.ivLineTax\{display:grid;grid-template-columns:max-content minmax\(96px,1fr\);align-items:center;gap:8px;width:100%\}/,'the two controls sit side by side, the rate column sized to its label and the cell filling its column');
 assert.ok(!styles.includes('width:284px'),'the earlier fixed tax-cell width is not left behind');
 assert.match(styles,/\.soCreatePage \.ivTaxSelect>summary\{overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/,'the rate summary never wraps onto a second line, and truncates only as a last resort');
 assert.match(styles,/\.soCreatePage \.ivLineTax>select\{min-width:0;width:100%;height:40px/,'the treatment select matches the 40px siblings beside it');
 assert.equal((styles.match(/\.soCreatePage \.ivTaxSelect\{/g)||[]).length,2,'the selector is sized once and takes its own width once');
 assert.match(readFileSync(new URL('../src/sales-document-tax.css',import.meta.url),'utf8'),/\.ivLineTax\{display:flex;flex-direction:column/,'the shared stack that the order page overrides is still what the invoice page uses');
});
test('the create head title is the same size as the other create pages',()=>{
 assert.match(styles,/\.soCreatePage \.soCreateHead h2\{margin:0;color:#172033;font-size:16px;font-weight:650;line-height:1.25\}/,'the title is 16px, the size the Create Item and Create Journal heads use');
 assert.match(readFileSync(new URL('../src/invoice-workspace.css',import.meta.url),'utf8'),/\.invoiceWorkspace h2\{font-size:23px;margin:0 0 7px\}/,'the host page really does carry a 23px h2 rule');
 assert.match(readFileSync(new URL('../src/SalesOrders.jsx',import.meta.url),'utf8'),/import '\.\/sales-orders\.css';\s+import \{[^}]*\} from '\.\/date-range-filter\.js';\s+import '\.\/invoice-workspace\.css';/,'and it loads after this stylesheet, with the shared date ranges between them, which is why the two-class selector is required');
 assert.match(styles,/\.soCreatePage \.soHeadHint\{display:inline;margin:0;color:#667085;font-size:12px;font-weight:400\}/,'the head hint resets the host small rule too');
 assert.match(styles,/\.soCreatePage \.soAddressDialog h3\{margin:0;color:#172033;font-size:15px;font-weight:650\}/,'and the dialog title');
 assert.match(styles,/\.soCreatePage \.soAddressDialog textarea\{/,'and the dialog textarea');
});

test('matching billing and shipping addresses are shown once',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.match(fields,/const billingText=inlineAddress\(form\.billing\),shippingText=inlineAddress\(form\.shipping\);/,'both addresses are compared as displayed');
 assert.match(fields,/const \[splitFor,setSplitFor\]=useState\(''\);/,'splitting is remembered per customer');
 assert.match(fields,/const sameAddress=\(!shippingText\|\|shippingText===billingText\)&&splitFor!==form\.customerId;/,'the single card is used while the two match');
 assert.match(fields,/\{billingText\|\|'Not provided'\}\{sameAddress&&<small className="soAddressSameNote">/,'one address fact while they match, with the note and the split action inside its own value');
 assert.match(fields,/<div className="soFactItem soFactWide"><dt>Billing address<\/dt>/,'the row is the billing address, spanning the fact strip');
 assert.match(fields,/<small className="soAddressSameNote">Shipping address is the same\. <button type="button" className="soAddressSplit"/,'and it only mentions that shipping matches, with a way to split them, as the note under the one address fact');

 assert.match(fields,/\{!sameAddress&&<div className="soFactItem soFactWide"><dt>Shipping address<\/dt>/,'the second address fact is the alternative branch, shown only when the two differ');


 assert.match(fields,/\.\.\.\(sameAddress&&which==='billing'\?\{\[addressKey\('shipping'\)\]:address,shipping:composed\}:\{\}\)/,'editing the shared card keeps the shipping parts in step too, through the same composer');

 assert.match(styles,/\.soCreatePage \.soFactWide\{grid-column:1\/-1\}/,'each address takes a whole row of its own, because a street address is longer than a state name');
 assert.match(styles,/\.soCreatePage \.soAddressSameNote\{display:block;margin-top:6px;color:#667085;font-size:12px;font-weight:400/,'the note is a 12px muted line');
 assert.match(styles,/\.soCreatePage \.soAddressSplit\{[^}]*cursor:pointer/,'the split action is styled as a link');
});
test('the order items table never scrolls sideways',()=>{
 assert.match(styles,/\.soCreatePage table\.ivLineTable\{table-layout:fixed;width:100%;min-width:0\}/,'a fixed layout with percentage columns cannot exceed its wrapper, whatever the content');
 assert.match(readFileSync(new URL('../src/invoice-workspace.css',import.meta.url),'utf8'),/\.invoiceWorkspace \.ivLineTable\{min-width:980px\}/,'the shared sheet carries the same class-level specificity, and it is imported after this file');
 assert.ok(!styles.includes('.soCreatePage .ivLineTable{table-layout:fixed'),'so the class-only selector would lose the min-width and the table kept a 980px floor that scrolled below 1440px');
 assert.match(styles,/\.soCreatePage \.ivLineTable \.ivQtyCell\{display:flex;align-items:center;gap:6px;min-width:0\}/,'the quantity and its unit share one cell, because they are one fact about the line');
 assert.match(styles,/\.soCreatePage \.ivLineTable \.ivQtyCell>input\{width:auto!important;flex:1 1 0;min-width:32px\}/,'and the count yields inside it rather than pushing the unit out');
 assert.match(styles,/\.soCreatePage \.ivLineTable \.ivSearchInput input\{width:100%!important;max-width:100%\}/,'the search input is re-fitted over the shared 230px !important');
 assert.match(styles,/\.soCreatePage \.ivLineTable input,\.soCreatePage \.ivLineTable select\{width:100%;min-width:0;max-width:100%\}/,'the controls size to their column');
 for(const [n,pct] of [[1,'26'],[2,'13'],[3,'12'],[4,'15'],[5,'20'],[6,'10']])
  assert.ok(styles.includes('.soCreatePage .ivLineTable th:nth-child('+n+'){width:'+pct+'%}'),'column '+n+' is '+pct+'%');
 assert.ok(styles.includes('.soCreatePage .ivLineTable th:nth-child(7){width:46px}'),'and the action column is a fixed 46px, wide enough for the remove target it holds');
 assert.match(styles,/\.soCreatePage \.ivItemSearch\{width:100%\}/,'the item search fills its column rather than the 230px the shared sheet gives it');
 assert.match(styles,/\.soCreatePage \.ivTaxSelect\{width:auto\}/,'and the tax selector takes its own width rather than a fixed 215px');
 assert.match(readFileSync(new URL('../src/invoice-workspace.css',import.meta.url),'utf8'),/\.ivItemSearch\{width:230px/,'those shared widths are what had to be overridden');
});

test('the order items card is tightened',()=>{
 assert.match(styles,/\.soCreatePage \.ivCard\{padding:16px\}/,'the card padding drops from the shared 22px');
 assert.match(styles,/\.soCreatePage \.ivLineTable th,\.soCreatePage \.ivLineTable td\{padding:10px 8px!important;height:auto!important;overflow:hidden\}/,'and the cell padding from 14px 12px, stated over the application-wide 16px 20px !important rule that was costing this grid 40px a cell');
 assert.match(styles,/\.soCreatePage \.salesOrderForm \.ivCard\+\.ivCard\{margin-top:12px\}/,'the gap between cards is reduced');
 assert.match(styles,/\.soCreatePage \.ivCard \.ivHeading\{margin-bottom:12px\}/,'so is the heading gap');
});

test('the order line prints the unit instead of offering a second place to edit it',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.ok(fields.includes("['Item','Quantity','Rate \u20b9','Discount','Tax','Amount','']"),'the unit is no longer a column of its own in the line header');
 assert.match(fields,/<div className="ivQtyCell"><input aria-label=\{'qty '\+\(n\+1\)\} value=\{l\.qty\} onChange=\{e=>updateLine\(n,'qty',e\.target\.value\)\}\/>\{kind==='order'\?<span className="soUnitValue" title=\{l\.item\|\|l\.adHoc\?'Unit from the Item master':'No unit'\}>\{l\.item\|\|l\.adHoc\?\(l\.unit\|\|'\u2014'\):'\u2014'\}<\/span>:<input className="soUnitInput" aria-label=\{'unit '\+\(n\+1\)\} value=\{l\.unit\}/,'the order line shows the unit as read-only text beside the count it belongs to');
 assert.ok(!/<td><span className="soUnitValue"/.test(fields),'and only the order branch does it - the invoice page keeps the unit input it always had, because the engine refuses a line with no unit and a free-typed line has nothing to copy from');
 assert.match(styles,/\.soCreatePage \.ivLineTable \.soUnitValue\{flex:0 1 auto;min-width:0;padding:0;color:#6b7789;font-size:12px;font-weight:600;/,'so it reads as the muted unit label beside the count, not a second field');
});

test('the discount number yields so the %/rupee selector stays visible',()=>{
 const shared=readFileSync(new URL('../src/invoice-workspace.css',import.meta.url),'utf8');
 assert.match(shared,/\.ivDiscount select\{width:55px!important\}/,'the shared sheet gives every line input width:100%, which used to push the selector out of the cell');
 assert.match(styles,/\.soCreatePage \.ivLineTable \.ivDiscount\{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden\}/,'the pair shares one flex cell');
 assert.match(styles,/\.soCreatePage \.ivLineTable \.ivDiscount input\{width:auto!important;flex:1 1 0;min-width:0\}/,'the number yields instead of overflowing');
 assert.match(styles,/\.soCreatePage \.ivLineTable \.ivDiscount select\{width:54px!important;flex:0 1 54px;min-width:46px\}/,'and the selector keeps a readable width, shrinking only as a last resort');
});

test('the remove line action is a red, padded target',()=>{
 assert.match(styles,/\.soCreatePage \.ivLineTable td:last-child button\{width:32px;min-width:32px;height:32px;min-height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;color:#b42318;background:#fff5f4;border-color:#f0c8c4;border-radius:7px\}/,'the destructive action reads as one, with a centred icon');
 assert.match(styles,/\.soCreatePage \.ivLineTable td:last-child button:hover:not\(:disabled\)\{color:#912018;background:#fde8e6;border-color:#e3a49e\}/,'and darkens on hover');
 assert.ok(!styles.includes('td:last-child button{width:36px;min-width:36px;padding:0}'),'the squeezed 36px box is gone');
});

test('the create page picks the organisation and branch the order is raised in',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.match(source,/import \{getAccessibleOrganizations,getCurrentOrganizationContext\} from '\.\/organisation-context\.js';/,'the working context is the source of the scope list');
 assert.match(source,/const organisations=getAccessibleOrganizations\(\);/,'read once for the form');
 assert.match(source,/<SalesDocumentFields kind="order" onEditCustomer=\{editCustomer\} onCreateItem=\{createItem\} autoNumber=\{nextSalesOrderNumber\(orders\)\} form=\{form\} setForm=\{setForm\} customers=\{customers\} items=\{items\} config=\{config\} organisations=\{organisations\} creditOutstanding=\{form\.customerId\?customerCreditSummary\(live,form\.customerId\)\.outstanding:0\} onCreateCustomer=\{createCustomer\}>/,'and handed to the shared fields, with the customer credit exposure the limit warning needs and the detour to the customer master');
 assert.ok(fields.includes('<Field label="Organisation *" icon={IconBuildingBank}><select value={form.organizationId||\'\'} onChange={event=>changeScope(event.target.value,\'\')} required>'),'Organisation is a required picker in the Order details section');
 assert.ok(fields.includes('<Field label="Branch *" icon={IconSitemap}><select value={form.branchId||\'\'} onChange={event=>changeScope(form.organizationId,event.target.value)} required disabled={!selectedOrganisation}>'),'Branch requires an organisation first');
 assert.match(fields,/const selectedOrganisation=organisations\.find\(entry=>entry\.id===form\.organizationId\)\|\|null;/,'the branch list follows the chosen organisation');
 assert.match(fields,/function changeScope\(organisationId,branchId\)\{[\s\S]*?organizationId:organisationId,[\s\S]*?branchId:branchId\|\|''/,'switching organisation clears the branch so a stale one cannot be saved');
 assert.ok(source.includes("if(!order){const {company:seedCompany,branch:seedBranch}=getCurrentOrganizationContext();setForm({number:'',date:today(),organizationId:seedCompany?.id||'',organizationName:seedCompany?.name||'',branchId:seedBranch?.id||'',branchName:seedBranch?.name||'',"),'a new order is seeded from the working context');
});

test('an order cannot be saved against a scope the item is not set up for',()=>{
 assert.match(source,/import {nextSalesOrderNumber,ordersCsv,saveSalesOrder,orderScopeError} from '\.\/sales-order-service\.js';/,'the shared order check is imported, with the numbering the ID field states');
 assert.match(source,/const scopeOrganisation=organisations\.find\(x=>x\.id===form\.organizationId\);if\(!scopeOrganisation\)throw Error\("Select the organisation this order is raised in\."\);/,'the organisation is required');
 assert.match(source,/const scopeBranch=\(scopeOrganisation\.branches\|\|\[\]\)\.find\(x=>x\.id===form\.branchId\);if\(!scopeBranch\)throw Error\("Select the branch this order is raised in\."\);/,'so is the branch');
 assert.match(source,/const scopeError=orderScopeError\(form\.lines,items,\{organisationRefs:\[scopeOrganisation\.id,scopeOrganisation\.code\],branchRefs:\[scopeBranch\.id,scopeBranch\.name\],organisationName:scopeOrganisation\.name,branchName:scopeBranch\.name\}\);if\(scopeError\)throw Error\(scopeError\);/,'and every line is checked against the item master scope before saving');
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.match(fields,/\{lineScopeError\(l\)&&<small className="itemError">\{lineScopeError\(l\)\}<\/small>\}/,'the same message is reported on the line, not only on save');
});

test('the create page is one section per job, in the order the operator works',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
  const order=[fields.indexOf('<h3>Customer *</h3>'),fields.indexOf("{kind==='order'?'Order details':'Invoice details'}"),fields.indexOf("{kind==='order'?'Order items':'Invoice items'}"),fields.indexOf('<h3>Billing summary</h3>')];
 assert.ok(order.every(i=>i>0),'all four headings exist');
 assert.deepEqual(order.slice().sort((a,b)=>a-b),order,'and they appear in that order: the scope and the header first, then the customer, then the lines, then what it is worth');
 assert.match(fields,/<div className="ivCard soFormSection"><div className="soSectionHead"><h3>\{kind==='order'\?'Order details':'Invoice details'\}<\/h3>/,'the document details card leads the page on both documents');
 assert.match(fields,/<div className="soSectionHead"><h3>Customer \*<\/h3><\/div>/,'the customer card leads the page and carries the required mark on its heading alone, so the label is not repeated on the field below it');
 assert.match(readFileSync(new URL('../src/SalesOrders.jsx',import.meta.url),'utf8'),/<section className="soMoreGroup"><div className="ivFields soFieldRow soFieldRow1">/,'and the terms travel into the summary card as a child, with no Additional details card left to hold them');
});
test('the billing summary is its own card after the lines',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.match(fields,/<section className="ivCard soBillingSummary"><div className="soSummaryGrid"><div className="soSummaryLeft"><label className="soSummaryNote"><span>Customer note<\/span>/,'the summary closes the page like an invoice footer, with the customer note and the panels the host passes on the left');
 assert.match(fields,/<\/label>\{children\}<\/div><div className="soSummaryRight"><div className="soSummaryHead"><h3>Billing summary<\/h3><span className="soCurrencyChip"/,'and the host panels and the heading and figures close the card, the heading directly above the currency and the totals');
 assert.match(styles,/\.soCreatePage \.soSummaryMoney\{display:flex;flex-direction:column;align-items:flex-end;gap:8px\}/,'as the first line of the right-aligned money block');
 assert.match(fields,/\{preview\?totals\(preview\):<p role="status">\{previewError\|\|'Select an item and place of supply to calculate totals\.'\}<\/p>\}\{kind!=='order'&&<small>Item tax and price treatment are filled from the Item master\./,'and the Item master note is kept on the invoice page only, not the order page');
 assert.ok(styles.includes('.soCreatePage .soBillingSummary{display:block;width:100%;margin:0}'),'the summary is a card of its own in the stack, taking its chrome from .ivCard');
 assert.match(styles,/\.soCreatePage \.soBillingSummary \.ivTotals\{width:min\(420px,100%\);max-width:none;margin:0 0 0 auto;/,'with the figures holding a readable measure at the right rather than stretching across the page');
 assert.match(fields,/<p className="soPostingNote">\{kind==='order'\?'A sales order is an operational record: it posts nothing to the ledger\./,'and one quiet line saying when, if ever, the document reaches the ledger');
});
test('the order action bar stays on screen while the form scrolls',()=>{
 assert.match(source,/className="ivFooter soActionBar"/,'the footer carries the page action bar class');
  assert.ok(styles.includes('.soCreatePage .soActionBar{position:sticky;bottom:0;z-index:6;display:flex;align-items:center;justify-content:space-between;gap:10px;'),'which is pinned to the foot of the viewport, so Cancel, Save draft and Save & confirm are never scrolled out of reach');
  assert.ok(!styles.includes('.soCreatePage .soActionBar{position:static'),'and is no longer left in the flow, where the three decisions sat below a long form');
  assert.match(styles,/\.soCreatePage \.soBarActions\{display:flex;align-items:center;gap:10px;flex:none;margin-left:auto\}/,'the actions hold the right side whether or not the running totals render beside them, which is what parked them under the customer card');
  assert.ok(styles.includes('z-index:6')&&styles.includes('background:#f6f8fb'),'and it is opaque and layered under the row menus (80) and the address dialog (1200)');
 assert.match(styles,/\.soCreatePage \.soActionBar\{[^}]*margin-left:calc\(-1 \* clamp\(16px,2\.2vw,24px\)\)[^}]*padding:12px clamp\(16px,2\.2vw,24px\)[^}]*background:#f6f8fb/,'painted edge to edge with the page background so nothing shows through behind the buttons');
 assert.ok(styles.includes('@media(max-width:760px){.soCreatePage .soActionBar{margin-left:-12px;margin-right:-12px;padding:12px}}'),'and it follows the 12px gutter below 760px');
 assert.ok(styles.includes('@media(max-width:700px){')&&styles.includes('.soCreatePage table.ivLineTable{min-width:760px}'),'the line table falls back to its own horizontal scroll below 700px, where the fixed percentage columns left the item search about 35px wide');

});

test('documents upload through a drop zone with a file list, not a bare file input',()=>{
 assert.match(source,/import \{[^}]*\bIconUpload\b[^}]*\} from '@tabler\/icons-react';/,'the upload icon is imported');
 assert.match(source,/import \{[^}]*\bIconFileText\b[^}]*\} from '@tabler\/icons-react';/,'and so is the document icon');
 assert.match(source,/<label className=\{'soUploadDrop'\+\(dragActive\?' isActive':''\)\} onDragOver=\{e=>\{e\.preventDefault\(\);setDragActive\(true\)\}\} onDragLeave=\{\(\)=>setDragActive\(false\)\} onDrop=\{dropFiles\}>/,'the tile is a real drop target');
 assert.match(source,/function dropFiles\(e\)\{e\.preventDefault\(\);setDragActive\(false\);readFiles\(\[\.\.\.e\.dataTransfer\.files\]\)\}/,'a drop feeds the same reader the file input uses');
 assert.match(source,/<span className="soUploadCopy"><b>Drag files here or choose from your computer<\/b><small>\{fileLimitText\}<\/small><\/span><span className="soUploadChoose">Choose files<\/span>/,'the copy is built from the enforced budget, not a promise the store cannot keep');
 assert.match(source,/const fileSize=bytes=>\{const n=Number\(bytes\)\|\|0;return n>=1024\*1024\?\(n\/1024\/1024\)\.toFixed\(1\)\+' MB':Math\.max\(1,Math\.round\(n\/1024\)\)\+' KB'\};/,'the file list prints a readable size');
 assert.match(source,/<ul className="soFileList">\{form\.files\.map\(f=><li key=\{f\.id\}><span className="soFileIcon"><IconFileText size=\{15\}\/><\/span><span className="soFileMeta"><b>\{f\.name\}<\/b><small>\{fileSize\(f\.size\)\}<\/small><\/span><button type="button" aria-label=\{'Remove '\+f\.name\}/,'each attachment is a row with its name, size and its own remove');
 assert.match(styles,/\.soCreatePage \.soUploadDrop\{position:relative;display:grid;grid-template-columns:32px minmax\(0,1fr\) auto;align-items:center;gap:10px;min-height:54px;padding:10px 12px;border:1px dashed #cfd8e5;border-radius:9px;background:#fbfcfe/,'styled on the same tile the Create Item page uses for its image');
 assert.match(styles,/\.soCreatePage \.soUploadDrop\.isActive\{border-style:solid;border-color:var\(--ui-primary\);background:#eef4ff/,'with a visible drag-over state');
 assert.match(styles,/\.soCreatePage \.soFileList>li\{display:grid;grid-template-columns:30px minmax\(0,1fr\) auto;align-items:center;gap:10px;/,'and the file list is a plain row list');
 assert.ok(!source.includes('<label>Attachments<input type="file"'),'the bare file input label is gone');
});

test('the create page is one stacked column, with no second column to hunt through',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.ok(!fields.includes('soDocGrid')&&!fields.includes('soDocRail'),'the summary rail is gone from the markup');
 assert.ok(!styles.includes('soDocGrid')&&!styles.includes('soDocRail'),'and so are its rules, rather than left dead');
 assert.ok(!styles.includes('soOrderTop'),'as is the 60/40 row that put the customer beside the document');
 assert.ok(styles.includes('Create page: one stacked column.'),'with the reason recorded beside the rules');
 assert.match(fields,/<div className="soCustomerRow"><div className="soField soFieldSearch">/,'every block is the full width of the page');
 assert.ok(!fields.includes('ivCard ivFields'),'the invoice no longer renders its own flat single field card');
});
test('the register row menu carries Duplicate, Export and a guarded Delete',()=>{
 const actions=readFileSync(new URL('../src/SalesOrderActions.jsx',import.meta.url),'utf8');
 assert.match(actions,/onDuplicate,onExport,onDelete,role='Admin'\}/,'the menu receives the three handlers and the acting role');
 assert.match(actions,/<IconCopy size=\{17\} aria-hidden="true"\/><span>Duplicate<\/span>/,'Duplicate is offered');
 assert.match(actions,/<IconDownload size=\{17\} aria-hidden="true"\/><span>Export<\/span>/,'Export is offered');
 assert.match(actions,/<button role="menuitem" className="soActionDanger" disabled=\{!!order\.invoice\} title=\{order\.invoice\?'This order has a linked invoice\. Cancel or remove the invoice first\.':'Delete this order'\}/,'Delete is destructive, comes last, and is disabled with the reason when an invoice already exists');
 assert.match(actions,/\{confirm==='Delete'\?'Delete':confirm==='Completed'\?'Complete':'Cancel'\}/,'the confirm dialog names the delete case');
 assert.match(actions,/className=\{confirm==='Delete'\?'soConfirmDanger':'primary'\}/,'and confirms it with the danger button');
 const actionStyles=readFileSync(new URL('../src/sales-order-actions.css',import.meta.url),'utf8');
 assert.match(actionStyles,/\.soActionMenu button\[role=menuitem\]\.soActionDanger\{color:#b42318\}/,'the menu row is red');
 assert.match(actionStyles,/\.soConfirm button\.soConfirmDanger\{border-color:#d92d20;background:#d92d20;color:#fff/,'and so is the confirm button');
});

test('a duplicate opens as a new draft with no number, invoice or documents',()=>{
 assert.match(source,/function duplicateOrder\(order\)\{const copy=\{\.\.\.structuredClone\(order\),id:'',number:'',status:'Draft',invoice:null,files:\[\],auditTrail:\[\]\};delete copy\.createdAt;delete copy\.updatedAt;open\(copy\)\}/,'the copy is cleared of its identity, its link and its attachments so the save assigns the next SO number');
 assert.match(source,/function deleteOrder\(order\)\{const next=orders\.filter\(x=>x\.id!==order\.id\);/,'delete removes the row');
 assert.match(source,/function exportOrders\(\)\{downloadText\('sales-orders\.csv','\\ufeff'\+ordersCsv\(visible\)\)\}/,'and Export writes the filtered register through the shared CSV writer');
});

test('the order warns when it would take the customer past their credit limit',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.match(source,/creditOutstanding=\{form\.customerId\?customerCreditSummary\(live,form\.customerId\)\.outstanding:0\}/,'the page hands the customer current exposure in');
 assert.match(fields,/const creditLimit=Math\.round\(Number\(selectedCustomer\?\.limit\|\|0\)\*100\),projectedCredit=creditOutstanding\+\(preview\?preview\.total:0\),overLimit=kind==='order'&&creditLimit>0&&projectedCredit>creditLimit;/,'which is compared with the order total after the totals are calculated, in paise');
 assert.match(fields,/\{overLimit&&<p className="soCreditNotice" role="status">/,'and stated, not blocked');
 assert.match(styles,/\.soCreatePage \.soCreditNotice\{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0;padding:10px 12px;border:1px solid #f5d9a8;border-radius:8px;background:#fffaf0;color:#8a4b09;font-size:12px/,'the notice uses the warning tint on the create-page tokens');
});

test('every order write leaves a visible audit trail',()=>{
 assert.match(source,/function trail\(order,action,from\)\{return \{\.\.\.order,auditTrail:\[\.\.\.\(order\.auditTrail\|\|\[\]\),\{id:crypto\.randomUUID\(\),action,at:new Date\(\)\.toISOString\(\),by:role,fromStatus:from\|\|'',toStatus:order\.status\}\]\}\}/,'the trail records the acting role and the status transition, not the order creator');
 assert.match(source,/,action=!before\.invoice&&order\.invoice\?'Invoice '\+\(order\.invoice\.number\|\|''\)\+' created':before\.status!==order\.status\?'Status '\+order\.status:'Order updated',next=/,'a status change, a conversion and a plain edit each record what happened');
 assert.match(source,/saved=trail\(output\.order,form\.id\?'Order updated':'Order created'\)/,'and the save records created or updated');
 assert.match(source,/\{form\.auditTrail\?\.length>0&&<div className="soOrderHistory">/,'the history renders in Additional details for an existing order');
 assert.match(styles,/\.soCreatePage \.soOrderHistory>ul>li\{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border:1px solid #e4e9f0;border-radius:8px;background:#fff\}/,'as a read-only list on the create-page tokens');
});

test('the attachment budget is what the browser store can actually hold',()=>{
 assert.match(source,/const MAX_FILES=10,MAX_FILE_BYTES=1024\*1024,MAX_TOTAL_BYTES=2\*1024\*1024;/,'the limits are declared, not buried in the reader');
 assert.match(source,/const fileLimitText='You can upload up to 10 files, 1 MB each, 2 MB in total\.';/,'and the copy is the same number the reader enforces');
 assert.match(source,/if\(picked\.some\(x=>x\.size>MAX_FILE_BYTES\)\)\{setErrors\(x=>\(\{\.\.\.x,files:'Each file must be 1 MB or smaller\.'\}\)\);return\}/,'an oversized file is named');
 assert.match(source,/if\(total>MAX_TOTAL_BYTES\)\{setErrors\(x=>\(\{\.\.\.x,files:'Attachments can total 2 MB\. Remove a file or use a smaller one\.'\}\)\);return\}/,'and so is a full budget');
 assert.match(source,/Browser storage is full\. Remove an attachment or clear some saved data, then save again\./,'a full browser store reports something a user can act on instead of the raw quota error');
});

test('the place of supply is derived on the document and only overridden on purpose',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.match(fields,/const placeIsManual=source=>source\.placeSource===PLACE_OF_SUPPLY_SOURCE\.MANUAL\|\|\(!!String\(source\.place\|\|''\)\.trim\(\)&&!source\.placeSource\)/,'a stored document carrying a place but no source predates the field and counts as the operator own value, so opening an old document and editing an address never silently moves its tax treatment');
 assert.match(fields,/const applyPlaceFor=\(next,customerState,force=false\)=>\{if\(!force&&placeIsManual\(next\)\)return next;const suggestion=placeSuggestionOf\(next,customerState\);return \{\.\.\.next,place:suggestion\.state,placeSource:suggestion\.source,placeCode:gstStateCode\(suggestion\.state\)\}\};/,'a derived value is recalculated and a manual one is left exactly where the operator put it, at module scope because the field is rendered by the host pages');
 assert.match(fields,/export function PlaceOfSupplyField\(\{form,setForm,customer\}\)\{/,'the field is exported for the Additional details block on both host pages');
 assert.ok(fields.includes('<option value="">Select Place of Supply</option>'),'an underived field asks for a value rather than guessing one');
 assert.match(fields,/onChange=\{e=>setForm\(\{\.\.\.form,place:e\.target\.value,placeSource:PLACE_OF_SUPPLY_SOURCE\.MANUAL,placeCode:gstStateCode\(e\.target\.value\)\}\)\}/,'choosing a value by hand marks it manual');
 assert.match(fields,/const reset=\(\)=>setForm\(current=>applyPlaceFor\(current,customer\?\.state\|\|'',true\)\);/,'and the reset is the one path that is allowed to overwrite it');
 assert.match(fields,/const status=placeOfSupplyStatus\(form\.placeSource,suggestion\);/,'the helper line is computed from the stored source and the current addresses, inside the exported field');
 assert.match(fields,/<small className="soPlaceHint" role="status">\{status\.text\}\{status\.reset&&<> &middot; <button type="button" className="soPlaceReset" onClick=\{reset\}>\{status\.reset\}<\/button><\/>}<\/small>/,'and it is announced under the control, naming the reset when there is one');
 assert.match(fields,/suggestion=placeOfSupplySuggestion\(c,customerStates\);setForm\(\{\.\.\.form,customerId:id[^}]*place:suggestion\.state,placeSource:suggestion\.source,placeCode:gstStateCode\(suggestion\.state\)/,'selecting a customer fills the field in and records the source');
 assert.ok(!fields.includes('<label>Place of supply *<select required value={form.place}'),'and the field no longer sits in the document-details grid');
});

test('the place of supply is styled as the foot of the address card it is derived from',()=>{
 assert.match(styles,/\.soCreatePage \.soField \.soPlaceHint\{gap:4px;line-height:1\.4\}/,'the source line sits under the control inside the field, on the shared 12px tokens');





 assert.match(styles,/\.soCreatePage \.soPlaceHint\{[^}]*color:#667085;font-size:12px/,'and the source line keeps the 12px floor');
 assert.match(styles,/\.soCreatePage \.soPlaceReset\{[^}]*color:#245fd9;font:inherit;font-size:12px;font-weight:600/,'with the reset as a quiet link, not a second button competing with the primary action');

test('the addresses are facts in the customer card, with one pencil for both',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.match(fields,/<div className="soFactItem soFactWide"><dt>Billing address<\/dt><dd>\{billingText\|\|'Not provided'\}/,'the billing address is a fact in the customer strip, in the same read-out as the tax identity beside it');
 assert.match(fields,/\{!sameAddress&&<div className="soFactItem soFactWide"><dt>Shipping address<\/dt><dd>\{inlineAddress\(form\.shipping\)\|\|'Not provided'\}<\/dd><\/div>\}/,'and the shipping address joins it whenever the two differ');
 assert.match(styles,/\.soCreatePage \.soFactWide\{grid-column:1\/-1\}/,'each address spans the strip, because an address is longer than a state name');
 assert.match(styles,/\.soCreatePage \.soFactWide>dt\{margin-bottom:3px\}/,'on the same 12px label and 13px value tokens the other facts use');
 assert.ok(!fields.includes('soAddressCard'),'and the separate address card is gone rather than left empty');
 assert.ok(!styles.includes('.soAddressGrid'),'with its layout rules deleted, not left dead');
 assert.match(styles,/\.soCreatePage \.soFactEdit>summary\{display:grid;place-items:center;width:32px;height:32px;min-height:0;padding:0;border:0;border-radius:7px;background:transparent;color:#667085;cursor:pointer/,'the one pencil sits at the card top right as a quiet 32px icon button');
 assert.match(styles,/\.soCreatePage \.soFactEditMenu\{position:absolute;right:0;top:calc\(100% \+ 6px\);z-index:80;[^}]*min-width:196px;padding:6px;border:1px solid #e1e6ed;border-radius:9px;background:#fff;box-shadow:0 12px 30px #1018281f\}/,'its menu is the canonical register menu geometry');
 assert.match(fields,/const closeFactEditMenus=\(\)=>document\.querySelectorAll\('\.soFactEdit\[open\]'\)\.forEach\(node=>node\.removeAttribute\('open'\)\);/,'one named closer owns the menu');
 assert.match(fields,/const closeAddItemMenus=\(\)=>document\.querySelectorAll\('\.soAddItem\[open\]'\)\.forEach\(node=>node\.removeAttribute\('open'\)\);/,'and the add-item menu has its own named closer on the same pattern');
 assert.match(fields,/if\(event\.key==='Escape'\)\{closeFactEditMenus\(\);closeAddItemMenus\(\)\}/,'Escape closes both, and taking an entry closes it too');
});

test('the action bar states the running total beside the actions',()=>{
 const page=readFileSync(new URL('../src/SalesOrders.jsx',import.meta.url),'utf8'),invoice=readFileSync(new URL('../src/InvoiceWorkspace.jsx',import.meta.url),'utf8');
 assert.match(page,/const barTotals=\(\(\)=>\{if\(!form\)return null;try\{const t=calculate\(form,config\);return \{total:t\.total,qty:form\.lines\.reduce\(\(n,l\)=>n\+Number\(l\.qty\|\|0\),0\)\}\}catch\{return null\}\}\)\(\);/,'the order page calculates the running total, and yields nothing when the document cannot be calculated yet');
 assert.match(page,/<div className="ivFooter soActionBar">\{barTotals&&<dl className="soBarTotals"><div><dt>Total amount<\/dt><dd>\{money\(barTotals\.total\/100\)\}<\/dd><\/div><div><dt>Total quantity<\/dt><dd>\{barTotals\.qty\}<\/dd><\/div><\/dl>\}/,'and prints amount and quantity - the figures the operator is about to commit - from the same engine call the summary uses');
 assert.match(invoice,/\{preview&&<dl className="soBarTotals"><div><dt>Total amount<\/dt><dd>\{money\(preview\.total\)\}<\/dd><\/div>/,'the invoice bar uses the preview it already computes');
 assert.match(styles,/\.soCreatePage \.ivFooter\.soActionBar\{justify-content:space-between\}/,'the totals take the left of the bar and the actions the right, the way a sales document reads');
  assert.ok(styles.includes('.soCreatePage .soBarActions{display:flex;align-items:center;gap:10px;flex:none;margin-left:auto}'),'with the actions kept together as one group, pushed to the right side whether or not the totals render beside them');
});
});

/* The create page reads left to right: what is being sold, then what it is worth. The summary holds
   the right column and follows the reader, and the two documents share the one grid, so the order
   and the invoice can never drift into two different layouts. */
test('the customer card keeps the master data behind one disclosure',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.match(fields,/<button type="button" className="soCustomerMoreToggle" aria-label="View customer details" title="View customer details" aria-expanded=\{customerMore\} onClick=\{\(\)=>setCustomerMore\(!customerMore\)\}><IconEye size=\{17\}\/><\/button>/,'the rest of the master data sits behind one disclosure, an eye icon button beside the pen');
 assert.match(fields,/<p className="soFactCaption">Read from the customer record\./,'which says where the facts come from, so a read-only value is never mistaken for an empty field');
 assert.match(styles,/\.soCreatePage \.soCustomerActions\{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:0\}/,'and the pen and the disclosure read together from the card trailing edge');
});test('the add-item control offers exactly two ways to start a line',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.match(fields,/<details className="soAddItem"><summary className="soAddItemMain"><IconPlus size=\{16\}\/>Add item<\/summary><div className="soAddItemMenu">/,'Add item is one control with its own menu, not a bare button');
 assert.ok(fields.includes('>Add item row</button>'),'a blank line, whose one item box searches the master and names an ad hoc line, is the first way');
 assert.ok(fields.includes('>Create new item</button>'),'and the way out to the Item master is the second');
 assert.ok(!fields.includes('Add an ad hoc item'),'the separate ad hoc entry is gone, because the line item box already offers the typed text as an ad hoc item');
 assert.ok(fields.includes('const addLine=()=>setForm(current=>({...current,lines:[...current.lines,blankLine()]}));'),'and there is one shape of new line to add, with no kind for the operator to choose');
 assert.ok(fields.includes('onAdHoc={text=>setForm(f=>({...f,lines:f.lines.map((x,k)=>k===n?{...blankLine(),adHoc:true,description:text}:x)}))}'),'and the same search box turns the typed text into an ad hoc line, so a line never has to change kind to be named');
 assert.ok(fields.includes("onType={l.adHoc?text=>updateLine(n,'description',text):undefined}"),'typing edits the stored name only on a line already marked ad hoc');
 assert.ok(!fields.includes('soAdHocName'),'so the separate ad hoc name input, and the second kind of row it needed, are gone');
 assert.match(fields,/\{l\.adHoc&&<small className="soAdHocNote">Ad hoc line: no item master record\./,'with the line saying why it has to be configured by hand');
 assert.match(styles,/\.soCreatePage \.soAddItemMenu\{position:absolute;right:0;top:calc\(100% \+ 6px\);z-index:80;/,'the menu floats under its control on the register menu tokens');
 assert.match(styles,/\.soCreatePage \.soAddItemMain\{[^}]*border:1px solid #bcd0f5;border-radius:7px;background:#eef4ff;color:#245fd9/,'and the control is the light primary variant - primary text and border on a tinted fill - so the primary Save action keeps the solid fill');
});

test('Additional details is one labelled block per job',()=>{
 assert.ok(!source.includes('soMoreGroupTitle">Tax'),'the place of supply left the Additional details card for the details row, so the card no longer needs a Tax block');
 assert.ok(!source.includes('soMoreCard'),'the Additional details card is gone, and its panels live in the summary card so nothing is duplicated');
 assert.ok(!source.includes('soMoreGroupTitle">Shipment'),'with the shipment block removed from the create page Additional details');
 assert.ok(!source.includes('Delivery method')&&!source.includes('Salesperson'),'along with the delivery method and the salesperson');
 assert.match(source,/<\/section><\/SalesDocumentFields>/,'and the panels close the shared component rather than a card of their own');
 assert.match(source,/<section className="soMoreGroup"><div className="ivFields soFieldRow soFieldRow1">/,'with the terms as their own block');
 assert.ok(!source.includes('>Customer notes<textarea'),'because the customer note moved to the Billing summary, where an invoice prints it');
 assert.match(source,/<h4 className="soMoreGroupTitle soUploadLabel">Documents<\/h4>/,'and the documents tile keeps a heading on the same token');
 assert.match(source,/<h4 className="soMoreGroupTitle soUploadLabel">History<\/h4>/,'so does the history list, which only renders for a saved document');
 assert.match(styles,/\.soCreatePage \.soMoreGroup\+\.soMoreGroup\{padding-top:12px;border-top:1px solid #eef1f6\}/,'the blocks are divided by one hairline rather than a full-width rule');
 assert.match(styles,/\.soCreatePage \.soMoreGroupTitle\{margin:0;color:#344054;font-size:12px;font-weight:650;letter-spacing:\.04em;text-transform:uppercase\}/,'on the section-heading tokens, at the twelve pixel floor');
});

test('the line tax states one rate, with the split inside the menu',()=>{
 const controls=readFileSync(new URL('../src/InvoiceLineControls.jsx',import.meta.url),'utf8');
 assert.match(controls,/total=percent\('cgst'\)\+percent\('sgst'\)\+percent\('igst'\)/,'the rate is summed from the components the engine reads, so an intra-state pair still reads as one GST rate');
 assert.ok(controls.includes("const summary=[total?`GST ${total}%`:'',percent('cess')?`Cess ${percent('cess')}%`:''].filter(Boolean).join(' + ')||'No tax';"),'and the line states it as one rate, the way the operator sets it');
 assert.ok(!controls.includes("Object.entries(rates).filter(([,v])=>Number(v)>0)"),'the component-by-component label is gone from the collapsed line - it stays inside the menu, where each rate is labelled as it is entered');
});

test('the create-customer action, the customer type and the net receivable sit on the customer card',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 const styles=readFileSync(new URL('../src/sales-orders.css',import.meta.url),'utf8');
 const orders=readFileSync(new URL('../src/SalesOrders.jsx',import.meta.url),'utf8');
 const invoices=readFileSync(new URL('../src/InvoiceWorkspace.jsx',import.meta.url),'utf8');
 const quick=readFileSync(new URL('../src/quick-create.js',import.meta.url),'utf8');
 const customers=readFileSync(new URL('../src/Customers.jsx',import.meta.url),'utf8');
 const has=(hay,needle,msg)=>assert.ok(hay.includes(needle),msg);
 has(fields,'<button type="button" className="soCustomerCreate" aria-label="Create customer" title="Create customer" disabled={!onCreateCustomer} onClick={()=>onCreateCustomer&&onCreateCustomer()}><IconPlus size={18} stroke={1.8} aria-hidden="true"/></button>','a create-customer icon button stands beside the customer search box');
 has(styles,'.soCreatePage .soCustomerRow{display:flex;align-items:center;gap:10px;max-width:none}','on the row that holds the field, so the two read together');
 has(quick,"export const CUSTOMER_CREATE_KEY='wayvida-open-customer-create';",'the handoff is a one-shot session marker like the Item master one');
 has(orders,"function createCustomer(){try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify(form));sessionStorage.setItem(CUSTOMER_CREATE_KEY,'1');sessionStorage.setItem('wayvida-return-to','Sales Orders')}catch{}onNavigate('Customers')}",'and the order stashes its draft before leaving for the customer master');
 has(invoices,"'wayvida-return-to','Invoices'","as does the invoice page, so both return to the document they left");
 has(customers,'sessionStorage.removeItem(CUSTOMER_CREATE_KEY);start()','the customer master reads the marker once and opens a blank create form');
 has(orders,'onCreateCustomer={createCustomer}>','the handler reaches the shared component');
 has(fields,"<span className=\"soCustomerHead\"><strong className=\"soCustomerName\">{selectedCustomer?.name||'Customer'}</strong><span className=\"soCustomerType\">{customerTypeOf(selectedCustomer)}</span></span>",'the customer type reads as a chip beside the name, resolved by the master own rule');
 has(fields,'<div className="soCustomerMeta" title="What this customer still owes the business"><span>Net receivable</span><strong>{money(creditOutstanding)}</strong></div>','and the net receivable is a stat in the same strip');
 has(invoices,'creditOutstanding={form.customerId?customerCreditSummary(db,form.customerId).outstanding:0}','with the invoice page reading the same credit summary the order page does');
 has(fields,'<div className="soSummaryHead"><h3>Billing summary</h3><span className="soCurrencyChip"','the currency chip shares the heading row, so the footer is not two lines');
 has(styles,'.soCreatePage .soSummaryHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}','pushed to the two ends of that row');
 assert.ok(!orders.includes('soMoreGroupTitle">Terms')&&!invoices.includes('soMoreGroupTitle">Terms'),'and the redundant Terms heading is gone from both pages, because the field already labels itself');
});
test('the item box searches the master and offers the typed text as an ad hoc line at the same time',()=>{
 const controls=readFileSync(new URL('../src/InvoiceLineControls.jsx',import.meta.url),'utf8');
 assert.match(controls,/export function ItemSearch\(\{items,line,onSelect,onAdHoc,onType,index\}\)/,'the one item control takes both callbacks');
 assert.ok(controls.includes("const rows=[...matches.map(item=>({kind:'item',item})),...(onAdHoc&&typed?[{kind:'adHoc',text:typed}]:[])];"),'the master matches and the ad hoc offer are ONE option list, so the arrow keys and Enter walk both');
 assert.ok(controls.includes("if(row.kind==='adHoc')onAdHoc(row.text);else onSelect(row.item)"),'and choosing either row commits the right thing');
 assert.ok(controls.includes('const move=d=>setActive(a=>Math.max(0,Math.min(a+d,rows.length-1)));'),'with the active row clamped to the combined list, which an empty result set would otherwise run past');
 assert.ok(controls.includes('className="ivAdHocOption"'),'the ad hoc row is styled apart from the master rows');
 assert.ok(controls.includes('Search or type an item'),'and the placeholder says the one box does both');
 assert.match(readFileSync(new URL('../src/invoice-workspace.css',import.meta.url),'utf8'),/\.ivItemResults \.ivAdHocOption\{display:flex;align-items:center;gap:7px;color:#245fd9;font-weight:600\}/,'in the primary colour, so it reads as the action rather than a product');
 assert.ok(!readFileSync(new URL('../src/sales-orders.css',import.meta.url),'utf8').includes('soAdHocName'),'and the old ad hoc name field is deleted from the stylesheet with it');
});

test('the customer type reads the same on the create page as in the customer master',()=>{
 const customers=readFileSync(new URL('../src/Customers.jsx',import.meta.url),'utf8');
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.ok(customers.includes("export const customerTypeOf=row=>row?.type==='Individual'?'Individual':'Business';"),'ONE exported rule decides the customer type');
 assert.ok(customers.includes('const type=customerTypeOf(row);'),'which the customer form normaliser already used, so the two cannot disagree');
 assert.ok(fields.includes("import {customerStates,customerTypeOf} from './Customers.jsx';"),'and the create page reads it from the master module rather than keeping a second default');
 assert.ok(fields.includes('<span className="soCustomerType">{customerTypeOf(selectedCustomer)}</span>'),'so the type chip always shows, including for a stored customer that predates the field');
});

test('the item code the master holds is carried onto the line and printed',()=>{
 const fields=readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 const preview=readFileSync(new URL('../src/DocumentPreview.jsx',import.meta.url),'utf8');
 const previewCss=readFileSync(new URL('../src/document-preview.css',import.meta.url),'utf8');
 assert.ok(fields.includes("hsnSac:item.hsnSac||''"),'choosing an item copies the HSN/SAC code the Item master holds');
 assert.ok(fields.includes("itemType:item.type||'Goods'"),'with the item type, because goods print an HSN and a service prints an SAC');
 assert.ok(fields.includes("<small className=\"soHsnValue\">{(l.itemType==='Service'?'SAC':'HSN')+' '+l.hsnSac}</small>"),'and the create-page line states it under the box that chose it');
 assert.ok(fields.includes('{l.hsnSac?'),'only when the line has one, so an ad hoc line shows no empty code');
 assert.ok(preview.includes("{['#','Item','HSN / SAC','Qty / Unit','Rate','Discount','Tax','Amount'].map"),'the printed document carries an HSN / SAC column beside the item, which is what the order details, the invoice and a printout all read');
 assert.ok(preview.includes("<td>{l.hsnSac||'—'}</td>"),'printing an em dash rather than a blank cell when a line has none');
 assert.match(previewCss,/\.dpItemsTable th:nth-child\(7\)\{width:10%\}/,'and the eight column widths were restated, because those rules are positional and a new column shifts every one of them; the Tax column gave 2% back to HSN / SAC and Qty / Unit on 2026-09-26 so both two-word headers print on one line');
 assert.match(previewCss,/\.dpItemsTable th:nth-child\(n\+5\),\.dpItemsTable td:nth-child\(n\+5\)\{text-align:right/, 'with the alignment moved so the qty and its unit stay left-aligned and the money columns stay right-aligned');
});
