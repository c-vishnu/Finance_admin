import {useEffect,useRef,useState} from 'react';
import {IconBuildingBank,IconCalendar,IconClock,IconEye,IconFileText,IconHash,IconMapPin,IconPencil,IconPlus,IconSearch,IconSitemap,IconTrash,IconUser,IconX} from '@tabler/icons-react';
import {ItemSearch,TaxSelection} from './InvoiceLineControls.jsx';
import {calculate,money} from './invoice-engine.js';
import {customerStates,customerTypeOf} from './Customers.jsx';
import {COUNTRIES,PAYMENT_TERM_DAYS,blankAddress,composeAddress,customerTermDays,gstStateCode,parseAddress,placeOfSupplySuggestion,placeOfSupplyStatus,PLACE_OF_SUPPLY_SOURCE} from './customer-tax.js';
import EmptyState from './EmptyState.jsx';
import {itemScopeError} from './sales-order-service.js';
import './sales-document-tax.css';
/* The card carries one pencil, so its menu closes through one named closer - on an outside pointer, on Escape, and when an entry is taken. */
const closeFactEditMenus=()=>document.querySelectorAll('.soFactEdit[open]').forEach(node=>node.removeAttribute('open'));
/* The add-item menu closes the way every other menu in the app does: outside, Escape, or a choice. */
const closeAddItemMenus=()=>document.querySelectorAll('.soAddItem[open]').forEach(node=>node.removeAttribute('open'));
/* A customer can hold its address as the structured object, as the composed string, or - for a
   record written before either - only as a free-text line with no state at all. The editor is
   seeded through this one reader so all three open with as much filled in as the record holds,
   and the customer registered state stands in for a billing state that was never captured. */
/* Re-reads the customer snapshot onto a document. It is the same read that choosing a customer does,
   so a draft that comes back after the customer master was edited from the document shows what was
   just changed rather than the copy taken before. */
export function applyCustomerSnapshot(form,customer){
 const days=customerTermDays(customer),suggestion=placeOfSupplySuggestion(customer,customerStates);
 return {...form,
  customerId:customer?.id||form.customerId,customerName:customer?.name||'',receivableAccount:customer?.account||'',
  customerGstin:customer?.gstin||'',customerGstTreatment:customer?.gstTreatment||'',customerState:String(customer?.state||''),
  billing:customer?.billing||'',shipping:customer?.shipping||'',
  billingAddress:customerAddress(customer,'billing'),shippingAddress:customerAddress(customer,'shipping'),
  place:suggestion.state,placeSource:suggestion.source,placeCode:gstStateCode(suggestion.state),
  terms:String(days),dueDate:due(form.date,days)};
}

export function customerAddress(customer,which){
 const record=customer||{};
 const structured=which==='billing'?record.billingAddress:record.shippingAddress;
 const fallback=parseAddress(record[which]);
 const base={...blankAddress(),...(structured||fallback)};
 const filled=Object.fromEntries(Object.entries(base).map(([key,value])=>[key,value||fallback[key]||'']));
 return {...filled,state:filled.state||String(record.state||'')};
}
export const blankDocumentLine=()=>({description:'',qty:'1',unit:'pcs',rate:'0',discount:'0',discountType:'%',tax:'18',cess:'0',income:'',priceTaxMode:'exclusive'});
export const due=(date,days)=>{const d=new Date(date+'T12:00:00Z');if(Number.isNaN(d.getTime()))return '';d.setUTCDate(d.getUTCDate()+Number(days));return d.toISOString().slice(0,10)};
/* The due date is stated under the payment terms rather than offered as a second field. The terms are
   a fixed number of days from the document date, so the date is fully determined by the two fields
   beside it: it can never disagree with them, and it never needs a third control in the one row the
   operator answers before anything is chosen. */
/* The place of supply follows the addresses until the operator overrides it. A stored document that
   carries a place but no source predates the field, so it is treated as the operator own value:
   opening an old document and editing an address must never silently move its tax treatment.
   These live at module scope because the field itself is rendered by the two host pages, in their
   Additional details block, while the address editor that also re-derives it lives in this file. */
const placeIsManual=source=>source.placeSource===PLACE_OF_SUPPLY_SOURCE.MANUAL||(!!String(source.place||'').trim()&&!source.placeSource);
const placeSuggestionOf=(source,customerState)=>placeOfSupplySuggestion({billing:source.billing,shipping:source.shipping,state:customerState||''},customerStates);
const applyPlaceFor=(next,customerState,force=false)=>{if(!force&&placeIsManual(next))return next;const suggestion=placeSuggestionOf(next,customerState);return {...next,place:suggestion.state,placeSource:suggestion.source,placeCode:gstStateCode(suggestion.state)}};

const shortDate=value=>{const d=new Date(String(value||'')+'T00:00:00');return Number.isNaN(d.getTime())?'Not set':d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})};
export const customerInitials=name=>String(name||'').trim().split(/\s+/).slice(0,2).map(word=>word[0]||'').join('').toUpperCase()||'C';
/* A plain search box, not a dropdown: the customer field is typed into directly and the matches
   appear under it, the same interaction the item cell on this page already uses. It keeps the
   combobox/listbox roles so the keyboard, a screen reader and the outside-pointer dismissal all
   behave the way the shared SearchSelect they replaced did. */
export function CustomerSearch({customers,value,onSelect,onEditCustomer}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
 const inputRef=useRef(null);
 const selected=customers.find(entry=>entry.id===value)||null;
 const terms=(query.toLowerCase().match(/"[^\"]+"|\S+/g)||[]).map(t=>t.replaceAll('"',''));
 const matches=customers.filter(c=>terms.every(t=>`${c.name} ${c.code||''} ${c.phone||''} ${c.gstin||''}`.toLowerCase().includes(t)));
 /* Focusing always starts a fresh search, and choosing releases the caret: the box then shows the
    name it was committed with, so a second search can never append to the first one. */
 function pick(customer){onSelect(customer.id);setOpen(false);setQuery('');setActive(0);inputRef.current&&inputRef.current.blur()}
 return <div className="soCustomerSearch" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)){setOpen(false);setQuery('')}}}>
  <span className="soControl"><IconUser size={18} stroke={1.8} aria-hidden="true"/><input role="combobox" aria-label="Search customers" aria-expanded={open} aria-autocomplete="list" aria-controls="so-customer-list" placeholder="Search a customer by name, phone or GSTIN" value={open?query:selected?.name||''} onFocus={()=>{setOpen(true);setQuery('');setActive(0)}} onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(0)}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(a=>Math.min(a+1,matches.length-1))}if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(0,a-1))}if(e.key==='Enter'&&open){e.preventDefault();if(matches[active])pick(matches[active])}if(e.key==='Escape'){e.preventDefault();setOpen(false);setQuery('')}}} ref={inputRef}/>{selected&&<button type="button" className="soCustomerClear" aria-label={'Clear '+selected.name} onClick={()=>{onSelect('');setQuery('');setOpen(true)}}><IconX size={15}/></button>}</span>
  {open&&<div className="soCustomerResults" id="so-customer-list" role="listbox" aria-label="Customers">{matches.map((c,n)=><button type="button" role="option" aria-selected={c.id===value} key={c.id} className={n===active?'active':''} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(n)} onClick={()=>pick(c)}><span><b>{c.name}</b><small>{[c.billing,c.phone].filter(Boolean).join(' \u00b7 ')||'No address recorded'}</small></span></button>)}{!matches.length&&<p className="soCustomerEmptyMatch">{'No customer matches \u201c'+query+'\u201d.'}{onEditCustomer&&<button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>onEditCustomer()}>Create or edit a customer</button>}</p>}</div>}
 </div>;
}

/* The one field shape on the create page, matching the Record Transaction page: the label over a
   bordered control that carries its own icon, so a field is recognised by its mark as well as by
   its word. */
function Field({label,icon:Icon,hint,children}){
 return <label className="soField"><span>{label}</span><span className="soControl">{Icon&&<Icon size={18} stroke={1.8} aria-hidden="true"/>}{children}</span>{hint}</label>;
}

/* Place of supply is rendered by the host pages inside their Additional details block, and it
   recomputes its own source line and reset from the document, so opening a saved document and
   editing an address still cannot move a value the operator set by hand. */
export function PlaceOfSupplyField({form,setForm,customer}){
 const suggestion=placeSuggestionOf(form,customer?.state||'');
 const status=placeOfSupplyStatus(form.placeSource,suggestion);
 const reset=()=>setForm(current=>applyPlaceFor(current,customer?.state||'',true));
 return <Field label="Place of supply *" icon={IconMapPin} hint={<small className="soPlaceHint" role="status">{status.text}{status.reset&&<> &middot; <button type="button" className="soPlaceReset" onClick={reset}>{status.reset}</button></>}</small>}>
  <select id="soPlaceOfSupply" required value={form.place||''} onChange={e=>setForm({...form,place:e.target.value,placeSource:PLACE_OF_SUPPLY_SOURCE.MANUAL,placeCode:gstStateCode(e.target.value)})}>
   <option value="">Select Place of Supply</option>{customerStates.map(state=><option key={state}>{state}</option>)}
  </select>
 </Field>;
}

export default function SalesDocumentFields({form,setForm,customers,items,config,organisations=[],kind='invoice',creditOutstanding=0,onEditCustomer,onCreateItem,onCreateCustomer,autoNumber='',children}){
 const blankLine=blankDocumentLine;
 /* The card's one pencil menu closes on an outside pointer or Escape, the way every other menu in the app does. It owns its own listener because this component is mounted by two pages, neither of which knows about it. */
 useEffect(()=>{const onPointerDown=event=>{document.querySelectorAll('.soFactEdit[open],.soAddItem[open]').forEach(node=>{if(!node.contains(event.target))node.removeAttribute('open')})};const onEscape=event=>{if(event.key==='Escape'){closeFactEditMenus();closeAddItemMenus()}};document.addEventListener('pointerdown',onPointerDown);document.addEventListener('keydown',onEscape);return()=>{document.removeEventListener('pointerdown',onPointerDown);document.removeEventListener('keydown',onEscape)}},[]);
 /* One layout serves both sales documents: the order and the invoice read the same two cards, the
    same read-only customer facts and the same item grid, so the two pages cannot drift apart.
    Only the wording and the two genuinely document-specific controls differ - the invoice number
    and date labels, the invoice unit input, and the invoice-only tax note. */
 const docWord=kind==='order'?'order':'invoice';
 const docTitle=kind==='order'?'Sales order':'Invoice';
 /* The order page shows the selected customer's addresses as a summary with an edit action, and
    states the tax identity it inherits from the master. The editor changes this order's copy
    only - the customer master keeps its own address, so editing here never silently rewrites a
    saved customer. */
 const [addressEdit,setAddressEdit]=useState('');
 /* The row of actions on the customer card: the pen and this trigger sit together at the card trailing
    edge, which a native <details> cannot do because its summary and its body must stay in one element. */
 const [customerMore,setCustomerMore]=useState(false);
 /* The stored address is multi-line so it prints one part per line. On the form it is shown as
    one flowing block instead, because a five-line address in each of two cards pushed the form
    down for no gain - the whole line is readable at the card's width. */
 const inlineAddress=value=>String(value||'').split(/\r?\n/).map(part=>part.trim()).filter(Boolean).join(', ');
 /* The order stores a day count, so the list is built from the same table the customer form uses -
   Due on Receipt / Net 15 / Net 30 / Net 45 / Net 60 - plus a row for the Custom credit period the
   customer master allows. A hardcoded [0,7,15,30,45] left a Net 60 or Custom customer showing a
   blank select while the stored term was 60, because no option carried that value. */
 const termOptions=(()=>{const known=Object.values(PAYMENT_TERM_DAYS).map(Number),list=Object.entries(PAYMENT_TERM_DAYS).map(([label,days])=>[String(days),label]),current=Number(form.terms);if(String(form.terms)!==''&&Number.isFinite(current)&&!known.includes(current))list.push([String(current),'Net '+current+' days']);return list.sort((a,b)=>Number(a[0])-Number(b[0]))})();
const selectedCustomer=customers.find(entry=>entry.id===form.customerId)||null;
/* The tax identity the document was raised with. Editing the customer later must not rewrite the
   GSTIN on an invoice that has already been issued, so the frozen value wins over the master. */
const documentGstin=form.customerGstin||selectedCustomer?.gstin||'';
 /* The order carries its own organisation and branch, seeded from the working context. The branch
    list follows the chosen organisation, and switching organisation clears the branch so a stale
    branch can never be saved against the wrong scope. */
 const selectedOrganisation=organisations.find(entry=>entry.id===form.organizationId)||null;
 function changeScope(organisationId,branchId){
  const organisation=organisations.find(entry=>entry.id===organisationId)||null;
  const branch=(organisation?.branches||[]).find(item=>String(item.id)===String(branchId))||null;
  setForm(current=>({...current,organizationId:organisationId,organizationName:organisation?.name||'',branchId:branchId||'',branchName:branch?.name||''}));
 }
 const selectedBranch=(selectedOrganisation?.branches||[]).find(item=>String(item.id)===String(form.branchId))||null;
 /* The Item master may hold either reference for the same scope, so the line check is given both. */
 const scope={organisationRefs:[selectedOrganisation?.id,selectedOrganisation?.code],branchRefs:[selectedBranch?.id,selectedBranch?.name],organisationName:selectedOrganisation?.name||form.organizationName||'',branchName:selectedBranch?.name||form.branchName||''};
 /* A line whose item is not set up for the chosen organisation, or is not stocked at the chosen
    branch, is reported on the line itself rather than only on save. */
 const lineScopeError=line=>{const item=(items||[]).find(entry=>entry.id===line.item||entry.id===line.itemId);return item?itemScopeError(item,scope):''};
 /* An order whose billing and shipping addresses match says so once instead of printing the same
    block twice; the two cards only appear when they actually differ. Editing the single card
    keeps the two stored fields in step. */
 const billingText=inlineAddress(form.billing),shippingText=inlineAddress(form.shipping);
 /* Splitting is remembered per customer, so choosing another customer returns to the single card
    when that customer's two addresses match. */
 const [splitFor,setSplitFor]=useState('');
 const sameAddress=(!shippingText||shippingText===billingText)&&splitFor!==form.customerId;
 /* Selecting the customer fills the place of supply in, and records where it came from. The operator
    can still change it; that is what makes the value manual and stops later address edits rewriting
    it (see applyPlace below). */
 function chooseCustomer(id){const c=customers.find(x=>x.id===id),days=customerTermDays(c),suggestion=placeOfSupplySuggestion(c,customerStates);setForm({...form,customerId:id,customerName:c?.name||'',receivableAccount:c?.account||'',customerGstin:c?.gstin||'',customerGstTreatment:c?.gstTreatment||'',customerState:String(c?.state||''),billing:c?.billing||'',shipping:c?.shipping||'',billingAddress:customerAddress(c,'billing'),shippingAddress:customerAddress(c,'shipping'),place:suggestion.state,placeSource:suggestion.source,placeCode:gstStateCode(suggestion.state),terms:String(days),dueDate:due(form.date,days)})}
 const field=(name,label,type='text',icon)=><Field label={label} icon={icon}><input type={type} value={form[name]||''} onChange={e=>setForm({...form,[name]:e.target.value,...(name==='date'&&e.target.value?{dueDate:due(e.target.value,form.terms)}:{})})}/></Field>;
 /* The place of supply follows the addresses until the operator overrides it. A stored document that
    carries a place but no source predates this field, so it is treated as the operator's own value:
    opening an old order or invoice and editing an address must never silently move its tax treatment. */
 /* Only a derived value is recalculated; a manual one is the operator's and is left alone. When no
    address yields a state the field goes back to unselected rather than guessing one. */
 const applyPlace=(next,force=false)=>applyPlaceFor(next,selectedCustomer?.state||'',force);
 /* The editor works on the structured address and composes the stored string from it, so Address 1,
    Address 2, City, State, PIN and Country are separate fields rather than one text blob. A customer
    written before that shape existed is read back through parseAddress instead. */
 const addressKey=which=>which==='billing'?'billingAddress':'shippingAddress';
 /* The stored address is structured, so the read-out prints it as an address - street, then city
    and state, then PIN and country - instead of the one flattened line the fact list used. */
 /* One line for the compact profile strip. Each part is printed once: a stored address can repeat
    itself - the city field is 'India' on some records, and the country is 'India' too - and the
    repeat reads as a mistake in the address rather than as data. */
 const addressLine=which=>{const a=addressOf(which),clean=value=>String(value||'').trim(),country=clean(a.country);
  /* A record can hold the country in its city field - the seed data does - which would print 'India'
     before the state and again at the end. The country is dropped from the body and appended once. */
  const body=[a.line1,a.line2,a.city,a.state,a.pin].map(clean).filter(part=>part&&part!==country).filter((part,index,all)=>all.indexOf(part)===index);
  return [...body,...(country?[country]:[])].join(', ')};
 const addressOf=which=>form[addressKey(which)]?{...blankAddress(),...form[addressKey(which)]}:customerAddress(selectedCustomer,which);
 function updateAddress(key,value){
  setForm(current=>{
   const which=addressEdit,slot=addressKey(which);
   const address={...blankAddress(),...(current[slot]||parseAddress(current[which])),[key]:value};
   const composed=composeAddress(address);
   const next={...current,[slot]:address,[which]:composed,...(sameAddress&&which==='billing'?{[addressKey('shipping')]:address,shipping:composed}:{})};
   return applyPlace(next);
  });
 }
 const updateLine=(index,key,value)=>setForm({...form,lines:form.lines.map((l,n)=>n===index?{...l,[key]:value}:l)});
 /* The add-item menu offers the two ways a line is born here. A picked line is filled from the Item
    master; an ad hoc line has no item behind it, so its name is typed on the line and its price
    treatment has to be chosen, which is what the engine asks a line with no master record for. */
 /* One way to add a line: a blank row whose single item box searches the master and names an ad hoc
   line. The menu no longer offers a second kind of row for the operator to choose between. */
 const addLine=()=>setForm(current=>({...current,lines:[...current.lines,blankLine()]}));
 const itemDefaults=item=>{const rate=item.taxApplicable===false?0:Number(item.taxRate??18),cess=Number(item.cessRate||0),intra=form.place.trim().toLowerCase()===config.state.trim().toLowerCase();return {item:item.id,description:item.name,unit:item.unit,rate:item.price||'0',income:item.salesAccount||'',hsnSac:item.hsnSac||'',itemType:item.type||'Goods',priceTaxMode:item.priceTaxMode||'exclusive',taxes:intra?{cgst:rate/2,sgst:rate/2,igst:0,cess}:{cgst:0,sgst:0,igst:rate,cess}}};
 let preview,previewError;try{preview=calculate(form,config)}catch(e){previewError=e.message}
/* The credit limit is set on the customer master in rupees while every amount on this page is in
   paise. The warning is advisory - a business may still raise the order - so it is stated, not
   blocked. It has to be computed here, after `preview`, because it reads the order total. */
 const creditLimit=Math.round(Number(selectedCustomer?.limit||0)*100),projectedCredit=creditOutstanding+(preview?preview.total:0),overLimit=kind==='order'&&creditLimit>0&&projectedCredit>creditLimit;
 const totals=t=><dl className="ivTotals">{[['Subtotal',t.subtotal],['Discount',t.discount],['Taxable amount',t.taxable],...(t.intra?[['CGST',t.cgst],['SGST',t.sgst]]:[['IGST',t.igst]]),...(t.cess?[['Cess',t.cess]]:[]),['Tax',t.cgst+t.sgst+t.igst+t.cess],['Round off',t.roundOff],['Grand total',t.total]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{money(v)}</dd></div>)}</dl>;
 return <>
 <div className="ivCard soFormSection"><div className="soSectionHead"><h3>Customer *</h3></div><div className="soCustomerRow"><div className="soField soFieldSearch"><CustomerSearch customers={customers} value={form.customerId} onSelect={id=>chooseCustomer(id)} onEditCustomer={selectedCustomer&&onEditCustomer?()=>onEditCustomer(form.customerId):null}/></div><button type="button" className="soCustomerCreate" aria-label="Create customer" title="Create customer" disabled={!onCreateCustomer} onClick={()=>onCreateCustomer&&onCreateCustomer()}><IconPlus size={18} stroke={1.8} aria-hidden="true"/></button></div><div className="soCustomerRef">{selectedCustomer?<><div className="soCustomerProfile"><span className="soCustomerAvatar" aria-hidden="true">{customerInitials(selectedCustomer?.name)}</span><div className="soCustomerLines"><span className="soCustomerHead"><strong className="soCustomerName">{selectedCustomer?.name||'Customer'}</strong><span className="soCustomerType">{customerTypeOf(selectedCustomer)}</span></span><span className="soCustomerAddress"><b>Billing Address:</b> {addressLine('billing')||'Not provided'}</span></div><div className="soCustomerMeta" title="What this customer still owes the business"><span>Net receivable</span><strong>{money(creditOutstanding)}</strong></div></div><div className="soCustomerActions"><details className="soFactEdit"><summary aria-label="Edit address" title="Edit address"><IconPencil size={15}/></summary><div className="soFactEditMenu"><button type="button" onClick={()=>{closeFactEditMenus();setAddressEdit('billing')}}>Edit billing address</button><button type="button" onClick={()=>{closeFactEditMenus();setAddressEdit('shipping')}}>Edit shipping address</button><button type="button" onClick={()=>{closeFactEditMenus();onEditCustomer&&form.customerId&&onEditCustomer(form.customerId)}}>Edit customer details</button></div></details><button type="button" className="soCustomerMoreToggle" aria-label="View customer details" title="View customer details" aria-expanded={customerMore} onClick={()=>setCustomerMore(!customerMore)}><IconEye size={17}/></button></div>{customerMore&&<div className="soCustomerMoreBody"><p className="soFactCaption">Read from the customer record. The tax identity and the contact come from the customer master; the addresses can be changed on this {docWord} only.</p><dl className="soFactList"><div className="soFactItem"><dt>GST treatment</dt><dd>{selectedCustomer?.gstTreatment||'Not recorded'}</dd></div><div className="soFactItem"><dt>GSTIN</dt><dd>{selectedCustomer?.gstin||'Not registered'}{documentGstin&&documentGstin!==selectedCustomer?.gstin&&<small className="soDocumentIdentityNote">This document keeps {documentGstin}.</small>}</dd></div><div className="soFactItem"><dt>PAN</dt><dd>{selectedCustomer?.pan||'Not recorded'}</dd></div><div className="soFactItem"><dt>Contact person</dt><dd>{selectedCustomer?.contact||'Not recorded'}</dd></div><div className="soFactItem"><dt>Phone</dt><dd>{selectedCustomer?.phone||'Not recorded'}</dd></div><div className="soFactItem"><dt>Credit limit</dt><dd>{creditLimit?money(creditLimit):'Not set'}</dd></div><div className="soFactItem soFactWide"><dt>Billing address</dt><dd>{billingText||'Not provided'}{sameAddress&&<small className="soAddressSameNote">Shipping address is the same. <button type="button" className="soAddressSplit" onClick={()=>setSplitFor(form.customerId)}>Use a different shipping address</button></small>}</dd></div>{!sameAddress&&<div className="soFactItem soFactWide"><dt>Shipping address</dt><dd>{inlineAddress(form.shipping)||'Not provided'}</dd></div>}</dl></div>}{overLimit&&<p className="soCreditNotice" role="status">{selectedCustomer?.name||'This customer'} already owes <b>{money(creditOutstanding)}</b>; this {docWord} takes the balance to <b>{money(projectedCredit)}</b>, past the <b>{money(creditLimit)}</b> credit limit.</p>}</>:<EmptyState variant="customer" className="soCustomerEmpty" title="No customer selected" description={`Search for a customer above to load their tax identity, contact and addresses onto this ${docWord}.`}/>}</div></div>
<div className="ivCard soFormSection"><div className="soSectionHead"><h3>{kind==='order'?'Order details':'Invoice details'}</h3></div><div className="ivFields soFieldRow soFieldRow4"><Field label={docTitle+' ID'} icon={IconHash}><input placeholder={autoNumber||'Automatic'} value={form.number||''} onChange={e=>setForm({...form,number:e.target.value})}/></Field>{field('date',docTitle+' date *','date',IconCalendar)}{field('reference','Reference number','text',IconFileText)}<Field label="Payment terms" icon={IconClock} hint={<small className="soDueHint">Due {shortDate(form.dueDate)}</small>}><select value={form.terms} onChange={e=>setForm({...form,terms:e.target.value,dueDate:due(form.date,e.target.value)})}>{termOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field></div>
 <div className="ivFields soFieldRow soFieldRow3"><Field label="Organisation *" icon={IconBuildingBank}><select value={form.organizationId||''} onChange={event=>changeScope(event.target.value,'')} required><option value=''>Select organisation</option>{organisations.map(entry=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><Field label="Branch *" icon={IconSitemap}><select value={form.branchId||''} onChange={event=>changeScope(form.organizationId,event.target.value)} required disabled={!selectedOrganisation}><option value=''>{selectedOrganisation?'Select branch':'Select an organisation first'}</option>{(selectedOrganisation?.branches||[]).map(entry=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field><PlaceOfSupplyField form={form} setForm={setForm} customer={selectedCustomer}/></div></div> <div className="ivCard"><div className="ivHeading"><h3>{kind==='order'?'Order items':'Invoice items'}<span className="soItemsCount">{form.lines.length} {form.lines.length===1?'item':'items'}</span></h3><details className="soAddItem"><summary className="soAddItemMain"><IconPlus size={16}/>Add item</summary><div className="soAddItemMenu"><button type="button" onClick={()=>{closeAddItemMenus();addLine()}}>Add item row</button>{onCreateItem&&<button type="button" onClick={()=>{closeAddItemMenus();onCreateItem()}}>Create new item</button>}</div></details></div><div className="ivScroll"><table className="ivLineTable"><thead><tr>{['Item','Quantity','Rate ₹','Discount','Tax','Amount',''].map((s,n)=><th key={n}>{s}</th>)}</tr></thead><tbody>{form.lines.map((l,n)=><tr key={n}><td><div className="soItemCell"><ItemSearch items={items} line={l} index={n} onSelect={item=>setForm(f=>({...f,lines:f.lines.map((x,k)=>k===n?{...x,...itemDefaults(item)}:x)}))} onAdHoc={text=>setForm(f=>({...f,lines:f.lines.map((x,k)=>k===n?{...blankLine(),adHoc:true,description:text}:x)}))} onType={l.adHoc?text=>updateLine(n,'description',text):undefined}/>{l.hsnSac?<small className="soHsnValue">{(l.itemType==='Service'?'SAC':'HSN')+' '+l.hsnSac}</small>:null}{l.adHoc&&<small className="soAdHocNote">Ad hoc line: no item master record. Its price type starts tax exclusive - change it below if the rate already includes tax.</small>}{lineScopeError(l)&&<small className="itemError">{lineScopeError(l)}</small>}</div></td><td><div className="ivQtyCell"><input aria-label={'qty '+(n+1)} value={l.qty} onChange={e=>updateLine(n,'qty',e.target.value)}/>{kind==='order'?<span className="soUnitValue" title={l.item||l.adHoc?'Unit from the Item master':'No unit'}>{l.item||l.adHoc?(l.unit||'—'):'—'}</span>:<input className="soUnitInput" aria-label={'unit '+(n+1)} value={l.unit} onChange={e=>updateLine(n,'unit',e.target.value)}/>}</div></td><td><div className="ivRateCell"><input aria-label={'rate '+(n+1)} value={l.rate} onChange={e=>updateLine(n,'rate',e.target.value)}/><small className={'ivPriceType '+(l.priceTaxMode==='inclusive'?'is-inclusive':'is-exclusive')}>{l.priceTaxMode==='inclusive'?'Incl. Tax':'Excl. Tax'}</small></div></td><td><div className="ivDiscount"><input aria-label={'Discount '+(n+1)} value={l.discount} onChange={e=>updateLine(n,'discount',e.target.value)}/><select aria-label={'Discount type '+(n+1)} value={l.discountType} onChange={e=>updateLine(n,'discountType',e.target.value)}><option>%</option><option value="fixed">₹</option></select></div></td><td><div className="ivLineTax"><TaxSelection line={l} index={n} intra={form.place.trim().toLowerCase()===config.state.trim().toLowerCase()} onChange={taxes=>updateLine(n,'taxes',taxes)}/><select aria-label={'Price tax treatment '+(n+1)} value={l.priceTaxMode||''} onChange={e=>updateLine(n,'priceTaxMode',e.target.value)}><option value="">Select price type</option><option value="exclusive">Tax exclusive</option><option value="inclusive">Tax inclusive</option></select></div></td><td>{preview?money(preview.lines[n].taxable):'—'}</td><td><button type="button" aria-label="Remove line" disabled={form.lines.length===1} onClick={()=>setForm({...form,lines:form.lines.filter((_,k)=>k!==n)})}><IconTrash size={16}/></button></td></tr>)}</tbody></table></div></div><section className="ivCard soBillingSummary"><div className="soSummaryGrid"><div className="soSummaryLeft"><label className="soSummaryNote"><span>Customer note</span><textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} placeholder={'Anything to record against this '+docWord+'.'} aria-label="Customer note"/></label>{children}</div><div className="soSummaryRight"><div className="soSummaryHead"><h3>Billing summary</h3><span className="soCurrencyChip" title="Every amount on this document is in Indian rupees">INR ₹</span></div><div className="soSummaryMoney">{preview?totals(preview):<p role="status">{previewError||'Select an item and place of supply to calculate totals.'}</p>}{kind!=='order'&&<small>Item tax and price treatment are filled from the Item master. You can change them on this document.</small>}</div><p className="soPostingNote">{kind==='order'?'A sales order is an operational record: it posts nothing to the ledger. Accounting entries are created only when its invoice is posted.':'This invoice reaches the ledger when it is approved and posted from the register, not from here.'}</p></div></div></section>
 {addressEdit&&<div className="soAddressLayer" role="dialog" aria-modal="true" aria-labelledby="soAddressTitle"><button type="button" className="soAddressBackdrop" aria-label="Close address editor" onClick={()=>setAddressEdit('')}/><section className="soAddressDialog"><div className="soAddressDialogHead"><h3 id="soAddressTitle">{addressEdit==='billing'?'Edit billing address':'Edit shipping address'}</h3><button type="button" className="soAddressClose" aria-label="Close address editor" onClick={()=>setAddressEdit('')}><IconX size={18}/></button></div><div className="soAddressFields"><label className="soAddressFieldWide">Address 1<input autoFocus={true} value={addressOf(addressEdit)['line1']||''} onChange={event=>updateAddress('line1',event.target.value)}/></label><label className="soAddressFieldWide">Address 2<input value={addressOf(addressEdit)['line2']||''} onChange={event=>updateAddress('line2',event.target.value)}/></label><label className="soAddressField">City<input value={addressOf(addressEdit)['city']||''} onChange={event=>updateAddress('city',event.target.value)}/></label><label className="soAddressField">State<select value={addressOf(addressEdit)['state']||''} onChange={event=>updateAddress('state',event.target.value)}><option value="">Select state</option>{customerStates.map(state=><option key={state}>{state}</option>)}</select></label><label className="soAddressField">PIN code<input value={addressOf(addressEdit)['pin']||''} onChange={event=>updateAddress('pin',event.target.value)}/></label><label className="soAddressField">Country<select value={addressOf(addressEdit)['country']||'India'} onChange={event=>updateAddress('country',event.target.value)}>{COUNTRIES.map(country=><option key={country}>{country}</option>)}</select></label></div><p className="soAddressNote">This changes the address on this {docWord} only. {selectedCustomer?.name?selectedCustomer.name+' keeps its own address in the customer master.':'The customer master keeps its own address.'}</p><footer><button type="button" onClick={()=>setAddressEdit('')}>Cancel</button><button type="button" className="primary" onClick={()=>setAddressEdit('')}>Done</button></footer></section></div>}
 </>;
}
