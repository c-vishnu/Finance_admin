import {useEffect,useMemo,useState} from 'react';
import {IconPlus,IconSearch,IconArrowLeft,IconTrash,IconX,IconFilter,IconEye} from '@tabler/icons-react';
import StatusPill from './StatusPill.jsx';
import PurchaseRowActions from './PurchaseRowActions.jsx';
import {KEY,initial,money} from './invoice-engine.js';
import {itemSeeds} from './Items.jsx';
import {readVendors} from './vendor-store.js';
import {PURCHASE_ORDER_KEY,PURCHASE_BILL_KEY,calculatePurchase,savePurchaseOrder,savePurchaseBill,convertPurchaseOrder,postPurchaseBill,vendorOutstanding} from './purchase-service.js';
import {advancePurchaseOrder,recordPurchasePayment,cancelPurchaseBill} from './purchase-service.js';
import PurchaseDetails from './PurchaseDetails.jsx';
import PurchaseDocumentFields,{blankDocumentLine} from './PurchaseDocumentFields.jsx';
import {QUICK_CREATE_KEY} from './quick-create.js';
import './purchases.css';
import './items.css';
import './sales-orders.css';

const read=(key,fallback=[])=>{try{const value=JSON.parse(localStorage.getItem(key));return Array.isArray(value)?value:fallback}catch{return fallback}};
const today=()=>new Date().toLocaleDateString('en-CA');
const fmtDate=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'Not recorded';

const BILL_HANDOFF='wayvida-open-bill';
const handoffBill=()=>{try{const id=sessionStorage.getItem(BILL_HANDOFF);if(!id)return null;sessionStorage.removeItem(BILL_HANDOFF);return read(PURCHASE_BILL_KEY).find(row=>row.id===id)||null}catch{return null}};

import {getScopeOrganisations} from './organisation-context.js';
import {demoOrganizations} from './demo-organisations.js';

const ORG_KEY='wayvida-organisations-v1';
const defaultOrganisations=demoOrganizations;

export default function Purchases({page='Purchase Orders',onNavigate=()=>{}}){
 const isBill=page==='Purchase Bills';
 const [orders,setOrders]=useState(()=>read(PURCHASE_ORDER_KEY));
 const [bills,setBills]=useState(()=>read(PURCHASE_BILL_KEY));
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState('All statuses');
 const [form,setForm]=useState(null);
 const [view,setView]=useState(handoffBill);
 const [error,setError]=useState('');
 const [vendorFilter,setVendorFilter]=useState('');
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const [sort,setSort]=useState('newest');
 const [current,setCurrent]=useState(1);

 const vendors=readVendors().filter(v=>v?.status==='Active');
 const items=read('finance-erp-items',itemSeeds).filter(item=>item.purchase!==false);
 const organisations=read(ORG_KEY,defaultOrganisations);
 const rows=isBill?bills:orders;

 const config=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')?.config||initial().config}catch{return initial().config}})();
 const approvalEnabled=config?.purchases?.approval!==false;

 useEffect(()=>{
  const action=sessionStorage.getItem(QUICK_CREATE_KEY);
  if((isBill&&action==='purchase-bill')||(!isBill&&action==='purchase-order')){
   sessionStorage.removeItem(QUICK_CREATE_KEY);
   open();
  }
  try{
   const draft=sessionStorage.getItem('wayvida-purchase-order-draft');
   if(draft){
    sessionStorage.removeItem('wayvida-purchase-order-draft');
    setForm(JSON.parse(draft));
   }
  }catch{}
 },[]);

 const PURCHASE_TONES=(value,isOverdue=false)=>{
  if(isOverdue)return 'danger';
  const s=String(value||'').toLowerCase();
  if(/cancel|overdue|reject|blocked/.test(s))return 'danger';
  if(/pending|awaiting/.test(s))return 'warn';
  if(/partial/.test(s))return 'info';
  if(/paid|completed|received|active|closed/.test(s))return 'ok';
  if(/sent|approved|open/.test(s))return 'info';
  return 'neutral';
 };

 const statusOptions=useMemo(()=>['All statuses',...new Set([...(isBill?['Draft','Pending Approval','Unpaid','Partially Paid','Paid','Overdue','Cancelled']:['Draft','Pending Approval','Approved','Sent To Vendor','Partially Received','Received','Completed','Overdue','Cancelled']),...rows.map(row=>row.status).filter(Boolean)])],[rows,isBill]);
 const activeFilters=[filter!=='All statuses',vendorFilter,from,to,sort!=='newest'].filter(Boolean).length;
 const clearFilters=()=>{setFilter('All statuses');setVendorFilter('');setFrom('');setTo('');setSort('newest');setQuery('');setCurrent(1)};
 const currentDate=today();

 const visible=useMemo(()=>{
  const list=rows.filter(row=>[row.number,row.vendorName,row.vendorInvoice,row.reference].join(' ').toLowerCase().includes(query.toLowerCase())&&(filter==='All statuses'||row.status===filter||(filter==='Overdue'&&!isBill&&row.expectedDate&&row.expectedDate<currentDate&&['Open','Sent To Vendor','Partially Received'].includes(row.status))||(filter==='Overdue'&&isBill&&row.dueDate&&row.dueDate<currentDate&&row.posted&&row.status!=='Paid'&&row.status!=='Cancelled'))&&(!vendorFilter||row.vendorId===vendorFilter)&&(!from||(row.date||'')>=from)&&(!to||(row.date||'')<=to));
  if(sort==='amount')return [...list].sort((a,b)=>(b.total||0)-(a.total||0));
  if(sort==='number')return [...list].sort((a,b)=>String(a.number||'').localeCompare(String(a.number||'')));
  return [...list].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 },[rows,query,filter,vendorFilter,from,to,sort,isBill,currentDate]);

 const pageCount=Math.max(1,Math.ceil(visible.length/10)),pageIndex=Math.min(current,pageCount),paged=visible.slice((pageIndex-1)*10,pageIndex*10);

 const accounting=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')||initial()}catch{return initial()}})();
 const outstandingPayable=form?.vendorId?vendorOutstanding(accounting,form.vendorId):0;

 const totals=(()=>{try{return form?calculatePurchase(form.lines,{placeOfSupply:form.place||'Kerala'}):null}catch{return null}})();
 const totalQty=(form?.lines||[]).reduce((sum,l)=>sum+Number(l.qty||0),0);

 const nextPoNumber=(()=>{
  const numbers=orders.map(x=>Number(String(x.number||'').match(/\d+/)?.[0]||0));
  const max=Math.max(0,...numbers)+1;
  return `PO-2026-${String(max).padStart(5,'0')}`;
 })();

 function createVendor(){
  if(form)sessionStorage.setItem('wayvida-purchase-order-draft',JSON.stringify(form));
  sessionStorage.setItem('wayvida-return-to',isBill?'Purchase Bills':'Purchase Orders');
  onNavigate('Vendors');
 }

 function editVendor(vendorId){
  if(form)sessionStorage.setItem('wayvida-purchase-order-draft',JSON.stringify(form));
  sessionStorage.setItem('wayvida-edit-vendor',vendorId);
  sessionStorage.setItem('wayvida-return-to',isBill?'Purchase Bills':'Purchase Orders');
  onNavigate('Vendors');
 }

 function createItem(){
  if(form)sessionStorage.setItem('wayvida-purchase-order-draft',JSON.stringify(form));
  sessionStorage.setItem('wayvida-open-item-create','1');
  sessionStorage.setItem('wayvida-return-to',isBill?'Purchase Bills':'Purchase Orders');
  onNavigate('Items');
 }

 function open(row=null){
  setView(null);
  setError('');
  if(row){setForm(structuredClone(row));return}
  const date=today();
  const defaultOrg=organisations[0]||defaultOrganisations[0];
  const defaultBranch=defaultOrg.branches?.[0]||{id:'br-1',name:'Kochi Branch'};
  setForm(isBill?{
   number:'',vendorId:'',vendorName:'',vendorInvoice:'',date,dueDate:date,referenceOrder:'',reference:'',status:'Draft',paymentTerms:'30 Days',terms:'30',vendorAddress:'',vendorContact:'',vendorGstin:'',organizationId:defaultOrg.id,organizationName:defaultOrg.name,branchId:defaultBranch.id,branchName:defaultBranch.name,place:'Kerala',lines:[blankDocumentLine()],purchaseAccount:'5000',inputTaxAccount:'1400',payableAccount:'2000',files:[],notes:''
  }:{
   number:nextPoNumber,date,vendorId:'',vendorName:'',expectedDate:'',reference:'',status:'Draft',paymentTerms:'Net 30 days',terms:'30',vendorAddress:'',vendorContact:'',vendorGstin:'',organizationId:defaultOrg.id,organizationName:defaultOrg.name,branchId:defaultBranch.id,branchName:defaultBranch.name,place:'Kerala',lines:[blankDocumentLine()],deliveryAddress:'Kochi Branch',shippingMethod:'',deliveryTerms:'',warranty:'',notes:'',termsAndConditions:'',files:[]
  });
 }

 function persist(event,status){
  event?.preventDefault();
  try{
   if(isBill){
    const output=savePurchaseBill(bills,form,status);
    localStorage.setItem(PURCHASE_BILL_KEY,JSON.stringify(output.rows));
    setBills(output.rows);
   }else{
    const output=savePurchaseOrder(orders,form,status);
    localStorage.setItem(PURCHASE_ORDER_KEY,JSON.stringify(output.rows));
    setOrders(output.rows);
   }
   setForm(null);
   setError('');
  }catch(reason){setError(reason.message)}
 }

 function convert(order){try{const output=convertPurchaseOrder(orders,bills,order);setOrders(output.orders);setBills(output.bills);localStorage.setItem(PURCHASE_ORDER_KEY,JSON.stringify(output.orders));localStorage.setItem(PURCHASE_BILL_KEY,JSON.stringify(output.bills));onNavigate('Purchase Bills')}catch(reason){setError(reason.message)}}
 function post(bill){try{const accountingState=JSON.parse(localStorage.getItem(KEY)||'null')||initial();const output=postPurchaseBill(accountingState,bill);localStorage.setItem(KEY,JSON.stringify(output.state));const next=bills.map(row=>row.id===bill.id?output.bill:row);setBills(next);localStorage.setItem(PURCHASE_BILL_KEY,JSON.stringify(next));setView(output.bill);return output.bill}catch(reason){setError(reason.message)}}
 function advance(order,action){try{const output=advancePurchaseOrder(orders,order,action);setOrders(output.rows);setView(output.order);localStorage.setItem(PURCHASE_ORDER_KEY,JSON.stringify(output.rows))}catch(reason){setError(reason.message)}}
 function pay(bill,payment){try{const accountingState=JSON.parse(localStorage.getItem(KEY)||'null')||initial();const output=recordPurchasePayment(accountingState,bill,payment);localStorage.setItem(KEY,JSON.stringify(output.state));const next=bills.map(row=>row.id===bill.id?output.bill:row);setBills(next);setView(output.bill);localStorage.setItem(PURCHASE_BILL_KEY,JSON.stringify(next));return output.bill}catch(reason){setError(reason.message)}}
 function cancelBill(bill,data){try{const accountingState=JSON.parse(localStorage.getItem(KEY)||'null')||initial();const output=cancelPurchaseBill(accountingState,bill,data);localStorage.setItem(KEY,JSON.stringify(output.state));const next=bills.map(row=>row.id===bill.id?output.bill:row);setBills(next);setView(output.bill);localStorage.setItem(PURCHASE_BILL_KEY,JSON.stringify(next));return output.bill}catch(reason){setError(reason.message)}}

 if(view)return <PurchaseDetails isBill={isBill} record={view} error={error} onDismissError={()=>setError('')} onBack={()=>setView(null)} onOpen={()=>advance(view,'open')} onReceive={()=>onNavigate('Goods Receipts')} onConvert={()=>convert(view)} onPost={()=>post(view)} onPayment={payment=>pay(view,payment)} onCancel={data=>cancelBill(view,data)}/>;

 if(form)return <section className="invoiceWorkspace purchaseWorkspace soCreatePage ivCreatePage">
  <div className="soCreateHead">
   <div className="soHeadIdentity">
    <button type="button" className="soBack" aria-label={'Back to '+page} onClick={()=>setForm(null)}>
     <IconArrowLeft size={19}/>
    </button>
    <div className="soHeadText">
     <h2>{form.id?'Edit '+(isBill?'purchase bill':'purchase order'):(isBill?'New purchase bill':'New purchase order')}</h2>
     {form.id&&<small className="soHeadHint">Editing {form.number}</small>}
    </div>
   </div>
  </div>
  <form className="ivCreateForm salesOrderForm" onSubmit={event=>persist(event,isBill?'Draft':(approvalEnabled?'Pending Approval':'Approved'))}>
   {error&&<div role="alert" className="ivError">{error}<button type="button" aria-label="Dismiss error" onClick={()=>setError('')}><IconX size={16}/></button></div>}
   
   <PurchaseDocumentFields
    form={form}
    setForm={setForm}
    vendors={vendors}
    items={items}
    config={config}
    organisations={organisations}
    kind={isBill?'bill':'order'}
    outstandingPayable={outstandingPayable}
    onEditVendor={vendorId=>editVendor(vendorId)}
    onCreateVendor={()=>createVendor()}
    onCreateItem={()=>createItem()}
    autoNumber={nextPoNumber}
   />

   <div className="ivFooter soActionBar">
    <dl className="soBarTotals">
     <div><dt>Total amount</dt><dd>{money(totals?.total)}</dd></div>
     <div><dt>Total quantity</dt><dd>{totalQty} {totalQty===1?'item':'items'}</dd></div>
    </dl>
    <div className="soBarActions">
     <button type="button" onClick={()=>setForm(null)}>Cancel</button>
     <button type="button" onClick={event=>persist(event,'Draft')}>Save draft</button>
     <button className="primary" type="submit">
      {isBill?'Save bill':(approvalEnabled?'Submit for approval':'Save & confirm')}
     </button>
    </div>
   </div>
  </form>
 </section>;

 return <section className="itemsPage salesOrdersPage purchaseWorkspace">
  {error&&<div role="alert" className="ivError">{error}<button type="button" aria-label="Dismiss error" onClick={()=>setError('')}><IconX size={16}/></button></div>}
  <div className="itemsHeading soPageHeading registerHead">
   <div className="registerHeadText">
    <h2>{isBill?'Purchase Bills':'Purchase orders'} <span className="registerHeadCount">({rows.length})</span></h2>
    <p>{isBill?'Manage supplier bills and amounts payable.':'Create, confirm and receive supplier orders.'}</p>
   </div>
   <div className="itemsTools soFilterBar">
    <label><IconSearch size={18}/><input aria-label={'Search '+page.toLowerCase()} placeholder="Search number, vendor or reference…" value={query} onChange={e=>{setQuery(e.target.value);setCurrent(1)}}/></label>
    <details className="soFiltersMore">
     <summary aria-label="Open filters"><IconFilter size={17}/>Filters{activeFilters>0&&<i>{activeFilters}</i>}</summary>
     <div className="soFiltersPanel">
      <label>Status<select aria-label="Filter status" value={filter} onChange={e=>{setFilter(e.target.value);setCurrent(1)}}>{statusOptions.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Vendor<select aria-label="Filter vendor" value={vendorFilter} onChange={e=>{setVendorFilter(e.target.value);setCurrent(1)}}><option value="">All vendors</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.displayName||v.name}</option>)}</select></label>
      <label>From<input type="date" aria-label="Filter from" value={from} onChange={e=>{setFrom(e.target.value);setCurrent(1)}}/></label>
      <label>To<input type="date" aria-label="Filter to" value={to} onChange={e=>{setTo(e.target.value);setCurrent(1)}}/></label>
      <label>Sort<select aria-label="Sort records" value={sort} onChange={e=>{setSort(e.target.value);setCurrent(1)}}><option value="newest">Newest first</option><option value="amount">Highest amount</option><option value="number">Number</option></select></label>
      <button type="button" className="soClearFilters" onClick={clearFilters}>Clear filters</button>
     </div>
    </details>
   </div>
   <div className="itemsActions">
    <button className="primary soCreateButton" onClick={()=>open()}><IconPlus size={18}/>New {isBill?'purchase bill':'purchase order'}</button>
   </div>
  </div>
  <div className="itemsCard soListCard ivRegisterCard">
   <div className="ivScroll">
    <table className="ivInvoiceTable">
     <thead>
      <tr>{(isBill?['Bill & date','Vendor','Vendor invoice','Amount','Balance due','Status','Actions']:['Order & date','Vendor','Reference','Amount','Status','Expected delivery','Actions']).map(h=><th key={h}>{h}</th>)}</tr>
     </thead>
     <tbody>
      {paged.map(row=>{
       const isDraft=row.status==='Draft';
       const bal=(row.total||0)-(row.paidAmount||0);
       const isPoOverdue=!isBill&&row.expectedDate&&row.expectedDate<currentDate&&['Open','Sent To Vendor','Partially Received'].includes(row.status);
       const isBillOverdue=isBill&&row.dueDate&&row.dueDate<currentDate&&row.posted&&row.status!=='Paid'&&row.status!=='Cancelled';
       const daysOverdue=isBillOverdue?Math.floor((new Date(currentDate+'T00:00:00')-new Date(row.dueDate+'T00:00:00'))/(1000*3600*24)):0;
       const contact=row.vendorContact&&row.vendorContact!=='Contact not recorded'?row.vendorContact:null;
       return <tr key={row.id}>
        {isBill?<>
         <td><b className="soOrderNumber" style={{cursor:'pointer'}} onClick={()=>setView(row)}>{row.number}</b><small>{fmtDate(row.date)}</small></td>
         <td>{row.vendorName}{contact&&<small>{contact}</small>}</td>
         <td>{row.vendorInvoice||'-'}</td>
         <td>{money(row.total)}</td>
         <td>{isDraft?'—':<>{money(bal)}{isBillOverdue?<small style={{color:'#ef4444',fontWeight:600,display:'block'}}>Overdue by {daysOverdue} {daysOverdue===1?'day':'days'}</small>:<small style={{display:'block'}}>Due {fmtDate(row.dueDate)}</small>}</>}</td>
         <td><StatusPill status={row.status} tone={PURCHASE_TONES(row.status,isBillOverdue)}/></td>
        </>:<>
         <td><b className="soOrderNumber" style={{cursor:'pointer'}} onClick={()=>setView(row)}>{row.number}</b><small>{fmtDate(row.date)}</small></td>
         <td>{row.vendorName}{contact&&<small>{contact}</small>}</td>
         <td>{row.reference||'-'}</td>
         <td>{money(row.total)}</td>
         <td><StatusPill status={isPoOverdue?'Overdue':row.status} tone={PURCHASE_TONES(row.status,isPoOverdue)}/></td>
         <td>{row.expectedDate?<span style={isPoOverdue?{color:'#ef4444',fontWeight:600}:{}}>{fmtDate(row.expectedDate)}</span>:'-'}</td>
        </>}
        <td>
         <div className="ivRowActions">
          <PurchaseRowActions doc={row} isBill={isBill} onView={()=>setView(row)} onEdit={()=>open(row)} onPost={()=>post(row)} onJournal={()=>onNavigate('Journal Entries')} onSend={()=>{const next=rows.map(x=>x.id===row.id?{...x,status:'Sent To Vendor'}:x);setOrders(next);localStorage.setItem(PURCHASE_ORDER_KEY,JSON.stringify(next))}} onConvert={()=>convert(row)} onCancel={()=>{const next=rows.map(x=>x.id===row.id?{...x,status:'Cancelled'}:x);if(isBill){setBills(next);localStorage.setItem(PURCHASE_BILL_KEY,JSON.stringify(next))}else{setOrders(next);localStorage.setItem(PURCHASE_ORDER_KEY,JSON.stringify(next))}}}/>
         </div>
        </td>
       </tr>;
      })}
     </tbody>
    </table>
    {!visible.length&&<div className="itemsEmpty">
     <h3>No {page.toLowerCase()} found</h3>
     <p>{rows.length?'No results match your filters.':'Create the first record to begin the purchase workflow.'}</p>
     <button className="primary" onClick={()=>open()}><IconPlus size={17}/>New {isBill?'purchase bill':'purchase order'}</button>
    </div>}
   </div>
   <div className="ivActions purchaseRegisterFoot">
    <span>{visible.length} of {rows.length} records</span>
    {pageCount>1&&<><button disabled={pageIndex===1} onClick={()=>setCurrent(pageIndex-1)}>Previous</button><span>Page {pageIndex} of {pageCount}</span><button disabled={pageIndex===pageCount} onClick={()=>setCurrent(pageIndex+1)}>Next</button></>}
   </div>
  </div>
 </section>;
}
