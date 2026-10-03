import {useMemo,useState} from 'react';
import {IconArrowLeft,IconEye,IconFilter,IconPlus,IconSearch,IconX} from '@tabler/icons-react';
import StatusPill from './StatusPill.jsx';
import {GOODS_RECEIPT_KEY,PURCHASE_ORDER_KEY,createGoodsReceipt} from './purchase-service.js';
import './purchases.css';
import './invoice-workspace.css';

const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
const today=()=>new Date().toLocaleDateString('en-CA');
const fmtDate=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'Not recorded';
export default function GoodsReceipts({onNavigate=()=>{}}){
 const [orders,setOrders]=useState(()=>read(PURCHASE_ORDER_KEY)),[receipts,setReceipts]=useState(()=>read(GOODS_RECEIPT_KEY)),[query,setQuery]=useState(''),[form,setForm]=useState(null),[view,setView]=useState(null),[error,setError]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const available=orders.filter(o=>['Open','Sent To Vendor','Partially Received','Partially Billed'].includes(o.status)),visible=useMemo(()=>{const list=receipts.filter(r=>(r.number+' '+r.orderNumber+' '+r.vendorName).toLowerCase().includes(query.toLowerCase())&&(!from||(r.date||'')>=from)&&(!to||(r.date||'')<=to));return [...list].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))},[receipts,query,from,to]);
 const clearFilters=()=>{setFrom('');setTo('');setQuery('')};
 const activeFilters=[from,to].filter(Boolean).length;
 function start(order=available[0]){
  if(!order){setError('Open a purchase order before receiving goods.');return}
  setForm({
   orderId:order.id,
   date:today(),
   reference:'',
   notes:'',
   lines:order.lines.map(line=>({
    orderLineId:line.id,
    description:line.description,
    unit:line.unit,
    orderedQty:Number(line.qty),
    receivedBefore:Number(line.receivedQty||0),
    receivedQty:String(Math.max(0,Number(line.qty)-Number(line.receivedQty||0))),
   })),
  });
 }
 function selectOrder(id){start(available.find(o=>o.id===id))}
 function save(event){event.preventDefault();try{const out=createGoodsReceipt(orders,receipts,form);setOrders(out.orders);setReceipts(out.receipts);localStorage.setItem(PURCHASE_ORDER_KEY,JSON.stringify(out.orders));localStorage.setItem(GOODS_RECEIPT_KEY,JSON.stringify(out.receipts));setForm(null);setError('')}catch(reason){setError(reason.message)}}
 if(form)return <section className="invoiceWorkspace purchaseWorkspace soCreatePage ivCreatePage">
  <div className="soCreateHead"><div className="soHeadIdentity"><button type="button" className="soBack" aria-label="Back to Goods Receipts" onClick={()=>setForm(null)}><IconArrowLeft size={19}/></button><div className="soHeadText"><h2>Receive goods</h2><small className="soHeadHint">Record the quantities actually received against an open purchase order.</small></div></div></div>
  <form className="ivCreateForm" onSubmit={save}>
   {error&&<div role="alert" className="ivError">{error}<button type="button" aria-label="Dismiss error" onClick={()=>setError('')}><IconX size={16}/></button></div>}
   <div className="ivCard soFormSection"><div className="soSectionHead"><div className="soSectionHeadText"><h3>Receipt details</h3></div></div><div className="ivFields">
    <label>Purchase order<select value={form.orderId} onChange={e=>selectOrder(e.target.value)}>{available.map(o=><option key={o.id} value={o.id}>{o.number} · {o.vendorName}</option>)}</select></label>
    <label>Receipt date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
    <label>Delivery reference<input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/></label>
   </div></div>
   <div className="ivCard"><div className="ivHeading"><h3>Items to receive</h3></div><div className="ivScroll"><table className="ivLineTable"><thead><tr>{['Item','Ordered','Received before','Receive now','Pending after'].map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{form.lines.map((line,index)=><tr key={line.orderLineId}><td>{line.description}<small>{line.unit}</small></td><td>{line.orderedQty}</td><td>{line.receivedBefore}</td><td><input aria-label={'receive '+(index+1)} type="number" min="0" max={line.orderedQty-line.receivedBefore} step="0.01" value={line.receivedQty} onChange={e=>setForm({...form,lines:form.lines.map((x,i)=>i===index?{...x,receivedQty:e.target.value}:x)})}/></td><td><strong>{Math.max(0,line.orderedQty-line.receivedBefore-Number(line.receivedQty||0))}</strong></td></tr>)}</tbody></table></div><section className="soBillingSummary"><div className="soSummaryHead"><h3>Receipt summary</h3></div><dl className="ivTotals"><div><dt>Lines</dt><dd>{form.lines.length}</dd></div><div><dt>Receiving now</dt><dd>{form.lines.reduce((n,l)=>n+Number(l.receivedQty||0),0)}</dd></div><div><dt>Accounting entry</dt><dd>None</dd></div></dl></section></div>
   <details className="ivCard soMoreCard"><summary><span className="soMoreTitle">Notes</span><span className="soMoreHint">Optional</span></summary><div className="soMoreBody"><div className="ivFields"><label>Receipt notes<textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/></label></div></div></details>
   <div className="ivFooter soActionBar"><dl className="soBarTotals"><div><dt>Receiving now</dt><dd>{form.lines.reduce((n,l)=>n+Number(l.receivedQty||0),0)}</dd></div></dl><div className="soBarActions"><button type="button" onClick={()=>setForm(null)}>Cancel</button><button className="primary">Post receipt</button></div></div>
  </form>
 </section>;
  if(view)return <section className="invoiceWorkspace purchaseWorkspace ivDetailOpen">
   <div className="ivDetailHead"><button type="button" className="ivDetailBack" aria-label="Back to Goods Receipts" onClick={()=>setView(null)}><IconArrowLeft size={19}/></button><div className="ivDetailHeadText"><h2>Goods receipt details</h2><small>{view.number} · {view.vendorName}</small></div></div>
   <div className="ivDetailBody"><section className="ivDetailSheet">
    <div className="ivDetailIdentityRow">
     <div className="ivDetailIdentity"><div className="ivDetailNumber"><h3>{view.number}</h3><StatusPill status={view.status||'Posted'} tone="ok"/></div><p>{view.vendorName} · PO: {view.orderNumber} · {fmtDate(view.date)}</p></div>
     <div className="ivDocumentActions">
      <button className="primary" onClick={()=>onNavigate('Purchase Orders')}><IconEye size={16}/>Open purchase order</button>
     </div>
    </div>
    <div className="ivDetailStats">{[['Receipt status',view.status||'Posted'],['Purchase order',view.orderNumber],['Vendor',view.vendorName],['Receipt date',fmtDate(view.date)],['Items received',view.lines.reduce((n,l)=>n+Number(l.receivedQty||0),0)],['Reference',view.reference||'None']].map(([k,v])=><span key={k}><small>{k}</small><strong>{v}</strong></span>)}</div>
    <section className="itemDetailCard">
     <div className="itemDetailSectionTitle"><h2>Items received</h2></div>
     <div className="ivScroll"><table className="ivInvoiceTable purchaseDetailLines"><thead><tr>{['Item / description','Unit','Ordered','Received before','Received now','Pending after'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{(view.lines||[]).map(l=><tr key={l.orderLineId||l.description}><td><b>{l.description}</b></td><td>{l.unit||'pcs'}</td><td>{l.orderedQty??'-'}</td><td>{l.previouslyReceived??l.receivedBefore??0}</td><td><strong>{l.receivedQty}</strong></td><td>{l.pendingQty??Math.max(0,Number(l.orderedQty||0)-Number(l.previouslyReceived||0)-Number(l.receivedQty||0))}</td></tr>)}</tbody></table></div>
    </section>
    {view.notes&&<section className="itemDetailCard" style={{marginTop:16}}><div className="itemDetailSectionTitle"><h2>Notes</h2></div><p style={{margin:'8px 0 0',color:'#475467',fontSize:14}}>{view.notes}</p></section>}
   </section></div>
  </section>;
  return <section className="invoiceWorkspace purchaseWorkspace">
   {error&&<div role="alert" className="ivError">{error}<button type="button" aria-label="Dismiss error" onClick={()=>setError('')}><IconX size={16}/></button></div>}
   <div className="ivHeading registerHead">
    <div className="registerHeadText">
     <h2>Goods Receipts <span className="registerHeadCount">({receipts.length})</span></h2>
     <p>Record goods received against purchase orders.</p>
    </div>
    <div className="ivTools">
     <label className="ivToolSearch">
      <IconSearch size={17}/>
      <input aria-label="Search goods receipts" placeholder="Search receipt, purchase order or vendor" value={query} onChange={e=>setQuery(e.target.value)}/>
     </label>
     <details className="soFiltersMore">
      <summary aria-label="Open filters"><IconFilter size={17}/>Filters{activeFilters>0&&<i>{activeFilters}</i>}</summary>
      <div className="soFiltersPanel">
       <label>From<input type="date" aria-label="Filter from" value={from} onChange={e=>setFrom(e.target.value)}/></label>
       <label>To<input type="date" aria-label="Filter to" value={to} onChange={e=>setTo(e.target.value)}/></label>
       <button type="button" className="soClearFilters" onClick={clearFilters}>Clear filters</button>
      </div>
     </details>
    </div>
    <div className="ivActions">
     <button className="primary" onClick={()=>start()}><IconPlus size={16}/>New goods receipt</button>
    </div>
   </div>
   <div className="ivCard ivRegisterCard">
    <div className="ivScroll">
     <table className="ivInvoiceTable">
      <thead>
       <tr>{['Receipt & date','Purchase order','Vendor','Items received','Status','Actions'].map(x=><th key={x}>{x}</th>)}</tr>
      </thead>
      <tbody>
       {visible.map(row=><tr key={row.id}>
        <td><b className="soOrderNumber" style={{cursor:'pointer'}} onClick={()=>setView(row)}>{row.number}</b><small>{fmtDate(row.date)}</small></td>
        <td><button type="button" className="ivLink" onClick={()=>onNavigate('Purchase Orders')}>{row.orderNumber}</button></td>
        <td>{row.vendorName}</td>
        <td>{row.lines.reduce((n,l)=>n+Number(l.receivedQty||0),0)}<small>{row.lines.length} {row.lines.length===1?'item':'items'}</small></td>
        <td><StatusPill status={row.status||'Posted'} tone="ok"/></td>
        <td>
         <div className="ivRowActions">
          <button type="button" className="ivIconButton" aria-label={'View '+row.number} title={'View '+row.number} onClick={()=>setView(row)}>
           <IconEye size={17}/>
          </button>
         </div>
        </td>
       </tr>)}
      </tbody>
     </table>
     {!visible.length&&<div className="ivEmpty"><h3>No goods receipts found</h3><p>{receipts.length?'No results match your filters.':'Open a purchase order, then record the received quantities.'}</p></div>}
    </div>
    <div className="ivActions purchaseRegisterFoot"><span>{visible.length} of {receipts.length} records</span></div>
   </div>
  </section>;
}
