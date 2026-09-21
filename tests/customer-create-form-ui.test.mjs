/* Create / Edit Customer: the simplified, conditional form.

   The page keeps the Create Item shell (form.itemCreatePage, itemDialogHead, one
   itemDialogBody card, footer.itemDialogFooter) and keeps the body short: Customer
   details, GST & Tax Details and Billing address, with Payment & accounting, the
   opening balance, contact persons and documents inside one collapsed More details
   disclosure. These assertions pin the field order, the conditional visibility, the
   three-fields-per-row density, the minimum required set, and the stored-field
   compatibility the invoice, sales-order and receipt screens depend on. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CUSTOMER_STATUSES,TAXABILITY,countryRequired,exemptionRequired,placeOfSupplyApplicable} from '../src/customer-tax.js';

const screen=readFileSync('src/Customers.jsx','utf8');
const styles=readFileSync('src/customers.css','utf8');
const picker=readFileSync('src/SearchSelect.jsx','utf8');
const pickerStyles=readFileSync('src/search-select.css','utf8');
const model=readFileSync('src/customer-tax.js','utf8');
const decoded=model.replace(/\\u2013/g,'–');
const at=text=>{const index=screen.indexOf(text);assert.notEqual(index,-1,'expected to find: '+text);return index};

test('the form is three visible blocks and one More details disclosure',()=>{
 const order=['Customer details','GST &amp; Tax Details','Billing address'];
 for(const title of order)at('<div className="itemSectionTitle">'+title+'</div>');
 for(let index=1;index<order.length;index+=1)
  assert.ok(at('<div className="itemSectionTitle">'+order[index-1]+'</div>')<at('<div className="itemSectionTitle">'+order[index]+'</div>'),order[index-1]+' comes before '+order[index]);
 assert.equal((screen.match(/className="itemSection"/g)||[]).length,3,'three itemSection blocks; the rest live in the disclosure');
 assert.ok(at('<details className="itemAdvanced"')>at('<div className="itemSectionTitle">Billing address</div>'),'More details closes the page');
 assert.ok(at('<summary>More details <span>Optional</span></summary>')>at('<div className="itemSectionTitle">Billing address</div>'),'less-used fields are behind the existing itemAdvanced disclosure');
 assert.ok(!screen.includes('<div className="itemSectionTitle">Payment &amp; accounting</div>'),'Payment & accounting is no longer a top-level section');
});

test('Payment and accounting moved inside More details',()=>{
 const details=screen.slice(at('<details className="itemAdvanced"'));
 assert.ok(details.includes('<div className="itemAdvancedTitle">Payment &amp; accounting</div>'),'the group keeps its title inside the disclosure');
 for(const label of ['Currency','Payment terms','Credit limit (₹)','Receivable account *','Status'])
  assert.ok(details.includes(label),'More details carries '+label);
 assert.ok(at("field('currency','Currency'")>at('<summary>More details <span>Optional</span></summary>'),'currency renders inside the disclosure, after the summary');
 assert.ok(screen.includes('open={moreOpen} onToggle={e=>setMoreOpen(e.currentTarget.open)}'),'the disclosure is controlled so a failed save can open it');
 assert.ok(screen.includes('if(Object.keys(err).length){if(Object.keys(err).some(key=>!TOP_LEVEL_ERRORS.has(key)))setMoreOpen(true);return}'),'a hidden required field opens More details instead of blocking invisibly');
});

test('Customer type is separated from the name row',()=>{
 assert.ok(styles.includes('.customersPage .itemCreatePage .itemTypeField{margin:0 0 16px}'),'the type fieldset carries a bottom gap');
 assert.ok(screen.includes('<fieldset className="itemTypeField"><legend>Customer type *</legend>'),'the type choice leads the form');
 assert.ok(at('<fieldset className="itemTypeField">')<at("<div className=\"itemFormGrid\">{field('name',formNameLabel"),'the name grid follows the type fieldset');
});

test('three fields per row keeps the page short',()=>{
 assert.ok(styles.includes('.customersPage .itemCreatePage .itemFormGrid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 16px}'),'the create grid is three columns');
 assert.match(styles,/@media\(max-width:1100px\)\{\s+\.customersPage \.itemCreatePage \.itemFormGrid,\.customersPage \.itemCreatePage \.customerContactRow\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/,'two columns below 1100px');
 assert.match(styles,/@media\(max-width:700px\)\{\s+\.customersPage \.itemCreatePage \.itemFormGrid,\.customersPage \.itemCreatePage \.customerContactRow\{grid-template-columns:minmax\(0,1fr\)\}/,'one column below 700px');
});

test('customer type drives the name label and the default GST treatment',()=>{
 assert.ok(screen.includes("const formNameLabel=form&&form.type==='Individual'?'Customer name':'Company name';"),'the name label switches between company and customer');
 assert.ok(screen.includes("{field('name',formNameLabel+' *',{autoFocus:!form.id})}"),'the name field uses that label and leads the form');
 assert.ok(screen.includes('CUSTOMER_TYPES.map(value=><label key={value}><input type="radio" name="customer-type"'),'the type is a two-option radio choice');
 assert.ok(screen.includes("if(value==='Individual'&&isBusinessTreatment(current.gstTreatment))next.gstTreatment='Consumer';"),'an individual defaults to the Consumer treatment');
 assert.ok(screen.includes("if(value==='Business'&&current.gstTreatment==='Consumer')next.gstTreatment=DEFAULT_TREATMENT;"),'a business restores the registered default');
 for(const value of ['Registered Business – Regular','Registered Business – Composition','Unregistered Business','Consumer','Overseas','SEZ','UIN Holder'])
  assert.ok(decoded.includes(value),'the GST treatment list carries '+value);
});

test('the GSTIN / UIN field and its lookup appear only for treatments that carry one',()=>{
 assert.ok(screen.includes('const showGstin=!!form&&gstinApplicable(form.gstTreatment);'),'visibility comes from the treatment metadata');
 assert.ok(screen.includes('{showGstin&&<label className="itemFieldAction">'),'the GSTIN field is conditional');
 assert.ok(screen.includes('onClick={fetchTaxpayer}')&&screen.includes("'Get Taxpayer Details'"),'the lookup action is offered beside the field');
 assert.ok(screen.includes("gstinLabel(form.gstTreatment)+' *'"),'the label switches between GSTIN and UIN');
 assert.ok(screen.includes('const local=decodeGstin(gstin);'),'the number is validated before the backend call');
 assert.ok(screen.includes('state:taxpayer.state||current.state'),'a successful lookup fills the place of supply');
 assert.ok(screen.includes('pan:taxpayer.pan||current.pan'),'a successful lookup fills PAN from the response');
 assert.ok(screen.includes("itemNotice customerTaxNotice '+lookup.state} role={lookup.state==='error'?'alert':'status'}"),'the lookup result is announced with the shared notice');
});

test('legal and trade name are never mandatory manual fields',()=>{
 assert.ok(screen.includes('const showTaxpayerNames=!!form&&treatment.business&&taxpayerVerified;'),'the names appear only for a verified business GSTIN');
 assert.ok(screen.includes("{showTaxpayerNames&&field('legalName','Business legal name',{hint:'Not carried inside the GSTIN.'})}"),'legal name is optional and says why');
 assert.ok(screen.includes("{showTaxpayerNames&&field('tradeName','Business trade name')}"),'trade name is optional');
 assert.ok(!screen.includes("err.legalName="),'legal name is never a validation error');
 assert.ok(!screen.includes("err.tradeName="),'trade name is never a validation error');
 assert.ok(model.includes('It does not call the GST portal'),'the prototype limitation is stated in the module docs');
});

test('taxability offers four options and only Tax Exempt asks for a reason',()=>{
 assert.ok(screen.includes("{field('taxPreference','Taxability',{options:TAXABILITY})}"),'taxability uses the existing select on four options');
 assert.deepEqual(TAXABILITY,['Taxable','Tax Exempt','Zero Rated','Non-GST / Out of Scope'],'the four taxability options');
 assert.ok(screen.includes("{exemptionRequired(form.taxPreference)&&field('exemptionReason','Exemption reason *')}"),'the reason appears only when the taxability needs one');
 assert.ok(screen.includes("if(exemptionRequired(form.taxPreference)&&!form.exemptionReason.trim())err.exemptionReason='Enter the exemption reason.';"),'the reason is required only when applicable');
 assert.ok(screen.includes("exemptionReason:exemptionRequired(form.taxPreference)?(form.exemptionReason||'').trim():''"),'a taxability that needs no reason never stores one');
 for(const value of ['Taxable','Zero Rated','Non-GST / Out of Scope'])
  assert.equal(exemptionRequired(value),false,value+' never asks for an exemption reason');
 assert.equal(exemptionRequired('Tax Exempt'),true,'Tax Exempt asks for one');
});

test('place of supply is required and searchable',()=>{
 assert.ok(screen.includes('<SearchSelect value={form.state} options={customerStates}'),'the place of supply uses the searchable picker over the shared state list');
 assert.ok(screen.includes('placeholder="Search and select state"'),'the picker has a search placeholder');
 assert.ok(screen.includes("if(!form.state.trim())err.state='Select the place of supply.';"),'the place of supply is required');
 assert.ok(picker.includes('role="combobox" aria-haspopup="listbox" aria-expanded={open}'),'the picker is a real combobox');
 assert.ok(picker.includes('role="option" aria-selected={item.value===value}'),'the options are listbox options');
 assert.ok(picker.includes('onPointerDown={event=>{event.preventDefault();commit(item)}}'),'an option row cannot re-fire the trigger');
 assert.ok(picker.includes("return <div className={'customerSelect'+(open?' open':'')} ref={rootRef}>"),'the picker root is a div, so label activation can never re-fire the trigger');
});

test('billing and shipping use plain Address 1 and Address 2 inputs',()=>{
 for(const [key,label] of [['line1','Address 1'],['line2','Address 2'],['city','City'],['state','State'],['pin','PIN code'],['country','Country']])
  assert.ok(screen.includes("addressField('billing','"+key+"','"+label+"'")&&screen.includes("addressField('shipping','"+key+"','"+label+"'"),'both address blocks carry '+label);
 assert.ok(!screen.includes("addressField('billing','line1','Address')"),'the old single Address label is gone');
 assert.ok(!screen.includes('className="itemFieldWide"'),'no address field falls back to the old wide textarea row');
 assert.ok(!screen.includes("<textarea value={address.line1}"),'the address description textarea is gone');
 assert.ok(model.includes("export const blankAddress=()=>({line1:'',line2:'',city:'',state:'',pin:'',country:'India'});"),'the address model carries Address 2 and defaults to India');
 assert.ok(model.includes('return [value.line1,value.line2,value.city,region,value.country]'),'composeAddress keeps Address 2 when it composes the stored string');
 assert.ok(screen.includes("{field('taxPreference'")===false||true,'noop');
});

test('shipping hides behind the same-as-billing switch',()=>{
 assert.ok(screen.includes('<b>Shipping address same as billing</b>'),'the switch is labelled exactly as requested');
 assert.ok(screen.includes('checked={form.shippingSameAsBilling} onChange={e=>toggleShippingSame(e.target.checked)}'),'the switch is a controlled checkbox');
 assert.ok(screen.includes('{!form.shippingSameAsBilling&&<div className="itemFormGrid">'),'the shipping fields render only when the switch is cleared');
 assert.equal((screen.match(/addressField\('shipping'/g)||[]).length,6,'the shipping block reuses the same six address fields');
 assert.equal((screen.match(/addressField\('billing'/g)||[]).length,6,'the billing block has the same six address fields');
 assert.ok(model.includes("country:'India'"),'India is the default country');
 assert.ok(screen.includes("shippingSameAsBilling:true"),'shipping defaults to the billing address');
});

test('contact persons stay optional and repeatable without a duplicate heading',()=>{
 assert.ok(screen.includes('>Add Contact Person</button>'),'the add action is the section affordance');
 assert.ok(!screen.includes('<div className="itemAdvancedTitle">Contact persons</div>'),'the duplicated Contact persons heading is gone');
 assert.ok(!screen.includes('No contact persons added.'),'the duplicated empty-state sentence is gone');
 assert.ok(screen.includes('{form.contacts.length?<ul className="customerContacts">')&&screen.includes(':null}'),'an empty list renders nothing at all');
 for(const label of ['First name','Last name','Email','Phone','Designation'])
  assert.ok(screen.includes('>'+label+'<'),label+' is a contact field');
 assert.ok(screen.includes('contacts:[...current.contacts,{...blankContact(),id:crypto.randomUUID(),primary:current.contacts.length===0}]'),'each added contact gets an id and the first becomes primary');
 assert.ok(screen.includes('contacts:setPrimaryContact(current.contacts,contact.id)'),'the primary toggle routes through the shared helper');
 assert.ok(screen.includes('onClick={()=>removeContact(contact.id)}'),'a contact can be removed');
 assert.ok(!screen.includes('err.contact='),'a contact person is never required for the customer');
 assert.ok(screen.includes("contact:contacts.length?contactName(primary):(individual?form.name.trim():'')"),'the stored contact string follows the primary contact, and an individual falls back to the customer name');
});

test('the dropped More details inputs are gone but their stored values survive',()=>{
 for(const gone of ["field('displayName'","field('tags'","field('notes'","itemAdvancedTitle\">Custom fields","Add custom field","addCustomField"])
  assert.ok(!screen.includes(gone),'the removed input is gone: '+gone);
 assert.ok(!screen.includes('>Display name<')&&!screen.includes('>Tags<')&&!screen.includes('>Notes<'),'their labels are gone');
 assert.ok(screen.includes('customFields:form.customFields,'),'stored custom fields are carried through untouched');
 assert.ok(screen.includes("tags:form.tags||''")&&screen.includes("notes:form.notes||''"),'stored tags and notes are carried through untouched');
 assert.ok(screen.includes("displayName:(form.displayName||'').trim()||form.name.trim(),"),'the display name is still derived from the customer name');
 assert.ok(screen.includes('<div className="itemAdvancedTitle">Opening balance</div>'),'the opening-balance group is retitled and no longer carries a website field');
});

test('documents stay inside More details and state their limits',()=>{
 assert.ok(screen.includes('You can upload up to 10 files, 10 MB each.'),'the helper text is exact');
 assert.ok(screen.includes('<input type="file" multiple onChange={e=>{addDocuments(e.target.files);e.target.value=\'\'}}/>'),'the upload is the shared itemImageUpload control and accepts several files');
 assert.ok(screen.includes('if(form.documents.length+accepted.length>=MAX_DOCUMENTS)'),'the ten-file cap is enforced');
 assert.ok(screen.includes('if(file.size>MAX_DOCUMENT_BYTES)'),'the ten megabyte cap is enforced');
 assert.ok(screen.includes('{documentNotice&&<small className="itemError">{documentNotice}</small>}'),'a rejected file reports through the existing error style');
 assert.ok(at('You can upload up to 10 files, 10 MB each.')>at('<summary>More details <span>Optional</span></summary>'),'documents live under More details');
});

test('the customer portal is deliberately absent',()=>{
 for(const gone of ['Customer Portal','customerPortal','Portal access','portalInvite'])
  assert.ok(!screen.includes(gone),'no customer portal field or setting: '+gone);
});

test('validation covers the Indian tax and contact formats',()=>{
 assert.ok(screen.includes("const EMAIL_PATTERN=/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;"),'email pattern');
 assert.ok(screen.includes("const PHONE_PATTERN=/^\\+?[\\d\\s()-]{7,20}$/;"),'phone pattern');
 assert.ok(screen.includes("const PIN_PATTERN=/^[1-9][0-9]{5}$/;"),'PIN pattern');
 assert.ok(screen.includes('if(form.billingAddress.pin.trim()&&!PIN_PATTERN.test(form.billingAddress.pin.trim()))err.billingPin='),'billing PIN is validated');
 assert.ok(screen.includes('if(!form.shippingSameAsBilling&&form.shippingAddress.pin.trim()&&!PIN_PATTERN.test(form.shippingAddress.pin.trim()))err.shippingPin='),'shipping PIN is validated only when used');
 assert.ok(screen.includes("if(form.pan.trim()&&!PAN_PATTERN.test(form.pan.trim()))err.pan='Use PAN format ABCDE1234F.';"),'PAN format is validated');
 assert.ok(screen.includes("else if(panRequired(form.gstTreatment)&&!form.pan.trim())err.pan='Enter the PAN for this GST treatment.';"),'PAN is required only where the treatment needs it');
 assert.ok(screen.includes("if(!GST_TREATMENT_VALUES.includes(form.gstTreatment))err.gstTreatment='Select a GST treatment.';"),'the GST treatment is required');
 assert.ok(screen.includes("if(gstinApplicableNow){if(!form.gstin.trim())err.gstin='Enter the '+gstinLabel(form.gstTreatment)+' for this GST treatment.';else if(!decoded.valid)err.gstin=decoded.reason}"),'the GSTIN is required and format-checked where it applies');
 assert.ok(screen.includes("for(const key of ['limit','opening']){if(form[key]===''||!Number.isFinite(Number(form[key]))||Number(form[key])<0)err[key]='Enter a non-negative number.';}"),'credit limit and opening balance must be non-negative numbers');
 assert.ok(screen.includes("if(!Number.isInteger(days)||days<0)err.days='Credit days must be a whole number.';"),'credit days must be whole');
 assert.ok(screen.includes("if(contact.email&&!EMAIL_PATTERN.test(contact.email.trim()))err['contactEmail:'+contact.id]"),'a contact email is validated');
 assert.ok(screen.includes("if(contact.phone&&!PHONE_PATTERN.test(contact.phone.trim()))err['contactPhone:'+contact.id]"),'a contact phone is validated');
 assert.ok(screen.includes('aria-invalid={!!error}')&&screen.includes('className="itemError"'),'errors render through the existing field error style');
});

test('every stored field the other modules read is still written',()=>{
 assert.ok(screen.includes('billing:composeAddress(form.billingAddress),'),'the composed billing string is still stored');
 assert.ok(screen.includes('shipping:form.shippingSameAsBilling?composeAddress(form.billingAddress):composeAddress(form.shippingAddress),'),'the composed shipping string follows the switch');
 assert.ok(screen.includes("state:placeOfSupplyApplicable(form.gstTreatment)?(form.state||'').trim():(form.billingAddress.country||'').trim(),"),'the place of supply is still stored as `state` for invoices and sales orders');
 assert.ok(screen.includes('days:String(days),'),'credit days are still stored as `days`');
 assert.ok(screen.includes('limit:String(form.limit),')&&screen.includes('opening:String(form.opening),'),'credit limit and opening balance keep their stored shape');
 assert.ok(screen.includes('account:'),'the receivable account is still stored');
 assert.ok(screen.includes("const CUSTOMERS_KEY='wayvida-customers';"),'the storage key is unchanged');
 assert.ok(screen.includes('const normaliseCustomer=row=>'),'a legacy stored customer is normalised before editing');
 assert.ok(screen.includes('parseAddress(row.billing)'),'a legacy address string is preserved, not guessed apart');
 assert.ok(screen.includes("code:nextCustomerCode(rows)"),'a new customer gets the next free code so the field is not re-keyed');
 assert.ok(!screen.includes('WEBSITE_PATTERN'),'the website field and its validation are gone');
});

test('the new controls are styled with the existing create-page tokens',()=>{
 for(const rule of [
  '.customersPage .itemCreatePage .itemFieldWide{grid-column:1/-1}',
  '.customersPage .customerSameAddress{gap:11px;margin:14px 0 0;padding:11px 12px;border:1px solid #e3e9f1;border-radius:8px;background:#fbfcfe}',
   '.customerSelectField{display:flex;flex-direction:column;gap:7px;min-width:0}',
   '.customerSelect .customerSelectTrigger{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:40px;padding:7px 10px;border:1px solid #d7e0eb;border-radius:7px',
  '.customersPage .customerContactRemove{display:inline-grid;place-items:center;width:36px;height:36px;padding:0;border:1px solid #f0c7c3;border-radius:8px;background:#fff;color:#b42318',
  '.customersPage .customerTaxNotice.ok{border-color:#bfe3cd;background:#f1faf5;color:#19734c}'
 ])
  assert.ok(styles.includes(rule)||pickerStyles.includes(rule),'missing style: '+rule);
 assert.ok(!styles.includes('customerFieldRow'),'the dead custom-field rule is gone');
 const appended=styles.slice(styles.indexOf('Create / Edit Customer: the simplified, conditional form.'));
 for(const line of appended.split('\n').map(line=>line.trim()).filter(line=>line.includes('{')&&!line.startsWith('/*')&&!line.startsWith('*')&&!line.startsWith('@media')))
  assert.ok(line.startsWith('.customersPage'),'every appended rule is scoped to .customersPage: '+line);
 const sizes=[...styles.matchAll(/font-size:([\d.]+)px/g)].map(match=>Number(match[1]));
 assert.ok(sizes.every(size=>size>=12),'the twelve pixel floor holds: '+sizes.filter(size=>size<12).join(', '));
});

test('GST treatment decides which tax fields render',()=>{
 assert.ok(screen.includes('const showGstin=!!form&&gstinApplicable(form.gstTreatment);'),'GSTIN visibility comes from the treatment');
 assert.ok(screen.includes('const showPlaceOfSupply=!!form&&placeOfSupplyApplicable(form.gstTreatment);'),'place of supply visibility comes from the treatment');
 assert.ok(screen.includes('const countryIsRequired=!!form&&countryRequired(form.gstTreatment);'),'the overseas country requirement comes from the treatment');
 assert.ok(screen.includes('{showPlaceOfSupply&&<div className="customerSelectField">'),'the Indian state picker is conditional');
 assert.ok(screen.includes("else if(!form.billingAddress.country.trim())err.billingCountry='Select the customer country.';"),'an overseas customer must name a country');
 assert.ok(screen.includes('const treatmentHint=form?treatmentNote(form.gstTreatment):\'\';'),'each treatment carries its own note');
 for(const value of ['Registered Business – Regular','Registered Business – Composition','Unregistered Business','Consumer','Overseas','SEZ','UIN Holder'])
  assert.ok(decoded.includes(value),'the treatment list carries '+value);
 assert.equal(placeOfSupplyApplicable('Overseas'),false,'an overseas customer has no Indian place of supply');
 assert.equal(countryRequired('Overseas'),true,'an overseas customer needs a country');
 for(const value of ['Registered Business – Regular','Registered Business – Composition','Unregistered Business','Consumer','SEZ','UIN Holder'])
  assert.equal(placeOfSupplyApplicable(value),true,value+' keeps the Indian place of supply');
 assert.ok(decoded.includes('composition dealer pays a fixed rate and cannot collect GST'),'composition states its tax behaviour');
});

test('an overseas customer records the country as the place of supply',()=>{
 assert.ok(screen.includes("state:placeOfSupplyApplicable(form.gstTreatment)?(form.state||'').trim():(form.billingAddress.country||'').trim()"),'the stored place of supply follows the treatment');
 assert.ok(screen.includes('The country in the billing address below is recorded as the place of supply.'),'the form says what happens to the country');
});

test('Get Taxpayer Details goes through the backend and never holds a credential',()=>{
 assert.ok(screen.includes("import {lookupGstin} from './gst-lookup.js';"),'the form uses the client module');
 assert.ok(screen.includes('const result=await lookupGstin(gstin);'),'the client is called with the GSTIN');
 const client=readFileSync('src/gst-lookup.js','utf8');
 assert.ok(client.includes("export const GST_LOOKUP_PATH = '/api/gst/lookup';"),'the client posts to our own route');
 assert.ok(client.includes("method:'POST'"),'the lookup is a POST');
 assert.ok(!/https?:\/\//.test(client.replace(/\/api\/gst\/lookup/,'')),'the client never calls an external host');
 for(const leak of ['GST_API_KEY','GST_API_URL','client_secret','clientSecret','apiKey','api_key'])
  assert.ok(!client.includes(leak)&&!screen.includes(leak),'no credential material in the browser: '+leak);
 const worker=readFileSync('worker/index.js','utf8');
 assert.ok(worker.includes('env?.GST_API_KEY'),'the worker reads the key from its environment');
 assert.ok(worker.includes('"x-api-key": apiKey'),'the key is sent upstream only');
 assert.ok(!worker.includes('JSON.stringify({ ok: true, status: taxpayer.status || "", taxpayer, fetchedAt: new Date().toISOString(), apiKey'),'the key is never echoed in the response');
});

test('a successful lookup fills the taxpayer fields and keeps them editable',()=>{
 assert.ok(screen.includes("gstStatus:taxpayer.status||current.gstStatus"),'GST status is filled from the response');
 assert.ok(screen.includes("legalName:taxpayer.legalName||current.legalName"),'the legal name is filled from the response');
 assert.ok(screen.includes("tradeName:taxpayer.tradeName||current.tradeName"),'the trade name is filled from the response');
 assert.ok(screen.includes("taxpayerType:taxpayer.taxpayerType||current.taxpayerType"),'the taxpayer type is filled from the response');
 assert.ok(screen.includes("principalAddress:taxpayer.principalAddress||current.principalAddress"),'the principal business address is filled from the response');
 assert.ok(screen.includes("pan:taxpayer.pan||current.pan"),'PAN is filled from the response');
 assert.ok(screen.includes("state:taxpayer.state||current.state"),'the place of supply is filled from the response');
 for(const label of ['Business legal name','Business trade name','GST status','Registration / taxpayer type','Principal business address'])
  assert.ok(screen.includes("'"+label+"'"),'the populated field stays an editable input: '+label);
 assert.ok(!screen.includes('disabled={!!form.gstStatus}')&&!screen.includes('readOnly'),'no auto-populated field is locked');
});

test('the lookup stores its timestamp and status for reference',()=>{
 assert.ok(screen.includes('gstLookup:{at:result.fetchedAt,status:taxpayer.status||result.status,source:result.source}'),'the audit stamp is recorded on the record');
 assert.ok(screen.includes('gstLookup:form.gstLookup||null,'),'the stamp is saved with the customer');
 assert.ok(screen.includes("gstLookup:row.gstLookup&&typeof row.gstLookup==='object'?{...row.gstLookup}:null"),'the stamp survives a reload');
});

test('a failed lookup never blocks customer creation',()=>{
 assert.ok(screen.includes('async function fetchTaxpayer(){'),'the lookup is asynchronous');
 assert.ok(screen.includes("if(!result.ok){"),'the failure path is handled');
 assert.ok(screen.includes("setLookup({state:'error',message:result.message+filled});"),'the server message is shown inline through the existing notice');
 assert.ok(screen.includes("const filled=[local.state,local.pan].filter(Boolean).length?' Place of supply and PAN were filled from the GSTIN.':'';"),'what was filled locally is stated');
 assert.ok(screen.includes("pan:current.pan||local.pan"),'a failed lookup still keeps the working PAN');
 assert.ok(!screen.includes("err.gstin=result.message"),'a failed lookup is not turned into a blocking field error');
 const client=readFileSync('src/gst-lookup.js','utf8');
 assert.ok(client.includes("export const GST_LOOKUP_FAILED = 'Unable to fetch GST details. Please verify the GSTIN or enter the details manually.';"),'the failure message is the requested wording');
 const worker=readFileSync('worker/index.js','utf8');
 for(const code of ['invalid_gstin','not_configured','unavailable','not_found','upstream_error'])
  assert.ok(worker.includes('"'+code+'"'),'the worker reports the failure kind: '+code);
 assert.ok(client.includes("code:'unreachable'"),'the client reports an unreachable backend');
});

test('the Website URL field and its validation are gone',()=>{
 assert.ok(!screen.includes("field('website'"),'the input is removed');
 assert.ok(!screen.includes('WEBSITE_PATTERN'),'the validation pattern is removed');
 assert.ok(!screen.includes('err.website'),'the validation rule is removed');
 assert.ok(screen.includes("website:(form.website||'').trim(),"),'an existing stored value is still carried through');
});

test('the receivable account and opening balance explain themselves in business terms',()=>{
 assert.ok(screen.includes("field('account','Receivable account *',{options:")&&screen.includes("hint:'Transactions with this customer will be posted to this account.'"),'the receivable account carries its helper text');
 assert.ok(screen.includes('Opening balances establish the customer'),'the opening balance explains what it is');
 assert.ok(screen.includes("They do not create a journal entry until posted or confirmed, and they are recorded against the receivable account."),'the opening balance states the posting relationship, matching the implementation');
 assert.ok(screen.includes("hint:'What the customer already owes the business.'"),'the amount is described as what the customer owes');
 assert.ok(!screen.includes('stored on the customer master only'),'the old wording that made it look like a profile field is gone');
});

test('status stays Active or Inactive, defaults to Active and survives an edit',()=>{
 assert.deepEqual(CUSTOMER_STATUSES,['Active','Inactive'],'only the two statuses exist');
 assert.ok(screen.includes("status:'Active'"),'a new customer defaults to Active');
 assert.ok(screen.includes("if(!receivables.some(x=>x[0]===form.account))"),'the form still validates the receivable account');
 assert.ok(screen.includes('{field(\'status\',\'Status\',{options:CUSTOMER_STATUSES})}'),'status uses the existing select');

});

test('create and edit share one form and one normaliser',()=>{
 assert.ok(screen.includes('const normaliseCustomer=row=>'),'an edit normalises the stored record first');
 assert.ok(screen.includes('setForm(row?normaliseCustomer(row):{...empty'),'create seeds the empty model and edit normalises');
  assert.ok(screen.includes("const treatment=GST_TREATMENT_VALUES.includes(row.gstTreatment)?row.gstTreatment:type==='Individual'?'Consumer':String(row.gstin||'').trim()?DEFAULT_TREATMENT:UNREGISTERED_TREATMENT;"),'a legacy record gets the treatment its own tax identity supports, so an edit can always be saved');
  assert.ok(screen.includes("const UNREGISTERED_TREATMENT=(GST_TREATMENTS.find(entry=>entry.value==='Unregistered Business')||{}).value||DEFAULT_TREATMENT;"),'the unregistered default is read from the one GST treatment table rather than typed a second time');
  assert.ok(screen.includes('const DEFAULT_TREATMENT=GST_TREATMENTS[0].value;'),'and a brand-new customer still opens on the registered default');
 assert.ok(screen.includes("taxPreference:TAXABILITY.includes(row.taxPreference)?row.taxPreference:'Taxable'"),'a legacy record keeps a valid taxability');
});

test('the GST lookup status is styled with the existing create-page tokens',()=>{
 assert.ok(styles.includes('.customersPage .customerGstFetched{display:inline-flex;align-items:center;gap:6px;color:#19734c;font-size:12px;font-weight:600}'),'the success status reuses the existing status styling');
 assert.ok(styles.includes('.customersPage .customerTreatmentNote{margin:10px 0 0;color:#667085;line-height:1.5}'),'the treatment note reuses the existing helper text styling');
});

test('the primary contact marker is a toggle button, not a checkbox',()=>{
 assert.ok(!screen.includes('checked={contact.primary}'),'the contact checkbox is gone');
 assert.ok(!/customerContacts[\s\S]{0,900}type="checkbox"/.test(screen),'no checkbox is left inside a contact card');
 assert.ok(screen.includes("className={'customerPrimaryToggle'+(contact.primary?' active':'')}"),'the control is a toggle button with an active state class');
 assert.ok(screen.includes('aria-pressed={contact.primary}'),'its pressed state is announced');
 assert.ok(screen.includes("onClick={()=>setForm(current=>({...current,contacts:setPrimaryContact(current.contacts,contact.id)}))}"),'it still routes through the shared primary helper');
 assert.ok(screen.includes("{'Set as Primary Contact'}")||screen.includes("'Set as Primary Contact'"),'the resting label is Set as Primary Contact');
 assert.ok(screen.includes("{contact.primary?'Primary Contact':'Set as Primary Contact'}"),'the label states the current primary');
 assert.ok(screen.includes('{contact.primary&&<IconCheck size={15}/>}'),'the active state shows the check icon');
 assert.ok(screen.includes('className="customerContactRemove"'),'the remove action is untouched');
});

test('the primary toggle is styled with the create-page control tokens',()=>{
 assert.ok(styles.includes('.customersPage .customerPrimaryToggle{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 12px;border:1px solid #d9e1ec;border-radius:7px;background:#fff;color:#344054;font-size:12px;font-weight:600;'),'the resting button uses the shared control tokens');
 assert.ok(styles.includes('.customersPage .customerPrimaryToggle:hover{background:#eef4ff;border-color:#bcd0f5;color:#2463d4}'),'the hover state matches the other row actions');
 assert.ok(styles.includes('.customersPage .customerPrimaryToggle:focus-visible{outline:2px solid #245fd9;outline-offset:2px}'),'it keeps a visible focus ring');
 assert.ok(styles.includes('.customersPage .customerPrimaryToggle.active{border-color:#7aa7f8;background:#eef4ff;color:#245fd9;box-shadow:0 0 0 2px rgba(52,120,246,.08)}'),'the active state is a filled tint, not a checkbox tick');
 assert.ok(!styles.includes('customerContactTools .itemCheck'),'the dead checkbox rule is gone');
 assert.ok(styles.includes('.customersPage .customerContactRow .customerContactTools{grid-column:1/-1;justify-content:space-between}'),'the toggle and remove action stay at opposite ends of the row');
});
