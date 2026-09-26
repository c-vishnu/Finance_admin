import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const workspace=fs.readFileSync(new URL('../src/InvoiceWorkspace.jsx',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../src/invoice-detail.css',import.meta.url),'utf8'),workspaceCss=fs.readFileSync(new URL('../src/invoice-workspace.css',import.meta.url),'utf8');

test('the invoice draft survives the detour to the customer master and comes back refreshed',()=>{
  assert.ok(workspace.includes("const DRAFT_KEY='wayvida-draft-invoice';"),'the invoice keeps one draft key');
  assert.ok(workspace.includes("function editCustomer(id){try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify(form));sessionStorage.setItem('wayvida-edit-customer',id);sessionStorage.setItem('wayvida-return-to','Invoices')}catch{}onNavigate('Customers')}"),'the detour stashes the draft and the return marker before it leaves');
  assert.ok(workspace.includes("const customer=read('wayvida-customers',customerSeeds).find(c=>c.id===draft.customerId);"),'the restore reads the customer list from storage: a useState initializer runs before the customers const declared below it is initialised');
  assert.ok(!workspace.includes('const customer=customers.find(c=>c.id===draft.customerId);'),'reading that later binding threw a temporal-dead-zone error into the surrounding catch, which silently dropped the draft and left the operator on the register');
  assert.ok(workspace.includes('return customer?applyCustomerSnapshot(draft,customer):draft'),'the restored draft is refreshed from the customer master through the same read chooseCustomer uses');
  assert.ok(workspace.includes("sessionStorage.removeItem('wayvida-return-to');"),'and the return marker is consumed once, so a later visit to the register does not reopen the form');
});

test('the New sales invoice page is the Create Sales Order page, not a second design',()=>{
 const salesOrders=fs.readFileSync(new URL('../src/SalesOrders.jsx',import.meta.url),'utf8'),invoiceCss=fs.readFileSync(new URL('../src/invoice-workspace.css',import.meta.url),'utf8'),salesOrderCss=fs.readFileSync(new URL('../src/sales-orders.css',import.meta.url),'utf8');
 assert.match(workspace,/const createOpen=!!form;/,'the create marker is derived from the open form');
 assert.match(workspace,/return <section className=\{"invoiceWorkspace"\+\(detailOpen\?" ivDetailOpen":""\)\+\(createOpen\?" soCreatePage ivCreatePage":""\)\}>/,'and the create page carries the same shell class the order page uses, so every shared shell rule applies by construction');
 assert.match(workspace,/<div className="soCreateHead"><div className="soHeadIdentity"><button type="button" className="soBack" aria-label="Back to invoices" onClick=\{\(\)=>setForm\(null\)\}><IconArrowLeft size=\{19\}\/><\/button><div className="soHeadText"><h2 id="ivCreateTitle">\{form\.id\?'Edit invoice':'New sales invoice'\}<\/h2>\{form\.id&&<small className="soHeadHint">Editing \{form\.number\}<\/small>\}<\/div><\/div><NumberFormatControl\/><\/div>/,'the head is the same arrow-led full-bleed bar, with an edit-only hint and the Number and Currency Format control at its right end');
 assert.ok(!workspace.includes('className="ivHeading"')||!workspace.includes('<button className="ivLink" onClick={()=>setForm(null)}><IconArrowLeft size={16}/> Invoices</button>'),'the old inline back link and its heading block are gone from the create page');
 assert.match(workspace,/<form className="ivCreateForm" onSubmit=/,'the form is its own element, as the order form is');
 assert.match(workspace,/<SalesDocumentFields kind="invoice" onEditCustomer=\{editCustomer\} onCreateItem=\{createItem\} autoNumber=\{nextInvoiceNumber\(db\.invoices\)\} form=\{form\} setForm=\{setForm\} customers=\{customers\} items=\{items\} config=\{db\.config\} organisations=\{organisations\} onCreateCustomer=\{createCustomer\} creditOutstanding=\{form\.customerId\?customerCreditSummary\(db,form\.customerId\)\.outstanding:0\}>/,'the fields come from the shared component, told it is an invoice, with the same scope universe the order page offers and the detour to the customer master');

 assert.match(workspace,/<section className="soMoreGroup"><div className="ivFields soFieldRow soFieldRow1">/,'the terms travel into the summary card as a child, the same way the order page carries them');
 assert.ok(!workspace.includes('soMoreCard'),'and with no Additional details card left to hold them');
 assert.match(workspace,/<div className="soBarActions"><button type="button" onClick=\{\(\)=>setForm\(null\)\}>Cancel<\/button><button type="submit" className=\{invoiceAllowed\(role,'submit'\)\?'':'primary'\}>Save draft<\/button>\{invoiceAllowed\(role,'submit'\)&&<button type="button" className="primary" onClick=\{\(\)=>saveInvoice\('Pending Approval'\)\}>Submit for approval<\/button>\}<\/div><\/div><\/form><\/>:/,'the footer carries the three invoice verbs: cancel, save draft, and submit for approval as the primary action');
 assert.match(workspace,/className="ivFooter soActionBar">\{preview&&<dl className="soBarTotals"><div><dt>Total amount<\/dt>/,'and it pins the running total, so the figure is in view while the lines are entered');

 assert.match(workspace,/function create\(demo=false\)\{setError\(''\);\/\* The scope is seeded from the working context exactly as the sales order seeds it/,'a new invoice is seeded with the working-context organisation and branch, the way the order is');
 assert.match(workspace,/const \{company,branch\}=getCurrentOrganizationContext\(\);setForm\(\{number:'',date:today\(\),organizationId:company\?\.id\|\|'',organizationName:company\?\.name\|\|'',branchId:branch\?\.id\|\|'',branchName:branch\?\.name\|\|'',/,'and both are written onto the draft it opens');
 assert.match(invoiceCss,/\.app main>\.invoiceWorkspace\.ivCreatePage\{width:100%;max-width:none;margin:0;padding:0 0 28px\}/,'the workspace container gives up the 1600px box so the head bar reaches the top');
 assert.match(invoiceCss,/body:has\(\.ivCreatePage\) \.app main\{max-width:none!important;padding:0!important\}/,'and the shell padding is released the way the order page releases it');
 assert.match(invoiceCss,/\.ivCreatePage\{background:#f6f8fb;min-height:100%\}/,'the page sits on the same tinted ground');
 assert.match(invoiceCss,/\.ivCreatePage \.ivCreateForm\{width:auto;max-width:none;margin-top:12px;margin-bottom:0;padding:0;border:0;background:transparent;box-shadow:none\}/,'the form fills the remaining width instead of adding its own card box');
 assert.ok(!/\.ivCreatePage \.ivCreateForm\{[^}]*margin:0\b/.test(invoiceCss),'and it must not set a margin shorthand: that resets the side margins and beats the shared .soCreatePage>:not(.soCreateHead) gutter, which left the whole invoice page flush against the sidebar');

 assert.ok(!salesOrderCss.includes('soPlaceField'),'the invoice-only place-of-supply class its old grid needed is deleted, not left dead');
 assert.match(workspace,/const organisations=getScopeOrganisations\(\);/,'the scope list is the one the header drawer offers');
});

test('the Customer card and the document details card are one shared pair of cards',()=>{
 const fields=fs.readFileSync(new URL('../src/SalesDocumentFields.jsx',import.meta.url),'utf8');
 assert.match(fields,/<div className="ivCard soFormSection"><div className="soSectionHead"><h3>Customer \*<\/h3><\/div>/,'the customer card is the shared one, and carries the one pencil that changes its addresses');

 assert.match(fields,/<div className="ivCard soFormSection"><div className="soSectionHead"><h3>\{kind==='order'\?'Order details':'Invoice details'\}<\/h3>/,'and so is the details card, named for the document');
 assert.ok(fields.includes('<small className="soDueHint">Due {shortDate(form.dueDate)}</small>'),'the invoice states the same derived due date under the same payment terms');
 for(const shared of ['Organisation *','Branch *','Place of supply *','Payment terms'])
  assert.ok(fields.includes(shared),'the invoice carries the '+shared+' field the order carries');
 assert.match(fields,/<Field label=\{docTitle\+' ID'\} icon=\{IconHash\}><input placeholder=\{autoNumber\|\|'Automatic'\}/,'the number field is the same control, labelled for the document, carrying its own mark and stating the number the save will take');

 assert.match(fields,/\{field\('date',docTitle\+' date \*','date',IconCalendar\)\}/,'and so is the date, with its calendar mark');
 assert.match(fields,/<div className="soField soFieldSearch"><CustomerSearch customers=\{customers\}/,'the customer is typed into directly, never a native select, and the card heading is the only label it needs');
 assert.match(fields,/<dt>GST treatment<\/dt>|<dt>GSTIN<\/dt>/,'with the same read-only tax facts beside it');
 assert.match(fields,/\{addressEdit&&<div className="soAddressLayer"/,'and the same address editor');
});


test('the Sales invoices register search carries its own magnifier',()=>{

 assert.match(workspace,/import \{[^}]*\bIconSearch\b[^}]*\} from '@tabler\/icons-react';/,'IconSearch is imported');
 assert.match(workspace,/<div className="ivTools"><label className="ivToolSearch"><IconSearch size=\{17\}\/><input aria-label="Search invoices" placeholder="Search invoice or customer"/,'the register search is one labelled field holding the icon and the input');
 assert.match(workspaceCss,/\.ivTools \.ivToolSearch\{display:flex;flex-direction:row;align-items:center;gap:8px;flex:0 1 280px;min-width:200px;max-width:280px;min-height:38px;padding:0 10px;border:1px solid #dce3ee;border-radius:6px;background:#fff;color:#8fa0b7\}/,'the wrapper is the field, on the register control tokens');
 assert.match(workspaceCss,/\.ivTools \.ivToolSearch:focus-within\{border-color:#9fbdf0;box-shadow:0 0 0 3px #eaf1ff;color:#3478f6\}/,'focus moves the ring and the glyph colour to the wrapper');
 assert.match(workspaceCss,/\.invoiceWorkspace \.ivTools \.ivToolSearch input\{width:100%;min-width:0;padding:0;border:0;border-radius:0;background:transparent;color:#25334d\}/,'and the nested input gives up the shared input border and padding');
 assert.match(workspaceCss,/\.invoiceWorkspace \.ivTools \.ivToolSearch input:focus\{outline:none\}/,'so only one ring is ever drawn');
 assert.match(workspaceCss,/@media\(max-width:540px\)\{\n \.ivTools \.ivToolSearch\{flex:1 1 100%;min-width:0;max-width:none\}\n\}/,'the narrow viewport lets the field take the row');
});

test('the overview is the invoice read top to bottom, with no side panel',()=>{
 for(const label of ['<h2>Customer</h2>','<h2>More details</h2>','<h2>Items</h2>','<h3>Invoice summary</h3>'])assert.ok(workspace.includes(label),'the overview states '+label);
 assert.match(workspace,/tab==='Payments'\?<div className="ivOverviewPage"><section className="ivOverviewPanel"><div className="ivSectionTitle"><h3>Payments<\/h3>/,'and Payments is its own tab');
 assert.ok(!workspace.includes('<p>Billed party, tax identity and both addresses</p>'),'the customer panel carries no descriptive subtitle');
 assert.doesNotMatch(css,/position:\s*fixed/,'nothing on the overview is pinned to the viewport');
});

test('invoice details provide four tabs and journal ledger navigation',()=>{
 assert.match(workspace,/\[\['Overview','Overview'\],\['Payments','Payments'\],\['Accounting','Accounting'\],\['Activity','Activity'\]\]/,'the tabs are exactly the four the page is asked for, with Payments between Overview and Accounting');
 assert.match(workspace,/View Journal Entries/,'the accounting tab reaches the journal');
 assert.match(workspace,/View General Ledger/,'and the ledger');
});

test('the detail page is one card: head, identity, figures, tabs and the tab body together',()=>{
 assert.match(workspace,/<div className="ivDetailHead"><button type="button" className="ivDetailBack" aria-label="Back to invoices"/,'the page opens with the arrow-led head the other detail pages use');
 assert.match(workspace,/<h2>Invoice details<\/h2><small>\{invoice\.number\} · \{invoice\.customerName\}<\/small>/,'whose title is Invoice details and whose hint names the document');
 assert.ok(!workspace.includes('ivEyebrow'),'the blue SALES INVOICE eyebrow is gone');
 assert.ok(!workspace.includes('ivDetailTop'),'and so is the breadcrumb strip it replaces');
 assert.match(workspace,/<section className="ivDetailSheet">/,'everything that identifies the document sits in one card');
 for(const part of ['ivDetailIdentityRow','ivDetailStats','ivDetailTabs','ivDetailTabBody'])assert.ok(workspace.includes(part),'the card carries '+part);
 assert.match(css,/\.ivDetailSheet\{background:#fff;border:1px solid #e3e9f2;border-radius:10px;[^}]*overflow:visible\}/,'and never clips the More actions menu');
 assert.match(css,/\.invoiceWorkspace\.ivDetailOpen \.ivDetailHead\{display:grid;grid-template-columns:40px minmax\(0,1fr\);align-items:center;gap:14px;width:100%;min-height:56px;padding:8px 24px;border-top:1px solid #dfe6ef;border-bottom:1px solid #dfe6ef;background:#fff\}/,'the head is the full-bleed bar under the working-context strip');
 assert.match(css,/body:has\(\.ivDetailOpen\) \.app>main\{height:auto;max-height:none;overflow:visible;scrollbar-gutter:auto;max-width:none!important;padding:0!important\}/,'which needs the shell released the way the create pages do');
 assert.match(workspace,/const detailOpen=page==='Invoices'&&!!invoice;/,'the marker class is set only while a detail is open');
});

test('the four figures and the tabs live inside that card',()=>{
 assert.match(workspace,/<div className="ivDetailStats"><span><small>Order number and status<\/small>/,'the figures are one row, leading with the linked order rather than repeating the status already in the header');
 for(const label of ['Order number and status','Payment status','Invoice total','Outstanding balance'])assert.ok(workspace.includes(label),'including '+label);
 assert.match(css,/\.ivDetailStats\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\);border-bottom:1px solid #eef1f6\}/,'laid out as four columns inside the card');
 assert.match(css,/\.ivDetailStats>span\{[^}]*align-items:flex-start/,'and a pill keeps its own size instead of stretching across its tile');
});

test('an invoice records the scope it was raised in, and the overview states it',()=>{
 assert.match(workspace,/const \{company,branch\}=getCurrentOrganizationContext\(\);\s*const saved=run\('save',\{\.\.\.form,organizationId:form\.organizationId\|\|company\?\.id\|\|''/,'save stamps the order scope the way a sales order does, keeping any stored value');
 assert.match(workspace,/const organisation=organisations\.find\(row=>row\.id===invoice\.organizationId\|\|row\.code===invoice\.organizationId\)\|\|null;/,'resolving a name from the header list, because an invoice may hold an id or a code');
 assert.match(workspace,/\['Organisation',organisation\?\.name\|\|invoice\.organizationName\],\['Branch',branch\?\.name\|\|invoice\.branchName\]/,'and the overview states both inside More details');
});

test('the overview carries the sections the detail page is asked for',()=>{
 assert.match(workspace,/<th>Item<\/th><th>Qty<\/th><th>Rate<\/th><th>Tax<\/th><th>Amount<\/th>/,'the items table carries the five columns the page is asked for, including the line tax rate');
 assert.match(workspace,/<dt>Subtotal<\/dt>[^]{0,700}<dt>Discount<\/dt>[^]{0,700}<dt>GST<\/dt>[^]{0,700}<dt>Round off<\/dt>/,'the summary builds up from subtotal, discount, GST and round off');
 assert.match(workspace,/<dt>Total<\/dt><dd>\{money\(t\.total\)\}<\/dd><\/div><div><dt>Paid<\/dt><dd>\{money\(received\)\}<\/dd><\/div><div className="ivAmountBalance"><dt>Balance<\/dt>/,'and closes on Total, Paid and Balance');
 assert.match(workspace,/<span className="ivPaymentWhen">/,'each payment row states its date');
 assert.match(workspace,/<span className="ivPaymentHow">/,'its method, or the receipt it came from');
 assert.ok(!workspace.includes('ivOverviewMore'),'the disclosure wrapper is gone: More details is a section card beside the customer');
 for(const fact of ['Invoice date','Due date','Place of supply','Salesperson','Organisation','Branch','Notes'])assert.ok(workspace.includes("['"+fact+"'"),'More details carries '+fact);
 assert.ok(!workspace.includes("['Order number and status',order"),'the order is stated once, in the figures row, not repeated in More details');
 assert.ok(!workspace.includes('<h3>Organisation &amp; branch</h3>'),'the standalone organisation and branch panel is gone from the overview');
 assert.ok(!workspace.includes('<h3>Accounting summary</h3>'),'so is the accounting summary card, which the Accounting tab owns');
 assert.ok(!workspace.includes('<h3>Related documents</h3>'),'and the related documents card');
 assert.match(css,/\.ivOverviewPage\{display:flex;flex-direction:column;gap:14px;background:#f7f9fc;border-radius:0 0 10px 10px\}/,'and the page keeps one vertical rhythm around its sections');
 assert.match(css,/\.ivOverviewPage\{padding:16px\}/,'with one 16px gutter, the same the title strip and the fact grid use');
 assert.match(css,/\.ivAmountClose\{margin-top:8px;padding-top:10px;border-top:1px solid #e7ebf2\}/,'and the money block is split by a rule before Total');
});

test('the More actions menu carries print, share, duplicate and the guarded cancel',()=>{
 assert.match(workspace,/Preview &amp; print<\/button>/,'Preview and print moved into the menu');
 assert.match(workspace,/Send or share invoice<\/button>/,'so did Send or share');
 assert.match(workspace,/<button onClick=\{\(\)=>duplicateInvoice\(invoice\)\}>Duplicate<\/button>/,'Duplicate is offered');
 assert.match(workspace,/className="ivDangerAction" onClick=\{\(\)=>\{setCancel\(\{id:invoice\.id,reason:''\}\);setMoreActions\(false\)\}\}><IconBan size=\{17\}\/>Cancel invoice<\/button>/,'and Cancel is the destructive entry inside the menu, not a loose button in the header');
 assert.match(workspace,/function duplicateInvoice\(i\)\{const copy=structuredClone\(i\);delete copy\.id;delete copy\.number;delete copy\.revision;delete copy\.journalId;delete copy\.arAccount;delete copy\.postedAt;delete copy\.posted;delete copy\.status;delete copy\.sourceOrder;delete copy\.attachments;/,'a duplicate drops the identity, the posting and the links');
});

test('the tab row is the module left-aligned underline row, and the detail padding is tight',()=>{
 assert.match(workspace,/<nav className="itemDetailTabs ivDetailTabs" aria-label="Invoice detail sections">/,'the tab row is the Item Details row, shared by class');
 assert.match(css,/\.ivDetailSheet \.itemDetailTabs\{display:flex;align-items:center;flex:0 0 auto;gap:0;height:46px;padding:0 4px;border-top:1px solid #e6ebf2;background:transparent;overflow:auto\}/,'sized to match it exactly');
 assert.match(fs.readFileSync(new URL('../src/items.css',import.meta.url),'utf8'),/\.itemDetailTabs\{display:flex;align-items:center;flex:0 0 auto;gap:0;height:46px;padding:0 4px;border-top:1px solid #e6ebf2/,'which is the rule the Item Details page carries');
 assert.match(css,/\.ivDetailSheet \.itemDetailTabs button\{display:flex;flex:0 0 auto;width:auto;min-width:0;min-height:0;align-items:center;justify-content:center;gap:6px;height:100%;padding:0 12px;border:0;border-bottom:2px solid transparent/,'each label is sized to its own text with a 12px gutter, the shape the Item Details row uses');
 assert.ok(!css.includes('grid-template-columns:repeat(3,minmax(0,1fr));padding:0 22px'),'the equal-column tab row is gone');
 assert.match(css,/\.ivDetailIdentityRow\{[^}]*padding:14px 18px 12px/,'the identity row padding is reduced');
 assert.match(css,/\.ivDetailStats>span\{[^}]*padding:11px 18px/,'so is the figures row');
 assert.match(css,/\.ivOverviewPanel\{padding:14px 16px\}/,'the Payments tab keeps the same panel padding');
 assert.match(css,/\.ivInvoiceSummary \.ivSectionTitle\{padding-bottom:8px;margin-bottom:8px;border-bottom:0\}/,'and the summary heading stays plain above the figures');
 assert.ok(!css.includes('.ivOverviewCard .ivSectionTitle'),'the per-card section-title override is gone, so the titles are evenly spaced');
});

test('the invoice detail uses the shared status pill, never its own badge',()=>{
 assert.match(workspace,/import StatusPill from '\.\/StatusPill\.jsx';/,'the shared pill is imported');
 assert.match(workspace,/const INVOICE_TONES=\{Draft:'neutral','Pending Approval':'warn',Approved:'info',Sent:'info','Partially Paid':'warn',Paid:'ok',Overdue:'danger',Cancelled:'danger'\};/,'the lifecycle words map to the shared tones');
 assert.match(workspace,/const PAYMENT_TONES=\{Paid:'ok','Partially Paid':'warn',Unpaid:'neutral',Overdue:'danger','Not invoiced':'neutral','\\u2014':'neutral'\};/,'and so do the payment words, including the em dash a cancelled invoice returns');
 assert.match(workspace,/<div className="ivDetailNumber"><h3>\{invoice\.number\}<\/h3><StatusPill status=\{invoice\.status\} tone=\{INVOICE_TONES\[invoice\.status\]\|\|'neutral'\}\/><\/div>/,'the header badge is the shared pill');
 assert.match(workspace,/<span><small>Payment status<\/small><StatusPill status=\{paymentStatus\(db,invoice\)\} tone=\{PAYMENT_TONES\[paymentStatus\(db,invoice\)\]\|\|'neutral'\}\/><\/span>/,'and so does the payment figure, while the invoice status is stated once in the header');
 assert.ok(!workspace.includes('ivStatusText'),'the coloured status text is gone');
 assert.ok(!workspace.includes('ivStatus ivStatus-'),'and so is the bespoke badge');
});

test('the summary closes the item list on the right, and the customer is shown in full',()=>{
 assert.match(workspace,/<section className="ivInvoiceSummary"><div className="ivSectionTitle"><h3>Invoice summary<\/h3><\/div><dl className="ivAmountLines">/,'the summary is a block inside the items panel, after the table');
 assert.match(css,/\.ivInvoiceSummary\{width:min\(420px,100%\);margin:14px 0 0 auto;border-top:1px solid #eef1f6\}/,'right aligned to the panel margin under the items, the way the document reads');
 assert.match(css,/\.ivInvoiceSummary\{padding:10px 16px 2px\}/,'and on the same 16px gutter');
 assert.match(css,/\.ivOverviewPage \.itemDetailFacts>div\.ivFactWide\{grid-column:1\/-1\}/,'and the two addresses run the full width of the fact grid because an address wraps');
 assert.match(workspace,/const addressFacts=\[\['Billing address',billing\],\['Shipping address',sameAddress\?'Same as the billing address':shipping\]\];/,'built as their own facts');
 for(const fact of ['Customer','Customer id','Type','Contact person','Email','Phone','GSTIN','PAN','GST treatment','Place of supply'])assert.ok(workspace.includes("['"+fact+"'"),'the customer panel carries '+fact);
 assert.match(workspace,/<div className="ivOverviewGrid">\s*<section className="itemDetailCard"><div className="itemDetailSectionTitle"><IconUser size=\{18\}\/><h2>Customer<\/h2><\/div><dl className="itemDetailFacts">/,'the customer and More details sections sit side by side in the Item Details card language');
 assert.match(workspace,/<section className="itemDetailCard"><div className="itemDetailSectionTitle"><IconInfoCircle size=\{18\}\/><h2>More details<\/h2><\/div><dl className="itemDetailFacts">/,'with the same tinted title strip and fact grid the Item Details page uses');
 assert.match(css,/\.ivOverviewGrid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:14px\}/,'at half width each');
 assert.match(css,/\.ivOverviewGrid\{align-items:stretch\}/,'and stretched to one height, so the pair reads level');
 assert.match(css,/\.ivDetailSheet \.itemDetailSectionTitle h2\{margin:0;font-size:13\.5px;font-weight:650;color:#172033\}/,'the section titles are the Item Details size, because the host sheet .invoiceWorkspace h2 (23px) outranks the shared rule at equal specificity');
 assert.match(css,/\.ivOverviewPage \.itemDetailFacts\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:14px 20px\}/,'and two fact columns, because a half-width card cannot carry three');
 assert.match(workspace,/const addressFacts=\[\['Billing address',billing\],\['Shipping address',sameAddress\?'Same as the billing address':shipping\]\];/,'billing and shipping are both stated, and a matching pair says so instead of repeating');
 assert.match(workspace,/className=\{label\.endsWith\('address'\)\?'ivFactWide':undefined\}/,'both run the full width of the fact grid');
 assert.match(workspace,/const billing=invoice\.billing\|\|composeAddressText\(customer\?\.billingAddress\);/,'an address falls back to the structured halves the customer master keeps');
 assert.match(workspace,/function composeAddressText\(address\)\{/,'through one shared composer');
});

test('a plain click on Invoices shows the register, not the last invoice opened',()=>{
 assert.match(workspace,/\[selected,setSelected\]=useState\(\(\)=>\{/,'the selected invoice is resolved in an initialiser');
 assert.match(workspace,/if\(page!=='Invoices'\)return null;/,'which only honours a handoff on the Invoices page');
 assert.match(workspace,/const handoff=sessionStorage\.getItem\('wayvida-open-invoice'\);\s*\n?\s*if\(!handoff\)return null;\s*\n?\s*sessionStorage\.removeItem\('wayvida-open-invoice'\);\s*\n?\s*return handoff;/,'reads the handoff once and removes it, so the next visit shows the list');
});

test('the invoice tab row is the Item Details row, value for value',()=>{
 const items=fs.readFileSync(new URL('../src/items.css',import.meta.url),'utf8');
 const declarations=(css,selector)=>{const at=css.indexOf(selector);assert.notEqual(at,-1,'expected to find '+selector);const open=css.indexOf('{',at),close=css.indexOf('}',open);return Object.fromEntries(css.slice(open+1,close).split(';').map(part=>part.trim()).filter(Boolean).map(part=>{const colon=part.indexOf(':');return [part.slice(0,colon).trim(),part.slice(colon+1).trim()]}))};
 const row=declarations(items,'.itemDetailTabs{');
 const invoiceRow=declarations(css,'.ivDetailSheet .itemDetailTabs{');
 for(const [property,value] of Object.entries(row))
  if(property!=='overflow')assert.equal(invoiceRow[property],value,'the row agrees on '+property);
 assert.equal(invoiceRow.overflow,'auto','the one deliberate difference: four tabs must never be clipped by the hidden overflow the Item Details row can rely on');
 const button=declarations(items,'.itemDetailTabs button{');
 const invoiceButton=declarations(css,'.ivDetailSheet .itemDetailTabs button{');
 for(const [property,value] of Object.entries(button))
  assert.equal(invoiceButton[property],value,'the tab agrees on '+property);
 assert.equal(invoiceButton['min-height'],'0','and neutralises the host sheet button min-height, which Item Details never has to');
 for(const state of ['.itemDetailTabs button:hover{','.itemDetailTabs button.active{','.itemDetailTabs button:focus-visible{'])
  assert.ok(css.includes('.ivDetailSheet '+state),'the '+state.slice(1)+' state is carried over');
 assert.match(css,/\.ivDetailSheet \.itemDetailTabs button:hover\{background:#f5f8fd;color:#245fd9\}/,'the hover tint is the Item Details one');
 assert.match(css,/\.ivDetailSheet \.itemDetailTabs button\.active\{color:#245fd9;border-bottom-color:#3478f6\}/,'and so is the active underline');
 assert.match(css,/\.ivDetailSheet \.itemDetailTabs button span\{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#e7ecf4;color:#5c6b80;font-size:12px;font-weight:600\}/,'including the count pill the row uses');
 assert.match(css,/@media\(max-width:520px\)\{\.ivDetailSheet \.itemDetailTabs\{padding:0\}\.ivDetailSheet \.itemDetailTabs button\{flex:1 1 0;padding:0 8px;gap:5px;font-size:12px\}\}/,'and the narrow-viewport fallback');
});

test('the invoices register is eight columns that never scroll sideways',()=>{
 assert.match(workspace,/<table className="ivInvoiceTable"><thead><tr>\{\['Invoice','Customer','Status','Invoice amount','Payment status','Organisation','Branch','Actions'\]\.map\(/,'the register names eight columns: the invoice, its customer, the lifecycle status AHEAD of the amount, the payment status, organisation and branch apart, and the row actions - the Order ID has no column here');
 assert.match(workspace,/onClick=\{\(\)=>\{setSelected\(i\.id\);setTab\('Overview'\)\}\}>\{i\.number\}<\/button><small>\{i\.date\}<\/small>/,'the invoice number and its date share one cell, and the lifecycle status lives in its own column rather than beside the date');
 assert.match(workspace,/<td>\{i\.customerName\}<\/td><td><StatusPill status=\{invoiceDisplayStatus\(i\)\} tone=\{invoiceDisplayTone\(i\)\}\/><\/td><td>\{money\(i\.totals\.total\)\}/,'the lifecycle status sits between the customer and the amount, and it reads through invoiceDisplayStatus - Draft, Pending or Published, from the stored record and its posted flag');
 assert.ok(!workspace.includes("<td>{orderNumberOf(i)||'Not linked'}</td>"),'the Order ID has no cell in the register - it is read on the invoice detail page, and only its filter remains here');
 assert.match(workspace,/<StatusPill status=\{paymentStatus\(db,i\)\} tone=\{PAYMENT_TONES\[paymentStatus\(db,i\)\]\|\|'neutral'\}\/>/, 'payment status uses the shared pill every other register uses, with the same tones');
 assert.match(workspace,/<td>\{i\.organizationName\|\|'Not recorded'\}<\/td><td>\{i\.branchName\|\|'Not recorded'\}<\/td>/,'organisation and branch are columns of their own instead of one merged cell');
 assert.match(workspace,/<button className="ivIconButton" aria-label=\{'View '\+i\.number\} title=\{'View '\+i\.number\} onClick=\{\(\)=>\{setSelected\(i\.id\);setTab\('Overview'\)\}\}><IconEye size=\{17\}\/><\/button>/,'and the row View action is an eye icon, labelled for a screen reader');
 const css=fs.readFileSync(new URL('../src/invoice-workspace.css',import.meta.url),'utf8');
 assert.ok(css.includes('.invoiceWorkspace .ivInvoiceTable{table-layout:fixed;width:100%;min-width:0;white-space:nowrap}'),'the table takes the card width, which is what stops the sideways scroll the eight-column layout had');
 for(const [n,w] of [[1,'13%'],[2,'16%'],[3,'11%'],[4,'12%'],[5,'12%'],[6,'16%'],[7,'11%'],[8,'9%']])
 assert.ok(css.includes('.invoiceWorkspace .ivInvoiceTable th:nth-child('+n+'){width:'+w+'}'),'column '+n+' is '+w+' of the table, restated for eight');
 assert.ok(css.includes('.invoiceWorkspace .ivInvoiceTable td:nth-child(8),.invoiceWorkspace .ivInvoiceTable th:nth-child(8){text-align:right;overflow:visible}'),'with the actions column - now the last - still right-aligned and released from the cell clipping');
 assert.ok(css.includes('.invoiceWorkspace .ivInvoiceTable th,.invoiceWorkspace .ivInvoiceTable td{padding:12px 10px;overflow:hidden;text-overflow:ellipsis;vertical-align:top}'),'a long value ellipses inside its own cell instead of widening the grid');
 assert.ok(css.includes('.invoiceWorkspace .ivCard.ivRegisterCard{overflow:visible}'),'and the register card releases its overflow so the Filters panel is not clipped at the card edge');
});

/* The migrated register is one row: the page heading, its description, the search, the Filters
   disclosure and the split action share it, and the register card finishes the card it opens. */
test('the invoices register heading and toolbar are one merged row',()=>{
 assert.match(workspace,/<div className="ivHeading registerHead"><div className="registerHeadText"><h2>Sales invoices <span className="registerHeadCount">(\(\{db\.invoices\.length\}\))<\/span><\/h2><p>Create invoices once\. Accounting follows automatically\.<\/p><\/div><div className="ivTools">/,'the page title and its description lead the shared merged row, which holds the toolbar');
 assert.ok(workspace.indexOf('className="ivTools"')>workspace.indexOf('ivHeading registerHead'),'the register toolbar is merged into the heading row');
 assert.match(workspace,/<div className="ivCard ivRegisterCard"><div className="ivScroll">/,'and the register card completes the one card the row opens');
 assert.match(workspace,/className="ivActions"><div className="registerSplit"><button type="button" className="primary registerSplitMain" onClick=\{\(\)=>create\(\)\}><IconPlus size=\{17\}\/>Create invoice<\/button><details className="registerSplitMore">/,'the add action is the shared split button over the same create the page already had');
 assert.match(workspace,/<div><button type="button" onClick=\{menuRun\(\(\)=>setConfig\(\{\.\.\.db\.config\}\)\)\}><IconSettings size=\{16\}\/>Account mapping<\/button><\/div>/,'and its caret holds Account mapping alone: the demo-example and export entries were removed on request');
 assert.ok(!workspace.includes('exportRegister')&&!workspace.includes('IconDownload')&&!workspace.includes('wayvida-invoices.csv'),'the register export and everything it needed are deleted rather than left dead');
 assert.match(workspace,/const menuRun=handler=>event=>\{event\.currentTarget\.closest\('details'\)\?\.removeAttribute\('open'\);handler\(\)\};/,'the caret closes itself before it runs its entry');
 const shell=fs.readFileSync(new URL('../src/register-head.css',import.meta.url),'utf8');
 assert.ok(shell.includes('.registerHead.ivHeading .registerHeadText h2{margin:0;font-size:24px;font-weight:700;line-height:1.25;letter-spacing:-.4px;color:#172033}'),'the merged row carries the Journal Entries title size');
 assert.ok(shell.includes('.registerHead.ivHeading .registerHeadText p{margin:5px 0 0;color:#667085;font-size:12px}'),'and the Journal Entries description size');
 assert.ok(shell.includes(' .registerHead:has(.soFiltersMore[open]),.registerHead:has(.customerFilters[open]){position:static}'),'and gives up its pin while a filter panel opens in the flow at a narrow width');
 assert.ok(shell.includes('.registerHead .registerSplit>.registerSplitMore>summary{display:inline-grid;'),'the caret keeps the shared register split geometry');
});

test('the register carries a Filters disclosure with every invoice filter',()=>{
 assert.match(workspace,/<details className="soFiltersMore"><summary aria-label="Open filters"><IconFilter size=\{17\}\/>Filters\{activeInvoiceFilters>0&&<i>\{activeInvoiceFilters\}<\/i>\}<\/summary>/,'the toolbar carries the shared Filters disclosure with its count badge');
 assert.match(workspace,/import \{[^}]*\bIconFilter\b[^}]*\} from '@tabler\/icons-react';/,'and its icon is imported');
 for(const field of ['Status','Payment status','Customer','Organisation','Branch','Order ID','Invoice date from','Invoice date to','Amount from (₹)','Amount to (₹)'])
  assert.ok(workspace.includes('<label>'+field),field+' is one of the panel fields');
 for(const aria of ['Invoice status','Payment status','Customer','Organisation','Branch','Order ID','Invoice date from','Invoice date to','Amount from','Amount to'])
  assert.ok(workspace.includes('aria-label="'+aria+'"'),aria+' is labelled for assistive technology');
 assert.ok(workspace.includes("<button type=\"button\" className=\"soClearFilters\" onClick={()=>{clearInvoiceFilters();setFilter('')}}>Clear filters</button>"),'the panel closes with the shared Clear filters row, which also drops the status the panel now holds');
 assert.ok(workspace.includes("const INVOICE_FILTER_DEFAULTS={payment:'All payment statuses',customer:'All customers',organisation:'All organisations',branch:'All branches',order:'',from:'',to:'',amountFrom:'',amountTo:''};"),'every field starts on a default that the count is derived from');
 assert.ok(workspace.includes("const activeInvoiceFilters=Object.keys(INVOICE_FILTER_DEFAULTS).filter(key=>invFilters[key]!==INVOICE_FILTER_DEFAULTS[key]).length+(filter?1:0);"),'the badge counts the fields that differ from those defaults, plus the status once it is set');
});

test('every filter narrows the same list, in the units the engine stores',()=>{
 assert.match(workspace,/const amountMinor=value=>\{if\(value===''\|\|value===null\|\|value===undefined\)return null;const n=Number\(value\);return Number\.isFinite\(n\)&&n>0\?Math\.round\(n\*100\):null\};/,'an amount filter converts rupees to the paise the total is stored in');
 for(const rule of [
  "(i.number+' '+i.customerName).toLowerCase().includes(query.toLowerCase())",
  "(!filter||i.status===filter||(i.posted&&payment===filter))",
  "(invFilters.payment==='All payment statuses'||payment===invFilters.payment)",
  "(invFilters.customer==='All customers'||i.customerName===invFilters.customer)",
  "(invFilters.organisation==='All organisations'||i.organizationName===invFilters.organisation)",
  "(invFilters.branch==='All branches'||i.branchName===invFilters.branch)",
  "(!search||order.toLowerCase().includes(search))",
  "(!invFilters.from||i.date>=invFilters.from)",
  "(!invFilters.to||i.date<=invFilters.to)",
  "(amountFrom===null||i.totals.total>=amountFrom)",
  "(amountTo===null||i.totals.total<=amountTo)"
 ]) assert.ok(workspace.includes(rule),'the panel filters on '+rule.slice(0,40));
 assert.ok(workspace.includes('const visibleInvoices=db.invoices.filter(i=>{'),'one memo-free derivation feeds the table, so the rows and the badge cannot disagree');
 assert.ok(workspace.includes("{!visibleInvoices.length&&<div className=\"ivEmpty\"><IconFileInvoice/><h3>{db.invoices.length?'No invoices match these filters':'Your first invoice starts here'}</h3>"),'an empty result says whether the register is empty or the filters are too narrow');
 assert.ok(workspace.includes('<button className="primary" onClick={clearInvoiceFilters}>Clear filters</button>'),'and offers the way out of the filters');
 assert.ok(!/db\.invoices\.filter\(i=>\(i\.number/.test(workspace),'the old inline row filter is gone');
});

test('the register row actions are the sales order register controls, value for value',()=>{
 const css=fs.readFileSync(new URL('../src/invoice-workspace.css',import.meta.url),'utf8');
 const orders=fs.readFileSync(new URL('../src/sales-orders.css',import.meta.url),'utf8');
 const shared=fs.readFileSync(new URL('../src/sales-order-actions.css',import.meta.url),'utf8');
 assert.ok(shared.includes('.soMoreButton{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;background:white;color:#475467;border:1px solid #d0d5dd;border-radius:6px;margin-left:8px}'),'both registers share one trigger component');
 assert.ok(orders.includes('.salesOrdersPage .soMoreButton{margin-left:0;width:36px;height:36px;border-radius:7px}'),'which the sales order register sizes to its own row');
 assert.ok(css.includes('.invoiceWorkspace .ivRowActions button.soMoreButton{margin-left:0;width:36px;height:36px;min-width:36px;min-height:36px;padding:0;color:#475467}'),'and the invoices register sizes the same way');
 assert.ok(css.includes('.invoiceWorkspace .ivRowActions button{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:0 9px;border:1px solid #d0d5dd;border-radius:7px;background:#fff;color:#344054}'),'View is the sales order row button - 36px, 1px #d0d5dd, 7px radius, the same fill and text colour, and the same inherited weight');
 assert.ok(css.includes('.invoiceWorkspace .ivRowActions button:hover:not(:disabled){border-color:#98a2b3;background:#f9fafb}'),'with the same hover');
 assert.ok(css.includes('.invoiceWorkspace .ivRowActions button:focus-visible{outline:2px solid #84adff;outline-offset:2px}'),'and the same focus ring');
 assert.match(css,/page styles every bare button at class-plus-element specificity/,'and the rule records why it has to be restated here: the page button rule outranks a single class component rule');
});
