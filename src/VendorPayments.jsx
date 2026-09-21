import {useMemo,useState} from 'react';
import {IconCashBanknote,IconFilter,IconSearch} from '@tabler/icons-react';
import StatusPill from './StatusPill.jsx';
import {KEY,initial,money} from './invoice-engine.js';
import './purchases.css';

/* Payments Made is the vendor-payment register. It reads the same shell as every other register:
   the shared heading, one card, the search box with one Filters disclosure, the shared fixed
   seven-column table, the shared status pill and the shared empty state. Nothing is actionable
   here - a payment is recorded from its posted bill - so the bill number is the link. */
export default function VendorPayments({onNavigate=()=>{}}){
 const db=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')||initial()}catch{return initial()}})(),[query,setQuery]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const rows=useMemo(()=>{const list=(db.vendorPayments||[]).filter(p=>{const bill=(db.purchaseBills||[]).find(b=>b.id===p.billId);return [p.number,p.reference,bill?.number,bill?.vendorName].join(' ').toLowerCase().includes(query.toLowerCase())&&(!from||(p.date||'')>=from)&&(!to||(p.date||'')<=to)}).map(p=>({...p,bill:(db.purchaseBills||[]).find(b=>b.id===p.billId)}));return list.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))},[query,from,to]);
 const activeFilters=[from,to].filter(Boolean).length;
 const clearFilters=()=>{setFrom('');setTo('');setQuery('')};
 return <section className="invoiceWorkspace purchaseWorkspace">
  <div className="ivHeading"><div><h2>Payments Made</h2><p>Posted payments allocated to purchase bills and Accounts Payable.</p></div><div className="ivActions"><button onClick={()=>onNavigate('Purchase Bills')}><IconCashBanknote size={16}/>Open unpaid bills</button></div></div>
  <div className="ivCard ivRegisterCard">
   <div className="ivTools"><label className="ivToolSearch"><IconSearch size={17}/><input aria-label="Search vendor payments" placeholder="Search payment, bill, vendor or reference" value={query} onChange={e=>setQuery(e.target.value)}/></label><details className="soFiltersMore"><summary aria-label="Open filters"><IconFilter size={17}/>Filters{activeFilters>0&&<i>{activeFilters}</i>}</summary><div className="soFiltersPanel"><label>From<input type="date" aria-label="Filter from" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" aria-label="Filter to" value={to} onChange={e=>setTo(e.target.value)}/></label><button type="button" className="soClearFilters" onClick={clearFilters}>Clear filters</button></div></details></div>
   <div className="ivScroll"><table className="ivInvoiceTable"><thead><tr>{['Payment & date','Vendor','Purchase bill','Reference','Amount','Bank account','Status'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.number}<small>{row.date}</small></td><td>{row.bill?.vendorName||'-'}</td><td>{row.bill?<button className="ivLink" onClick={()=>onNavigate('Purchase Bills')}>{row.bill.number}</button>:'-'}</td><td>{row.reference||'-'}</td><td>{money(row.amount)}</td><td>{row.bankAccount}</td><td><StatusPill status={row.status||'Posted'} tone="ok"/></td></tr>)}</tbody></table>{!rows.length&&<div className="ivEmpty"><h3>No vendor payments found</h3><p>{(db.vendorPayments||[]).length?'Adjust the search or filters to find a payment.':'Open a posted Purchase Bill to record the first payment.'}</p></div>}</div>
   <div className="ivActions purchaseRegisterFoot"><span>{rows.length} of {(db.vendorPayments||[]).length} records</span></div>
  </div>
 </section>;
}
