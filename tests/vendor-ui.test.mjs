/* Vendor register, editor and detail.

   The register and the detail screen keep the shared purchase shells they always had.
   The editor is now the shared create page every other master uses - form.itemCreatePage
   with one itemDialogHead, one itemDialogBody card and a footer.itemDialogFooter, exactly
   as src/Items.jsx and src/Customers.jsx render theirs - so the form reads as one screen
   instead of the old stack of ivCard sections: Vendor details merges the old Basic and
   Contact information, Billing address owns the shipping-address switch, and Tax & payment
   information merges the old Tax information and Payment information cards. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../src/Vendors.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/vendors.css',import.meta.url),'utf8');

const at=text=>{const index=page.indexOf(text);assert.notEqual(index,-1,'expected to find: '+text);return index};

test('vendor editor is the shared create page rather than a bespoke form',()=>{
  assert.match(page,/<section className="itemsPage vendorsPage">/,'the editor is the shared create page shell');
  assert.match(page,/<form className="itemCreatePage" aria-labelledby="itemDialogTitle" onSubmit=\{save\} noValidate>/,'with the shared create form element');
  assert.match(page,/<div className="itemDialogHead"><button type="button" className="itemBack" aria-label="Back to Vendors"/,'under the shared arrow-led head');
  assert.match(page,/<div className="itemDialogBody">/,'and one body card');
  assert.match(page,/<footer className="itemDialogFooter"><button type="button" onClick=\{\(\)=>setForm\(null\)\}>Cancel<\/button><button className="primary">\{form\.id\?'Save changes':'Create Vendor'\}<\/button><\/footer>/,'closing on the shared create-page footer');
  assert.ok(page.includes("import './items.css';"),'the create-page tokens are imported directly instead of inherited from Customers');
  assert.ok(!page.includes('soCreatePage')&&!page.includes('ivCreateForm')&&!page.includes('soActionBar'),'the old bespoke create shell is gone');
  assert.ok(!page.includes('ivFields'),'and so is the ivFields grid the old sections used');
  assert.ok(!page.includes('vendorOverlay')&&!page.includes('vendorDialog'),'the modal overlay and dialog markup are gone');
  assert.ok(!css.includes('.vendorOverlay')&&!css.includes('.vendorDialog'),'and so are their stylesheet rules');
});

test('basic and contact information are one Vendor details section',()=>{
  assert.equal((page.match(/className="itemSection"/g)||[]).length,3,'three visible blocks; the rest live in the disclosure');
  assert.ok(page.includes('<div className="itemSectionTitle">Vendor details</div>'),'the first block merges the two old cards');
  assert.ok(!page.includes('Basic information')&&!page.includes('Contact information'),'the old Basic and Contact information headings are gone');
  const details=page.slice(at('<div className="itemSectionTitle">Vendor details</div>'),at('<div className="itemSectionTitle">Billing address</div>'));
  for(const field of ["field('name','Vendor name *'","field('code','Vendor code'","field('displayName','Display name'","field('status','Status'","field('contactName','Contact person name'","field('phone','Phone number *'","field('email','Email address'","field('website','Website'"])
   assert.ok(details.includes(field),'Vendor details carries '+field);
});

test('Vendor type leads the form as the shared radio group',()=>{
  assert.ok(page.includes('<fieldset className="itemTypeField"><legend>Vendor type *</legend><div className="itemRadioGroup">'),'the type choice is the shared themed radio group');
  assert.ok(page.includes("<input type=\"radio\" name=\"vendor-type\" value={value} checked={form.type===value} onChange={()=>update('type',value)}/>"),'and it still writes the stored type value');
  assert.ok(at('<fieldset className="itemTypeField">')<at("<div className=\"itemFormGrid\">{field('name'"),'the name grid follows the type fieldset');
});

test('Billing address owns the shipping-address toggle',()=>{
  const billing=page.slice(at('<div className="itemSectionTitle">Billing address</div>'),at('<div className="itemSectionTitle">Tax &amp; payment information</div>'));
  assert.ok(billing.includes('<label className="itemCheck vendorSameAddress"><input type="checkbox" role="switch" checked={!!form.shippingSameAsBilling}'),'the switch is the shared create-page switch');
  assert.ok(billing.includes('<b>Shipping address same as billing</b>'),'labelled plainly');
  assert.ok(billing.includes('{!form.shippingSameAsBilling&&<div className="itemFormGrid">'),'the shipping fields only render once the switch is off');
  assert.ok(billing.includes("{addressField('billing','line1','Address line 1')}"),'the billing grid is always present');
  assert.ok(!page.includes('Copy billing address'),'the old copy button is replaced by the switch');
  assert.ok(page.includes("const toggleShippingSame=checked=>setForm(x=>checked?{...x,shippingSameAsBilling:true,shipping:{...x.billing}}:{...x,shippingSameAsBilling:false});"),'switching it on copies billing into shipping');
  assert.ok(page.includes("if(kind==='billing'&&x.shippingSameAsBilling)next.shipping={...address}"),'and a billing edit keeps shipping in step while it is on');
  assert.ok(page.includes('shipping:form.shippingSameAsBilling?{...form.billing}:form.shipping'),'a save stores the billing address as the shipping address when the switch is on');
  assert.ok(page.includes('setForm({...draft,shippingSameAsBilling:row?draft.shippingSameAsBilling!==false&&sameAddress(draft.billing,draft.shipping):true})'),'a new vendor opens with the switch on and an edit re-reads the stored pair');
});

test('tax and payment information share one section',()=>{
  assert.ok(page.includes('<div className="itemSectionTitle">Tax &amp; payment information</div>'),'the two cards are one block');
  assert.ok(!page.includes('<h3>Tax information</h3>')&&!page.includes('<h3>Payment information</h3>'),'the old Tax information and Payment information cards are gone');
  const merged=page.slice(at('<div className="itemSectionTitle">Tax &amp; payment information</div>'),at('<details className="itemAdvanced"'));
  for(const field of ["field('gstin','GSTIN'","field('gstTreatment','GST treatment'","field('pan','PAN number'","field('tdsSection','TDS section'","field('tdsRate','TDS rate (%)'","field('paymentTerms','Payment terms *'","field('paymentMode','Preferred payment mode'","field('creditLimit','Credit limit (₹)'","field('bankName','Bank name'","field('accountHolder','Account holder name'","field('accountNumber','Account number'","field('ifsc','IFSC code'","field('bankBranch','Bank branch'"])
   assert.ok(merged.includes(field),'the merged section carries '+field);
  assert.ok(merged.includes('<div className="itemAdvancedTitle vendorSubTitle">Payment &amp; bank details</div>'),'the payment half keeps its own sub-heading');
  assert.ok(at('<div className="itemAdvancedTitle vendorSubTitle">')>at("field('pan','PAN number'"),'which sits after the tax fields');
  assert.ok(merged.includes('<div className="vendorSwitchGrid">'),'GST registered and TDS applicable lead the block as switch rows');
  assert.ok(merged.includes('<b>GST registered</b>')&&merged.includes('<b>TDS applicable</b>'),'both switches keep their labels');
});

test('the accountant-only fields stay inside More details and open on a hidden error',()=>{
  const details=page.slice(at('<details className="itemAdvanced"'));
  for(const field of ["field('payableAccountId'","field('purchaseAccountId'","field('currency'","field('branch'","field('costCentre'","field('openingBalance'","field('openingType'","field('notes'","field('notes','Notes',{type:'textarea'"])
   assert.ok(details.includes(field),'More details carries '+field);
  assert.ok(details.includes('<div className="itemAdvancedTitle">Accounting</div>'),'the accounting group keeps its title');
  assert.ok(details.includes('<div className="itemAdvancedTitle">Opening balance</div>'),'the opening balance group keeps its title');
  assert.ok(page.includes('open={moreOpen} onToggle={e=>setMoreOpen(e.currentTarget.open)}'),'the disclosure is controlled so a failed save can open it');
  assert.ok(page.includes('if(Object.keys(err).some(key=>!TOP_LEVEL_ERRORS.has(key)))setMoreOpen(true);'),'a hidden required field opens More details instead of blocking invisibly');
  assert.ok(page.includes("const TOP_LEVEL_ERRORS=new Set(['name','phone','email','gstin','pan','tds','save']);"),'the visible errors are named once');
});

test('the searchable state select and the country list come from the shared tables',()=>{
  assert.ok(page.includes("import {COUNTRIES} from './customer-tax.js';"),'countries come from the shared tax module');
  assert.ok(page.includes("const stateOptions=[['','Select state'],...customerStates];"),'the state list stays the shared register list');
  assert.ok(page.includes("const countryOptions=[['','Select country'],...COUNTRIES];"),'and the country list is the shared one');
  assert.ok(page.includes("addressField('billing','state','State',stateOptions)")&&page.includes("addressField('billing','country','Country',countryOptions)"),'both address grids use them');
  assert.ok(page.includes("{addressField('billing','pin','PIN code')}"),'and the PIN code stays a bounded numeric field');
  assert.ok(page.includes("inputMode={key==='pin'?'numeric':undefined} maxLength={key==='pin'?6:undefined}"),'six digits, numeric keyboard');
});

test('attachments keep the stored name list and can be removed',()=>{
  assert.ok(page.includes('const attachDocuments=files=>update(\'attachments\',[...(form.attachments||[]),...Array.from(files).map(file=>file.name)]'),'uploads still store names, as the detail tab reads them');
  assert.ok(page.includes('<ul className="vendorDocuments">'),'and they are listed under the shared upload control');
  assert.ok(page.includes("onClick={()=>update('attachments',(form.attachments||[]).filter((entry,position)=>position!==index))}"),'each row can be removed');
  assert.ok(page.includes('<span className="itemImageChoose">Browse</span>'),'the upload control is the shared create-page one');
});

test('the create page styles add structure only',()=>{
  assert.ok(css.includes('.vendorsPage .itemCreatePage .itemFormGrid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 16px}'),'three fields per row, like Create Customer');
  assert.ok(css.includes('.vendorsPage .itemCreatePage .itemRadioGroup{grid-template-columns:repeat(3,minmax(0,1fr));max-width:none}'),'the six type choices read in three columns');
  assert.ok(css.includes('.vendorsPage .vendorSameAddress{gap:11px;margin:14px 0 0;padding:11px 12px;border:1px solid #e3e9f1;border-radius:8px;background:#fbfcfe}'),'the switch sits in a quiet card on the shared tokens');
  assert.ok(css.includes('.vendorsPage .vendorSwitchRow{justify-content:space-between;padding:11px 12px;border:1px solid #e1e7ef;border-radius:8px;background:#fbfcfe}'),'and so do the tax switches');
  assert.ok(css.includes('.vendorsPage .itemAdvancedGroup .itemNotice{align-items:flex-start;margin:12px 0 0;color:#667085;line-height:1.5}'),'a note inside More details aligns with the group title');
  assert.match(css,/@media\(max-width:1100px\)\{\s+\.vendorsPage \.itemCreatePage \.itemFormGrid,\.vendorsPage \.itemCreatePage \.itemRadioGroup\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/,'two columns below 1100px');
  assert.match(css,/@media\(max-width:700px\)\{\s+\.vendorsPage \.itemCreatePage \.itemFormGrid,\.vendorsPage \.vendorSwitchGrid,\.vendorsPage \.itemCreatePage \.itemRadioGroup\{grid-template-columns:minmax\(0,1fr\)\}/,'one column below 700px');
  assert.ok(!css.includes('.vendorUpload')&&!css.includes('.vendorToggleRow')&&!css.includes('.vendorControlNote'),'the superseded stylesheet rules are deleted');
});

test('vendor register and detail use the shared register and detail shells',()=>{
  assert.match(page,/<div className="ivHeading registerHead"><div className="registerHeadText"><h2>Vendors<\/h2>/,'the register opens on the shared merged heading');
  assert.ok(page.includes('<div className="ivHeading registerHead">')&&page.indexOf('className="ivTools"')>page.indexOf('ivHeading registerHead'),'the register toolbar is merged into the heading row');
  assert.match(page,/<div className="ivCard ivRegisterCard">/,'inside the shared register card');
  assert.match(page,/<table className="ivInvoiceTable">/,'with the shared table');
  assert.match(page,/details className="soFiltersMore"/,'and the shared Filters disclosure');
  assert.match(page,/<StatusPill status=\{row.status\} tone=\{VENDOR_TONES\(row.status\)\}\/>/,'the lifecycle reads on the shared pill');
  assert.match(page,/<VendorRowActions vendor=\{row\}/,'the row menu is the shared portalled menu');
  assert.match(page,/<section className="invoiceWorkspace purchaseWorkspace ivDetailOpen">/,'the detail opens the shared detail shell');
  assert.match(page,/<div className="ivDetailHead"><button type="button" className="ivDetailBack" aria-label="Back to Vendors"/,'under the shared arrow-led head');
  assert.match(page,/<nav className="itemDetailTabs ivDetailTabs" aria-label="Vendor sections">/,'with the shared Item Details tab row');
  assert.ok(!page.includes('vendorTabs')&&!page.includes('vendorProfileHead'),'the bespoke tab row and profile head are gone');
  assert.ok(!css.includes('.vendorTabs')&&!css.includes('.vendorProfileHead'),'along with their rules');
});

/* The migrated register is one card: the heading bar is its top and the register card completes it. */
test('the vendor register heading is the top of the register card',()=>{
 const css=readFileSync(new URL('../src/register-head.css',import.meta.url),'utf8');
 assert.ok(css.includes('.registerHead.ivHeading,.registerHead.itemsHeading{margin-bottom:0;padding:12px 22px;background:#fff;border:1px solid #e1e6ed;border-bottom:1px solid #e1e6ed;border-radius:10px 10px 0 0;box-shadow:none}'),'the heading bar takes the card border and the top radius');
 assert.ok(css.includes('.registerHead.ivHeading+.ivCard,.registerHead.itemsHeading+.itemsCard{margin-top:0;border-top:0;border-radius:0 0 10px 10px}'),'and the register card drops its top border and takes the bottom radius');
});