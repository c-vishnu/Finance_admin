import {useMemo,useState} from 'react';
import {IconPackageImport,IconPlus,IconSearch,IconX} from '@tabler/icons-react';
import {GOODS_RECEIPT_KEY,PURCHASE_ORDER_KEY,createGoodsReceipt} from './purchase-service.js';
import './goods-receipts.css';
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
const today=()=>new Date().toLocaleDateString('en-CA');
export default function GoodsReceipts(){
 const [orders,setOrders]=useState(()=>read(PURCHASE_ORDER_KEY)),[receipts,setReceipts]=useState(()=>read(GOODS_RECEIPT_KEY)),[query,setQuery]=useState(''),[form,setForm]=useState(null),[error,setError]=useState('');
 const available=orders.filter(o=>['Open','Sent To Vendor','Partially Received','Partially Billed'].includes(o.status)),visible=useMemo(()=>receipts.filter(r=>(r.number+' '+r.orderNumber+' '+r.vendorName).toLowerCase().includes(query.toLowerCase())),[receipts,query]);
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
 return <section className="purchaseWorkspace"><div className="purchaseHeading"><div><span>Purchases</span><h1>Goods Receipts</h1><p>Record actual quantities received against open purchase orders. No accounting entry is created.</p></div><button className="primary" onClick={()=>start()}><IconPlus/>Receive goods</button></div>{error&&<div className="purchaseError">{error}<button onClick={()=>setError('')}><IconX/></button></div>}{form&&<form className="purchaseCard" onSubmit={save}><div className="purchaseSectionHead"><div><h2>New goods receipt</h2><p>Ordered, previously received, and pending quantities are validated automatically.</p></div></div><div className="purchaseFields"><label>Purchase order<select value={form.orderId} onChange={e=>selectOrder(e.target.value)}>{available.map(o=><option key={o.id} value={o.id}>{o.number} · {o.vendorName}</option>)}</select></label><label>Receipt date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Delivery reference<input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/></label></div><div className="purchaseReceiptLines"><div className="purchaseReceiptRow head"><span>Item</span><span>Ordered</span><span>Received before</span><span>Receive now</span><span>Pending after</span></div>{form.lines.map((line,index)=><div className="purchaseReceiptRow" key={line.orderLineId}><b>{line.description}<small>{line.unit}</small></b><span>{line.orderedQty}</span><span>{line.receivedBefore}</span><input type="number" min="0" max={line.orderedQty-line.receivedBefore} step="0.01" value={line.receivedQty} onChange={e=>setForm({...form,lines:form.lines.map((x,i)=>i===index?{...x,receivedQty:e.target.value}:x)})}/><strong>{Math.max(0,line.orderedQty-line.receivedBefore-Number(line.receivedQty||0))}</strong></div>)}</div><div className="purchaseFooter"><button type="button" onClick={()=>setForm(null)}>Cancel</button><button className="primary">Post receipt</button></div></form>}<div className="purchaseListCard"><div className="purchaseTools"><label><IconSearch/><input placeholder="Search receipt, PO, or vendor…" value={query} onChange={e=>setQuery(e.target.value)}/></label><span>{visible.length} receipts</span></div><div className="purchaseTableWrap"><table><thead><tr>{['Receipt','Purchase order','Vendor','Date','Received quantity','Status'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{visible.map(row=><tr key={row.id}><td><b>{row.number}</b></td><td>{row.orderNumber}</td><td>{row.vendorName}</td><td>{row.date}</td><td>{row.lines.reduce((n,l)=>n+l.receivedQty,0)}</td><td><b className="purchaseStatus paid">Posted</b></td></tr>)}</tbody></table>{!visible.length&&<div className="purchaseEmpty"><IconPackageImport/><h3>No goods receipts yet</h3><p>Open a purchase order, then record the received quantities.</p></div>}</div></div></section>;
}
