import {useEffect,useMemo,useRef,useState} from 'react';
import {IconArrowLeft,IconBan,IconBook2,IconCheck,IconChevronDown,IconCircleCheck,IconCopy,IconDots,IconDownload,IconEdit,IconEye,IconFilter,IconHistory,IconInfoCircle,IconPaperclip,IconPlus,IconReceipt,IconSearch,IconTrash,IconUpload,IconUsers,IconX} from '@tabler/icons-react';
import './items.css';
import './customers.css';
import {KEY,initial as emptyAccounting} from './invoice-engine.js';
import {customerCreditSummary,customerStatement} from './credit-note-service.js';
import {lookupGstin} from './gst-lookup.js';
import StatusPill from './StatusPill.jsx';
import SearchSelect from './SearchSelect.jsx';
import {COUNTRIES,CURRENCIES,CUSTOMER_STATUSES,CUSTOMER_TYPES,DEFAULT_CURRENCY,EXEMPTION_TAXABILITY,GST_TREATMENTS,GST_TREATMENT_VALUES,MAX_DOCUMENTS,MAX_DOCUMENT_BYTES,PAN_PATTERN,PAYMENT_TERMS,TAXABILITY,blankAddress,blankContact,blankCustomField,blankDocument,composeAddress,contactFromName,contactName,daysToPaymentTerm,decodeGstin,fileSize,gstTreatmentMeta,gstinApplicable,gstinLabel,gstinRequired,isBusinessTreatment,normaliseContacts,panRequired,parseAddress,paymentTermDays,primaryContact,setPrimaryContact,countryRequired,exemptionRequired,placeOfSupplyApplicable,treatmentNote} from './customer-tax.js';

const CUSTOMERS_KEY='wayvida-customers';
const SALES_ORDERS_KEY='wayvida-sales-orders';
const DEFAULT_TAB='Basic Data';
const DETAIL_TABS=['Basic Data','Transactions','History'];
const readAccounting=()=>{try{return JSON.parse(localStorage.getItem(KEY))||emptyAccounting()}catch{return emptyAccounting()}};
const readCustomers=()=>{try{const stored=JSON.parse(localStorage.getItem(CUSTOMERS_KEY));return Array.isArray(stored)?stored:customerSeeds}catch{return customerSeeds}};
const readSalesOrders=()=>{try{const stored=JSON.parse(localStorage.getItem(SALES_ORDERS_KEY));return Array.isArray(stored)?stored:[]}catch{return []}};
const trail=row=>Array.isArray(row.auditTrail)?row.auditTrail:[];
/* One dismissal owner for every three-dot menu and the register Filters disclosure: the register row menus and the
   detail header menu share the .customerKebab class and the toolbar filters are a second details element, so a
   single page-level pointerdown / Escape effect closes whichever one is open. */
const closeCustomerMenus=()=>document.querySelectorAll('.customerKebab[open]').forEach(node=>node.removeAttribute('open'));
const closeCustomerFilters=()=>document.querySelectorAll('.customerFilters[open]').forEach(node=>node.removeAttribute('open'));
/* Register filters beyond the always-visible status select. Every default starts with `All ` so the active-filter
   count is derived from the values themselves instead of a second bookkeeping list. */
const CUSTOMER_FILTER_DEFAULTS={type:'All types',state:'All states',gstTreatment:'All GST treatments',paymentTerms:'All payment terms',balance:'All balances'};
const BALANCE_FILTERS=['All balances','With outstanding','No outstanding'];
export const nextCustomerCode=rows=>{const used=new Set((rows||[]).map(row=>String(row.code||'').toUpperCase()));let count=0,code='';do{count+=1;code='CUS'+String(count).padStart(3,'0')}while(used.has(code));return code};

/* The stored customer record keeps every field the rest of the prototype already reads
   (`name`, `code`, `type`, `contact`, `email`, `phone`, `billing`, `shipping`, `state`,
   `limit`, `days`, `opening`, `account`, `status`) and adds the GST, structured address,
   payment-term, contact-person, document and notes fields the create form now captures.
   Nothing is renamed, so existing customers, invoices, sales orders and receipts keep
   resolving, and every new field is optional on a legacy record. */
/* The customer import reads the columns the register exports, so a register export round-trips.
   Quoted cells and doubled quotes follow src/account-master.js, and a CRLF file reads like an LF one. */
function parseCustomerCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
  else if(!quoted&&(c===','||c==='\n')){row.push(cell.replace(/\r$/,''));cell='';if(c==='\n'){if(row.some(x=>x.trim()))rows.push(row);row=[]}}
  else cell+=c}
 if(quoted)throw Error('The CSV has an unclosed quote.');
 row.push(cell.replace(/\r$/,''));if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}
const CUSTOMER_IMPORT_COLUMNS='Name, Code, Contact, Email, Phone, GSTIN, GST treatment, State, Billing address, Shipping address, Credit limit, Status';

const EMAIL_PATTERN=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN=/^\+?[\d\s()-]{7,20}$/;
const PIN_PATTERN=/^[1-9][0-9]{5}$/;
const DEFAULT_TREATMENT=GST_TREATMENTS[0].value;
/* A record written before the GST rework names no treatment of its own. Handing every business the
   registered default asked it for a GSTIN and a PAN the record never held, so the form could not be
   saved at all - and the round trip back from a sales document dead-ended on that error. The default
   now follows the record's own tax identity: a business that holds a GSTIN keeps the registered
   default, and one that holds none opens as unregistered. */
const UNREGISTERED_TREATMENT=(GST_TREATMENTS.find(entry=>entry.value==='Unregistered Business')||{}).value||DEFAULT_TREATMENT;
/* Validation keys rendered above More details. Any other error came from a field inside the
   collapsed disclosure, so a failed save opens it instead of blocking invisibly. */
const TOP_LEVEL_ERRORS=new Set(['name','code','email','phone','gstTreatment','gstin','pan','state','taxPreference','exemptionReason','billingPin','billingCountry','shippingPin','save']);
const empty={name:'',displayName:'',code:'',type:'Business',contact:'',email:'',phone:'',website:'',billing:'',shipping:'',billingAddress:blankAddress(),shippingAddress:blankAddress(),shippingSameAsBilling:true,pan:'',gstin:'',legalName:'',tradeName:'',gstStatus:'',taxpayerType:'',principalAddress:'',gstLookup:null,gstTreatment:DEFAULT_TREATMENT,state:'',taxPreference:'Taxable',exemptionReason:'',currency:DEFAULT_CURRENCY,paymentTerms:'Net 30',limit:'0',days:'30',opening:'0',openingDate:'',account:'1100',status:'Active',contacts:[],tags:'',notes:'',customFields:[],documents:[]};
const seedCustomer=overrides=>({...empty,...overrides,billingAddress:overrides.billingAddress||parseAddress(overrides.billing),shippingAddress:overrides.shippingAddress||parseAddress(overrides.shipping),contacts:[],customFields:[],documents:[]});
export const customerSeeds=[seedCustomer({id:'cus-1',name:'ABC Retail Pvt Ltd',code:'CUS001',contact:'Anjali Menon',email:'accounts@abcretail.example',phone:'9876543210',billing:'MG Road, Kochi',shipping:'MG Road, Kochi',state:'Kerala',limit:'100000',opening:'45000'}),seedCustomer({id:'cus-2',name:'Northstar Services',code:'CUS002',contact:'Rahul Kumar',email:'finance@northstar.example',phone:'9876543211',state:'Karnataka',limit:'75000',opening:'20000'})];
/* A stored row may predate every field this form added, so one normaliser turns it back
   into a complete form: addresses are rebuilt from the structured parts when present and
   otherwise from the composed string, a legacy free-text contact person becomes the first
   contact row, and the payment term is recovered from the stored credit days. */
const normaliseCustomer=row=>{
 const type=row.type==='Individual'?'Individual':'Business';
 const treatment=GST_TREATMENT_VALUES.includes(row.gstTreatment)?row.gstTreatment:type==='Individual'?'Consumer':String(row.gstin||'').trim()?DEFAULT_TREATMENT:UNREGISTERED_TREATMENT;
 const contacts=normaliseContacts(Array.isArray(row.contacts)&&row.contacts.length?row.contacts:[contactFromName(row.contact)].filter(Boolean));
 return {...empty,...row,type,gstTreatment:treatment,taxPreference:TAXABILITY.includes(row.taxPreference)?row.taxPreference:'Taxable',gstStatus:row.gstStatus||'',taxpayerType:row.taxpayerType||'',principalAddress:row.principalAddress||'',gstLookup:row.gstLookup&&typeof row.gstLookup==='object'?{...row.gstLookup}:null,currency:row.currency||DEFAULT_CURRENCY,paymentTerms:PAYMENT_TERMS.includes(row.paymentTerms)?row.paymentTerms:daysToPaymentTerm(row.days),billingAddress:row.billingAddress?{...blankAddress(),...row.billingAddress}:parseAddress(row.billing),shippingAddress:row.shippingAddress?{...blankAddress(),...row.shippingAddress}:parseAddress(row.shipping),shippingSameAsBilling:row.shippingSameAsBilling!==false,contacts,customFields:(Array.isArray(row.customFields)?row.customFields:[]).map(field=>({...blankCustomField(),...field,id:field.id||crypto.randomUUID()})),documents:(Array.isArray(row.documents)?row.documents:[]).map(file=>({...blankDocument(),...file,id:file.id||crypto.randomUUID()})),tags:row.tags||'',website:row.website||'',openingDate:row.openingDate||'',notes:row.notes||''};
};
export const customerStates=['Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir','Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
/* Searchable dropdown for Place of supply. It follows the same interaction contract as
   src/AccountGroupPicker.jsx - a combobox button over a filtered listbox, ArrowUp/Down,
   Enter, Escape, an outside pointerdown that closes it - but the options are plain state
   names and the whole control is mounted in a div, never inside a <label>, so no label
   activation can re-fire the trigger after an option row is clicked. */
export default function Customers({accounts,notify,onNavigate}){
 const live=readAccounting();
 const [rows,setRows]=useState(readCustomers);
 const [query,setQuery]=useState(''),[status,setStatus]=useState('All statuses'),[filters,setFilters]=useState(CUSTOMER_FILTER_DEFAULTS),[form,setForm]=useState(null),[errors,setErrors]=useState({});
 const [selectedId,setSelectedId]=useState(''),[detailTab,setDetailTab]=useState(DEFAULT_TAB);
 const [lookup,setLookup]=useState(null),[lookupBusy,setLookupBusy]=useState(false),[documentNotice,setDocumentNotice]=useState('');
 const [moreOpen,setMoreOpen]=useState(false);
 const receivables=(accounts.Assets||[]).filter(x=>/receivable/i.test(x[1]));
 const accountName=code=>Object.values(accounts).flat().find(row=>row[0]===code)?.[1]||code||'Not configured';
 const update=(key,value)=>setForm(f=>({...f,[key]:value}));
 const money=value=>Number(value||0).toLocaleString('en-IN',{style:'currency',currency:'INR'});
 const audit=(action,detail='')=>({id:crypto.randomUUID(),action,detail,actor:'Admin',at:new Date().toISOString()});
 const persist=next=>{try{localStorage.setItem(CUSTOMERS_KEY,JSON.stringify(next));setRows(next);return true}catch{return false}};
 /* A document can send the operator here to edit one customer, the same sessionStorage handoff the
    balance sheet and the day book use. The marker is read once and cleared, so coming back to the
    register later never reopens a form. */
 useEffect(()=>{try{const id=sessionStorage.getItem('wayvida-edit-customer');if(!id)return;sessionStorage.removeItem('wayvida-edit-customer');const row=rows.find(x=>x.id===id);if(row)start(row)}catch{}},[]);
 useEffect(()=>{const onPointerDown=event=>{document.querySelectorAll('.customerKebab[open],.customerFilters[open]').forEach(node=>{if(!node.contains(event.target))node.removeAttribute('open')})};const onEscape=event=>{if(event.key==='Escape'){closeCustomerMenus();closeCustomerFilters()}};document.addEventListener('pointerdown',onPointerDown);document.addEventListener('keydown',onEscape);return()=>{document.removeEventListener('pointerdown',onPointerDown);document.removeEventListener('keydown',onEscape)}},[]);
 const start=row=>{closeCustomerMenus();setErrors({});setLookup(null);setMoreOpen(false);setDocumentNotice('');setSelectedId('');setForm(row?normaliseCustomer(row):{...empty,code:nextCustomerCode(rows),account:receivables[0]?.[0]||''})};
 /* Business and Individual drive the conditional form: an individual defaults to the
    Consumer treatment, and switching back to a business restores the registered default. */
 function changeType(value){setForm(current=>{const next={...current,type:value};if(value==='Individual'&&isBusinessTreatment(current.gstTreatment))next.gstTreatment='Consumer';if(value==='Business'&&current.gstTreatment==='Consumer')next.gstTreatment=DEFAULT_TREATMENT;return next});setLookup(null)}
 /* Addresses are held as structured parts for this form and as the composed multi-line
    string for the invoice and sales-order screens, which already read `billing` and
    `shipping`. While shipping is the billing address the two stay mirrored. */
 function changeAddress(which,key,value){setForm(current=>{const addressKey=which==='billing'?'billingAddress':'shippingAddress';const address={...current[addressKey],[key]:value};const next={...current,[addressKey]:address,[which]:composeAddress(address)};if(which==='billing'&&current.shippingSameAsBilling){next.shippingAddress=address;next.shipping=composeAddress(address)}if(which==='billing'&&key==='state'&&(!current.state||current.state===current.billingAddress.state))next.state=value;return next})}
 function toggleShippingSame(checked){setForm(current=>checked?{...current,shippingSameAsBilling:true,shippingAddress:{...current.billingAddress},shipping:composeAddress(current.billingAddress)}:{...current,shippingSameAsBilling:false})}
 /* Get Taxpayer Details asks our own backend to call the GST/GSP service, so no credential ever
    reaches the browser. The response fills the taxpayer fields, and every one of them stays
    editable. A failed lookup never blocks the customer: the number is still structurally valid,
    so the state and PAN a GSTIN actually carries are filled locally and the operator completes
    the rest by hand. The timestamp and returned status are kept on the record for reference. */
 async function fetchTaxpayer(){
  const gstin=(form.gstin||'').trim().toUpperCase();
  const local=decodeGstin(gstin);
  if(!local.valid){setErrors(current=>({...current,gstin:local.reason}));setLookup({state:'error',message:local.reason});return}
  setLookupBusy(true);
  const result=await lookupGstin(gstin);
  setLookupBusy(false);
  if(!result.ok){
   const filled=[local.state,local.pan].filter(Boolean).length?' Place of supply and PAN were filled from the GSTIN.':'';
   setForm(current=>({...current,gstin,pan:current.pan||local.pan,state:placeOfSupplyApplicable(current.gstTreatment)&&!current.state?local.state:current.state}));
   setErrors(current=>{const next={...current};delete next.gstin;return next});
   setLookup({state:'error',message:result.message+filled});
   return;
  }
  const taxpayer=result.taxpayer;
  setForm(current=>({...current,gstin,legalName:taxpayer.legalName||current.legalName,tradeName:taxpayer.tradeName||current.tradeName,gstStatus:taxpayer.status||current.gstStatus,taxpayerType:taxpayer.taxpayerType||current.taxpayerType,pan:taxpayer.pan||current.pan,state:taxpayer.state||current.state,principalAddress:taxpayer.principalAddress||current.principalAddress,gstLookup:{at:result.fetchedAt,status:taxpayer.status||result.status,source:result.source}}));
  setErrors(current=>{const next={...current};delete next.gstin;return next});
  const detail=[taxpayer.legalName||taxpayer.tradeName,taxpayer.status,taxpayer.state].filter(Boolean).join(' · ');
  setLookup({state:'ok',message:'GST details fetched successfully'+(detail?'. '+detail:'.')});
 }
 const addContact=()=>setForm(current=>({...current,contacts:[...current.contacts,{...blankContact(),id:crypto.randomUUID(),primary:current.contacts.length===0}]}));
 const updateContact=(id,key,value)=>setForm(current=>({...current,contacts:current.contacts.map(row=>row.id===id?{...row,[key]:value}:row)}));
 const removeContact=id=>setForm(current=>({...current,contacts:normaliseContacts(current.contacts.filter(row=>row.id!==id))}));
 function addDocuments(fileList){const incoming=Array.from(fileList||[]);if(!incoming.length)return;const accepted=[],rejected=[];for(const file of incoming){if(form.documents.length+accepted.length>=MAX_DOCUMENTS){rejected.push(file.name+' (file limit is '+MAX_DOCUMENTS+')');continue}if(file.size>MAX_DOCUMENT_BYTES){rejected.push(file.name+' (over 10 MB)');continue}accepted.push({...blankDocument(),id:crypto.randomUUID(),name:file.name,size:file.size})}if(accepted.length)setForm(current=>({...current,documents:[...current.documents,...accepted]}));setDocumentNotice(rejected.length?rejected.join(', ')+' was not added.':'')}
 const removeDocument=id=>setForm(current=>({...current,documents:current.documents.filter(row=>row.id!==id)}));
 const openDetail=row=>{closeCustomerMenus();setDetailTab(DEFAULT_TAB);setSelectedId(row.id)};
 const openStatement=customer=>{closeCustomerMenus();sessionStorage.setItem('wayvida-credit-customer',customer.id);onNavigate('Customer Statement')};
 function save(e){
  e.preventDefault();
  const err={};
  const individual=form.type==='Individual';
  const gstinApplicableNow=gstinApplicable(form.gstTreatment);
  const decoded=gstinApplicableNow?decodeGstin(form.gstin):null;
  if(!form.name.trim())err.name=individual?'Enter the customer name.':'Enter the company name.';
  if(!form.code.trim())err.code='Enter a customer code.';
  else if(rows.some(x=>x.id!==form.id&&String(x.code||'').toLowerCase()===form.code.trim().toLowerCase()))err.code='Customer code must be unique.';
  if(form.email&&!EMAIL_PATTERN.test(form.email.trim()))err.email='Enter a valid email address.';
  if(form.phone&&!PHONE_PATTERN.test(form.phone.trim()))err.phone='Enter a valid phone number.';
  if(!GST_TREATMENT_VALUES.includes(form.gstTreatment))err.gstTreatment='Select a GST treatment.';
  if(gstinApplicableNow){if(!form.gstin.trim())err.gstin='Enter the '+gstinLabel(form.gstTreatment)+' for this GST treatment.';else if(!decoded.valid)err.gstin=decoded.reason}
  else if(form.gstin.trim()&&!decodeGstin(form.gstin).valid)err.gstin=decodeGstin(form.gstin).reason;
  if(form.pan.trim()&&!PAN_PATTERN.test(form.pan.trim()))err.pan='Use PAN format ABCDE1234F.';
  else if(panRequired(form.gstTreatment)&&!form.pan.trim())err.pan='Enter the PAN for this GST treatment.';
  if(placeOfSupplyApplicable(form.gstTreatment)){if(!form.state.trim())err.state='Select the place of supply.';}
  else if(!form.billingAddress.country.trim())err.billingCountry='Select the customer country.';
  if(form.billingAddress.pin.trim()&&!PIN_PATTERN.test(form.billingAddress.pin.trim()))err.billingPin='Enter a valid 6-digit PIN code.';
  if(!form.shippingSameAsBilling&&form.shippingAddress.pin.trim()&&!PIN_PATTERN.test(form.shippingAddress.pin.trim()))err.shippingPin='Enter a valid 6-digit PIN code.';
  if(exemptionRequired(form.taxPreference)&&!form.exemptionReason.trim())err.exemptionReason='Enter the exemption reason.';
  for(const key of ['limit','opening']){if(form[key]===''||!Number.isFinite(Number(form[key]))||Number(form[key])<0)err[key]='Enter a non-negative number.';}
  const days=paymentTermDays(form.paymentTerms,form.days);
  if(!Number.isInteger(days)||days<0)err.days='Credit days must be a whole number.';
  if(form.openingDate&&!/^\d{4}-\d{2}-\d{2}$/.test(form.openingDate))err.openingDate='Enter a valid opening balance date.';
  for(const contact of form.contacts){
   const name=contactName(contact);
   if(!name){err['contactName:'+contact.id]='Enter a contact name.';continue}
   if(contact.email&&!EMAIL_PATTERN.test(contact.email.trim()))err['contactEmail:'+contact.id]='Enter a valid email address.';
   if(contact.phone&&!PHONE_PATTERN.test(contact.phone.trim()))err['contactPhone:'+contact.id]='Enter a valid phone number.';
  }
  if(!receivables.some(x=>x[0]===form.account))err.account='Select a receivable account.';
  setErrors(err);
  if(Object.keys(err).length){if(Object.keys(err).some(key=>!TOP_LEVEL_ERRORS.has(key)))setMoreOpen(true);return}
  /* One primary contact is guaranteed, and the stored single `contact` string - which the
     register search, the detail page and the sales screens read - is its display name. */
  const contacts=normaliseContacts(form.contacts);
  const primary=primaryContact(contacts);
  const row={...form,
   name:form.name.trim(),
   displayName:(form.displayName||'').trim()||form.name.trim(),
   code:form.code.trim().toUpperCase(),
   gstin:(form.gstin||'').trim().toUpperCase(),
   pan:(form.pan||'').trim().toUpperCase(),
   legalName:(form.legalName||'').trim(),
   tradeName:(form.tradeName||'').trim(),
   gstStatus:(form.gstStatus||'').trim(),
   taxpayerType:(form.taxpayerType||'').trim(),
   principalAddress:(form.principalAddress||'').trim(),
   gstLookup:form.gstLookup||null,
   email:(form.email||'').trim(),
   phone:(form.phone||'').trim(),
   website:(form.website||'').trim(),
   /* An overseas customer sits outside the Indian place-of-supply rules, so the country the
      operator picked is what the invoice and sales-order screens read as the place of supply. */
   state:placeOfSupplyApplicable(form.gstTreatment)?(form.state||'').trim():(form.billingAddress.country||'').trim(),
   exemptionReason:exemptionRequired(form.taxPreference)?(form.exemptionReason||'').trim():'',
   tags:form.tags||'',
   notes:form.notes||'',
   billingAddress:{...form.billingAddress,line1:form.billingAddress.line1.trim(),line2:form.billingAddress.line2.trim(),city:form.billingAddress.city.trim(),pin:form.billingAddress.pin.trim()},
   shippingAddress:{...form.shippingAddress,line1:form.shippingAddress.line1.trim(),line2:form.shippingAddress.line2.trim(),city:form.shippingAddress.city.trim(),pin:form.shippingAddress.pin.trim()},
   billing:composeAddress(form.billingAddress),
   shipping:form.shippingSameAsBilling?composeAddress(form.billingAddress):composeAddress(form.shippingAddress),
   limit:String(form.limit),
   opening:String(form.opening),
   days:String(days),
   contacts,
   contact:contacts.length?contactName(primary):(individual?form.name.trim():''),
   customFields:form.customFields,
   id:form.id||crypto.randomUUID(),
   auditTrail:[...trail(form),audit(form.id?'Customer updated':'Customer created')]};
  const next=form.id?rows.map(x=>x.id===form.id?row:x):[row,...rows];
  if(!persist(next)){setErrors({save:'Unable to save. Browser storage may be full or unavailable.'});return}
  setForm(null);notify(form.id?'Customer updated':'Customer created');/* The document that sent the operator here is waiting, with its draft stashed and its customer snapshot about to be refreshed. */const back=sessionStorage.getItem('wayvida-return-to');if(back){sessionStorage.removeItem('wayvida-return-to');onNavigate(back)}
 }
 const toggleStatus=customer=>{const deactivating=customer.status==='Active';const next=rows.map(row=>row.id===customer.id?{...row,status:deactivating?'Inactive':'Active',auditTrail:[...trail(row),audit(deactivating?'Customer deactivated':'Customer activated')]}:row);closeCustomerMenus();if(!persist(next)){notify('Unable to update this customer. Browser storage may be unavailable.');return}notify(deactivating?customer.name+' is now inactive':customer.name+' is now active')};
 const duplicateCustomer=customer=>{const copy={...structuredClone(customer),id:crypto.randomUUID(),name:customer.name+' Copy',code:nextCustomerCode(rows),auditTrail:[audit('Customer duplicated','Created from '+customer.name)]};closeCustomerMenus();if(!persist([copy,...rows])){notify('Unable to duplicate this customer. Browser storage may be unavailable.');return}notify('Customer duplicated')};
 /* A customer that already appears on a document is never deleted - the documents would be left pointing at a
     missing master. Deactivation is the supported way to retire a customer that has history. */
 const referenceCount=id=>[live.invoices,live.payments,live.receipts,live.creditNotes,readSalesOrders()].reduce((total,list)=>total+(Array.isArray(list)?list.filter(row=>row&&(row.customerId===id||row.customer===id)).length:0),0);
 const deleteCustomer=customer=>{closeCustomerMenus();if(referenceCount(customer.id)){notify(customer.name+' has transactions. Mark the customer inactive instead.');return}if(!window.confirm('Delete '+customer.name+'? This cannot be undone.'))return;if(!persist(rows.filter(row=>row.id!==customer.id))){notify('Unable to delete this customer. Browser storage may be unavailable.');return}if(selectedId===customer.id)setSelectedId('');notify('Customer deleted')};
 const field=(key,label,{type='text',options=null,hint='',autoFocus=false,wide=false}={})=>{
  const error=errors[key];
  const control=options
   ?<select value={form[key]} onChange={e=>update(key,e.target.value)} aria-invalid={!!error}>{options.map(option=>Array.isArray(option)?<option key={option[0]} value={option[0]}>{option[1]}</option>:<option key={option}>{option}</option>)}</select>
   :type==='textarea'
   ?<textarea value={form[key]} onChange={e=>update(key,e.target.value)} aria-invalid={!!error}/>
   :<input autoFocus={autoFocus} type={type} min={type==='number'?0:undefined} step={type==='number'?(key==='days'?1:'0.01'):undefined} value={form[key]} onChange={e=>update(key,['pan','gstin'].includes(key)?e.target.value.toUpperCase():e.target.value)} aria-invalid={!!error}/>;
  return <label key={key} className={wide?'itemFieldWide':undefined}>{label}{control}{hint&&<small className="itemHint">{hint}</small>}{error&&<small className="itemError">{error}</small>}</label>;
 };
 /* Billing and shipping share one renderer so both address blocks keep identical markup
    and the same validation error keys (`billingPin`, `shippingPin`). */
 const addressField=(which,key,label,{type='text',options=null}={})=>{
  const address=which==='billing'?form.billingAddress:form.shippingAddress;
  const error=errors[which+(key==='line1'?'Address':key==='pin'?'Pin':key[0].toUpperCase()+key.slice(1))];
  const set=value=>changeAddress(which,key,value);
  const control=options
   ?<select value={address[key]} onChange={e=>set(e.target.value)} aria-invalid={!!error}>{options.map(option=>Array.isArray(option)?<option key={option[0]} value={option[0]}>{option[1]}</option>:<option key={option}>{option}</option>)}</select>
   :<input type={type} inputMode={key==='pin'?'numeric':undefined} maxLength={key==='pin'?6:undefined} value={address[key]} onChange={e=>set(key==='pin'?e.target.value.replace(/\D/g,''):e.target.value)} aria-invalid={!!error}/>;
  return <label key={which+key}>{label}{control}{error&&<small className="itemError">{error}</small>}</label>;
 };
 /* Derived form state. Every value is guarded because the register render runs with no form open. */
 const treatment=gstTreatmentMeta(form?form.gstTreatment:DEFAULT_TREATMENT);
 const showGstin=!!form&&gstinApplicable(form.gstTreatment);
 const panIsRequired=!!form&&panRequired(form.gstTreatment);
 const taxpayerVerified=!!form&&!!form.gstin&&decodeGstin(form.gstin).valid;
 const showTaxpayerNames=!!form&&treatment.business&&taxpayerVerified;
 const showPlaceOfSupply=!!form&&placeOfSupplyApplicable(form.gstTreatment);
 const countryIsRequired=!!form&&countryRequired(form.gstTreatment);
 const treatmentHint=form?treatmentNote(form.gstTreatment):'';
 const formNameLabel=form&&form.type==='Individual'?'Customer name':'Company name';
 /* The register filters are additive on top of the search box and the status select that stay visible in the
    toolbar: Type and the stored GST treatment, place of supply and payment terms come from the record itself, and
    Balance is evaluated on the computed credit summary, so it can only run after that map. */
 const customerTypeOptions=['All types',...CUSTOMER_TYPES];
 const customerStateOptions=['All states',...Array.from(new Set(rows.map(row=>row.state).filter(Boolean))).sort((left,right)=>left.localeCompare(right))];
 const customerTreatmentOptions=['All GST treatments',...GST_TREATMENTS.map(item=>item.value)];
 const customerTermOptions=['All payment terms',...PAYMENT_TERMS];
 const activeFilterCount=Object.values(filters).filter(value=>!value.startsWith('All ')).length;
 const visible=rows.filter(x=>[x.name,x.code,x.email,x.contact,x.phone].join(' ').toLowerCase().includes(query.toLowerCase())&&(status==='All statuses'||x.status===status)&&(filters.type==='All types'||(x.type||'Business')===filters.type)&&(filters.state==='All states'||x.state===filters.state)&&(filters.gstTreatment==='All GST treatments'||x.gstTreatment===filters.gstTreatment)&&(filters.paymentTerms==='All payment terms'||x.paymentTerms===filters.paymentTerms)).map(x=>({...x,credit:customerCreditSummary(live,x.id)})).filter(x=>filters.balance==='All balances'||(filters.balance==='With outstanding'?x.credit.outstanding>0:x.credit.outstanding<=0));
 const selected=rows.find(row=>row.id===selectedId)||null;
 if(selected){
  const credit=customerCreditSummary(live,selected.id),entries=customerStatement(live,selected.id),history=[...trail(selected)].reverse();
  return <section className="itemsPage customersPage customerDetailPage">
   <div className="customerDetailHead"><button type="button" className="customerBack" aria-label="Back to Customers" onClick={()=>{setSelectedId('');setDetailTab(DEFAULT_TAB)}}><IconArrowLeft size={19}/></button><h1>Customer Details</h1></div>
   <div className="customerDetailBody">
    <section className="customerDetailPanel">
     <div className="customerDetailIdentity">
      <span><IconUsers size={26}/></span>
      <div className="customerDetailName"><h2>{selected.name}</h2><p>{selected.code||'No customer code'} · {selected.type||'Business'} · {Number(selected.days||0)} credit days</p></div>
      <div className="customerDetailActions"><StatusPill status={selected.status||'Active'} tone={selected.status==='Inactive'?'neutral':'ok'}/>
       <button type="button" className="customerDetailEdit" onClick={()=>start(selected)}><IconEdit size={16}/>Edit Customer</button>
       <details className="customerKebab customerDetailMore"><summary aria-label="More customer actions"><IconDots size={17}/></summary>
        <div className="customerMoreMenu">
         <button type="button" onClick={()=>{closeCustomerMenus();setDetailTab('Transactions')}}><IconReceipt size={16}/>View transactions</button>
         <button type="button" onClick={()=>openStatement(selected)}><IconBook2 size={16}/>Statement & credits</button>
         <button type="button" onClick={()=>toggleStatus(selected)}>{selected.status==='Active'?<IconBan size={16}/>:<IconCircleCheck size={16}/>}{selected.status==='Active'?'Deactivate Customer':'Activate Customer'}</button>
         <button type="button" onClick={()=>duplicateCustomer(selected)}><IconCopy size={16}/>Duplicate Customer</button>
         <button type="button" className="customerDanger" onClick={()=>deleteCustomer(selected)}><IconTrash size={16}/>Delete Customer</button>
        </div>
       </details>
      </div>
     </div>
     <nav className="customerDetailTabs" aria-label="Customer detail sections">{DETAIL_TABS.map(tab=><button type="button" key={tab} className={detailTab===tab?'active':''} aria-current={detailTab===tab?'page':undefined} onClick={()=>setDetailTab(tab)}>{tab}{tab==='Transactions'&&<span>{entries.length}</span>}{tab==='History'&&<span>{history.length}</span>}</button>)}</nav>
    </section>

    {detailTab==='Basic Data'&&<div className="customerDetailCardsGrid">
     <section className="customerDetailCard">
      <div className="customerDetailSectionTitle"><IconUsers size={18}/><h2>Customer details</h2></div>
      <dl className="customerDetailFacts">
       <div><dt>Customer code</dt><dd>{selected.code||'—'}</dd></div>
       <div><dt>Customer type</dt><dd>{selected.type||'Business'}</dd></div>
       <div><dt>Status</dt><dd>{selected.status||'Active'}</dd></div>
       <div><dt>Contact person</dt><dd>{selected.contact||'Not provided'}</dd></div>
       <div><dt>Email</dt><dd>{selected.email||'Not provided'}</dd></div>
       <div><dt>Phone</dt><dd>{selected.phone||'Not provided'}</dd></div>
      </dl>
     </section>
     <section className="customerDetailCard">
      <div className="customerDetailSectionTitle"><IconInfoCircle size={18}/><h2>Addresses & tax information</h2></div>
      <dl className="customerDetailFacts">
       <div><dt>Billing address</dt><dd className="customerAddress">{selected.billing||'Not provided'}</dd></div>
       <div><dt>Shipping address</dt><dd className="customerAddress">{selected.shipping||selected.billing||'Not provided'}</dd></div>
       <div><dt>State / place of supply</dt><dd>{selected.state||'Not provided'}</dd></div>
       <div><dt>PAN</dt><dd>{selected.pan||'Not provided'}</dd></div>
       <div><dt>GSTIN</dt><dd>{selected.gstin||'Not registered'}</dd></div>
      </dl>
     </section>
     <section className="customerDetailCard">
      <div className="customerDetailSectionTitle"><IconReceipt size={18}/><h2>Credit & receivable</h2></div>
      <dl className="customerDetailFacts">
       <div><dt>Credit limit</dt><dd>{money(selected.limit)}</dd></div>
       <div><dt>Credit days</dt><dd>{Number(selected.days||0)} days</dd></div>
       <div><dt>Opening balance</dt><dd>{money(selected.opening)}</dd></div>
       <div><dt>Receivable account</dt><dd>{accountName(selected.account)}</dd></div>
       <div><dt>Net receivable</dt><dd>{money(credit.outstanding/100)}</dd></div>
       <div><dt>Available credit</dt><dd>{money(credit.available/100)}</dd></div>
      </dl>
     </section>
    </div>}    {detailTab==='Transactions'&&<section className="customerDetailCard">
     <div className="customerDetailSectionTitle"><IconReceipt size={18}/><h2>Transactions</h2><span>{entries.length}</span><button type="button" className="customerStatementLink" onClick={()=>openStatement(selected)}>Open customer statement</button></div>
     {entries.length?<div className="customerDetailTableWrap">
      <table>
       <thead><tr><th>Date</th><th>Reference</th><th>Source</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
       <tbody>{entries.map(row=><tr key={row.id}><td>{row.date||'—'}</td><td>{row.reference||'—'}</td><td>{row.source||'—'}</td><td>{row.debit?money(row.debit):'—'}</td><td>{row.credit?money(row.credit):'—'}</td><td>{money(row.balance)}</td></tr>)}</tbody>
      </table>
     </div>:<p className="customerDetailEmpty">No transactions reference this customer yet.</p>}
     <p className="customerDetailNote">Posted invoices, receipts, credit notes and their credit allocations from the shared ledger.</p>
    </section>}

    {detailTab==='History'&&<section className="customerDetailCard">
     <div className="customerDetailSectionTitle"><IconHistory size={18}/><h2>Audit log / History</h2><span>{history.length}</span></div>
     {history.length?<ol className="customerHistory">
      {history.map(entry=><li key={entry.id}>
       <span/>
       <div>
        <b>{entry.action}</b>
        {entry.detail?<p>{entry.detail}</p>:null}
        <small>{entry.at?new Date(entry.at).toLocaleString('en-IN'):'Not recorded'} · {entry.actor||'Admin'}</small>
       </div>
      </li>)}
     </ol>:<p className="customerDetailEmpty">No customer history has been recorded yet.</p>}
    </section>}
   </div>
  </section>;
 } const importRef=useRef(null);
 /* Import is all or nothing: every row is held to the same rules the form saves with - a name, a unique
    code, the email and phone patterns, an allowed GST treatment and a valid GSTIN when the treatment
    carries one - and nothing is written unless the whole file passes. */
 async function importCustomers(file){
  try{
   if(file.size>1024*1024)throw Error('Choose a CSV smaller than 1 MB.');
   const table=parseCustomerCSV(await file.text());
   const header=(table.shift()||[]).map(value=>String(value).trim().toLowerCase());
   if(!header.includes('name'))throw Error('CSV needs a Name column. Use: '+CUSTOMER_IMPORT_COLUMNS+'.');
   if(!table.length)throw Error('No customer rows found in this file.');
   const at=(cells,key)=>{const index=header.indexOf(key);return index<0?'':String(cells[index]==null?'':cells[index]).trim()};
   const created=[],problems=[];
   table.forEach((cells,index)=>{
    const name=at(cells,'name'),treatment=GST_TREATMENT_VALUES.includes(at(cells,'gst treatment'))?at(cells,'gst treatment'):'Unregistered Business',gstin=at(cells,'gstin'),email=at(cells,'email'),phone=at(cells,'phone');
    const code=at(cells,'code')||nextCustomerCode([...rows,...created]);
    const billing=at(cells,'billing address'),shipping=at(cells,'shipping address')||billing;
    const record={...empty,id:crypto.randomUUID(),name,code,contact:at(cells,'contact'),email,phone,gstin,gstTreatment:treatment,state:at(cells,'state'),billing,shipping,billingAddress:parseAddress(billing),shippingAddress:parseAddress(shipping),limit:at(cells,'credit limit'),status:at(cells,'status').toLowerCase()==='inactive'?'Inactive':'Active'};
    const fault=[];
    if(!name)fault.push('enter the customer name');
    if([...rows,...created].some(x=>String(x.code||'').toLowerCase()===code.toLowerCase()))fault.push('the customer code '+code+' is already used');
    if(email&&!EMAIL_PATTERN.test(email))fault.push('enter a valid email address');
    if(phone&&!PHONE_PATTERN.test(phone))fault.push('enter a valid phone number');
    if(gstinApplicable(treatment)){if(!gstin)fault.push('enter the GSTIN for this GST treatment');else if(!decodeGstin(gstin).valid)fault.push(decodeGstin(gstin).reason)}
    if(fault.length)problems.push('Row '+(index+2)+': '+fault[0]+'.');else created.push(record);
   });
   if(problems.length)throw Error(problems.slice(0,2).join(' ')+(problems.length>2?' +'+(problems.length-2)+' more':''));
   persist([...created,...rows]);
   notify&&notify('Imported '+created.length+' '+(created.length===1?'customer':'customers'));
  }catch(error){notify&&notify(error.message)}
 }
 const closeMenu=event=>event.currentTarget.closest('details')?.removeAttribute('open');
 const pickImport=event=>{closeMenu(event);importRef.current?.click()};
 const pickExport=event=>{closeMenu(event);exportList()};
 const readImport=async event=>{const file=event.target.files?.[0];event.target.value='';if(file)await importCustomers(file)};
 /* The register export writes the rows the reader is looking at, with the columns the grid shows. */
 const exportList=()=>{const quote=value=>'"'+String(value==null?'':value).replaceAll('"','""')+'"';const content=[['Name','Code','Contact','Email','Phone','GSTIN','State','Credit limit','Status'],...visible.map(row=>[row.name,row.code,row.contact,row.email,row.phone,row.gstin,row.state,row.limit,row.status])].map(line=>line.map(quote).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download='wayvida-customers.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify&&notify('Customer list exported as CSV')};
 return <section className="itemsPage customersPage"><div className="itemsHeading registerHead"><div className="registerHeadText"><h2>Customers <span className="registerHeadCount">({rows.length})</span></h2><p>Manage customer contacts, addresses and credit terms.</p></div><div className="itemsTools"><label><IconSearch size={18}/><input aria-label="Search customers" placeholder="Search name, code, contact or email…" value={query} onChange={e=>setQuery(e.target.value)}/></label><details className="customerFilters"><summary aria-label="Open filters"><IconFilter size={17}/>Filters{activeFilterCount>0&&<em className="customerFilterBadge">{activeFilterCount}</em>}</summary><div className="customerFilterPanel"><label className="customerFilterField"><span>Status</span><select aria-label="Filter customer status" value={status} onChange={e=>setStatus(e.target.value)}>{['All statuses','Active','Inactive'].map(x=><option key={x}>{x}</option>)}</select></label><label className="customerFilterField"><span>Type</span><select value={filters.type} onChange={e=>setFilters({...filters,type:e.target.value})}>{customerTypeOptions.map(x=><option key={x}>{x}</option>)}</select></label><label className="customerFilterField"><span>State / place of supply</span><select value={filters.state} onChange={e=>setFilters({...filters,state:e.target.value})}>{customerStateOptions.map(x=><option key={x}>{x}</option>)}</select></label><label className="customerFilterField"><span>GST treatment</span><select value={filters.gstTreatment} onChange={e=>setFilters({...filters,gstTreatment:e.target.value})}>{customerTreatmentOptions.map(x=><option key={x}>{x}</option>)}</select></label><label className="customerFilterField"><span>Payment terms</span><select value={filters.paymentTerms} onChange={e=>setFilters({...filters,paymentTerms:e.target.value})}>{customerTermOptions.map(x=><option key={x}>{x}</option>)}</select></label><label className="customerFilterField"><span>Balance</span><select value={filters.balance} onChange={e=>setFilters({...filters,balance:e.target.value})}>{BALANCE_FILTERS.map(x=><option key={x}>{x}</option>)}</select></label><div className="customerFilterActions"><button type="button" onClick={()=>{setFilters(CUSTOMER_FILTER_DEFAULTS);setStatus("All statuses")}}>Clear filters</button></div></div></details></div><div className="itemsActions"><div className="registerSplit"><button type="button" className="primary registerSplitMain" onClick={()=>start()}><IconPlus size={18}/>Create Customer</button><details className="registerSplitMore"><summary aria-label="More customer actions" title="More customer actions"><IconChevronDown size={16}/></summary><div><button type="button" onClick={pickImport}><IconUpload size={16}/>Import</button><button type="button" onClick={pickExport}><IconDownload size={16}/>Export</button></div></details></div><input ref={importRef} type="file" accept=".csv,text/csv" hidden onChange={readImport}/></div></div><div className="itemsCard"><div className="itemsTableWrap"><table><thead><tr>{['Customer Details','Type','Email / Phone','Net receivable','Available credit','Status','Actions'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{visible.map(x=><tr key={x.id}><td><div className="itemIdentity"><span><IconUsers size={20}/></span><span className="itemIdentityCopy"><b>{x.name}</b><small>{x.code||'No customer code'}</small></span></div></td><td>{x.type||'Business'}</td><td><div className="customerContact"><span>{x.email||'—'}</span><small>{x.phone||'—'}</small></div></td><td>{money(x.credit.outstanding/100)}</td><td>{money(x.credit.available/100)}</td><td><StatusPill status={x.status||'Active'} tone={x.status==='Inactive'?'neutral':'ok'}/></td><td className="customerActionsCell"><div className="customerRowActions"><button type="button" className="customerView" onClick={()=>openDetail(x)}><IconEye size={16}/>View Customer</button><details className="customerKebab"><summary aria-label={'More actions for '+x.name}><IconDots size={17}/></summary><div className="customerMoreMenu"><button type="button" onClick={()=>start(x)}><IconEdit size={16}/>Edit Customer</button><button type="button" onClick={()=>toggleStatus(x)}>{x.status==='Active'?<IconBan size={16}/>:<IconCircleCheck size={16}/>}{x.status==='Active'?'Deactivate Customer':'Activate Customer'}</button><button type="button" onClick={()=>duplicateCustomer(x)}><IconCopy size={16}/>Duplicate Customer</button><button type="button" className="customerDanger" onClick={()=>deleteCustomer(x)}><IconTrash size={16}/>Delete Customer</button></div></details></div></td></tr>)}</tbody></table>{!visible.length&&<div className="itemsEmpty"><IconUsers size={32}/><h3>No customers found</h3><p>Try another search or create a customer.</p></div>}</div></div> {form&&<form className="itemCreatePage" aria-labelledby="customerDialogTitle" onSubmit={save} noValidate>
 <div className="itemDialogHead"><button type="button" className="itemBack" aria-label="Back to Customers" onClick={()=>setForm(null)}><IconArrowLeft size={19}/></button><div className="itemHeadText"><h2 id="customerDialogTitle">{form.id?'Edit Customer':'Create Customer'}</h2>{form.id&&<small className="itemHeadHint">Editing <b>{form.name||form.code}</b></small>}</div></div>
 <div className="itemDialogBody">
  <section className="itemSection">
   <div className="itemSectionTitle">Customer details</div>
   <fieldset className="itemTypeField"><legend>Customer type *</legend><div className="itemRadioGroup">{CUSTOMER_TYPES.map(value=><label key={value}><input type="radio" name="customer-type" value={value} checked={form.type===value} onChange={()=>changeType(value)}/><span>{value}</span></label>)}</div></fieldset>
   <div className="itemFormGrid">{field('name',formNameLabel+' *',{autoFocus:!form.id})}{field('code','Customer code *')}{field('email','Email',{type:'email'})}{field('phone','Phone',{type:'tel'})}</div>
  </section>
  <section className="itemSection">
   <div className="itemSectionTitle">GST &amp; Tax Details</div>
   <div className="itemFormGrid">
    {field('gstTreatment','GST treatment *',{options:GST_TREATMENTS.map(row=>[row.value,row.value])})}
    {showGstin&&<label className="itemFieldAction">{gstinLabel(form.gstTreatment)+' *'}<span className="itemInputAction"><input value={form.gstin} onChange={e=>{update('gstin',e.target.value.toUpperCase());setLookup(null)}} aria-invalid={!!errors.gstin}/><button type="button" onClick={fetchTaxpayer} disabled={lookupBusy}>{lookupBusy?'Fetching…':'Get Taxpayer Details'}</button></span>{lookup&&lookup.state==='ok'&&<small className="customerGstFetched"><IconCircleCheck size={14}/>GST details fetched successfully</small>}{errors.gstin&&<small className="itemError">{errors.gstin}</small>}</label>}
    {showTaxpayerNames&&field('legalName','Business legal name',{hint:'Not carried inside the GSTIN.'})}
    {showTaxpayerNames&&field('tradeName','Business trade name')}
    {showTaxpayerNames&&field('gstStatus','GST status')}
    {showTaxpayerNames&&field('taxpayerType','Registration / taxpayer type')}
    {showPlaceOfSupply&&<div className="customerSelectField"><span className="customerSelectLabel">Place of supply *</span><SearchSelect value={form.state} options={customerStates} onChange={value=>update('state',value)} placeholder="Search and select state" listLabel="States and union territories" error={errors.state}/>{errors.state&&<small className="itemError">{errors.state}</small>}</div>}
    {field('pan',panIsRequired?'PAN *':'PAN')}
    {field('taxPreference','Taxability',{options:TAXABILITY})}
    {exemptionRequired(form.taxPreference)&&field('exemptionReason','Exemption reason *')}
    {showTaxpayerNames&&field('principalAddress','Principal business address',{type:'textarea',wide:true})}
   </div>
   {treatmentHint&&<p className="itemHint customerTreatmentNote">{treatmentHint}</p>}
   {countryIsRequired&&<p className="itemHint customerTreatmentNote">GSTIN does not apply to an overseas customer. The country in the billing address below is recorded as the place of supply.</p>}
   {lookup&&<p className={'itemNotice customerTaxNotice '+lookup.state} role={lookup.state==='error'?'alert':'status'}>{lookup.state==='ok'?<IconCircleCheck size={16}/>:<IconInfoCircle size={16}/>}{lookup.message}</p>}
  </section>
  <section className="itemSection">
   <div className="itemSectionTitle">Billing address</div>
   <div className="itemFormGrid">{addressField('billing','line1','Address 1')}{addressField('billing','line2','Address 2')}{addressField('billing','city','City')}{addressField('billing','state','State',{options:customerStates})}{addressField('billing','pin','PIN code')}{addressField('billing','country','Country',{options:COUNTRIES})}</div>
   <label className="itemCheck customerSameAddress"><input type="checkbox" role="switch" checked={form.shippingSameAsBilling} onChange={e=>toggleShippingSame(e.target.checked)}/><span><b>Shipping address same as billing</b><small>Clear this to deliver to a different address.</small></span></label>
   {!form.shippingSameAsBilling&&<div className="itemFormGrid">{addressField('shipping','line1','Address 1')}{addressField('shipping','line2','Address 2')}{addressField('shipping','city','City')}{addressField('shipping','state','State',{options:customerStates})}{addressField('shipping','pin','PIN code')}{addressField('shipping','country','Country',{options:COUNTRIES})}</div>}
  </section>
  <details className="itemAdvanced" open={moreOpen} onToggle={e=>setMoreOpen(e.currentTarget.open)}>
   <summary>More details <span>Optional</span></summary>
   <div className="itemAdvancedGroup">
    <div className="itemAdvancedTitle">Payment &amp; accounting</div>
    <div className="itemFormGrid">{field('currency','Currency',{options:CURRENCIES})}{field('paymentTerms','Payment terms',{options:PAYMENT_TERMS})}{form.paymentTerms==='Custom'&&field('days','Credit days *',{type:'number'})}{field('limit','Credit limit (₹)',{type:'number'})}{field('account','Receivable account *',{options:[['','Select account'],...receivables.map(x=>[x[0],`${x[0]} — ${x[1]}`])],hint:'Transactions with this customer will be posted to this account.'})}{field('status','Status',{options:CUSTOMER_STATUSES})}</div>
   </div>
   <div className="itemAdvancedGroup">
    <div className="itemAdvancedTitle">Opening balance</div>
    <div className="itemFormGrid">{field('opening','Opening balance (₹)',{type:'number',hint:'What the customer already owes the business.'})}{field('openingDate','Opening balance date',{type:'date'})}</div>
    <p className="itemNotice"><IconInfoCircle size={16}/>Opening balances establish the customer's outstanding balance - the amount owed to the business as on the date above. They do not create a journal entry until posted or confirmed, and they are recorded against the receivable account.</p>
   </div>
   <div className="itemAdvancedGroup">
    {form.contacts.length?<ul className="customerContacts">{form.contacts.map((contact,index)=><li key={contact.id}><div className="itemFormGrid customerContactRow"><label>First name<input value={contact.firstName} onChange={e=>updateContact(contact.id,'firstName',e.target.value)}/>{errors['contactName:'+contact.id]&&<small className="itemError">{errors['contactName:'+contact.id]}</small>}</label><label>Last name<input value={contact.lastName} onChange={e=>updateContact(contact.id,'lastName',e.target.value)}/></label><label>Email<input type="email" value={contact.email} onChange={e=>updateContact(contact.id,'email',e.target.value)}/>{errors['contactEmail:'+contact.id]&&<small className="itemError">{errors['contactEmail:'+contact.id]}</small>}</label><label>Phone<input type="tel" value={contact.phone} onChange={e=>updateContact(contact.id,'phone',e.target.value)}/>{errors['contactPhone:'+contact.id]&&<small className="itemError">{errors['contactPhone:'+contact.id]}</small>}</label><label>Designation<input value={contact.designation} onChange={e=>updateContact(contact.id,'designation',e.target.value)}/></label><div className="customerContactTools"><button type="button" className={'customerPrimaryToggle'+(contact.primary?' active':'')} aria-pressed={contact.primary} onClick={()=>setForm(current=>({...current,contacts:setPrimaryContact(current.contacts,contact.id)}))}>{contact.primary&&<IconCheck size={15}/>}{contact.primary?'Primary Contact':'Set as Primary Contact'}</button><button type="button" className="customerContactRemove" aria-label={'Remove contact '+(index+1)} onClick={()=>removeContact(contact.id)}><IconTrash size={16}/></button></div></div></li>)}</ul>:null}
    <button type="button" className="copyAddress" onClick={addContact}><IconPlus size={16}/>Add Contact Person</button>
   </div>
   <div className="itemAdvancedGroup">
    <div className="itemAdvancedTitle">Documents</div>
    <div className="itemImageField"><label className="itemImageUpload"><input type="file" multiple onChange={e=>{addDocuments(e.target.files);e.target.value=''}}/><span className="itemImageIcon"><IconPaperclip size={20}/></span><span className="itemImageCopy"><b>{form.documents.length?'Add more documents':'Attach documents'}</b><small>You can upload up to 10 files, 10 MB each.</small></span><span className="itemImageChoose">Browse</span></label>{form.documents.length?<ul className="customerDocuments">{form.documents.map(file=><li key={file.id}><span>{file.name}</span><small>{fileSize(file.size)}</small><button type="button" onClick={()=>removeDocument(file.id)}>Remove</button></li>)}</ul>:null}{documentNotice&&<small className="itemError">{documentNotice}</small>}</div>
   </div>
  </details>
  {errors.save&&<p className="itemError itemSaveError" role="alert">{errors.save}</p>}
 </div>
 <footer className="itemDialogFooter"><button type="button" onClick={()=>setForm(null)}>Cancel</button><button className="primary">{form.id?'Save changes':'Create Customer'}</button></footer>
</form>}
</section>;
}
