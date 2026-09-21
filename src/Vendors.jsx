import {useMemo,useState} from 'react';
import {IconBuildingStore,IconPlus,IconSearch,IconFilter,IconEdit,IconReceipt,IconBook2,IconArrowLeft,IconInfoCircle,IconPaperclip,IconTrash,IconBuildingBank} from '@tabler/icons-react';
import {readVendors,writeVendors,nextVendorCode,validateVendor,vendorDefaults} from './vendor-store.js';
import {KEY,initial} from './invoice-engine.js';
import {vendorOutstanding,vendorLedger} from './purchase-service.js';
import {customerStates} from './Customers.jsx';
import {COUNTRIES} from './customer-tax.js';
import StatusPill from './StatusPill.jsx';
import EmptyState from './EmptyState.jsx';
import VendorRowActions from './VendorRowActions.jsx';
import './items.css';
import './vendors.css';

const types=['Supplier','Service Provider','Contractor','Manufacturer','Distributor','Other'];
const terms=['Due Immediately','15 Days','30 Days','45 Days','60 Days'];
const modes=['Bank Transfer','UPI','Cheque','Cash','Card','Other'];
const money=n=>Number(n||0).toLocaleString('en-IN',{style:'currency',currency:'INR'});

/* The create form is the shared Create Item / Create Customer page (`form.itemCreatePage` in
   src/items.css), so its structure, its control tokens and its field errors follow
   src/Customers.jsx. Only the vendor's own field list is new. */
const ADDRESS_KEYS=['line1','line2','city','state','country','pin'];
const sameAddress=(left,right)=>ADDRESS_KEYS.every(key=>(left?.[key]||'')===(right?.[key]||''));
const stateOptions=[['','Select state'],...customerStates];
const countryOptions=[['','Select country'],...COUNTRIES];
/* Errors the form shows above More details. Any other error came from a field inside that
   collapsed disclosure, so a failed save opens it instead of blocking invisibly. */
const TOP_LEVEL_ERRORS=new Set(['name','phone','email','gstin','pan','tds','save']);

/* Vendor lifecycle on the one shared pill, like every other register and detail screen. */
const VENDOR_TONES=value=>{const s=String(value||'').toLowerCase();if(/blocked|inactive/.test(s))return 'danger';if(/active/.test(s))return 'ok';return 'neutral'};
/* The table columns hold pairs of facts the way the other registers do. */
const VENDOR_TABS=['Overview','Transactions','Documents','Audit Trail'];

export default function Vendors({accounts={},notify=()=>{},onNavigate=()=>{}}){
 const [rows,setRows]=useState(()=>readVendors()),[query,setQuery]=useState(''),[status,setStatus]=useState('All statuses'),[form,setForm]=useState(null),[selected,setSelected]=useState(null),[tab,setTab]=useState('Overview'),[errors,setErrors]=useState({}),[moreOpen,setMoreOpen]=useState(false),[typeFilter,setTypeFilter]=useState(''),[gstFilter,setGstFilter]=useState(''),[stateFilter,setStateFilter]=useState('');
 const payable=(accounts.Liabilities||[]).filter(x=>/payable/i.test(x[1]));
 const expenses=accounts.Expenses||[];
 const accounting=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')||initial()}catch{return initial()}})();
 const liveRows=rows.map(row=>({...row,balance:vendorOutstanding(accounting,row.id)}));
 const visible=useMemo(()=>liveRows.filter(x=>[x.name,x.code,x.type,x.gstin,x.phone].join(' ').toLowerCase().includes(query.toLowerCase())&&(status==='All statuses'||x.status===status)&&(!typeFilter||x.type===typeFilter)&&(!gstFilter||x.gstTreatment===gstFilter)&&(!stateFilter||x.billing?.state===stateFilter)),[rows,query,status,typeFilter,gstFilter,stateFilter]);
 const activeFilters=[status!=='All statuses',typeFilter,gstFilter,stateFilter].filter(Boolean).length;
 const clearFilters=()=>{setStatus('All statuses');setTypeFilter('');setGstFilter('');setStateFilter('')};
 const ledger=vendorLedger(accounting,selected?.id);
 const update=(key,value)=>setForm(x=>({...x,[key]:value}));
 /* A billing edit keeps the shipping address in step while the switch is on, exactly as
    src/Customers.jsx does, so a saved vendor can never hold two addresses that disagree. */
 const updateAddress=(kind,key,value)=>setForm(x=>{const address={...x[kind],[key]:value};const next={...x,[kind]:address};if(kind==='billing'&&x.shippingSameAsBilling)next.shipping={...address};return next});
 const toggleShippingSame=checked=>setForm(x=>checked?{...x,shippingSameAsBilling:true,shipping:{...x.billing}}:{...x,shippingSameAsBilling:false});
 const attachDocuments=files=>update('attachments',[...(form.attachments||[]),...Array.from(files).map(file=>file.name)].filter((name,index,list)=>list.indexOf(name)===index));
 function start(row){setErrors({});setMoreOpen(false);setSelected(null);const draft=row?{...structuredClone(row),billing:{...vendorDefaults.billing,...row.billing},shipping:{...vendorDefaults.shipping,...row.shipping}}:{...structuredClone(vendorDefaults),code:nextVendorCode(rows),payableAccountId:payable[0]?.[0]||'2000'};setForm({...draft,shippingSameAsBilling:row?draft.shippingSameAsBilling!==false&&sameAddress(draft.billing,draft.shipping):true});}
 function save(e){e.preventDefault();const err=validateVendor(form,rows);setErrors(err);if(Object.keys(err).length){if(Object.keys(err).some(key=>!TOP_LEVEL_ERRORS.has(key)))setMoreOpen(true);return}const now=new Date().toISOString();const record={...form,shipping:form.shippingSameAsBilling?{...form.billing}:form.shipping,id:form.id||crypto.randomUUID(),displayName:form.displayName.trim()||form.name.trim(),name:form.name.trim(),code:form.code.trim().toUpperCase(),balance:Number(form.balance||form.openingBalance||0),createdBy:form.createdBy||'Admin',createdAt:form.createdAt||now,modifiedBy:'Admin',modifiedAt:now};const next=form.id?rows.map(x=>x.id===form.id?record:x):[record,...rows];try{writeVendors(next)}catch{setErrors({save:'Unable to save vendor in browser storage.'});return}setRows(next);setForm(null);notify(form.id?'Vendor updated':'Vendor created and linked to Accounts Payable');}
 function changeStatus(row,value){const next=rows.map(x=>x.id===row.id?{...x,status:value,modifiedBy:'Admin',modifiedAt:new Date().toISOString()}:x);writeVendors(next);setRows(next);notify(row.name+' is now '+value.toLowerCase());}
 /* One field renderer for every vendor input, on the create-page tokens src/items.css already
    defines: a 12px/600 label, a 40px control on a #d7e0eb hairline with a 7px radius, a 13px
    value, an optional hint and the field error. `options` renders a select and accepts either
    plain values or [value,label] pairs. */
 const field=(key,label,{type='text',options=null,hint='',autoFocus=false,wide=false}={})=>{
  const error=errors[key];
  const control=options
   ?<select value={form[key]||''} onChange={e=>update(key,e.target.value)} aria-invalid={!!error}>{options.map(option=>Array.isArray(option)?<option key={option[0]} value={option[0]}>{option[1]}</option>:<option key={option}>{option}</option>)}</select>
   :type==='textarea'
   ?<textarea value={form[key]||''} onChange={e=>update(key,e.target.value)} aria-invalid={!!error}/>
   :<input autoFocus={autoFocus} type={type} min={type==='number'?0:undefined} step={type==='number'?'0.01':undefined} value={form[key]||''} onChange={e=>update(key,['gstin','pan','ifsc'].includes(key)?e.target.value.toUpperCase():e.target.value)} readOnly={key==='code'} aria-invalid={!!error}/>;
  return <label key={key} className={wide?'itemFieldWide':undefined}>{label}{control}{hint&&<small className="itemHint">{hint}</small>}{error&&<small className="itemError">{error}</small>}</label>;
 };
 /* Billing and shipping share one renderer so both address blocks keep identical markup, the
    same state and country options, and the same `billing` / `shipping` storage keys. */
 const addressField=(which,key,label,options=null)=>{
  const control=options
   ?<select value={form[which][key]||''} onChange={e=>updateAddress(which,key,e.target.value)}>{options.map(option=>Array.isArray(option)?<option key={option[0]} value={option[0]}>{option[1]}</option>:<option key={option}>{option}</option>)}</select>
   :<input inputMode={key==='pin'?'numeric':undefined} maxLength={key==='pin'?6:undefined} value={form[which][key]||''} onChange={e=>updateAddress(which,key,key==='pin'?e.target.value.replace(/\D/g,''):e.target.value)}/>;
  return <label key={which+key}>{label}{control}</label>;
 };

 if(form)return <section className="itemsPage vendorsPage">
  <form className="itemCreatePage" aria-labelledby="itemDialogTitle" onSubmit={save} noValidate>
   <div className="itemDialogHead"><button type="button" className="itemBack" aria-label="Back to Vendors" onClick={()=>setForm(null)}><IconArrowLeft size={19}/></button><div className="itemHeadText"><h2 id="itemDialogTitle">{form.id?'Edit Vendor':'Create Vendor'}</h2><small className="itemHeadHint">{form.id?'Editing':'New supplier'} <b>{form.displayName||form.name||form.code}</b></small></div></div>
   <div className="itemDialogBody">
    <section className="itemSection">
     <div className="itemSectionTitle">Vendor details</div>
     <fieldset className="itemTypeField"><legend>Vendor type *</legend><div className="itemRadioGroup">{types.map(value=><label key={value}><input type="radio" name="vendor-type" value={value} checked={form.type===value} onChange={()=>update('type',value)}/><span>{value}</span></label>)}</div></fieldset>
     <div className="itemFormGrid">{field('name','Vendor name *',{autoFocus:!form.id})}{field('code','Vendor code',{hint:'Generated from the vendor register.'})}{field('displayName','Display name')}{field('status','Status',{options:['Active','Inactive','Blocked']})}{field('contactName','Contact person name')}{field('phone','Phone number *',{type:'tel'})}{field('email','Email address',{type:'email'})}{field('website','Website',{type:'url'})}</div>
    </section>
    <section className="itemSection">
     <div className="itemSectionTitle">Billing address</div>
     <div className="itemFormGrid">{addressField('billing','line1','Address line 1')}{addressField('billing','line2','Address line 2')}{addressField('billing','city','City')}{addressField('billing','state','State',stateOptions)}{addressField('billing','pin','PIN code')}{addressField('billing','country','Country',countryOptions)}</div>
     <label className="itemCheck vendorSameAddress"><input type="checkbox" role="switch" checked={!!form.shippingSameAsBilling} onChange={e=>toggleShippingSame(e.target.checked)}/><span><b>Shipping address same as billing</b><small>{form.shippingSameAsBilling?'Goods are delivered to the billing address. Switch this off to record a different shipping address.':'Enter the address the goods are delivered to.'}</small></span></label>
     {!form.shippingSameAsBilling&&<div className="itemFormGrid">{addressField('shipping','line1','Address line 1')}{addressField('shipping','line2','Address line 2')}{addressField('shipping','city','City')}{addressField('shipping','state','State',stateOptions)}{addressField('shipping','pin','PIN code')}{addressField('shipping','country','Country',countryOptions)}</div>}
    </section>
    <section className="itemSection">
     <div className="itemSectionTitle">Tax &amp; payment information</div>
     <div className="vendorSwitchGrid"><label className="itemCheck vendorSwitchRow"><span><b>GST registered</b><small>Collect the GSTIN and the treatment for this vendor.</small></span><input type="checkbox" role="switch" checked={!!form.gstRegistered} onChange={e=>update('gstRegistered',e.target.checked)}/></label><label className="itemCheck vendorSwitchRow"><span><b>TDS applicable</b><small>Withhold tax on the payments made to this vendor.</small></span><input type="checkbox" role="switch" checked={!!form.tdsApplicable} onChange={e=>update('tdsApplicable',e.target.checked)}/></label></div>
     <div className="itemFormGrid">{form.gstRegistered&&field('gstin','GSTIN')}{field('gstTreatment','GST treatment',{options:['Registered Business','Composition Dealer','Unregistered Business','Overseas Vendor']})}{field('pan','PAN number')}{form.tdsApplicable&&field('tdsSection','TDS section',{options:[['','Select section'],'194C','194H','194I','194J']})}{form.tdsApplicable&&field('tdsRate','TDS rate (%)',{type:'number'})}</div>
     {errors.tds&&<p className="itemError itemSectionError">{errors.tds}</p>}
     <div className="itemAdvancedTitle vendorSubTitle">Payment &amp; bank details</div>
     <div className="itemFormGrid">{field('paymentTerms','Payment terms *',{options:terms})}{field('paymentMode','Preferred payment mode',{options:modes})}{field('creditLimit','Credit limit (₹)',{type:'number'})}{field('bankName','Bank name')}{field('accountHolder','Account holder name')}{field('accountNumber','Account number')}{field('ifsc','IFSC code')}{field('bankBranch','Bank branch')}</div>
    </section>
    <details className="itemAdvanced" open={moreOpen} onToggle={e=>setMoreOpen(e.currentTarget.open)}>
     <summary>More details <span>Optional</span></summary>
     <div className="itemAdvancedGroup">
      <div className="itemAdvancedTitle">Accounting</div>
      <div className="itemFormGrid">{field('payableAccountId','Default payable account *',{options:[['2100','2100 - Accounts Payable'],...payable.filter(x=>x[0]!=='2100').map(x=>[x[0],x[0]+' - '+x[1]])]})}{field('purchaseAccountId','Purchase expense account',{options:[['','Use item/category mapping'],...expenses.map(x=>[x[0],x[0]+' - '+x[1]])]})}{field('currency','Currency',{options:[['INR','INR - Indian Rupee'],['USD','USD - US Dollar'],['AED','AED - UAE Dirham'],['Other','Other']]})}{field('branch','Branch',{options:['Kochi Branch','Kannur Branch','Coimbatore Branch']})}{field('costCentre','Cost centre',{options:['','Purchase Department','Operations','Administration']})}</div>
      <p className="itemNotice"><IconBuildingBank size={16}/>The vendor is a sub-ledger of Accounts Payable, so no separate Chart of Accounts account is created and every purchase bill posts to the payable account above.</p>
     </div>
     <div className="itemAdvancedGroup">
      <div className="itemAdvancedTitle">Opening balance</div>
      <div className="itemFormGrid">{field('openingBalance','Opening balance (₹)',{type:'number'})}{field('openingType','Balance type',{options:[['Credit','Credit - the company owes the vendor'],['Debit','Debit - the vendor owes the company']]})}</div>
      <p className="itemNotice"><IconInfoCircle size={16}/>Use this only while migrating from another accounting system. It sets the vendor outstanding balance and does not post a journal entry.</p>
     </div>
     <div className="itemAdvancedGroup">
      <div className="itemAdvancedTitle">Documents</div>
      <div className="itemImageField"><label className="itemImageUpload"><input type="file" multiple onChange={e=>{attachDocuments(e.target.files);e.target.value=''}}/><span className="itemImageIcon"><IconPaperclip size={20}/></span><span className="itemImageCopy"><b>{(form.attachments||[]).length?'Add more documents':'Attach documents'}</b><small>GST certificate, PAN document, agreement or other files.</small></span><span className="itemImageChoose">Browse</span></label>{(form.attachments||[]).length?<ul className="vendorDocuments">{form.attachments.map((name,index)=><li key={name+index}><span>{name}</span><button type="button" aria-label={'Remove '+name} onClick={()=>update('attachments',(form.attachments||[]).filter((entry,position)=>position!==index))}><IconTrash size={15}/></button></li>)}</ul>:null}</div>
     </div>
     <div className="itemAdvancedGroup">
      <div className="itemAdvancedTitle">Notes</div>
      <div className="itemFormGrid itemSingleField">{field('notes','Notes',{type:'textarea',hint:'Anything the purchase team or the accountant should know about this vendor.'})}</div>
     </div>
    </details>
    {errors.save&&<p className="itemError itemSaveError" role="alert">{errors.save}</p>}
   </div>
   <footer className="itemDialogFooter"><button type="button" onClick={()=>setForm(null)}>Cancel</button><button className="primary">{form.id?'Save changes':'Create Vendor'}</button></footer>
  </form>
 </section>;

 if(selected)return <section className="invoiceWorkspace purchaseWorkspace ivDetailOpen">
  <div className="ivDetailHead"><button type="button" className="ivDetailBack" aria-label="Back to Vendors" onClick={()=>setSelected(null)}><IconArrowLeft size={19}/></button><div className="ivDetailHeadText"><h2>Vendor details</h2><small>{selected.displayName||selected.name} &middot; {selected.code}</small></div></div>
  <div className="ivDetailBody"><section className="ivDetailSheet">
   <div className="ivDetailIdentityRow">
    <div className="ivDetailIdentity"><div className="ivDetailNumber"><h3>{selected.displayName||selected.name}</h3><StatusPill status={selected.status} tone={VENDOR_TONES(selected.status)}/></div><p>{selected.code} &middot; {selected.type}</p></div>
    <div className="ivDocumentActions"><button onClick={()=>start(selected)}><IconEdit size={16}/>Edit vendor</button><button onClick={()=>onNavigate('General Ledger')}><IconBook2 size={16}/>View ledger</button></div>
   </div>
   <div className="ivDetailStats">{[['Status',selected.status],['Vendor type',selected.type],['GST treatment',selected.gstTreatment||'Not recorded'],['GSTIN',selected.gstin||'Not registered'],['Payment terms',selected.paymentTerms],['Current payable',money(selected.balance)]].map(([k,v])=><span key={k}><small>{k}</small><strong>{v||'Not recorded'}</strong></span>)}</div>
   <nav className="itemDetailTabs ivDetailTabs" aria-label="Vendor sections">{VENDOR_TABS.map(t=><button key={t} type="button" className={tab===t?'active':''} aria-current={tab===t?'page':undefined} onClick={()=>setTab(t)}>{t}</button>)}</nav>
   {tab==='Overview'?<div className="ivOverviewPage"><div className="ivOverviewGrid"><section className="itemDetailCard"><div className="itemDetailSectionTitle"><IconBuildingStore size={18}/><h2>Vendor details</h2></div><dl className="itemDetailFacts">{[['Display name',selected.displayName],['Contact',selected.contactName],['Phone',selected.phone],['Email',selected.email],['Website',selected.website],['GST treatment',selected.gstTreatment],['GSTIN',selected.gstin||'Not registered'],['PAN',selected.pan],['TDS section',selected.tdsSection],['TDS rate',selected.tdsRate]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||'Not provided'}</dd></div>)}</dl></section><section className="itemDetailCard"><div className="itemDetailSectionTitle"><IconReceipt size={18}/><h2>Payables summary</h2></div><dl className="itemDetailFacts">{[['Current payable',money(selected.balance)],['Credit limit',money(selected.creditLimit)],['Payment terms',selected.paymentTerms],['Preferred mode',selected.paymentMode],['Currency',selected.currency],['Default payable account',selected.payableAccountId]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||'Not recorded'}</dd></div>)}</dl><p className="ivMutedNote">Vendor sub-ledger under Accounts Payable.</p></section></div><section className="itemDetailCard"><div className="itemDetailSectionTitle"><IconBuildingBank size={18}/><h2>Addresses</h2></div><dl className="itemDetailFacts">{[['Billing address',[selected.billing?.line1,selected.billing?.line2,selected.billing?.city,selected.billing?.state,selected.billing?.pin,selected.billing?.country].filter(Boolean).join(', ')],['Shipping address',[selected.shipping?.line1,selected.shipping?.line2,selected.shipping?.city,selected.shipping?.state,selected.shipping?.pin,selected.shipping?.country].filter(Boolean).join(', ')]].map(([k,v])=><div key={k} className="ivFactWide"><dt>{k}</dt><dd>{v||'Not provided'}</dd></div>)}</dl></section></div>:tab==='Transactions'?<div className="purchaseTabBody"><p className="ivMutedNote">{money(vendorOutstanding(accounting,selected.id))} outstanding across posted purchase bills, payments and adjustments.</p><div className="ivScroll"><table className="ivInvoiceTable"><thead><tr>{['Date','Voucher','Source','Debit','Credit','Balance'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{ledger.map(entry=><tr key={entry.id}><td>{entry.date}</td><td>{entry.reference}</td><td>{entry.source}</td><td>{entry.debit?money(entry.debit):'-'}</td><td>{entry.credit?money(entry.credit):'-'}</td><td>{money(entry.balance)}</td></tr>)}</tbody></table>{!ledger.length&&<EmptyState variant="adjustment" title="No posted vendor transactions" description="Posted purchase bills and payments will appear here."/>}</div></div>:tab==='Documents'?<div className="purchaseTabBody">{(selected.attachments||[]).length?<dl className="itemDetailFacts">{selected.attachments.map((name,index)=><div key={index}><dt>Attachment</dt><dd>{name}</dd></div>)}</dl>:<EmptyState variant="adjustment" title="No documents uploaded" description="GST certificates, PAN documents and agreements will appear here."/>}</div>:<div className="purchaseTabBody"><dl className="itemDetailFacts">{[['Created by',selected.createdBy||'Admin'],['Created',selected.createdAt?new Date(selected.createdAt).toLocaleString('en-IN'):'Not recorded'],['Last modified by',selected.modifiedBy||'Not recorded'],['Last modified',selected.modifiedAt?new Date(selected.modifiedAt).toLocaleString('en-IN'):'Not recorded']].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>}
  </section></div>
 </section>;

 return <section className="invoiceWorkspace purchaseWorkspace">
  <div className="ivHeading registerHead"><div className="registerHeadText"><h2>Vendors</h2><p>Manage suppliers, payment terms and Accounts Payable balances.</p></div><div className="ivTools"><label className="ivToolSearch"><IconSearch size={17}/><input aria-label="Search vendors" placeholder="Search vendor name, code, GSTIN or phone" value={query} onChange={e=>setQuery(e.target.value)}/></label><details className="soFiltersMore"><summary aria-label="Open filters"><IconFilter size={17}/>Filters{activeFilters>0&&<i>{activeFilters}</i>}</summary><div className="soFiltersPanel"><label>Status<select aria-label="Filter vendor status" value={status} onChange={e=>setStatus(e.target.value)}>{['All statuses','Active','Inactive','Blocked'].map(x=><option key={x}>{x}</option>)}</select></label><label>Vendor type<select aria-label="Filter vendor type" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="">All types</option>{types.map(x=><option key={x}>{x}</option>)}</select></label><label>GST treatment<select aria-label="Filter GST treatment" value={gstFilter} onChange={e=>setGstFilter(e.target.value)}><option value="">All treatments</option>{['Registered Business','Composition Dealer','Unregistered Business','Overseas Vendor'].map(x=><option key={x}>{x}</option>)}</select></label><label>State<select aria-label="Filter state" value={stateFilter} onChange={e=>setStateFilter(e.target.value)}><option value="">All states</option>{customerStates.map(x=><option key={x}>{x}</option>)}</select></label><button type="button" className="soClearFilters" onClick={clearFilters}>Clear filters</button></div></details></div><div className="ivActions"><button className="primary" onClick={()=>start()}><IconPlus size={16}/>Create Vendor</button></div></div>
  <div className="ivCard ivRegisterCard">
   <div className="ivScroll"><table className="ivInvoiceTable"><thead><tr>{['Vendor','Type','GSTIN','Phone','Net payable','Status','Actions'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{visible.map(row=><tr key={row.id}><td><button className="ivLink" onClick={()=>{setSelected(row);setTab('Overview')}}>{row.displayName||row.name}</button><small>{row.code}</small></td><td>{row.type}<small>{row.paymentTerms||'Terms not set'} · {row.paymentMode||'Mode not recorded'}</small></td><td>{row.gstin||'Not registered'}<small>{row.gstTreatment||'Treatment not recorded'}</small></td><td>{row.phone}<small>{row.email||'Email not provided'}</small></td><td>{money(row.balance)}</td><td><StatusPill status={row.status} tone={VENDOR_TONES(row.status)}/></td><td><div className="ivRowActions"><button onClick={()=>{setSelected(row);setTab('Overview')}}>View</button><VendorRowActions vendor={row} onView={()=>{setSelected(row);setTab('Overview')}} onEdit={()=>start(row)} onTransactions={()=>{setSelected(row);setTab('Transactions')}} onLedger={()=>onNavigate('General Ledger')} onToggle={()=>changeStatus(row,row.status==='Inactive'?'Active':'Inactive')}/></div></td></tr>)}</tbody></table>{!visible.length&&<div className="ivEmpty"><h3>No vendors found</h3><p>{rows.length?'Adjust the search or filters to find a vendor.':'Create your first vendor to manage purchases and payables.'}</p></div>}</div>
   <div className="ivActions purchaseRegisterFoot"><span>{visible.length} of {rows.length} vendors</span></div>
  </div>
 </section>;
}
