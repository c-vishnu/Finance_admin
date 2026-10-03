import {useDeferredValue,useEffect,useMemo,useState} from 'react';
import {IconAdjustments,IconAlertTriangle,IconCheck,IconEye,IconFileSpreadsheet,IconFileTypePdf,IconRefresh,IconSearch,IconUser} from '@tabler/icons-react';
import {readAccounts} from './account-store.js';
import {money} from './invoice-engine.js';
import {ALL,DASH,DEFAULT_SORT,POSTED,SORT_OPTIONS,salesExportSheet,salesReport,sortTransactions} from './business-reports.js';
import {downloadReport,excelReport} from './daybook-export.js';
import {getAccessibleOrganizations,getCurrentOrganizationContext} from './organisation-context.js';
import {tableExport} from './tax-compliance.js';
import EmptyState from './EmptyState.jsx';
import OutstandingActions from './OutstandingActions.jsx';
import StatusPill from './StatusPill.jsx';
import './business-reports.css';
import {DateRangeSelect,ReportExportMenu} from './ReportToolbar.jsx';

const CUSTOMERS_KEY='wayvida-customers';

/* The one date formatter every Wayvida register shares, so a date reads here exactly as it reads in
   the Transaction Register, the Day Book and the Journal Entries register. The projection keeps its
   dates in the comparable ISO form - the filters compare strings with it - and only this page
   renders them. */
const dateText=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):DASH;

/* The three lifecycle words a business report prints, each on the shared status pill. The word is
   always printed beside the tone, so a status is readable without relying on its colour. */
const STATUS_TONES={Draft:'neutral',Pending:'warn',Posted:'ok'};

const blankFilters=()=>({from:'',to:'',party:ALL,status:POSTED,branch:ALL});

/* The customer master is its own browser store, written by the Customers register. A missing store
   is not an error: the report still states every invoice, because each one carries its customer
   name, and only the code column is left blank. */
const readCustomers=()=>{try{const rows=JSON.parse(localStorage.getItem(CUSTOMERS_KEY));return Array.isArray(rows)?rows:[]}catch{return []}};

/* The Sales Report answers one question: what did we sell. It is a business report, not a ledger:
   one row per invoice, the amount the invoice itself carries, and no receivable, outstanding or
   payment-status column - those belong to Customer Outstanding. Every action hands off to the
   workflow that owns the document; this page only reads.

   The projection itself lives in src/business-reports.js, so what this file owns is the shell every
   other report uses: the heading with its search, Filters disclosure and exports, the four summary
   cards, the paged register, the reconciliation strip, the empty and error states, and the handoff
   that opens the source document where it already lives. */
export default function SalesReport({onNavigate=()=>{}}){
 const [revision,setRevision]=useState(0),[filters,setFilters]=useState(blankFilters),[search,setSearch]=useState(''),[filtersOpen,setFiltersOpen]=useState(false),[sort,setSort]=useState(DEFAULT_SORT),[perPage,setPerPage]=useState(25),[page,setPage]=useState(1),[stamp,setStamp]=useState(()=>new Date());
 const deferredSearch=useDeferredValue(search),busy=deferredSearch!==search;
 const organisation=getCurrentOrganizationContext().company;
 const branches=useMemo(()=>getAccessibleOrganizations().find(item=>item.id===organisation.id)?.branches||[], [organisation.id]);

 const refresh=()=>setRevision(value=>value+1);
 useEffect(()=>{window.addEventListener('wayvida-accounts-updated',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('wayvida-accounts-updated',refresh);window.removeEventListener('storage',refresh)}},[]);

 /* The book and the customer master, read together so one revision states them consistently. */
 const {book,customers,error}=useMemo(()=>{try{return {book:readAccounts(),customers:readCustomers(),error:''}}catch(reason){return {book:null,customers:[],error:reason.message}}},[revision]);

 const report=useMemo(()=>{
  try{return salesReport(book||{},customers,{...filters,search:deferredSearch,branches,organisation:organisation.id,organisationCode:organisation.code})}
  catch{return salesReport({},[],{...filters,search:deferredSearch,branches,organisation:organisation.id,organisationCode:organisation.code})}
 },[book,customers,filters,deferredSearch,branches,organisation.id,organisation.code]);

 /* The register shows one comfortable page of rows rather than one very long table, ordered by the
    same control the Transaction Register offers and defaulting to newest first. */
 const ordered=useMemo(()=>sortTransactions(report.rows,sort),[report.rows,sort]);
 const pageCount=Math.max(1,Math.ceil(ordered.length/perPage)),pageIndex=Math.min(page,pageCount);
 const startIndex=(pageIndex-1)*perPage,firstRow=ordered.length?startIndex+1:0,lastRow=Math.min(startIndex+perPage,ordered.length);
 useEffect(()=>{setPage(1)},[deferredSearch,filters,sort,perPage]);

 const set=(key,value)=>setFilters(current=>({...current,[key]:value}));
 const clear=()=>{setFilters(blankFilters());setSearch('');setSort(DEFAULT_SORT);setPage(1)};
 const sortLabel=(SORT_OPTIONS.find(option=>option.value===sort)||{}).label||'Newest first';
 const activeFilters=(filters.from?1:0)+(filters.to?1:0)+(filters.party!==ALL?1:0)+(filters.status!==POSTED?1:0)+(filters.branch!==ALL?1:0)+(sort!==DEFAULT_SORT?1:0);
 const branchOptions=useMemo(()=>[...new Set([...branches.map(branch=>branch.name),...report.branchOptions])].filter(Boolean).sort(),[branches,report.branchOptions]);
 const failed=report.checks.filter(check=>!check.ok);

 function remember(key,value){try{sessionStorage.setItem(key,value)}catch{}}
 function openDocument(entry){if(entry.handshake)remember(entry.handshake,entry.recordId);if(entry.page)onNavigate(entry.page)}
 function openCustomer(entry){if(!entry.partyId)return;remember('wayvida-credit-customer',entry.partyId);onNavigate('Customer Statement')}
 function rowActions(entry){return [{key:'view',label:'View Invoice',icon:IconEye,run:()=>openDocument(entry)},...(entry.partyId?[{key:'customer',label:'View Customer',icon:IconUser,run:()=>openCustomer(entry)}]:[])]}
 function print(){setStamp(new Date());setTimeout(()=>window.print(),50)}

 function printMeta(){return [
  ['Organisation',organisation.name],
  ['Branch',filters.branch===ALL?'All branches':filters.branch],
  ['Date range',(filters.from||'Beginning')+' to '+(filters.to||'Latest')],
  ['Invoice Status',filters.status===ALL?'All statuses':filters.status],
  ['Customer',filters.party===ALL?'All customers':filters.party],
  ['Search',search||'None'],
  ['Sorted by',sortLabel],
  ['Invoices',String(report.rows.length)],
  ['Generated by Local user',stamp.toLocaleString()]
 ]}

 function exportExcel(){
  const sheet=salesExportSheet(report);
  const content=excelReport(tableExport(sheet.header,sheet.rows,{
   title:'Wayvida Books · Sales Report',subtitle:'View sales transactions, customers and sales amounts.',
   organisation:organisation.name,branch:filters.branch,from:filters.from,to:filters.to,
   filters:{'Invoice Status':filters.status,Customer:filters.party,Branch:filters.branch,Search:search,Sort:sort===DEFAULT_SORT?'':sortLabel},
   count:report.rows.length,generatedBy:'Local user',generatedAt:stamp.toISOString()
  }));
  downloadReport(content,'wayvida-sales-report.xml','application/xml;charset=utf-8');
 }

 const statusText=filters.status===ALL?'all statuses':filters.status.toLowerCase()+' invoices';

 return <section className="brPage brSales" aria-busy={busy}>
  <header className="brHead">
   <div className="brHeadText"><h1>Sales Report</h1><p>View sales transactions, customers and sales amounts.</p></div>
   <div className="brHeadActions">
    <label className="brSearch"><IconSearch size={17}/><input aria-label="Search sales" placeholder="Search invoice, customer or reference" value={search} onChange={event=>setSearch(event.target.value)}/></label>
    <DateRangeSelect from={filters.from} to={filters.to} onChange={(start,end)=>{set('from',start);set('to',end)}} onCustom={()=>setFiltersOpen(true)}/>
    <details className="brFiltersMore" open={filtersOpen} onToggle={event=>setFiltersOpen(event.currentTarget.open)}>
     <summary aria-label="Open filters"><IconAdjustments size={17}/>Filters{activeFilters>0&&<span>{activeFilters}</span>}</summary>
     <div className="brFilters">
      <label>Date From<input type="date" aria-label="Date From" value={filters.from} onChange={event=>set('from',event.target.value)}/></label>
      <label>Date To<input type="date" aria-label="Date To" value={filters.to} onChange={event=>set('to',event.target.value)}/></label>
      <label>Customer<select aria-label="Customer" value={filters.party} onChange={event=>set('party',event.target.value)}><option value={ALL}>All customers</option>{report.partyOptions.map(option=><option key={option.name} value={option.name}>{option.code?option.code+' · '+option.name:option.name}</option>)}</select></label>
      <label>Branch<select aria-label="Branch" value={filters.branch} onChange={event=>set('branch',event.target.value)}><option value={ALL}>All branches</option>{branchOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Invoice Status<select aria-label="Invoice Status" value={filters.status} onChange={event=>set('status',event.target.value)}><option value={ALL}>All statuses</option>{report.statusOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Sort<select aria-label="Sort sales" value={sort} onChange={event=>setSort(event.target.value)}>{SORT_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <div className="brFilterActions"><button type="button" onClick={()=>{refresh();setStamp(new Date())}}><IconRefresh size={15}/>Refresh</button><button type="button" onClick={clear}>Clear filters</button></div>
     </div>
    </details>
    <ReportExportMenu items={[{key:'excel',label:'Export Excel',icon:<IconFileSpreadsheet size={17}/>,onClick:exportExcel,disabled:!report.rows.length},{key:'pdf',label:'Export PDF',icon:<IconFileTypePdf size={17}/>,onClick:print,disabled:!report.rows.length}]}/>
   </div>
  </header>
  {error&&<div className="brError" role="alert"><IconAlertTriangle size={18}/><span>Unable to load sales invoices. {error}</span><button type="button" onClick={refresh}>Retry</button></div>}
  <div className="brPrintMeta"><h2>Sales Report</h2>{printMeta().map(([label,value])=><p key={label}><b>{label}:</b> {value}</p>)}</div>
  <div className="brSummary">
   <div><span>Total Sales</span><strong>{money(report.totals.total)}</strong></div>
   <div><span>Taxable Sales</span><strong>{money(report.totals.taxable)}</strong></div>
   <div><span>GST</span><strong>{money(report.totals.gst)}</strong></div>
   <div><span>Invoices</span><strong>{report.totals.count}</strong></div>
  </div>
  <div className="brRegisterCard"><div className="brTableScroll"><table>
   <caption className="brCaption">Showing {report.rows.length} of {report.poolSize} sales invoices · {statusText}{busy?' · filtering':''}</caption>
   <thead><tr><th className="brDateCol">Date</th><th className="brNumberCol">Invoice</th><th className="brPartyCol">Customer</th><th className="brMetaCol brMoney">Taxable Amount</th><th className="brMetaCol brTaxCol brMoney">GST</th><th className="brMoneyCol brMoney">Total</th><th className="brStatusCol">Status</th><th className="brActionsCol">Actions</th></tr></thead>
   <tbody>
   {ordered.map((entry,index)=><tr key={entry.id} className={index>=startIndex&&index<startIndex+perPage?'':'brOffPage'} title={[entry.number,entry.party,entry.reference].filter(Boolean).join(' · ')}>
    <td className="brDateCol">{dateText(entry.date)}</td>
    <td className="brNumberCol"><button type="button" className="brLink" title={'Open invoice '+entry.number} onClick={()=>openDocument(entry)}>{entry.number}</button></td>
    <td className="brPartyCol" title={entry.party}>{entry.party}</td>
    <td className="brMetaCol brMoney">{money(entry.taxable)}</td>
    <td className="brMetaCol brTaxCol brMoney">{money(entry.gst)}</td>
    <td className="brMoneyCol brMoney">{money(entry.total)}</td>
    <td className="brStatusCol"><StatusPill status={entry.status} tone={STATUS_TONES[entry.status]||'neutral'}/></td>
    <td className="brActionsCol"><OutstandingActions label={'Actions for invoice '+entry.number} items={rowActions(entry)}/></td>
   </tr>)}
   {!report.rows.length&&<tr className="emptyStateRow"><td colSpan="8" className="emptyStateCell"><EmptyState variant="customer" title={report.hasRows?'No transactions match your filters.':'No sales transactions found.'} description={report.hasRows?'Try a wider date range, or clear the filters to see every sales invoice in this scope.':'Sales invoices will appear here once they are posted. Draft and cancelled invoices are never counted in a sales total.'} actionLabel={report.hasRows?'Clear filters':undefined} onAction={report.hasRows?clear:undefined}/></td></tr>}
   </tbody>
   {report.rows.length>0&&<tfoot><tr className="brGrandTotal">
    <th className="brDateCol brLabel" colSpan={2} scope="row">Total</th>
    <th className="brPartyCol"></th>
    <th className="brMetaCol brMoney">{money(report.totals.taxable)}</th>
    <th className="brMetaCol brTaxCol brMoney">{money(report.totals.gst)}</th>
    <th className="brMoneyCol brMoney">{money(report.totals.total)}</th>
    <th className="brStatusCol">{report.totals.count}</th>
    <th className="brActionsCol"></th>
   </tr></tfoot>}
  </table></div>
  {ordered.length>0&&<div className="pagination-footer brPager">
   <span className="pagination-left">Showing {firstRow}&ndash;{lastRow} of {ordered.length} invoices</span>
   <div className="pagination-right">
    <label className="brPerPage"><select aria-label="Invoices per page" value={perPage} onChange={event=>setPerPage(Number(event.target.value))}>{[25,50,100].map(size=><option key={size} value={size}>{size} per page</option>)}</select></label>
    <div className="pagination-nav"><button type="button" aria-label="Previous page" disabled={pageIndex<=1} onClick={()=>setPage(pageIndex-1)}>&lsaquo;</button><span>Page {pageIndex} of {pageCount}</span><button type="button" aria-label="Next page" disabled={pageIndex>=pageCount} onClick={()=>setPage(pageIndex+1)}>&rsaquo;</button></div>
   </div>
  </div>}
  </div>
  <div className={'brEquation brStickyBalance '+(failed.length?'mismatch':'balanced')} role="status">
   {failed.length?<IconAlertTriangle size={19}/>:<IconCheck size={19}/>}
   <b>{failed.length?'Sales Report needs review':'Sales agree with the invoices listed'}</b>
   <span>{failed.length?failed.map(check=>check.label).join(' · '):report.totals.count+' invoices · '+money(report.totals.total)}</span>
  </div>
 </section>;
}
