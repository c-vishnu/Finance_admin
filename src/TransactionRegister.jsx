import {useDeferredValue,useEffect,useMemo,useState} from 'react';
import {IconAdjustments,IconAlertTriangle,IconDots,IconExternalLink,IconEye,IconFileSearch,IconFileSpreadsheet,IconFileTypePdf,IconRefresh,IconSearch,IconX} from '@tabler/icons-react';
import {readAccounts} from './account-store.js';
import {money} from './invoice-engine.js';
import {BANKING_KEY} from './banking-service.js';
import {MANUAL_JOURNAL_KEY} from './simple-journal-transaction.js';
import {readOperations} from './operations-store.js';
import {getAccessibleOrganizations,getCurrentOrganizationContext} from './organisation-context.js';
import {ALL,DEFAULT_SORT,SORT_OPTIONS,TRANSACTION_STATUSES,collectTransactions,filterTransactions,registerOptions,sortTransactions,summarizeTransactions,transactionRegisterExportRows} from './transaction-register.js';
import {downloadReport,excelReport} from './daybook-export.js';
import EmptyState from './EmptyState.jsx';
import StatusPill from './StatusPill.jsx';
import './transaction-register.css';
import {DateRangeSelect,ReportExportMenu} from './ReportToolbar.jsx';

const DASH='—';

/* The one date formatter the Wayvida registers share, so a date reads here exactly as it reads in
   the Journal Entries, General Ledger and Sales Order registers. The projection keeps its dates in
   the comparable ISO form - filters compare strings with it - and only this page renders them. */
const dateText=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):DASH;

/* The five lifecycle words the register counts by, each on the shared status pill. The word is
   always printed beside the tone, so a status is readable without relying on its colour. */
const STATUS_TONES={Draft:'neutral',Pending:'warn',Posted:'ok',Reversed:'danger',Cancelled:'danger'};

const blankFilters=()=>({from:'',to:'',type:ALL,status:ALL,branch:ALL,customer:ALL,supplier:ALL});

/* One store reader for the four places a transaction can live. */
const readStore=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')??null}catch{return null}};
const typeClass=type=>'trTypeBadge trType-'+(type||'').replace(/\s+/g,'-');

export default function TransactionRegister({onNavigate=()=>{}}){
 const [revision,setRevision]=useState(0),[filters,setFilters]=useState(blankFilters),[search,setSearch]=useState(''),[filtersOpen,setFiltersOpen]=useState(false),[stamp,setStamp]=useState(()=>new Date()),[sort,setSort]=useState(DEFAULT_SORT),[perPage,setPerPage]=useState(25),[page,setPage]=useState(1),[previewEntry,setPreviewEntry]=useState(null);
 const deferredSearch=useDeferredValue(search),busy=deferredSearch!==search;
 const organisation=getCurrentOrganizationContext().company;

 const refresh=()=>setRevision(value=>value+1);
 useEffect(()=>{window.addEventListener('wayvida-accounts-updated',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('wayvida-accounts-updated',refresh);window.removeEventListener('storage',refresh)}},[]);

 const {rows,error}=useMemo(()=>{
  try{
   return {
    rows:collectTransactions({
     book:readAccounts(),
     operations:readOperations(),
     banking:readStore(BANKING_KEY)||{},
     manual:readStore(MANUAL_JOURNAL_KEY)||[]
    }),
    error:''
   };
  }catch(reason){
   return {rows:[],error:reason.message};
  }
 },[revision]);

 const visible=useMemo(()=>{
  try{return filterTransactions(rows,{...filters,search:deferredSearch})}
  catch{return []}
 },[rows,filters,deferredSearch]);
 const summary=useMemo(()=>summarizeTransactions(visible),[visible]);
 const options=useMemo(()=>registerOptions(rows),[rows]);
 const branches=useMemo(()=>[...new Set([...getAccessibleOrganizations().flatMap(item=>(item.branches||[]).map(branch=>branch.name)),...options.branches])].filter(Boolean).sort(),[options]);

 const ordered=useMemo(()=>sortTransactions(visible,sort),[visible,sort]);
 const pageCount=Math.max(1,Math.ceil(ordered.length/perPage)),pageIndex=Math.min(page,pageCount);
 const startIndex=(pageIndex-1)*perPage,firstRow=ordered.length?startIndex+1:0,lastRow=Math.min(startIndex+perPage,ordered.length);
 useEffect(()=>{setPage(1)},[deferredSearch,filters,sort,perPage]);

 const sortLabel=(SORT_OPTIONS.find(option=>option.value===sort)||{}).label||'Newest first';
 const activeFilters=Object.entries(filters).filter(([key,value])=>value&&value!==ALL).length+(sort!==DEFAULT_SORT?1:0);
 const set=(key,value)=>setFilters(current=>({...current,[key]:value}));
 const clear=()=>{setFilters(blankFilters());setSearch('');setSort(DEFAULT_SORT);setPage(1)};

 function open(entry){
  try{if(entry.handshake&&entry.handoffId)sessionStorage.setItem(entry.handshake,entry.handoffId)}catch{}
  if(entry.page)onNavigate(entry.page);
 }

 function exportExcel(){
  const content=excelReport(transactionRegisterExportRows(visible,{
   organisation:organisation.name,
   branch:filters.branch,
   from:filters.from,
   to:filters.to,
   filters:{'Transaction type':filters.type,Status:filters.status,Branch:filters.branch,Customer:filters.customer,Supplier:filters.supplier,Search:search,Sort:sort===DEFAULT_SORT?'':sortLabel},
   generatedBy:'Local user',
   generatedAt:stamp.toISOString()
  }));
  downloadReport(content,'wayvida-transaction-register.xml','application/xml;charset=utf-8');
 }

 function print(){setStamp(new Date());setTimeout(()=>window.print(),50)}

 const printMeta=()=>[
  ['Organisation',organisation.name],
  ['Branch',filters.branch===ALL?'All branches':filters.branch],
  ['Date range',(filters.from||'Beginning')+' to '+(filters.to||'Latest')],
  ['Transaction type',filters.type===ALL?'All types':filters.type],
  ['Status',filters.status===ALL?'All statuses':filters.status],
  ['Customer',filters.customer===ALL?'All customers':filters.customer],
  ['Supplier',filters.supplier===ALL?'All suppliers':filters.supplier],
  ['Search',search||'None'],
  ['Sorted by',sortLabel],
  ['Transactions',String(visible.length)],
  ['Generated by Local user',stamp.toLocaleString()]
 ];

 const filterSelect=(key,label,values,allLabel)=><label key={key}>{label}<select aria-label={label} value={filters[key]} onChange={event=>set(key,event.target.value)}><option value={ALL}>{allLabel}</option>{values.map(value=><option key={value} value={value}>{value}</option>)}</select></label>;

 return <section className="trPage" aria-busy={busy}>
  <header className="trHead">
   <div className="trHeadText"><h1>Transaction Register ({summary.total})</h1><p>Find and review your business transactions in one place.</p></div>
   <div className="trHeadActions">
    <label className="trSearch"><IconSearch size={19}/><input aria-label="Search transactions" placeholder="Search transactions..." value={search} onChange={event=>setSearch(event.target.value)}/></label>
    <DateRangeSelect from={filters.from} to={filters.to} onChange={(start,end)=>{setFilters(current=>({...current,from:start,to:end}))}} onCustom={()=>setFiltersOpen(true)}/>
    <details className="trFiltersMore" open={filtersOpen} onToggle={event=>setFiltersOpen(event.currentTarget.open)}>
     <summary aria-label="Open filters"><IconAdjustments size={24} stroke={2.2}/>Filters{activeFilters>0&&<span>{activeFilters}</span>}</summary>
     <div className="trFilters">
      {filterSelect('type','Transaction type',options.types,'All types')}
      {filterSelect('status','Status',TRANSACTION_STATUSES,'All statuses')}
      {filterSelect('branch','Branch',branches,'All branches')}
      {filterSelect('customer','Customer',options.customers,'All customers')}
      {filterSelect('supplier','Supplier',options.suppliers,'All suppliers')}
      <label>Sort<select aria-label="Sort transactions" value={sort} onChange={event=>setSort(event.target.value)}>{SORT_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <div className="trFilterActions"><button type="button" onClick={()=>{refresh();setStamp(new Date())}}><IconRefresh size={15}/>Refresh</button><button type="button" onClick={clear}>Clear filters</button></div>
     </div>
    </details>
    <ReportExportMenu items={[{key:'excel',label:'Export Excel',icon:<IconFileSpreadsheet size={19}/>,onClick:exportExcel,disabled:!visible.length},{key:'pdf',label:'Export PDF',icon:<IconFileTypePdf size={19}/>,onClick:print,disabled:!visible.length}]}/>
   </div>
  </header>

  {error&&<div className="trError" role="alert"><IconAlertTriangle size={18}/><span>Unable to load transactions. {error}</span><button type="button" onClick={refresh}>Retry</button></div>}
  <div className="trPrintMeta"><h2>Transaction Register</h2>{printMeta().map(([label,value])=><p key={label}><b>{label}:</b> {value}</p>)}</div>

  <div className="trRegisterCard">
   <div className="trTableScroll">
    <table>
     <thead><tr><th className="trDocDateCol">Document No. & Date</th><th className="trTypeCol">Transaction Type</th><th className="trPartyCol">Party / Description</th><th className="trRefCol">Reference</th><th className="trAmountCol">Amount</th><th className="trStatusCol">Status</th><th className="trActionsCol">Actions</th></tr></thead>
     <tbody>
     {ordered.map((entry,index)=><tr key={entry.id} className={index>=startIndex&&index<startIndex+perPage?'':'trOffPage'} title={[entry.type,entry.number,entry.party||entry.description,entry.reference].filter(Boolean).join(' · ')}>
      <td className="trDocDateCol">
       <div className="trDocDateCell">
        <button type="button" className="trLink" title={'Open '+entry.type+' '+entry.number} onClick={()=>open(entry)}>{entry.number}</button>
        <span className="trDateSub">{dateText(entry.date)}</span>
       </div>
      </td>
      <td className="trTypeCol"><span className={typeClass(entry.type)}>{entry.type}</span></td>
      <td className="trPartyCol" title={entry.party||entry.description||undefined}>{entry.party||entry.description||DASH}</td>
      <td className="trRefCol" title={entry.reference||undefined}>{entry.reference||DASH}</td>
      <td className="trMoney trAmountCol">{money(entry.amount)}</td>
      <td className="trStatusCol"><StatusPill status={entry.status} tone={STATUS_TONES[entry.status]||'neutral'}/></td>
      <td className="trActionsCol">
       <details className="trActionsMenu">
        <summary aria-label={'Actions for '+entry.number}><IconDots size={18}/></summary>
        <div className="trActionsDropdown" role="menu">
         <button type="button" role="menuitem" onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');open(entry);}}>
          <IconEye size={16}/>
          <span>View</span>
         </button>
         <button type="button" role="menuitem" onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');setPreviewEntry(entry);}}>
          <IconFileSearch size={16}/>
          <span>Preview</span>
         </button>
        </div>
       </details>
      </td>
     </tr>)}
      {!visible.length&&<tr className="emptyStateRow"><td colSpan="7" className="emptyStateCell"><EmptyState variant="journal" title={rows.length?'No transactions match your filters.':'No transactions found.'} description={rows.length?'Try a wider date range, or clear the filters to see every transaction in this scope.':'Record an invoice, receipt, bill, payment or journal and it will appear here. It never creates sample transactions.'} actionLabel={rows.length||search||activeFilters?'Clear filters':undefined} onAction={rows.length||search||activeFilters?clear:undefined}/></td></tr>}
     </tbody>
    </table>
   </div>
   {ordered.length>0&&<div className="pagination-footer trPager">
    <span className="pagination-left">Showing {firstRow}&ndash;{lastRow} of {ordered.length} transactions</span>
    <div className="pagination-right">
     <label className="trPerPage"><select aria-label="Transactions per page" value={perPage} onChange={event=>setPerPage(Number(event.target.value))}>{[25,50,100].map(size=><option key={size} value={size}>{size} per page</option>)}</select></label>
     <div className="pagination-nav"><button type="button" aria-label="Previous page" disabled={pageIndex<=1} onClick={()=>setPage(pageIndex-1)}>&lsaquo;</button><span>Page {pageIndex} of {pageCount}</span><button type="button" aria-label="Next page" disabled={pageIndex>=pageCount} onClick={()=>setPage(pageIndex+1)}>&rsaquo;</button></div>
    </div>
   </div>}
  </div>

  {previewEntry&&<div className="trModalOverlay" onClick={()=>setPreviewEntry(null)}>
   <div className="trModalContent" onClick={e=>e.stopPropagation()}>
    <header className="trModalHeader">
     <div>
      <span className="trModalType">{previewEntry.type}</span>
      <h3>{previewEntry.number}</h3>
     </div>
     <button type="button" className="trModalClose" aria-label="Close preview" onClick={()=>setPreviewEntry(null)}><IconX size={18}/></button>
    </header>
    <div className="trModalBody">
     <div className="trModalGrid">
      <div><label>Date</label><span>{dateText(previewEntry.date)}</span></div>
      <div><label>Status</label><StatusPill status={previewEntry.status} tone={STATUS_TONES[previewEntry.status]||'neutral'}/></div>
      <div><label>Party / Description</label><span>{previewEntry.party||previewEntry.description||DASH}</span></div>
      <div><label>Reference</label><span>{previewEntry.reference||DASH}</span></div>
      <div><label>Amount</label><strong>{money(previewEntry.amount)}</strong></div>
      <div><label>Branch</label><span>{previewEntry.branch||'Head Office'}</span></div>
     </div>
    </div>
    <footer className="trModalFooter">
     <button type="button" onClick={()=>setPreviewEntry(null)}>Close</button>
     <button type="button" className="trPrimaryBtn" onClick={()=>{setPreviewEntry(null);open(previewEntry);}}><IconExternalLink size={16}/>Open Document</button>
    </footer>
   </div>
  </div>}
 </section>;
}
