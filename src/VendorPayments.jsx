import {useMemo,useState} from 'react';
import {IconArrowLeft,IconPlus,IconEye,IconFilter,IconSearch} from '@tabler/icons-react';
import StatusPill from './StatusPill.jsx';
import {KEY,initial,money} from './invoice-engine.js';
import './purchases.css';
import './invoice-workspace.css';
import './sales-orders.css';

/* Payments Made is the vendor-payment register. It shares the exact same layout as
   all other registers: unified sticky header (title + count on left; search, filters and
   action button on right), seamless adjoining card, properly aligned tabular columns,
   and drill-down payment details. */
const fmtDate=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'Not recorded';

export default function VendorPayments({onNavigate=()=>{}}){
 const db=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')||initial()}catch{return initial()}})(),[query,setQuery]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[view,setView]=useState(null);
 const accountLabel=code=>{
  const acc=(db.accounts||[]).find(a=>a.code===code);
  if(acc?.name)return `${acc.code} · ${acc.name}`;
  if(code==='1010')return '1010 · Bank';
  if(code==='1000')return '1000 · Cash';
  if(code==='2000')return '2000 · Accounts Payable';
  return code||'1010 · Bank';
 };
 const rows=useMemo(()=>{
  const list=(db.vendorPayments||[]).filter(p=>{
   const bill=(db.purchaseBills||[]).find(b=>b.id===p.billId);
   return [p.number,p.reference,bill?.number,bill?.vendorName,p.vendorName].join(' ').toLowerCase().includes(query.toLowerCase())&&(!from||(p.date||'')>=from)&&(!to||(p.date||'')<=to);
  }).map(p=>({...p,bill:(db.purchaseBills||[]).find(b=>b.id===p.billId)}));
  return list.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 },[db,query,from,to]);
 const activeFilters=[from,to].filter(Boolean).length;
 const clearFilters=()=>{setFrom('');setTo('');setQuery('')};

 if(view)return <section className="invoiceWorkspace purchaseWorkspace ivDetailOpen">
  <div className="ivDetailHead">
   <button type="button" className="ivDetailBack" aria-label="Back to Payments Made" onClick={()=>setView(null)}>
    <IconArrowLeft size={19}/>
   </button>
   <div className="ivDetailHeadText">
    <h2>Payment details</h2>
    <small>{view.number} · {view.bill?.vendorName||view.vendorName||'Vendor Payment'}</small>
   </div>
  </div>
  <div className="ivDetailBody">
   <section className="ivDetailSheet">
    <div className="ivDetailIdentityRow">
     <div className="ivDetailIdentity">
      <div className="ivDetailNumber">
       <h3>{view.number}</h3>
       <StatusPill status={view.status||'Posted'} tone="ok"/>
      </div>
      <p>{view.bill?.vendorName||view.vendorName||'-'} · Applied: {view.bill?.number||(view.allocations?.length?`${view.allocations.length} Bills`:'Vendor Advance')} · {fmtDate(view.date)}</p>
     </div>
     <div className="ivDocumentActions">
      <button className="primary" onClick={()=>onNavigate('Purchase Bills')}>
       <IconEye size={16}/>Open purchase bills
      </button>
     </div>
    </div>
    <div className="ivDetailStats">
     {[
      ['Payment status',view.status||'Posted'],
      ['Payment date',fmtDate(view.date)],
      ['Amount paid',money(view.amount)],
      ['Vendor',view.bill?.vendorName||view.vendorName||'-'],
      ['Applied to',view.bill?.number||(view.allocations?.length?`${view.allocations.length} Bills`:'Vendor Advance')],
      ['Bank account',accountLabel(view.bankAccount)],
      ['Reference / UTR',view.reference||'None (Direct settlement)'],
      ['Recorded by',view.createdBy||'Admin'],
     ].map(([k,v])=><span key={k}><small>{k}</small><strong>{v}</strong></span>)}
    </div>
    <section className="itemDetailCard">
     <div className="itemDetailSectionTitle">
      <h2>Accounting entry (Journal Preview)</h2>
     </div>
     <div className="ivScroll">
      <table className="ivInvoiceTable purchaseDetailLines">
       <thead>
        <tr>{['Account code','Account name','Nature / Type','Debit','Credit'].map(h=><th key={h}>{h}</th>)}</tr>
       </thead>
       <tbody>
        <tr>
         <td><b>2000</b></td>
         <td>Accounts Payable</td>
         <td>Current Liability (Settled)</td>
         <td><strong>{money(view.amount)}</strong></td>
         <td>—</td>
        </tr>
        <tr>
         <td><b>{view.bankAccount||'1010'}</b></td>
         <td>{accountLabel(view.bankAccount).replace(/^\d+\s*·\s*/,'')}</td>
         <td>Current Asset (Disbursed)</td>
         <td>—</td>
         <td><strong>{money(view.amount)}</strong></td>
        </tr>
       </tbody>
      </table>
     </div>
    </section>
    {view.notes&&<section className="itemDetailCard" style={{marginTop:16}}>
     <div className="itemDetailSectionTitle"><h2>Notes</h2></div>
     <p style={{margin:'8px 0 0',color:'#475467',fontSize:14}}>{view.notes}</p>
    </section>}
   </section>
  </div>
 </section>;

 return <section className="invoiceWorkspace purchaseWorkspace">
  <div className="ivHeading registerHead">
   <div className="registerHeadText">
    <h2>Payments Made <span className="registerHeadCount">({(db.vendorPayments||[]).length})</span></h2>
    <p>Posted payments allocated to purchase bills and Accounts Payable.</p>
   </div>
   <div className="ivTools">
    <label className="ivToolSearch">
     <IconSearch size={17}/>
     <input aria-label="Search vendor payments" placeholder="Search payment, bill, vendor or reference…" value={query} onChange={e=>setQuery(e.target.value)}/>
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
    <button className="primary" onClick={()=>onNavigate('Purchase Bills')}><IconPlus size={16}/>Record Payment</button>
   </div>
  </div>
  <div className="ivCard ivRegisterCard">
   <div className="ivScroll">
    <table className="ivInvoiceTable vpTable">
     <thead>
      <tr>
       <th>Payment & date</th>
       <th>Vendor</th>
       <th>Applied to</th>
       <th>Reference</th>
       <th>Bank account</th>
       <th className="vpAmount">Amount</th>
       <th className="vpStatus">Status</th>
       <th className="vpActions">Actions</th>
      </tr>
     </thead>
     <tbody>
      {rows.map(row=><tr key={row.id}>
       <td><b className="soOrderNumber" style={{cursor:'pointer'}} onClick={()=>setView(row)}>{row.number}</b><small>{fmtDate(row.date)}</small></td>
       <td>{row.bill?.vendorName||row.vendorName||'-'}</td>
       <td>{row.bill?<button type="button" className="ivLink" onClick={()=>onNavigate('Purchase Bills')}>{row.bill.number}</button>:(row.allocations?.length>1?`${row.allocations.length} Bills`:'Vendor Advance')}</td>
       <td>{row.reference||'-'}</td>
       <td>{accountLabel(row.bankAccount)}</td>
       <td className="vpAmount">{money(row.amount)}</td>
       <td className="vpStatus"><StatusPill status={row.status||'Posted'} tone="ok"/></td>
       <td className="vpActions">
        <div className="ivRowActions" style={{justifyContent:'flex-end'}}>
         <button type="button" className="ivIconButton" aria-label={'View '+row.number} title={'View '+row.number} onClick={()=>setView(row)}>
          <IconEye size={17}/>
         </button>
        </div>
       </td>
      </tr>)}
     </tbody>
    </table>
    {!rows.length&&<div className="ivEmpty"><h3>No vendor payments found</h3><p>{(db.vendorPayments||[]).length?'Adjust the search or filters to find a payment.':'Open a posted Purchase Bill to record the first payment.'}</p></div>}
   </div>
   <div className="ivActions purchaseRegisterFoot"><span>{rows.length} of {(db.vendorPayments||[]).length} records</span></div>
  </div>
 </section>;
}
