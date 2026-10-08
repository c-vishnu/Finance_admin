import {useEffect,useRef,useState} from 'react';
import {IconBuildingBank,IconCalendar,IconClock,IconEye,IconFileText,IconHash,IconMapPin,IconPencil,IconPlus,IconSitemap,IconTrash,IconBuildingStore,IconX,IconUpload} from '@tabler/icons-react';
import {ItemSearch,TaxSelection} from './InvoiceLineControls.jsx';
import {calculatePurchase} from './purchase-service.js';
import {customerStates} from './Customers.jsx';
import {COUNTRIES,PAYMENT_TERM_DAYS,blankAddress,composeAddress,gstStateCode,parseAddress,placeOfSupplySuggestion,placeOfSupplyStatus,PLACE_OF_SUPPLY_SOURCE} from './customer-tax.js';
import EmptyState from './EmptyState.jsx';
import {itemScopeError} from './sales-order-service.js';
import {formatRupees} from './number-format.js';
import './sales-document-tax.css';

const closeFactEditMenus=()=>document.querySelectorAll('.soFactEdit[open]').forEach(node=>node.removeAttribute('open'));
const closeAddItemMenus=()=>document.querySelectorAll('.soAddItem[open]').forEach(node=>node.removeAttribute('open'));

const money=n=>formatRupees(n);

export function vendorAddress(vendor,which){
 const record=vendor||{};
 const structured=which==='billing'?record.billing:record.shipping;
 const fallback=parseAddress(record[which]);
 const base={...blankAddress(),...(structured||fallback)};
 const filled=Object.fromEntries(Object.entries(base).map(([key,value])=>[key,value||fallback[key]||'']));
 return {...filled,state:filled.state||String(record.state||'')};
}

export const blankDocumentLine=()=>({id:crypto.randomUUID(),itemId:'',description:'',qty:'1',unit:'pcs',rate:'0',discount:'0',discountType:'%',taxRate:'18',cessRate:'0',income:'',purchaseAccount:'5000',priceTaxMode:'exclusive',taxes:{cgst:9,sgst:9,igst:0,cess:0}});
export const due=(date,days)=>{const d=new Date(date+'T12:00:00Z');if(Number.isNaN(d.getTime()))return '';d.setUTCDate(d.getUTCDate()+Number(days));return d.toISOString().slice(0,10)};

const placeIsManual=source=>source.placeSource===PLACE_OF_SUPPLY_SOURCE.MANUAL||(!!String(source.place||'').trim()&&!source.placeSource);
const placeSuggestionOf=(source,vendorState)=>placeOfSupplySuggestion({billing:source.billing,shipping:source.shipping,state:vendorState||''},customerStates);
const applyPlaceFor=(next,vendorState,force=false)=>{if(!force&&placeIsManual(next))return next;const suggestion=placeSuggestionOf(next,vendorState);return {...next,place:suggestion.state,placeSource:suggestion.source,placeCode:gstStateCode(suggestion.state)}};

const shortDate=value=>{const d=new Date(String(value||'')+'T00:00:00');return Number.isNaN(d.getTime())?'Not set':d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})};
export const vendorInitials=name=>String(name||'').trim().split(/\s+/).slice(0,2).map(word=>word[0]||'').join('').toUpperCase()||'V';

export function VendorSearch({vendors,value,onSelect,onCreateVendor}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
 const inputRef=useRef(null);
 const selected=vendors.find(entry=>entry.id===value)||null;
 const terms=(query.toLowerCase().match(/"[^\"]+"|\S+/g)||[]).map(t=>t.replaceAll('"',''));
 const matches=vendors.filter(v=>terms.every(t=>`${v.displayName||v.name||''} ${v.code||''} ${v.phone||''} ${v.gstin||''}`.toLowerCase().includes(t)));

 function pick(vendor){onSelect(vendor.id);setOpen(false);setQuery('');setActive(0);inputRef.current&&inputRef.current.blur()}

 return <div className="soCustomerSearch" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)){setOpen(false);setQuery('')}}}>
  <span className="soControl"><IconBuildingStore size={18} stroke={1.8} aria-hidden="true"/><input role="combobox" aria-label="Search vendors" aria-expanded={open} aria-autocomplete="list" aria-controls="so-vendor-list" placeholder="Search or select a vendor by name, phone or GSTIN..." value={open?query:selected?.displayName||selected?.name||''} onFocus={()=>{setOpen(true);setQuery('');setActive(0)}} onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(0)}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(a=>Math.min(a+1,matches.length-1))}if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(0,a-1))}if(e.key==='Enter'&&open){e.preventDefault();if(matches[active])pick(matches[active])}if(e.key==='Escape'){e.preventDefault();setOpen(false);setQuery('')}}} ref={inputRef}/>{selected&&<button type="button" className="soCustomerClear" aria-label={'Clear '+(selected.displayName||selected.name)} onClick={()=>{onSelect('');setQuery('');setOpen(true)}}><IconX size={15}/></button>}</span>
  {open&&<div className="soCustomerResults" id="so-vendor-list" role="listbox" aria-label="Vendors">{matches.map((v,n)=><button type="button" role="option" aria-selected={v.id===value} key={v.id} className={n===active?'active':''} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(n)} onClick={()=>pick(v)}><span><b>{v.displayName||v.name}</b><small>{[v.billing?.city||v.billing?.state,v.phone].filter(Boolean).join(' · ')||'No address recorded'}</small></span></button>)}{!matches.length&&<p className="soCustomerEmptyMatch">{'No vendor matches \u201c'+query+'\u201d.'}{onCreateVendor&&<button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>onCreateVendor()}>Create or edit a vendor</button>}</p>}</div>}
 </div>;
}

function Field({label,icon:Icon,hint,children}){
 return <label className="soField"><span>{label}</span><span className="soControl">{Icon&&<Icon size={18} stroke={1.8} aria-hidden="true"/>}{children}</span>{hint}</label>;
}

export function PlaceOfSupplyField({form,setForm,vendor}){
 const suggestion=placeSuggestionOf(form,vendor?.billing?.state||vendor?.state||'');
 const status=placeOfSupplyStatus(form.placeSource,suggestion);
 const reset=()=>setForm(current=>applyPlaceFor(current,vendor?.billing?.state||vendor?.state||'',true));
 return <Field label="Place of supply *" icon={IconMapPin} hint={<small className="soPlaceHint" role="status">{status.text}{status.reset&&<> &middot; <button type="button" className="soPlaceReset" onClick={reset}>{status.reset}</button></>}</small>}>
  <select id="soPlaceOfSupply" required value={form.place||''} onChange={e=>setForm({...form,place:e.target.value,placeSource:PLACE_OF_SUPPLY_SOURCE.MANUAL,placeCode:gstStateCode(e.target.value)})}>
   <option value="">Select Place of Supply</option>{customerStates.map(state=><option key={state}>{state}</option>)}
  </select>
 </Field>;
}

const MAX_FILES=10,MAX_FILE_BYTES=1024*1024,MAX_TOTAL_BYTES=2*1024*1024;
const fileLimitText='You can upload up to 10 files, 1 MB each, 2 MB in total.';
const fileSize=bytes=>{const n=Number(bytes)||0;return n>=1024*1024?(n/1024/1024).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB'};

export default function PurchaseDocumentFields({form,setForm,vendors,items,config,organisations=[],kind='order',outstandingPayable=0,onEditVendor,onCreateItem,onCreateVendor,autoNumber='',children}){
 useEffect(()=>{const onPointerDown=event=>{document.querySelectorAll('.soFactEdit[open],.soAddItem[open]').forEach(node=>{if(!node.contains(event.target))node.removeAttribute('open')})};const onEscape=event=>{if(event.key==='Escape'){closeFactEditMenus();closeAddItemMenus()}};document.addEventListener('pointerdown',onPointerDown);document.addEventListener('keydown',onEscape);return()=>{document.removeEventListener('pointerdown',onPointerDown);document.removeEventListener('keydown',onEscape)}},[]);

 const [addressEdit,setAddressEdit]=useState('');
 const [vendorMore,setVendorMore]=useState(false);
 const [busy,setBusy]=useState(false);
 const [dragActive,setDragActive]=useState(false);
 const [errors,setErrors]=useState({});

 const docWord=kind==='order'?'purchase order':'purchase bill';
 const docTitle=kind==='order'?'Purchase order':'Purchase bill';

 const inlineAddress=value=>{
  if(!value)return '';
  if(typeof value==='string')return value.split(/\r?\n/).map(part=>part.trim()).filter(Boolean).join(', ');
  const parts=[value.line1,value.line2,value.city,value.state,value.pin,value.country].filter(Boolean);
  return parts.join(', ');
 };

 const termOptions=(()=>{
  const known=Object.values(PAYMENT_TERM_DAYS).map(Number),list=Object.entries(PAYMENT_TERM_DAYS).map(([label,days])=>[String(days),label]),current=Number(form.terms||30);
  if(String(form.terms)!==''&&Number.isFinite(current)&&!known.includes(current))list.push([String(current),'Net '+current+' days']);
  return list.sort((a,b)=>Number(a[0])-Number(b[0]));
 })();

 const selectedVendor=vendors.find(entry=>entry.id===(form.vendorId||form.vendor))||null;
 const documentGstin=form.vendorGstin||selectedVendor?.gstin||'';

 const selectedOrganisation=organisations.find(entry=>entry.id===form.organizationId)||null;
 function changeScope(organisationId,branchId){
  const organisation=organisations.find(entry=>entry.id===organisationId)||null;
  const branch=(organisation?.branches||[]).find(item=>String(item.id)===String(branchId))||null;
  setForm(current=>({...current,organizationId:organisationId,organizationName:organisation?.name||'',branchId:branchId||'',branchName:branch?.name||''}));
 }
 const selectedBranch=(selectedOrganisation?.branches||[]).find(item=>String(item.id)===String(form.branchId))||null;
 const scope={organisationRefs:[selectedOrganisation?.id,selectedOrganisation?.code],branchRefs:[selectedBranch?.id,selectedBranch?.name],organisationName:selectedOrganisation?.name||form.organizationName||'',branchName:selectedBranch?.name||form.branchName||''};
 const lineScopeError=line=>{const item=(items||[]).find(entry=>entry.id===line.itemId||entry.id===line.item);return item?itemScopeError(item,scope):''};

 const billingText=inlineAddress(form.billingAddress||form.billing||selectedVendor?.billing);
 const shippingText=inlineAddress(form.shippingAddress||form.shipping||selectedVendor?.shipping);
 const sameAddress=(!shippingText||shippingText===billingText);

 function chooseVendor(id){
  const v=vendors.find(x=>x.id===id);
  const terms=v?.paymentTerms||'30 Days';
  const termDays=Number(String(terms).match(/\d+/)?.[0]||30);
  const suggestionState=v?.billing?.state||v?.state||'Kerala';
  const addr=inlineAddress(v?.billing);
  setForm({
   ...form,
   vendorId:id,
   vendorName:v?.displayName||v?.name||'',
   vendorContact:v?.contactName||v?.phone||'',
   vendorAddress:addr||'Not recorded',
   vendorGstin:v?.gstin||'',
   billingAddress:v?.billing||{},
   shippingAddress:v?.shipping||v?.billing||{},
   billing:addr,
   shipping:inlineAddress(v?.shipping)||addr,
   place:suggestionState,
   placeSource:PLACE_OF_SUPPLY_SOURCE.SUGGESTED,
   placeCode:gstStateCode(suggestionState),
   paymentTerms:terms,
   terms:String(termDays),
   dueDate:due(form.date||new Date().toISOString().slice(0,10),termDays),
   payableAccount:v?.payableAccountId||'2000',
   purchaseAccount:v?.purchaseAccountId||form.purchaseAccount||'5000'
  });
 }

 const applyPlace=(next,force=false)=>applyPlaceFor(next,selectedVendor?.billing?.state||selectedVendor?.state||'',force);

 const addressKey=which=>which==='billing'?'billingAddress':'shippingAddress';
 const addressOf=which=>form[addressKey(which)]?{...blankAddress(),...form[addressKey(which)]}:vendorAddress(selectedVendor,which);
 const addressLine=which=>{
  const a=addressOf(which),clean=value=>String(value||'').trim(),country=clean(a.country);
  const body=[a.line1,a.line2,a.city,a.state,a.pin].map(clean).filter(part=>part&&part!==country).filter((part,index,all)=>all.indexOf(part)===index);
  return [...body,...(country?[country]:[])].join(', ');
 };

 function updateAddress(key,value){
  setForm(current=>{
   const which=addressEdit,slot=addressKey(which);
   const address={...blankAddress(),...(current[slot]||parseAddress(current[which])),[key]:value};
   const composed=composeAddress(address);
   const next={...current,[slot]:address,[which]:composed,...(sameAddress&&which==='billing'?{[addressKey('shipping')]:address,shipping:composed}:{})};
   return applyPlace(next);
  });
 }

 const updateLine=(index,key,value)=>setForm({...form,lines:form.lines.map((l,n)=>{
  if(n!==index)return l;
  const updated={...l,[key]:value};
  if(key==='taxRate'){
   const rate=Number(value||0);
   const intra=(form.place||'Kerala').trim().toLowerCase()===(config?.state||'Kerala').trim().toLowerCase();
   updated.taxes=intra?{cgst:rate/2,sgst:rate/2,igst:0,cess:Number(l.cessRate||0)}:{cgst:0,sgst:0,igst:rate,cess:Number(l.cessRate||0)};
  }
  return updated;
 })});

 async function readFiles(picked){
  if(!picked.length)return;
  const stored=(form.files||[]).reduce((n,f)=>n+(f.size||0),0),total=stored+picked.reduce((n,f)=>n+f.size,0);
  if((form.files||[]).length+picked.length>MAX_FILES){setErrors(x=>({...x,files:'Upload at most '+MAX_FILES+' files.'}));return}
  if(picked.some(x=>x.size>MAX_FILE_BYTES)){setErrors(x=>({...x,files:'Each file must be 1 MB or smaller.'}));return}
  if(total>MAX_TOTAL_BYTES){setErrors(x=>({...x,files:'Attachments can total 2 MB. Remove a file or use a smaller one.'}));return}
  setBusy(true);
  try{
   const files=await Promise.all(picked.map(file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({id:crypto.randomUUID(),name:file.name,size:file.size,data:reader.result});reader.onerror=reject;reader.readAsDataURL(file)})));
   setForm(f=>f?{...f,files:[...(f.files||[]),...files]}:f);
   setErrors(x=>({...x,files:''}));
  }catch{setErrors(x=>({...x,files:'Could not read attachment. Try again.'}))}finally{setBusy(false)}
 }

 async function attach(e){const picked=[...e.target.files];e.target.value='';await readFiles(picked)}
 function dropFiles(e){e.preventDefault();setDragActive(false);readFiles([...e.dataTransfer.files])}

 const addLine=()=>setForm(current=>({...current,lines:[...current.lines,blankDocumentLine()]}));

 const itemDefaults=item=>{
  const rate=item.taxApplicable===false?0:Number(item.taxRate??18);
  const cess=Number(item.cessRate||0);
  const intra=(form.place||'Kerala').trim().toLowerCase()===(config?.state||'Kerala').trim().toLowerCase();
  return {
   itemId:item.id,
   item:item.id,
   description:item.name,
   unit:item.unit||'pcs',
   rate:String(item.cost||item.price||'0'),
   purchaseAccount:item.purchaseAccount||'5000',
   taxRate:item.taxApplicable===false?'0':String(item.taxRate||'18'),
   cessRate:String(item.cessRate||'0'),
   priceTaxMode:item.priceTaxMode||'exclusive',
   taxes:intra?{cgst:rate/2,sgst:rate/2,igst:0,cess}:{cgst:0,sgst:0,igst:rate,cess}
  };
 };

 let preview,previewError;
 try{
  preview=calculatePurchase(form.lines,{companyState:config?.state||'Kerala',placeOfSupply:form.place||'Kerala'});
 }catch(e){
  previewError=e.message;
 }

 const totals=t=><dl className="ivTotals">
  {[
   ['Subtotal',t.subtotal],
   ['Discount',t.discount],
   ['Taxable amount',t.taxable],
   ...(t.cgst+t.sgst?[['CGST',t.cgst],['SGST',t.sgst]]:[['IGST',t.igst]]),
   ...(t.cess?[['Cess',t.cess]]:[]),
   ['Tax',t.tax],
   ['Round off',t.adjustment||0],
   ['Grand total',t.total]
  ].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{money(v)}</dd></div>)}
 </dl>;

 return <>
  <div className="ivCard soFormSection">
   <div className="soSectionHead"><h3>Vendor *</h3></div>
   <div className="soCustomerRow">
    <div className="soField soFieldSearch">
     <VendorSearch vendors={vendors} value={form.vendorId||form.vendor} onSelect={id=>chooseVendor(id)} onCreateVendor={onCreateVendor}/>
    </div>
    <button type="button" className="soCustomerCreate" aria-label="Create vendor" title="Create vendor" disabled={!onCreateVendor} onClick={()=>onCreateVendor&&onCreateVendor()}>
     <IconPlus size={18} stroke={1.8} aria-hidden="true"/>
    </button>
   </div>
   <div className="soCustomerRef">
    {selectedVendor?<><div className="soCustomerProfile"><span className="soCustomerAvatar" aria-hidden="true">{vendorInitials(selectedVendor?.displayName||selectedVendor?.name)}</span><div className="soCustomerLines"><span className="soCustomerHead"><strong className="soCustomerName">{selectedVendor?.displayName||selectedVendor?.name||'Vendor'}</strong><span className="soCustomerType">{selectedVendor?.type||'Supplier'}</span></span><span className="soCustomerAddress"><b>Billing Address:</b> {addressLine('billing')||form.vendorAddress||'Not provided'}</span></div><div className="soCustomerMeta" title="Actual open vendor payables"><span>Outstanding payable</span><strong>{money(outstandingPayable)}</strong></div></div><div className="soCustomerActions"><details className="soFactEdit"><summary aria-label="Edit address" title="Edit address"><IconPencil size={15}/></summary><div className="soFactEditMenu"><button type="button" onClick={()=>{closeFactEditMenus();setAddressEdit('billing')}}>Edit billing address</button><button type="button" onClick={()=>{closeFactEditMenus();setAddressEdit('shipping')}}>Edit shipping address</button><button type="button" onClick={()=>{closeFactEditMenus();onEditVendor&&form.vendorId&&onEditVendor(form.vendorId)}}>Edit vendor details</button></div></details><button type="button" className="soCustomerMoreToggle" aria-label="View vendor details" title="View vendor details" aria-expanded={vendorMore} onClick={()=>setVendorMore(!vendorMore)}><IconEye size={17}/></button></div>{vendorMore&&<div className="soCustomerMoreBody"><p className="soFactCaption">Read from the vendor record. The tax identity and contact come from the vendor master; the address can be changed on this {docWord} only.</p><dl className="soFactList"><div className="soFactItem"><dt>GST treatment</dt><dd>{selectedVendor?.gstTreatment||'Not recorded'}</dd></div><div className="soFactItem"><dt>GSTIN</dt><dd>{selectedVendor?.gstin||'Not registered'}{documentGstin&&documentGstin!==selectedVendor?.gstin&&<small className="soDocumentIdentityNote">This document keeps {documentGstin}.</small>}</dd></div><div className="soFactItem"><dt>PAN</dt><dd>{selectedVendor?.pan||'Not recorded'}</dd></div><div className="soFactItem"><dt>Contact person</dt><dd>{selectedVendor?.contactName||selectedVendor?.phone||'Not recorded'}</dd></div><div className="soFactItem"><dt>Phone</dt><dd>{selectedVendor?.phone||'Not recorded'}</dd></div><div className="soFactItem"><dt>Credit limit</dt><dd>{selectedVendor?.creditLimit?money(Number(selectedVendor.creditLimit)):'Not set'}</dd></div><div className="soFactItem soFactWide"><dt>Billing address</dt><dd>{billingText||form.vendorAddress||'Not provided'}</dd></div>{!sameAddress&&<div className="soFactItem soFactWide"><dt>Shipping address</dt><dd>{shippingText||'Not provided'}</dd></div>}</dl></div>}</>:<EmptyState variant="customer" className="soCustomerEmpty" title="No vendor selected" description={`Search for or select a vendor above to load their tax identity, contact and addresses onto this ${docWord}.`}/>}
   </div>
  </div>

  <div className="ivCard soFormSection">
   <div className="soSectionHead"><h3>{kind==='order'?'Order details':'Bill details'}</h3></div>
   <div className="ivFields soFieldRow soFieldRow4">
    <Field label={docTitle+' ID'} icon={IconHash}>
     <input placeholder={autoNumber||'PO-2026-00001'} value={form.number||''} onChange={e=>setForm({...form,number:e.target.value})}/>
    </Field>
    <Field label={docTitle+' date *'} icon={IconCalendar}>
     <input type="date" value={form.date||''} onChange={e=>setForm({...form,date:e.target.value,dueDate:due(e.target.value,form.terms||30)})}/>
    </Field>
    <Field label="Reference number" icon={IconFileText}>
     <input value={form.reference||''} placeholder="Vendor quotation / reference number" onChange={e=>setForm({...form,reference:e.target.value})}/>
    </Field>
    <Field label="Payment terms" icon={IconClock} hint={<small className="soDueHint">Due {shortDate(form.dueDate)}</small>}>
     <select value={form.terms||30} onChange={e=>setForm({...form,terms:e.target.value,paymentTerms:'Net '+e.target.value+' days',dueDate:due(form.date,e.target.value)})}>
      {termOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
     </select>
    </Field>
   </div>
   <div className="ivFields soFieldRow soFieldRow4">
    <Field label="Organisation *" icon={IconBuildingBank}>
     <select value={form.organizationId||''} onChange={event=>changeScope(event.target.value,'')} required>
      <option value=''>Select organisation</option>
      {organisations.map(entry=><option key={entry.id} value={entry.id}>{entry.name}</option>)}
     </select>
    </Field>
    <Field label="Branch *" icon={IconSitemap}>
     <select value={form.branchId||''} onChange={event=>changeScope(form.organizationId,event.target.value)} required disabled={!selectedOrganisation}>
      <option value=''>{selectedOrganisation?'Select branch':'Select an organisation first'}</option>
      {(selectedOrganisation?.branches||[]).map(entry=><option key={entry.id} value={entry.id}>{entry.name}</option>)}
     </select>
    </Field>
    <PlaceOfSupplyField form={form} setForm={setForm} vendor={selectedVendor}/>
    <Field label="Expected delivery date" icon={IconCalendar}>
     <input type="date" value={form.expectedDate||''} onChange={e=>setForm({...form,expectedDate:e.target.value})}/>
    </Field>
   </div>
  </div>

  <div className="ivCard">
   <div className="ivHeading">
    <h3>{kind==='order'?'Order items':'Bill items'}<span className="soItemsCount">{form.lines.length} {form.lines.length===1?'item':'items'}</span></h3>
    <details className="soAddItem">
     <summary className="soAddItemMain"><IconPlus size={16}/>Add item</summary>
     <div className="soAddItemMenu">
      <button type="button" onClick={()=>{closeAddItemMenus();addLine()}}>Add item row</button>
      {onCreateItem&&<button type="button" onClick={()=>{closeAddItemMenus();onCreateItem()}}>Create new item</button>}
     </div>
    </details>
   </div>
   <div className="ivScroll">
    <table className="ivLineTable">
     <thead>
      <tr>{['Item / Service','Quantity','Rate ₹','Discount','Tax','Amount',''].map((s,n)=><th key={n}>{s}</th>)}</tr>
     </thead>
     <tbody>
      {form.lines.map((l,n)=><tr key={n}>
       <td>
        <div className="soItemCell">
         <ItemSearch forPurchase={true} items={items} line={l} index={n} onSelect={item=>setForm(f=>({...f,lines:f.lines.map((x,k)=>k===n?{...x,...itemDefaults(item)}:x)}))} onAdHoc={text=>setForm(f=>({...f,lines:f.lines.map((x,k)=>k===n?{...blankDocumentLine(),adHoc:true,description:text}:x)}))} onType={l.adHoc?text=>updateLine(n,'description',text):undefined}/>
         {l.hsnSac?<small className="soHsnValue">{(l.itemType==='Service'?'SAC':'HSN')+' '+l.hsnSac}</small>:null}
         {l.adHoc&&<small className="soAdHocNote">Ad hoc line: no item master record. Its price type starts tax exclusive - change it below if the rate already includes tax.</small>}
         {lineScopeError(l)&&<small className="itemError">{lineScopeError(l)}</small>}
        </div>
       </td>
       <td>
        <div className="ivQtyCell">
         <input aria-label={'qty '+(n+1)} value={l.qty} onChange={e=>updateLine(n,'qty',e.target.value)}/>
         <span className="soUnitValue" title={l.item||l.itemId||l.adHoc?'Unit from the Item master':'No unit'}>{l.unit||'pcs'}</span>
        </div>
       </td>
       <td>
        <div className="ivRateCell">
         <input aria-label={'rate '+(n+1)} value={l.rate} onChange={e=>updateLine(n,'rate',e.target.value)}/>
         <small className={'ivPriceType '+(l.priceTaxMode==='inclusive'?'is-inclusive':'is-exclusive')}>{l.priceTaxMode==='inclusive'?'Incl. Tax':'Excl. Tax'}</small>
        </div>
       </td>
       <td>
        <div className="ivDiscount">
         <input aria-label={'Discount '+(n+1)} value={l.discount} onChange={e=>updateLine(n,'discount',e.target.value)}/>
         <select aria-label={'Discount type '+(n+1)} value={l.discountType||'%'} onChange={e=>updateLine(n,'discountType',e.target.value)}>
          <option>%</option>
          <option value="fixed">₹</option>
         </select>
        </div>
       </td>
       <td>
        <div className="ivLineTax">
         <TaxSelection line={{...l,cgst:l.taxes?.cgst,sgst:l.taxes?.sgst,igst:l.taxes?.igst,cess:l.taxes?.cess}} index={n} intra={(form.place||'Kerala').trim().toLowerCase()===(config?.state||'Kerala').trim().toLowerCase()} onChange={taxes=>updateLine(n,'taxes',taxes)}/>
         <select aria-label={'Price tax treatment '+(n+1)} value={l.priceTaxMode||'exclusive'} onChange={e=>updateLine(n,'priceTaxMode',e.target.value)}>
          <option value="exclusive">Tax exclusive</option>
          <option value="inclusive">Tax inclusive</option>
         </select>
        </div>
       </td>
       <td>{preview?.lines?.[n]?money(preview.lines[n].total):'—'}</td>
       <td>
        <button type="button" aria-label="Remove line" disabled={form.lines.length===1} onClick={()=>setForm({...form,lines:form.lines.filter((_,k)=>k!==n)})}>
         <IconTrash size={16}/>
        </button>
       </td>
      </tr>)}
     </tbody>
    </table>
   </div>
  </div>

  <section className="ivCard soBillingSummary">
   <div className="soSummaryGrid">
    <div className="soSummaryLeft">
     <label className="soSummaryNote">
      <span>Vendor note</span>
      <textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Anything to communicate to the vendor about this order." aria-label="Vendor note"/>
     </label>

     <label className="soSummaryNote" style={{marginTop:'14px'}}>
      <span>Terms &amp; conditions</span>
      <textarea value={form.termsAndConditions||form.deliveryTerms||''} onChange={e=>setForm({...form,termsAndConditions:e.target.value,deliveryTerms:e.target.value})} placeholder="Standard terms and conditions for this purchase order." aria-label="Terms & conditions"/>
     </label>

     <div className="ivFields soFieldRow soFieldRow2" style={{marginTop:'14px'}}>
      <Field label="Delivery address" icon={IconMapPin}>
       <input value={form.deliveryAddress||''} onChange={e=>setForm({...form,deliveryAddress:e.target.value})} placeholder="Delivery location / branch address"/>
      </Field>
      <Field label="Shipping method" icon={IconFileText}>
       <input value={form.shippingMethod||''} onChange={e=>setForm({...form,shippingMethod:e.target.value})} placeholder="Carrier, freight, or shipping terms"/>
      </Field>
     </div>

     <section className="soMoreGroup" style={{marginTop:'18px'}}>
      <div className="soUploadField">
       <h4 className="soMoreGroupTitle soUploadLabel">Documents</h4>
       <label className={'soUploadDrop'+(dragActive?' isActive':'')} onDragOver={e=>{e.preventDefault();setDragActive(true)}} onDragLeave={()=>setDragActive(false)} onDrop={dropFiles}>
        <span className="soUploadIcon"><IconUpload size={18}/></span>
        <span className="soUploadCopy"><b>Drag files here or choose from your computer</b><small>{fileLimitText}</small></span>
        <span className="soUploadChoose">Choose files</span>
        <input type="file" multiple disabled={busy} onChange={attach} aria-label="Attach documents"/>
       </label>
       {form.files?.length>0&&<ul className="soFileList">
        {form.files.map(f=><li key={f.id}><span className="soFileIcon"><IconFileText size={15}/></span><span className="soFileMeta"><b>{f.name}</b><small>{fileSize(f.size)}</small></span><button type="button" aria-label={'Remove '+f.name} onClick={()=>setForm({...form,files:form.files.filter(x=>x.id!==f.id)})}><IconX size={14}/></button></li>)}
       </ul>}
       {errors.files&&<p className="soUploadError" role="alert">{errors.files}</p>}
      </div>
     </section>
     {children}
    </div>

    <div className="soSummaryRight">
     <div className="soSummaryHead">
      <h3>Order summary</h3>
      <span className="soCurrencyChip" title="Every amount on this document is in Indian rupees">INR ₹</span>
     </div>
     <div className="soSummaryMoney">
      {preview?totals(preview):<p role="status">{previewError||'Select an item and place of supply to calculate totals.'}</p>}
     </div>
     <p className="soPostingNote">A purchase order is an operational document and does not create a vendor payable or accounting entry. Accounting is recorded when the appropriate purchase bill is posted.</p>
    </div>
   </div>
  </section>

  {addressEdit&&<div className="soAddressLayer" role="dialog" aria-modal="true" aria-labelledby="soAddressTitle"><button type="button" className="soAddressBackdrop" aria-label="Close address editor" onClick={()=>setAddressEdit('')}/><section className="soAddressDialog"><div className="soAddressDialogHead"><h3 id="soAddressTitle">{addressEdit==='billing'?'Edit billing address':'Edit shipping address'}</h3><button type="button" className="soAddressClose" aria-label="Close address editor" onClick={()=>setAddressEdit('')}><IconX size={18}/></button></div><div className="soAddressFields"><label className="soAddressFieldWide">Address 1<input autoFocus={true} value={addressOf(addressEdit)['line1']||''} onChange={event=>updateAddress('line1',event.target.value)}/></label><label className="soAddressFieldWide">Address 2<input value={addressOf(addressEdit)['line2']||''} onChange={event=>updateAddress('line2',event.target.value)}/></label><label className="soAddressField">City<input value={addressOf(addressEdit)['city']||''} onChange={event=>updateAddress('city',event.target.value)}/></label><label className="soAddressField">State<select value={addressOf(addressEdit)['state']||''} onChange={event=>updateAddress('state',event.target.value)}><option value="">Select state</option>{customerStates.map(state=><option key={state}>{state}</option>)}</select></label><label className="soAddressField">PIN code<input value={addressOf(addressEdit)['pin']||''} onChange={event=>updateAddress('pin',event.target.value)}/></label><label className="soAddressField">Country<select value={addressOf(addressEdit)['country']||'India'} onChange={event=>updateAddress('country',event.target.value)}>{COUNTRIES.map(country=><option key={country}>{country}</option>)}</select></label></div><p className="soAddressNote">This changes the address on this {docWord} only. {selectedVendor?.displayName?selectedVendor.displayName+' keeps its own address in the vendor master.':'The vendor master keeps its own address.'}</p><footer><button type="button" onClick={()=>setAddressEdit('')}>Cancel</button><button type="button" className="primary" onClick={()=>setAddressEdit('')}>Done</button></footer></section></div>}
 </>;
}
