/* Customers register, row actions and the Customer Details page.

   The register is the shared row-action table pattern: one Customer Details column carrying the name over the
   customer code, the contact/opening-balance/credit-limit columns removed, and each row ending in one View Customer
   button beside a canonical three-dot menu (Edit Customer, Activate/Deactivate Customer, Duplicate Customer,
   Delete Customer). Customer Details is the full-width document screen beneath Working Context: a 56px back header,
   one panel holding the identity row and the Basic Data / Transactions / History tabs, then the selected card.
   The create/edit form still uses the shared .itemDialog classes that tests/item-create-page-ui.test.mjs pins. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync('src/Customers.jsx','utf8');
/* The place-of-supply picker was extracted into src/SearchSelect.jsx, so its own outside-click
   closer is asserted against that module now. */
const picker=readFileSync('src/SearchSelect.jsx','utf8');
const styles=readFileSync('src/customers.css','utf8');

test('the register merges name and customer id into one column and drops the removed columns',()=>{
 assert.ok(screen.includes("['Customer Details','Type','Email / Phone','Net receivable','Available credit','Status','Actions'].map"),'the register header row is the new column set');
 assert.ok(screen.includes('itemIdentityCopy'),'the identity cell reuses the shared identity stack');
 assert.match(screen,/<b>\{x\.name\}<\/b><small>\{x\.code\|\|'No customer code'\}<\/small>/,'the cell shows the name over the customer id');
 const headerRow=screen.slice(screen.indexOf("['Customer Details'"),screen.indexOf('].map(x=><th key={x}>{x}</th>)'));
 for(const gone of ["'Contact'","'Opening balance'","'Credit limit'","'Customer name'","'Code'"])
  assert.ok(!headerRow.includes(gone),'the removed register column '+gone+' stays gone');
assert.ok(screen.includes("placeholder=\"Search name, code, contact or email…\""),'search still covers code, contact and email');
});

test('each row offers View Customer plus the canonical three-dot menu',()=>{
 for(const label of ['Edit Customer','Activate Customer','Deactivate Customer','Duplicate Customer','Delete Customer'])
  assert.ok(screen.includes(label),label);
 assert.match(screen,/className="customerView" aria-label=\{"View "\+x\.name\} title="View customer" onClick=\{\(\)=>openDetail\(x\)\}><IconEye size=\{17\}\/><\/button>/,'the row action is one icon-only control that opens the detail page');
 assert.match(screen,/className="customerKebab"><summary aria-label=\{'More actions for '\+x\.name\}>/,'the row menu is a details disclosure named for its customer');
 assert.match(screen,/customerDanger" onClick=\{\(\)=>deleteCustomer\(x\)\}/,'delete is the destructive entry');
 assert.ok(screen.includes("<td className=\"customerActionsCell\">"),'the actions cell is the right-aligned last column');
 assert.doesNotMatch(screen,/className="itemEdit"/,'the old Edit/Statement buttons are gone');
 assert.ok(styles.includes('.customerActionsCell{white-space:nowrap;text-align:right}'),'the actions column is right aligned');
 assert.ok(styles.includes('.customerRowActions{display:flex;align-items:center;justify-content:flex-end;gap:8px}'),'the row actions right align');
 assert.ok(styles.includes('.customerKebab>summary{display:grid;place-items:center;width:32px;height:32px;border:1px solid #d9e1ec;border-radius:7px'),'the trigger keeps the canonical 32px geometry');
 assert.ok(styles.includes('.customerKebab[open]>summary{border-color:#3478f6;color:#245fd9}'),'the open trigger state');
 assert.ok(styles.includes('.customerMoreMenu{position:absolute;right:0;top:calc(100% + 6px);z-index:80;'),'the menu geometry');
 assert.ok(styles.includes('min-width:196px;padding:6px;border:1px solid #e1e6ed;border-radius:9px'),'the menu box geometry');
 assert.ok(styles.includes('.customerMoreMenu button{display:flex;align-items:center;gap:9px;min-height:36px;'),'the menu row geometry');
 assert.ok(styles.includes('.customerMoreMenu button.customerDanger{color:#b42318}'),'the destructive row is red');
});

test('one page-level dismissal effect owns every menu on the page',()=>{
 assert.equal((screen.match(/document\.addEventListener\('pointerdown',onPointerDown\)/g)||[]).length,1,'exactly one page-level pointerdown listener owns the kebab menus');
 assert.equal((screen.match(/document\.addEventListener\('keydown',onEscape\)/g)||[]).length,1,'exactly one keydown listener');
 assert.equal((picker.match(/document\.addEventListener\('pointerdown',away\)/g)||[]).length,1,'the place-of-supply picker owns its own outside-click closer');
 assert.ok(screen.includes("document.querySelectorAll('.customerKebab[open],.customerFilters[open]').forEach(node=>{if(!node.contains(event.target))node.removeAttribute('open')})"),'outside pointerdown closes the open menu and the Filters disclosure');
 assert.ok(screen.includes("if(event.key==='Escape'){closeCustomerMenus();closeCustomerFilters()}"),'Escape closes the open menu and the Filters disclosure');
 assert.ok(screen.includes('const closeCustomerMenus='),'one shared closer is used by the row and detail menus');
});
test('the row menu changes status, duplicates and guards delete',()=>{
 assert.match(screen,/const toggleStatus=customer=>/,'status changes through one handler');
 assert.match(screen,/status:deactivating\?'Inactive':'Active'/,'the toggle writes the opposite status');
 assert.match(screen,/audit\(deactivating\?'Customer deactivated':'Customer activated'\)/,'the toggle records history');
 assert.match(screen,/const duplicateCustomer=customer=>/,'duplicate exists');
 assert.match(screen,/name:customer\.name\+' Copy'/,'the copy is named as a copy');
 assert.match(screen,/code:nextCustomerCode\(rows\)/,'the copy takes the next free customer code');
 assert.match(screen,/export const nextCustomerCode=rows=>/,'the code generator is a pure exported helper');
 assert.match(screen,/const referenceCount=id=>\[live\.invoices,live\.payments,live\.receipts,live\.creditNotes,readSalesOrders\(\)\]/,'references are counted across the shared records');
 assert.match(screen,/if\(referenceCount\(customer\.id\)\)\{notify\(customer\.name\+' has transactions\. Mark the customer inactive instead\.'\);return\}/,'a customer with transactions is never deleted');
 assert.match(screen,/window\.confirm\('Delete '\+customer\.name\+'\? This cannot be undone\.'\)/,'delete still asks for confirmation');
});

test('customer details is the full-width document screen with three tabs',()=>{
 assert.match(screen,/<section className="itemsPage customersPage customerDetailPage">/,'the detail page is an in-dashboard page');
 assert.match(screen,/<div className="customerDetailHead"><button type="button" className="customerBack" aria-label="Back to Customers"/,'a 40px back button leads the head');
 assert.match(screen,/<h1>Customer Details<\/h1><\/div>/,'the head carries the page title');
 assert.match(screen,/<section className="customerDetailPanel">/,'one panel owns the card edge');
 assert.match(screen,/<div className="customerDetailIdentity">/,'the identity row is inside that panel');
 assert.match(screen,/const DETAIL_TABS=\['Basic Data','Transactions','History'\]/,'the three tabs');
 assert.match(screen,/DETAIL_TABS\.map\(tab=>/,'the tab row renders from that list');
 assert.match(screen,/aria-current=\{detailTab===tab\?'page':undefined\}/,'the selected tab is announced');
 assert.match(screen,/customerDetailEdit" onClick=\{\(\)=>start\(selected\)\}/,'Edit Customer sits on the identity row');
 assert.match(screen,/className="customerKebab customerDetailMore"><summary aria-label="More customer actions">/,'the detail menu is the same kebab');
 assert.match(screen,/\{tab==='Transactions'&&<span>\{entries\.length\}<\/span>\}/,'the Transactions tab carries its count');
 assert.match(screen,/\{tab==='History'&&<span>\{history\.length\}<\/span>\}/,'the History tab carries its count');
 assert.ok(styles.includes('.app main:has(>.itemsPage.customerDetailPage){max-width:none!important;padding:0!important}'),'the head is full bleed');
 assert.ok(styles.includes('.customerDetailPage .customerDetailHead{display:grid;grid-template-columns:40px minmax(0,1fr);align-items:center;gap:14px;width:100%;min-height:56px;padding:8px 24px'),'the head bar geometry');
 assert.ok(styles.includes('.customerDetailPage .customerDetailIdentity{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:16px;padding:14px 16px}'),'the identity grid');
 assert.ok(styles.includes('.customerDetailPage .customerDetailPanel{background:#fff;border:1px solid #e6ebf2;border-radius:10px}'),'the panel card');
 assert.doesNotMatch(styles,/\.customerDetailPage \.customerDetailPanel\{[^}]*overflow:hidden/,'the panel must not clip the detail menu');
 assert.ok(styles.includes('.customerDetailTabs button{display:flex;flex:0 0 auto;width:auto;min-width:0;'),'width:auto is required because src/styles.css declares nav button{width:100%}');
 assert.ok(styles.includes('.customerDetailTabs button{flex:1 1 0;padding:0 8px;gap:5px;font-size:12px}'),'the narrow-viewport tab fallback');
});

test('customer details shows all basic data, the transactions ledger and the audit history',()=>{
 for(const label of ['Customer code','Customer type','Status','Contact person','Billing address','Shipping address','State / place of supply','PAN','GSTIN','Credit limit','Credit days','Opening balance','Receivable account','Net receivable','Available credit'])
  assert.ok(screen.includes(label),'the basic data keeps '+label);
 assert.match(screen,/const credit=customerCreditSummary\(live,selected\.id\),entries=customerStatement\(live,selected\.id\),history=\[\.\.\.trail\(selected\)\]\.reverse\(\);/,'the detail reads the shared credit summary and statement');
 assert.match(screen,/<th>Date<\/th><th>Reference<\/th><th>Source<\/th><th>Debit<\/th><th>Credit<\/th><th>Balance<\/th>/,'the transactions table');
 assert.ok(screen.includes('No transactions reference this customer yet.'),'the transactions empty state');
 assert.ok(screen.includes('No customer history has been recorded yet.'),'the history empty state');
 assert.match(screen,/className="customerStatementLink" onClick=\{\(\)=>openStatement\(selected\)\}/,'the full statement stays one click away');
 assert.match(screen,/sessionStorage\.setItem\('wayvida-credit-customer',customer\.id\);onNavigate\('Customer Statement'\)/,'the statement handoff is unchanged');
 assert.match(screen,/auditTrail:\[\.\.\.trail\(form\),audit\(form\.id\?'Customer updated':'Customer created'\)\]/,'save appends one history entry');
 assert.match(screen,/auditTrail:\[audit\('Customer duplicated','Created from '\+customer\.name\)\]/,'duplicate seeds its history entry');
 assert.ok(styles.includes('.customerDetailFacts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:0;padding:16px;gap:16px 22px}'),'the facts grid');
 assert.ok(styles.includes('@media(max-width:800px){.customerDetailFacts{grid-template-columns:repeat(2,minmax(0,1fr))}}'),'the facts grid folds to two columns');
});

test('create and edit customer is a full page, not a modal popup',()=>{
 assert.match(screen,/\{form&&<form className="itemCreatePage" aria-labelledby="customerDialogTitle" onSubmit=\{save\} noValidate>/,'the form renders as the create page inside the register section');
 for(const gone of ['className="itemOverlay"','className="itemDialog"','aria-modal','role="dialog"'])
  assert.ok(!screen.includes(gone),'the modal shell '+gone+' is gone');
 assert.match(screen,/<button type="button" className="itemBack" aria-label="Back to Customers" onClick=\{\(\)=>setForm\(null\)\}>/,'one square back button leads the head');
 assert.match(screen,/<h2 id="customerDialogTitle">\{form\.id\?'Edit Customer':'Create Customer'\}<\/h2>/,'the title switches between Create Customer and Edit Customer');
 assert.match(screen,/\{form\.id&&<small className="itemHeadHint">Editing <b>\{form\.name\|\|form\.code\}<\/b><\/small>\}/,'an edit hint names the customer');
 assert.ok(screen.includes('className="itemDialogBody"'),'the body is the shared card');
 assert.ok(screen.includes('className="itemDialogFooter"'),'the footer is the shared action bar');
 assert.equal((screen.match(/className="itemSection"/g)||[]).length,3,'the three field groups are itemSection blocks');
 assert.equal((screen.match(/className="itemSectionTitle"/g)||[]).length,3,'each group carries a plain section title, never a header element');
 assert.ok(!/<header[ >]/.test(screen),'no bare header element is rendered, because src/styles.css paints one as the app bar');
 for(const kept of ['Customer code *','GST treatment *','Taxability','Place of supply *','Billing address','Shipping address same as billing','Currency','Payment terms','Credit limit (₹)','Receivable account *','Cancel'])
  assert.ok(screen.includes(kept),'the field or action '+kept+' survives');
 assert.ok(screen.includes("localStorage.setItem(CUSTOMERS_KEY,JSON.stringify(next))"),'the storage key is unchanged');
 assert.ok(screen.includes("if(!GST_TREATMENT_VALUES.includes(form.gstTreatment))err.gstTreatment='Select a GST treatment.';"),'the GST treatment is a required field');
 assert.ok(screen.includes("if(!form.code.trim())err.code='Enter a customer code.';"),'the customer code stays required and unique');
});
test('every visible customer string keeps the twelve pixel floor',()=>{
 const sizes=[...styles.matchAll(/font-size:([\d.]+)px/g)].map(match=>Number(match[1]));
 assert.ok(sizes.length>0,'the stylesheet declares font sizes');
assert.ok(sizes.every(size=>size>=12),'no declaration drops below 12px: '+sizes.filter(size=>size<12).join(', '));

test('the register toolbar drops the record count and adds one Filters disclosure',()=>{
 assert.ok(!screen.includes('{visible.length} customers'),'the removable toolbar count is gone');
 assert.match(screen,/<details className="customerFilters"><summary aria-label="Open filters"><IconFilter size=\{17\}\/>Filters\{activeFilterCount>0&&<em className="customerFilterBadge">\{activeFilterCount\}<\/em>\}<\/summary>/,'one Filters disclosure carries the active count');
 for(const label of ['Type','State / place of supply','GST treatment','Payment terms','Balance'])
  assert.ok(screen.includes('<span>'+label+'</span>'),'the panel filters by '+label);
 assert.match(screen,/const CUSTOMER_FILTER_DEFAULTS=\{type:'All types',state:'All states',gstTreatment:'All GST treatments',paymentTerms:'All payment terms',balance:'All balances'\}/,'one defaults object drives the panel and the badge');
 assert.match(screen,/const activeFilterCount=Object\.values\(filters\)\.filter\(value=>!value\.startsWith\('All '\)\)\.length/,'the badge counts the values that left their default');
 assert.match(screen,/const customerTypeOptions=\['All types',\.\.\.CUSTOMER_TYPES\]/,'Type offers the stored customer types');
 assert.match(screen,/const customerStateOptions=\['All states',\.\.\.Array\.from\(new Set\(rows\.map\(row=>row\.state\)\.filter\(Boolean\)\)\)\.sort/,'the state filter lists the places of supply the records actually carry');
 assert.match(screen,/const customerTreatmentOptions=\['All GST treatments',\.\.\.GST_TREATMENTS\.map\(item=>item\.value\)\]/,'GST treatment offers the stored treatments');
 assert.match(screen,/const customerTermOptions=\['All payment terms',\.\.\.PAYMENT_TERMS\]/,'payment terms offer the stored terms');
 assert.match(screen,/status==='All statuses'\|\|x\.status===status/,'the always-visible status select still filters');
 assert.match(screen,/filters\.type==='All types'\|\|\(x\.type\|\|'Business'\)===filters\.type/,'Type filters on the stored type with the Business default');
 assert.match(screen,/filters\.state==='All states'\|\|x\.state===filters\.state/,'State filters on the stored place of supply');
 assert.match(screen,/filters\.gstTreatment==='All GST treatments'\|\|x\.gstTreatment===filters\.gstTreatment/,'GST treatment filters on the stored treatment');
 assert.match(screen,/filters\.paymentTerms==='All payment terms'\|\|x\.paymentTerms===filters\.paymentTerms/,'payment terms filter on the stored term');
 assert.match(screen,/filters\.balance==='All balances'\|\|\(filters\.balance==='With outstanding'\?x\.credit\.outstanding>0:x\.credit\.outstanding<=0\)/,'Balance filters on the credit summary the map computes before it');
 assert.match(screen,/>Clear filters<\/button>/,'one clear action resets the panel');
 assert.match(screen,/onClick=\{\(\)=>\{setFilters\(CUSTOMER_FILTER_DEFAULTS\);setStatus\("All statuses"\)\}\}/,'and it resets the status select too');
 assert.ok(screen.includes('const BALANCE_FILTERS='),'the balance choices are one list');
 assert.ok(styles.includes('.customersPage .itemsTools .customerFilterField{display:flex;flex-direction:column;align-items:stretch;gap:5px;width:auto;max-width:none;min-width:0;padding:0;border:0;color:#344054}'),'the panel fields reset the shared .itemsTools label box so the two-column grid survives');
 assert.ok(styles.includes('.customersPage .customerFilterPanel{position:absolute;right:0;top:calc(100% + 6px);z-index:60;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));'),'the panel is anchored to its trigger');
 assert.ok(styles.includes('.customersPage .customerFilterActions button:hover{background:#eef4ff;border-color:#bcd0f5;color:#2463d4}'),'and its action uses the shared control tokens');
 assert.ok(styles.includes('@media(max-width:760px){'),'the narrow layout is declared');
 assert.ok(styles.includes('.customersPage .customerFilterPanel{position:static;grid-template-columns:minmax(0,1fr);width:100%;max-width:none;max-height:none;margin-top:10px}'),'where the panel takes the flow instead of running off the left of the viewport');
});

test('the Filters disclosure shares the one page-level dismissal effect',()=>{
 assert.ok(screen.includes("const closeCustomerFilters=()=>document.querySelectorAll('.customerFilters[open]').forEach(node=>node.removeAttribute('open'));"),'one shared closer for the filters');
 assert.equal((screen.match(/document\.addEventListener\('pointerdown',onPointerDown\)/g)||[]).length,1,'still exactly one page-level pointerdown listener');
 assert.equal((screen.match(/document\.addEventListener\('keydown',onEscape\)/g)||[]).length,1,'and exactly one keydown listener');
});
});
