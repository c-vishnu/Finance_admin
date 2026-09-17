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
const styles=readFileSync('src/customers.css','utf8');

test('the register merges name and customer id into one column and drops the removed columns',()=>{
 assert.ok(screen.includes("['Customer Details','Type','Email / Phone','Net receivable','Available credit','Status','Actions'].map"),'the register header row is the new column set');
 assert.ok(screen.includes('itemIdentityCopy'),'the identity cell reuses the shared identity stack');
 assert.match(screen,/<b>\{x\.name\}<\/b><small>\{x\.code\|\|'No customer code'\}<\/small>/,'the cell shows the name over the customer id');
 for(const gone of ["'Contact'","'Opening balance'","'Credit limit'","'Customer name'","'Code'"])
  assert.ok(!screen.includes(gone),'the removed register column '+gone+' stays gone');
 assert.ok(screen.includes("placeholder=\"Search name, code, contact or email…\""),'search still covers code, contact and email');
});

test('each row offers View Customer plus the canonical three-dot menu',()=>{
 for(const label of ['View Customer','Edit Customer','Activate Customer','Deactivate Customer','Duplicate Customer','Delete Customer'])
  assert.ok(screen.includes(label),label);
 assert.match(screen,/className="customerView" onClick=\{\(\)=>openDetail\(x\)\}/,'View Customer opens the detail page');
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
 assert.equal((screen.match(/addEventListener\('pointerdown'/g)||[]).length,1,'exactly one pointerdown listener');
 assert.equal((screen.match(/addEventListener\('keydown'/g)||[]).length,1,'exactly one keydown listener');
 assert.ok(screen.includes("document.querySelectorAll('.customerKebab[open]').forEach(node=>{if(!node.contains(event.target))node.removeAttribute('open')})"),'outside pointerdown closes the open menu');
 assert.ok(screen.includes("if(event.key==='Escape')closeCustomerMenus()"),'Escape closes the open menu');
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
 for(const kept of ['Customer Name *','Customer Code *','Contact Person','Billing Address','Shipping Address','GSTIN','Credit Limit (₹)','Credit Days','Opening Balance (₹)','Receivable Account *','Copy billing to shipping address','Cancel'])
  assert.ok(screen.includes(kept),'the field or action '+kept+' survives');
 assert.ok(screen.includes("localStorage.setItem(CUSTOMERS_KEY,JSON.stringify(next))"),'the storage key is unchanged');
 assert.ok(screen.includes("const err={};if(!form.name.trim())err.name='Enter a customer name.';"),'the validation block is unchanged');
});
test('every visible customer string keeps the twelve pixel floor',()=>{
 const sizes=[...styles.matchAll(/font-size:([\d.]+)px/g)].map(match=>Number(match[1]));
 assert.ok(sizes.length>0,'the stylesheet declares font sizes');
 assert.ok(sizes.every(size=>size>=12),'no declaration drops below 12px: '+sizes.filter(size=>size<12).join(', '));
});