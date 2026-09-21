import {useEffect,useState} from 'react';
import {IconPencil,IconPlus,IconTrash,IconX} from '@tabler/icons-react';
import {ItemSearch,TaxSelection} from './InvoiceLineControls.jsx';
import {calculate,money} from './invoice-engine.js';
import {customerStates} from './Customers.jsx';
import {COUNTRIES,PAYMENT_TERM_DAYS,blankAddress,composeAddress,customerTermDays,gstStateCode,parseAddress,placeOfSupplySuggestion,placeOfSupplyStatus,PLACE_OF_SUPPLY_SOURCE} from './customer-tax.js';
import SearchSelect from './SearchSelect.jsx';
import EmptyState from './EmptyState.jsx';
import {itemScopeError} from './sales-order-service.js';
import './sales-document-tax.css';
/* The card carries one pencil, so its menu closes through one named closer - on an outside pointer, on Escape, and when an entry is taken. */
const closeFactEditMenus=()=>document.querySelectorAll('.soFactEdit[open]').forEach(node=>node.removeAttribute('open'));
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
export default function SalesDocumentFields({form,setForm,customers,items,config,organisations=[],kind='invoice',creditOutstanding=0,onEditCustomer}){
 const blankLine=blankDocumentLine;
 /* The card's one pencil menu closes on an outside pointer or Escape, the way every other menu in the app does. It owns its own listener because this component is mounted by two pages, neither of which knows about it. */
 useEffect(()=>{const onPointerDown=event=>{document.querySelectorAll('.soFactEdit[open]').forEach(node=>{if(!node.contains(event.target))node.removeAttribute('open')})};const onEscape=event=>{if(event.key==='Escape')closeFactEditMenus()};document.addEventListener('pointerdown',onPointerDown);document.addEventListener('keydown',onEscape);return()=>{document.removeEventListener('pointerdown',onPointerDown);document.removeEventListener('keydown',onEscape)}},[]);
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
 /* The stored address is multi-line so it prints one part per line. On the form it is shown as
    one flowing block instead, because a five-line address in each of two cards pushed the form
    down for no gain - the whole line is readable at the card's width. */
 const inlineAddress=value=>String(value||'').split(/\r?\n/).map(part=>part.trim()).filter(Boolean).join(', ');
 /* The order stores a day count, so the list is built from the same table the customer form uses -
   Due on Receipt / Net 15 / Net 30 / Net 45 / Net 60 - plus a row for the Custom credit period the
   customer master allows. A hardcoded [0,7,15,30,45] left a Net 60 or Custom customer showing a
   blank select while the stored term was 60, because no option carried that value. */
 const termOptions=(()=>{const known=Object.values(PAYMENT_TERM_DAYS).map(Number),list=Object.entries(PAYMENT_TERM_DAYS).map(([label,days])=>[String(days),label]),current=Number(form.terms);if(String(form.terms)!==''&&Number.isFinite(current)&&!known.includes(current))list.push([String(current),'Net '+current+' days']);return list.sort((a,b)=>Number(a[0])-Number(b[0]))})();
/* The picker searches the customer NAME and shows the code or email underneath, so two
   similarly named customers can be told apart before the id is committed. */
 const customerOptions=customers.filter(entry=>entry.status!=='Inactive').map(entry=>({value:entry.id,label:entry.name,hint:entry.code||entry.email||''}));
const selectedCustomer=customers.find(entry=>entry.id===form.customerId)||null;
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
 function chooseCustomer(id){const c=customers.find(x=>x.id===id),days=customerTermDays(c),suggestion=placeOfSupplySuggestion(c,customerStates);setForm({...form,customerId:id,customerName:c?.name||'',receivableAccount:c?.account||'',billing:c?.billing||'',shipping:c?.shipping||'',billingAddress:customerAddress(c,'billing'),shippingAddress:customerAddress(c,'shipping'),place:suggestion.state,placeSource:suggestion.source,placeCode:gstStateCode(suggestion.state),terms:String(days),dueDate:due(form.date,days)})}
 const field=(name,label,type='text')=><label>{label}<input type={type} value={form[name]||''} onChange={e=>setForm({...form,[name]:e.target.value,...(name==='date'&&e.target.value?{dueDate:due(e.target.value,form.terms)}:{})})}/></label>;
 /* The place of supply follows the addresses until the operator overrides it. A stored document that
    carries a place but no source predates this field, so it is treated as the operator's own value:
    opening an old order or invoice and editing an address must never silently move its tax treatment. */
 const placeIsManual=source=>source.placeSource===PLACE_OF_SUPPLY_SOURCE.MANUAL||(!!String(source.place||'').trim()&&!source.placeSource);
 const placeSuggestionFor=source=>placeOfSupplySuggestion({billing:source.billing,shipping:source.shipping,state:selectedCustomer?.state||''},customerStates);
 /* Only a derived value is recalculated; a manual one is the operator's and is left alone. When no
    address yields a state the field goes back to unselected rather than guessing one. */
 const applyPlace=(next,force=false)=>{
  if(!force&&placeIsManual(next))return next;
  const suggestion=placeSuggestionFor(next);
  return {...next,place:suggestion.state,placeSource:suggestion.source,placeCode:gstStateCode(suggestion.state)};
 };
 /* The editor works on the structured address and composes the stored string from it, so Address 1,
    Address 2, City, State, PIN and Country are separate fields rather than one text blob. A customer
    written before that shape existed is read back through parseAddress instead. */
 const addressKey=which=>which==='billing'?'billingAddress':'shippingAddress';
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
 const resetPlace=()=>setForm(current=>applyPlace(current,true));
 const placeStatus=placeOfSupplyStatus(form.placeSource,placeSuggestionFor(form));
 const updateLine=(index,key,value)=>setForm({...form,lines:form.lines.map((l,n)=>n===index?{...l,[key]:value}:l)});
 const itemDefaults=item=>{const rate=item.taxApplicable===false?0:Number(item.taxRate??18),cess=Number(item.cessRate||0),intra=form.place.trim().toLowerCase()===config.state.trim().toLowerCase();return {item:item.id,description:item.name,unit:item.unit,rate:item.price||'0',income:item.salesAccount||'',priceTaxMode:item.priceTaxMode||'exclusive',taxes:intra?{cgst:rate/2,sgst:rate/2,igst:0,cess}:{cgst:0,sgst:0,igst:rate,cess}}};
 let preview,previewError;try{preview=calculate(form,config)}catch(e){previewError=e.message}
/* The credit limit is set on the customer master in rupees while every amount on this page is in
   paise. The warning is advisory - a business may still raise the order - so it is stated, not
   blocked. It has to be computed here, after `preview`, because it reads the order total. */
 const creditLimit=Math.round(Number(selectedCustomer?.limit||0)*100),projectedCredit=creditOutstanding+(preview?preview.total:0),overLimit=kind==='order'&&creditLimit>0&&projectedCredit>creditLimit;
 const totals=t=><dl className="ivTotals">{[['Subtotal',t.subtotal],['Discount',t.discount],['Taxable amount',t.taxable],...(t.intra?[['CGST',t.cgst],['SGST',t.sgst]]:[['IGST',t.igst]]),...(t.cess?[['Cess',t.cess]]:[]),['Tax',t.cgst+t.sgst+t.igst+t.cess],['Round off',t.roundOff],['Grand total',t.total]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{money(v)}</dd></div>)}</dl>;
 return <>
 <div className="soOrderTop"><div className="ivCard soFormSection"><div className="soSectionHead soFactHead"><div className="soSectionHeadText"><h3>Customer</h3></div>{/* The pencil acts on the chosen customer only: choosing one overwrites both addresses from the master, so editing them first would be discarded. */}{selectedCustomer&&<details className="soFactEdit"><summary aria-label="Edit address" title="Edit address"><IconPencil size={15}/></summary><div className="soFactEditMenu"><button type="button" onClick={()=>{closeFactEditMenus();setAddressEdit('billing')}}>Edit billing address</button><button type="button" onClick={()=>{closeFactEditMenus();setAddressEdit('shipping')}}>Edit shipping address</button><button type="button" onClick={()=>{closeFactEditMenus();onEditCustomer&&form.customerId&&onEditCustomer(form.customerId)}}>Edit customer details</button></div></details>}</div><div className="soCustomerRow"><div className="customerSelectField"><span className="customerSelectLabel">Customer *</span><SearchSelect value={form.customerId} options={customerOptions} onChange={id=>chooseCustomer(id)} placeholder="Search and select a customer" listLabel="Customers" searchLabel="Search customers"/></div></div><div className="soCustomerRef">{selectedCustomer?<><p className="soFactCaption">Read from the customer record. The tax identity and the contact come from the customer master; the addresses can be changed on this {docWord} only.</p><dl className="soFactList"><div className="soFactItem"><dt>GST treatment</dt><dd>{selectedCustomer?.gstTreatment||'Not recorded'}</dd></div><div className="soFactItem"><dt>GSTIN</dt><dd>{selectedCustomer?.gstin||'Not registered'}</dd></div><div className="soFactItem"><dt>PAN</dt><dd>{selectedCustomer?.pan||'Not recorded'}</dd></div><div className="soFactItem"><dt>Contact person</dt><dd>{selectedCustomer?.contact||'Not recorded'}</dd></div><div className="soFactItem"><dt>Phone</dt><dd>{selectedCustomer?.phone||'Not recorded'}</dd></div><div className="soFactItem"><dt>Credit limit</dt><dd>{creditLimit?money(creditLimit):'Not set'}</dd></div><div className="soFactItem soFactWide"><dt>Billing address</dt><dd>{billingText||'Not provided'}{sameAddress&&<small className="soAddressSameNote">Shipping address is the same. <button type="button" className="soAddressSplit" onClick={()=>setSplitFor(form.customerId)}>Use a different shipping address</button></small>}</dd></div>{!sameAddress&&<div className="soFactItem soFactWide"><dt>Shipping address</dt><dd>{inlineAddress(form.shipping)||'Not provided'}</dd></div>}</dl>{overLimit&&<p className="soCreditNotice" role="status">{selectedCustomer?.name||'This customer'} already owes <b>{money(creditOutstanding)}</b>; this {docWord} takes the balance to <b>{money(projectedCredit)}</b>, past the <b>{money(creditLimit)}</b> credit limit.</p>}</>:<EmptyState variant="customer" className="soCustomerEmpty" title="No customer selected" description={`Search for a customer above to load their tax identity, contact and addresses onto this ${docWord}.`}/>}</div></div><div className="ivCard soFormSection"><div className="soSectionHead"><h3>{kind==='order'?'Order details':'Invoice details'}</h3></div><div className="ivFields soFieldRow soFieldRow4"><label>Organisation *<select value={form.organizationId||''} onChange={event=>changeScope(event.target.value,'')} required><option value=''>Select organisation</option>{organisations.map(entry=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label>Branch *<select value={form.branchId||''} onChange={event=>changeScope(form.organizationId,event.target.value)} required disabled={!selectedOrganisation}><option value=''>{selectedOrganisation?'Select branch':'Select an organisation first'}</option>{(selectedOrganisation?.branches||[]).map(entry=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label>{docTitle} number<input placeholder="Automatic" value={form.number||''} onChange={e=>setForm({...form,number:e.target.value})}/></label>{field('date',docTitle+' date','date')}{field('reference','Reference number')}<label>Payment terms<select value={form.terms} onChange={e=>setForm({...form,terms:e.target.value,dueDate:due(form.date,e.target.value)})}>{termOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{field('dueDate','Due date','date')}<label>Place of supply *<select id="soPlaceOfSupply" required value={form.place||''} onChange={e=>setForm({...form,place:e.target.value,placeSource:PLACE_OF_SUPPLY_SOURCE.MANUAL,placeCode:gstStateCode(e.target.value)})}><option value="">Select Place of Supply</option>{customerStates.map(state=><option key={state}>{state}</option>)}</select><small className="soPlaceHint" role="status">{placeStatus.text}{placeStatus.reset&&<> &middot; <button type="button" className="soPlaceReset" onClick={resetPlace}>{placeStatus.reset}</button></>}</small></label></div></div></div>
 <div className="ivCard"><div className="ivHeading"><h3>{kind==='order'?'Order items':'Invoice items'}</h3><button type="button" onClick={()=>setForm({...form,lines:[...form.lines,blankLine()]})}><IconPlus size={16}/>Add line</button></div><div className="ivScroll"><table className="ivLineTable"><thead><tr>{['Item','Quantity','Unit','Rate ₹','Discount','Tax','Amount',''].map((s,n)=><th key={n}>{s}</th>)}</tr></thead><tbody>{form.lines.map((l,n)=><tr key={n}><td><ItemSearch items={items} line={l} index={n} onSelect={item=>setForm(f=>({...f,lines:f.lines.map((x,k)=>k===n?{...x,...itemDefaults(item)}:x)}))}/>{lineScopeError(l)&&<small className="itemError">{lineScopeError(l)}</small>}</td><td><input aria-label={'qty '+(n+1)} value={l.qty} onChange={e=>updateLine(n,'qty',e.target.value)}/></td><td>{kind==='order'?<span className="soUnitValue" title="Unit from the Item master">{l.item?(l.unit||'—'):'—'}</span>:<input aria-label={'unit '+(n+1)} value={l.unit} onChange={e=>updateLine(n,'unit',e.target.value)}/>}</td><td><input aria-label={'rate '+(n+1)} value={l.rate} onChange={e=>updateLine(n,'rate',e.target.value)}/></td><td><div className="ivDiscount"><input aria-label={'Discount '+(n+1)} value={l.discount} onChange={e=>updateLine(n,'discount',e.target.value)}/><select aria-label={'Discount type '+(n+1)} value={l.discountType} onChange={e=>updateLine(n,'discountType',e.target.value)}><option>%</option><option value="fixed">₹</option></select></div></td><td><div className="ivLineTax"><TaxSelection line={l} index={n} intra={form.place.trim().toLowerCase()===config.state.trim().toLowerCase()} onChange={taxes=>updateLine(n,'taxes',taxes)}/><select aria-label={'Price tax treatment '+(n+1)} value={l.priceTaxMode||'exclusive'} onChange={e=>updateLine(n,'priceTaxMode',e.target.value)}><option value="exclusive">Tax exclusive</option><option value="inclusive">Tax inclusive</option></select></div></td><td>{preview?money(preview.lines[n].taxable):'—'}</td><td><button type="button" aria-label="Remove line" disabled={form.lines.length===1} onClick={()=>setForm({...form,lines:form.lines.filter((_,k)=>k!==n)})}><IconTrash size={16}/></button></td></tr>)}</tbody></table></div><section className="soBillingSummary"><div className="soSummaryHead"><h3>Billing summary</h3></div>{preview?totals(preview):<p role="status">{previewError||'Select an item and place of supply to calculate totals.'}</p>}{kind!=='order'&&<small>Item tax and price treatment are filled from the Item master. You can change them on this document.</small>}</section></div>
 {addressEdit&&<div className="soAddressLayer" role="dialog" aria-modal="true" aria-labelledby="soAddressTitle"><button type="button" className="soAddressBackdrop" aria-label="Close address editor" onClick={()=>setAddressEdit('')}/><section className="soAddressDialog"><div className="soAddressDialogHead"><h3 id="soAddressTitle">{addressEdit==='billing'?'Edit billing address':'Edit shipping address'}</h3><button type="button" className="soAddressClose" aria-label="Close address editor" onClick={()=>setAddressEdit('')}><IconX size={18}/></button></div><div className="soAddressFields"><label className="soAddressFieldWide">Address 1<input autoFocus={true} value={addressOf(addressEdit)['line1']||''} onChange={event=>updateAddress('line1',event.target.value)}/></label><label className="soAddressFieldWide">Address 2<input value={addressOf(addressEdit)['line2']||''} onChange={event=>updateAddress('line2',event.target.value)}/></label><label className="soAddressField">City<input value={addressOf(addressEdit)['city']||''} onChange={event=>updateAddress('city',event.target.value)}/></label><label className="soAddressField">State<select value={addressOf(addressEdit)['state']||''} onChange={event=>updateAddress('state',event.target.value)}><option value="">Select state</option>{customerStates.map(state=><option key={state}>{state}</option>)}</select></label><label className="soAddressField">PIN code<input value={addressOf(addressEdit)['pin']||''} onChange={event=>updateAddress('pin',event.target.value)}/></label><label className="soAddressField">Country<select value={addressOf(addressEdit)['country']||'India'} onChange={event=>updateAddress('country',event.target.value)}>{COUNTRIES.map(country=><option key={country}>{country}</option>)}</select></label></div><p className="soAddressNote">This changes the address on this {docWord} only. {selectedCustomer?.name?selectedCustomer.name+' keeps its own address in the customer master.':'The customer master keeps its own address.'}</p><footer><button type="button" onClick={()=>setAddressEdit('')}>Cancel</button><button type="button" className="primary" onClick={()=>setAddressEdit('')}>Done</button></footer></section></div>}
 </>;
}
