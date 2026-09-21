import {useMemo,useState} from 'react';
import {IconDownload,IconSearch,IconFilter} from '@tabler/icons-react';
import {money} from './invoice-engine.js';
import {PURCHASE_BILL_KEY} from './purchase-service.js';
import {purchaseReportCsv,purchaseReportRows,purchaseReportSummary} from './purchase-reports.js';
import StatusPill from './StatusPill.jsx';
import EmptyState from './EmptyState.jsx';
import './purchase-reports.css';

const readBills=()=>{try{const rows=JSON.parse(localStorage.getItem(PURCHASE_BILL_KEY)||'[]');return Array.isArray(rows)?rows:[]}catch{return[]}};
const fyStart=()=>{const now=new Date(),year=now.getMonth()<3?now.getFullYear()-1:now.getFullYear();return `${year}-04-01`};
const today=()=>new Date().toLocaleDateString('en-CA');

export default function PurchaseReports({onNavigate=()=>{}}){
 const [bills]=useState(readBills),[filters,setFilters]=useState({from:fyStart(),to:today(),vendor:'All vendors',status:'All statuses',query:''});
 const activeFilters=[filters.vendor!=='All vendors',filters.status!=='All statuses',!!filters.query,filters.from!==fyStart(),filters.to!==today()].filter(Boolean).length;
 const clearFilters=()=>setFilters({from:fyStart(),to:today(),vendor:'All vendors',status:'All statuses',query:''});
 const vendors=useMemo(()=>[...new Map(bills.filter(row=>row.vendorId||row.vendorName).map(row=>[row.vendorId||row.vendorName,{id:row.vendorId||row.vendorName,name:row.vendorName}])).values()].sort((a,b)=>a.name.localeCompare(b.name)),[bills]);
 const statuses=useMemo(()=>[...new Set(bills.map(row=>row.status).filter(Boolean))].sort(),[bills]);
 const rows=useMemo(()=>purchaseReportRows(bills,filters),[bills,filters]),summary=useMemo(()=>purchaseReportSummary(rows),[rows]);
 const set=(key,value)=>setFilters(current=>({...current,[key]:value}));
 function exportCsv(){const blob=new Blob([purchaseReportCsv(rows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`purchase-report-${filters.from||'all'}-${filters.to||'all'}.csv`;link.click();URL.revokeObjectURL(url)}
 return <section className="invoiceWorkspace purchaseWorkspace purchaseReportPage">
  <div className="ivHeading"><div><h2>Purchase Reports</h2><p>Review vendor spend, input tax, payments, and outstanding payables.</p></div><div className="ivActions"><button onClick={exportCsv} disabled={!rows.length}><IconDownload size={16}/>Export CSV</button></div></div>
  <div className="ivCard"><div className="ivTools"><label className="ivToolSearch"><IconSearch size={17}/><input aria-label="Search purchase report" placeholder="Search bill, vendor, or reference" value={filters.query} onChange={e=>set('query',e.target.value)}/></label><details className="soFiltersMore"><summary aria-label="Open filters"><IconFilter size={17}/>Filters{activeFilters>0&&<i>{activeFilters}</i>}</summary><div className="soFiltersPanel"><label>From<input type="date" aria-label="Filter from" value={filters.from} onChange={e=>set('from',e.target.value)}/></label><label>To<input type="date" aria-label="Filter to" value={filters.to} onChange={e=>set('to',e.target.value)}/></label><label>Vendor<select aria-label="Filter vendor" value={filters.vendor} onChange={e=>set('vendor',e.target.value)}><option>All vendors</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label><label>Status<select aria-label="Filter status" value={filters.status} onChange={e=>set('status',e.target.value)}><option>All statuses</option>{statuses.map(value=><option key={value}>{value}</option>)}</select></label><button type="button" className="soClearFilters" onClick={clearFilters}>Clear filters</button></div></details></div></div>
  <div className="purchaseReportMetrics">{[['Purchase bills',summary.billCount],['Total purchases',money(summary.total)],['Input tax',money(summary.inputTax)],['Paid',money(summary.paid)],['Outstanding',money(summary.outstanding)]].map(([label,value],index)=><article key={label} className={index===4?'due':''}><span>{label}</span><strong>{value}</strong><small>{label==='Purchase bills'?'Excludes cancelled bills':'For selected period'}</small></article>)}</div>
  <section className="ivCard"><div className="ivHeading"><div><h3>Vendor summary</h3><p>{summary.vendors.length} vendors in the selected period</p></div></div><div className="ivScroll"><table className="ivInvoiceTable"><thead><tr>{['Vendor','Bills','Purchases','Input tax','Paid','Outstanding'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{summary.vendors.map(row=><tr key={row.vendorId}><td>{row.vendorName}</td><td>{row.bills}</td><td>{money(row.total)}</td><td>{money(row.inputTax)}</td><td>{money(row.paid)}</td><td>{money(row.balance)}</td></tr>)}</tbody></table>{!summary.vendors.length&&<EmptyState variant="adjustment" title="No purchase data found" description="Adjust the report filters or create a purchase bill." actionLabel="Open Purchase Bills" onAction={()=>onNavigate('Purchase Bills')}/>}</div></section>
  {!!rows.length&&<section className="ivCard"><div className="ivHeading"><div><h3>Purchase bill details</h3><p>{rows.length} matching records</p></div></div><div className="ivScroll"><table className="ivInvoiceTable"><thead><tr>{['Date','Bill','Vendor','Vendor invoice','Status','Total','Balance due'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.date}</td><td><button className="ivLink" onClick={()=>onNavigate('Purchase Bills')}>{row.number}</button></td><td>{row.vendorName}</td><td>{row.vendorInvoice||'-'}</td><td><StatusPill status={row.status} tone={REPORT_TONES(row.status)}/></td><td>{money(row.total)}<small>Paid {money(row.paidAmount)}</small></td><td>{money(row.balance)}</td></tr>)}</tbody></table></div></section>}
 </section>;
}

const REPORT_TONES=value=>{const s=String(value||'').toLowerCase();if(/cancel|overdue|reject/.test(s))return 'danger';if(/pending|awaiting/.test(s))return 'warn';if(/partial/.test(s))return 'info';if(/paid|completed|received/.test(s))return 'ok';if(/sent|approved|open/.test(s))return 'info';return 'neutral'};