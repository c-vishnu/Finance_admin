import {useMemo,useState} from 'react';
import {IconArrowLeft,IconFilter,IconPlus,IconSearch,IconX} from '@tabler/icons-react';
import StatusPill from './StatusPill.jsx';
import {GOODS_RECEIPT_KEY,PURCHASE_ORDER_KEY,createGoodsReceipt} from './purchase-service.js';

const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
const today=()=>new Date().toLocaleDateString('en-CA');
export default function GoodsReceipts({onNavigate=()=>{}}){
 const [orders,setOrders]=useState(()=>read(PURCHASE_ORDER_KEY)),[receipts,setReceipts]=useState(()=>read(GOODS_RECEIPT_KEY)),[query,setQuery]=useState(''),[form,setForm]=useState(null),[error,setError]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('');
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
 return <section className="invoiceWorkspace purchaseWorkspace">
  {error&&<div role="alert" className="ivError">{error}<button type="button" aria-label="Dismiss error" onClick={()=>setError('')}><IconX size={16}/></button></div>}
  <div className="ivHeading"><div><h2>Goods Receipts</h2><p>Record actual quantities received against open purchase orders. No accounting entry is created.</p></div><div className="ivActions"><button className="primary" onClick={()=>start()}><IconPlus size={16}/>Receive goods</button></div></div>
  <div className="ivCard ivRegisterCard">
   <div className="ivTools"><label className="ivToolSearch"><IconSearch size={17}/><input aria-label="Search goods receipts" placeholder="Search receipt, purchase order or vendor" value={query} onChange={e=>setQuery(e.target.value)}/></label><details className="soFiltersMore"><summary aria-label="Open filters"><IconFilter size={17}/>Filters{activeFilters>0&&<i>{activeFilters}</i>}</summary><div className="soFiltersPanel"><label>From<input type="date" aria-label="Filter from" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" aria-label="Filter to" value={to} onChange={e=>setTo(e.target.value)}/></label><button type="button" className="soClearFilters" onClick={clearFilters}>Clear filters</button></div></details></div>
   <div className="ivScroll"><table className="ivInvoiceTable"><thead><tr>{['Receipt & date','Purchase order','Vendor','Items received','Status','Actions'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{visible.map(row=><tr key={row.id}><td>{row.number}<small>{row.date}</small></td><td>{row.orderNumber}</td><td>{row.vendorName}</td><td>{row.lines.reduce((n,l)=>n+Number(l.receivedQty||0),0)}<small>{row.lines.length} lines</small></td><td><StatusPill status="Posted" tone="ok"/></td><td><div className="ivRowActions"><button onClick={()=>onNavigate('Purchase Orders')}>Open order</button></div></td></tr>)}</tbody></table>{!visible.length&&<div className="ivEmpty"><h3>No goods receipts found</h3><p>{receipts.length?'Adjust the search or filters to find a receipt.':'Open a purchase order, then record the received quantities.'}</p></div>}</div>
   <div className="ivActions purchaseRegisterFoot"><span>{visible.length} of {receipts.length} records</span></div>
  </div>
 </section>;
}
