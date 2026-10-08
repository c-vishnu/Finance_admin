import {useDeferredValue,useEffect,useMemo,useState} from 'react';
import {IconAdjustments,IconAlertTriangle,IconFileSpreadsheet,IconFileTypePdf,IconRefresh,IconSearch} from '@tabler/icons-react';
import {readAccounts} from './account-store.js';
import {money} from './invoice-engine.js';
import {getAccessibleOrganizations,getCurrentOrganizationContext} from './organisation-context.js';
import {ALL,DASH,GST_TRANSACTION_TYPES,TAX_TYPES,collectGstDocuments,filterGstRows,gstOptions,gstReconciliation,hsnSummary,summarizeGst,tableExport} from './tax-compliance.js';
import {downloadReport,excelReport} from './daybook-export.js';
import EmptyState from './EmptyState.jsx';
import './tax-compliance.css';
import {DateRangeSelect,ReportExportMenu} from './ReportToolbar.jsx';

/* The one date formatter the Wayvida registers share, so a GST report date reads exactly as a
   Transaction Register or General Ledger date reads. The projection keeps ISO dates so the date
   filters stay string-comparable; only this page renders them. */
const dateText=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):DASH;
const rateText=value=>value?value+'%':DASH;

/* The four accounting-level GST views this module keeps, held as one page with a tab strip - never
   four sidebar entries. GST reporting stays at the accounting level and prepares no return. */
const TABS=[
 {key:'summary',label:'GST Summary',note:'Overview of GST recorded on sales and purchases.'},
 {key:'input',label:'Input GST',note:'GST recorded on purchases. This prototype does not track input tax credit status, so no eligibility is claimed.'},
 {key:'output',label:'Output GST',note:'GST charged on sales.'},
 {key:'hsn',label:'HSN / SAC Summary',note:'GST summary grouped by item or service classification.'}
];
const PAGED=['summary','output','input'];

const blankFilters=()=>({from:'',to:'',type:ALL,branch:ALL,party:ALL,gstin:ALL,rate:ALL,taxType:ALL});

/* The GST / Tax Reports workspace. It reads the documents the invoice, credit note, purchase bill and
   debit note engines already posted - through the GST document reader the Credit Notes module
   already uses - and states them under the heading, toolbar, cards, tabs, table, totals and note the
   other Wayvida reports use. It is read-only: it posts nothing, recalculates nothing and changes no
   accounting value. */
export default function GstTaxReports({onNavigate=()=>{}}){
 const [revision,setRevision]=useState(0),[filters,setFilters]=useState(blankFilters),[search,setSearch]=useState(''),[filtersOpen,setFiltersOpen]=useState(false),[stamp,setStamp]=useState(()=>new Date()),[tab,setTab]=useState('summary'),[perPage,setPerPage]=useState(25),[page,setPage]=useState(1);
 const deferredSearch=useDeferredValue(search),busy=deferredSearch!==search;
 const organisation=getCurrentOrganizationContext().company;

 const refresh=()=>setRevision(value=>value+1);
 useEffect(()=>{window.addEventListener('wayvida-accounts-updated',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('wayvida-accounts-updated',refresh);window.removeEventListener('storage',refresh)}},[]);

 /* The book and its GST rows, read together so one revision states them consistently. */
 const {book,rows,error}=useMemo(()=>{
  try{
   const state=readAccounts();
   return {book:state,rows:collectGstDocuments({book:state}),error:''};
  }catch(reason){
   return {book:{},rows:[],error:reason.message};
  }
 },[revision]);

 const visible=useMemo(()=>{
  try{return filterGstRows(rows,{...filters,search:deferredSearch})}
  catch{return []}
 },[rows,filters,deferredSearch]);
 const summary=useMemo(()=>summarizeGst(visible),[visible]);
 const options=useMemo(()=>gstOptions(rows),[rows]);
 const branches=useMemo(()=>[...new Set([...getAccessibleOrganizations().flatMap(item=>(item.branches||[]).map(branch=>branch.name)),...options.branches])].filter(Boolean).sort(),[options]);
 const reconciliation=useMemo(()=>{try{return gstReconciliation({book,rows:visible})}catch{return null}},[book,visible]);

 /* Documents that have not posted yet are stated on the page rather than silently left out: the
    report covers the recognised postings only, which is the rule every other report follows. */
 const unposted=useMemo(()=>{
  const count=(key,predicate)=>Array.isArray(book[key])?book[key].filter(predicate).length:0;
  return count('invoices',row=>!row.posted)+count('creditNotes',row=>!row.posted)+count('purchaseBills',row=>!row.posted)+count('debitNotes',row=>!row.posted);
 },[book]);

 /* The rows the active tab states. The three transaction tabs are one list each; the HSN / SAC tab is
    grouped by the projection and never re-sorted here. */
 const listRows=useMemo(()=>{
  if(tab==='output')return visible.filter(row=>row.direction==='output');
  if(tab==='input')return visible.filter(row=>row.direction==='input');
  return visible;
 },[tab,visible]);
 const aggregate=useMemo(()=>tab==='hsn'?hsnSummary(visible):[],[tab,visible]);

 /* One comfortable page of rows rather than one very long table, exactly as the Transaction Register,
    the journal register and the purchase register count theirs. */
 const paged=PAGED.includes(tab);
 const pageCount=Math.max(1,Math.ceil(listRows.length/perPage)),pageIndex=Math.min(page,pageCount);
 const startIndex=(pageIndex-1)*perPage,firstRow=listRows.length?startIndex+1:0,lastRow=Math.min(startIndex+perPage,listRows.length);
 useEffect(()=>{setPage(1)},[deferredSearch,filters,tab,perPage]);

 const activeFilters=Object.entries(filters).filter(([,value])=>value&&value!==ALL).length;
 const set=(key,value)=>setFilters(current=>({...current,[key]:value}));
 const clear=()=>{setFilters(blankFilters());setSearch('');setPage(1)};
 const tabNote=(TABS.find(entry=>entry.key===tab)||{}).note||'';

 /* Opening a document hands off to the module that owns it, through the same handshake the
    Transaction Register uses, so a GST row and a register row open the same screen. */
 function open(entry){
  try{if(entry.handshake&&entry.recordId)sessionStorage.setItem(entry.handshake,entry.recordId)}catch{}
  if(entry.page)onNavigate(entry.page);
 }

 const appliedFilters=()=>({'Transaction type':filters.type,Branch:filters.branch,Customer:filters.party,GSTIN:filters.gstin,'Tax rate':filters.rate,'Tax type':filters.taxType,Search:search});
 const metaFor=(title,count)=>({title,subtitle:'View GST collected, paid and tax positions for your business.',organisation:organisation.name,branch:filters.branch,from:filters.from,to:filters.to,filters:appliedFilters(),count,generatedBy:'Local user',generatedAt:stamp.toISOString()});

 /* The Excel sheet for the active tab: the tab's own header and the tab's own rows, in rupees,
    behind the report identity block, so the workbook states exactly what the screen states. Every
    other Wayvida export writes rupees too. */
 function sheet(){
  const rupees=value=>value/100;
  const totalOf=key=>rupees(listRows.reduce((sum,row)=>sum+row[key],0));
  if(tab==='hsn')return {head:['HSN / SAC','Description','Quantity','Taxable Amount INR','CGST INR','SGST INR','IGST INR','Total GST INR'],body:aggregate.map(row=>[row.code,row.description||DASH,row.quantity,rupees(row.taxable),rupees(row.cgst),rupees(row.sgst),rupees(row.igst),rupees(row.tax)])};
  const head=['Date & Transaction Type',tab==='summary'?'Document No.':(tab==='output'?'Invoice / Document No.':'Bill / Document No.'),tab==='summary'?'Customer / Supplier':(tab==='output'?'Customer':'Supplier'),'GSTIN','Taxable Amount INR','CGST INR','SGST INR','IGST INR','Total GST INR'];
  const body=listRows.map(row=>[dateText(row.date)+' ('+row.type+')',row.number,row.party||DASH,row.gstin||DASH,rupees(row.taxable),rupees(row.cgst),rupees(row.sgst),rupees(row.igst),rupees(row.tax)]);
  const total=['Total','','','',totalOf('taxable'),totalOf('cgst'),totalOf('sgst'),totalOf('igst'),totalOf('tax')];
  return {head,body:listRows.length?[...body,total]:body};
 }

 function exportExcel(){
  const label=(TABS.find(entry=>entry.key===tab)||{}).label||'GST / Tax Reports';
  const current=sheet();
  const content=excelReport(tableExport(current.head,current.body,metaFor('Wayvida Books · GST / Tax Reports · '+label,String(paged?listRows.length:aggregate.length))));
  downloadReport(content,'wayvida-gst-'+tab+'.xml','application/xml;charset=utf-8');
 }

 function print(){setStamp(new Date());setTimeout(()=>window.print(),50)}

 const printMeta=()=>[
  ['Organisation',organisation.name],
  ['Branch',filters.branch===ALL?'All branches':filters.branch],
  ['Date range',(filters.from||'Beginning')+' to '+(filters.to||'Latest')],
  ['View',(TABS.find(entry=>entry.key===tab)||{}).label||''],
  ['Transaction type',filters.type===ALL?'All types':filters.type],
  ['Tax type',filters.taxType===ALL?'All tax types':filters.taxType],
  ['Tax rate',filters.rate===ALL?'All rates':rateText(filters.rate)],
  ['Customer / Supplier',filters.party===ALL?'All parties':filters.party],
  ['GSTIN',filters.gstin===ALL?'All GSTINs':filters.gstin],
  ['Search',search||'None'],
  ['Documents',String(listRows.length)],
  ['Generated by Local user',stamp.toLocaleString()]
 ];

 const filterSelect=(key,label,values,allLabel)=><label key={key}>{label}<select aria-label={label} value={filters[key]} onChange={event=>set(key,event.target.value)}><option value={ALL}>{allLabel}</option>{values.map(value=><option key={value} value={value}>{value}</option>)}</select></label>;
 const linkCell=(row,label)=><button type="button" className="tcLink" title={'Open '+row.kind+' '+row.number} onClick={()=>open(row)}>{label}</button>;

 /* Every GST row the report prints, cell by cell. The document total is the sum of its own
    components - never a second calculation - and every money cell is right aligned. */
 const transactionRow=(row,offPage)=><tr key={row.id} className={offPage?'tcOffPage':''} title={[row.type,row.number,row.party,row.gstin].filter(Boolean).join(' · ')}>
  <td className="tcDateTypeCol">
   <div className="tcDateVal">{dateText(row.date)}</div>
   <div className="tcTypeVal">{row.type}</div>
  </td>
  <td className="tcNumberCol">{linkCell(row,row.number)}</td>
  <td className="tcPartyCol" title={row.party||undefined}>{row.party||DASH}</td>
  <td className="tcGstinCol" title={row.gstin||undefined}>{row.gstin||DASH}</td>
  <td className="tcMoney">{money(row.taxable)}</td>
  <td className="tcMoney">{money(row.cgst)}</td>
  <td className="tcMoney">{money(row.sgst)}</td>
  <td className="tcMoney">{money(row.igst)}</td>
  <td className="tcMoney tcStrong">{money(row.tax)}</td>
 </tr>;

 const table=()=>{
  if(tab==='hsn')return <table className="tcAggregate">
   <caption className="tcCaption">HSN / SAC Summary · {aggregate.length} codes from outward supplies</caption>
   <thead><tr><th>HSN / SAC</th><th>Description</th><th className="tcNumCol">Quantity</th><th className="tcNumCol">Taxable Amount</th><th className="tcNumCol">CGST</th><th className="tcNumCol">SGST</th><th className="tcNumCol">IGST</th><th className="tcNumCol">Total GST</th></tr></thead>
   <tbody>
    {aggregate.map(row=><tr key={row.code}><td className="tcCodeCol">{row.code}</td><td className="tcPartyCol" title={row.description||undefined}>{row.description||DASH}</td><td className="tcNumCol">{row.quantity}</td><td className="tcMoney">{money(row.taxable)}</td><td className="tcMoney">{money(row.cgst)}</td><td className="tcMoney">{money(row.sgst)}</td><td className="tcMoney">{money(row.igst)}</td><td className="tcMoney tcStrong">{money(row.tax)}</td></tr>)}
   </tbody>
   <tfoot><tr><td>Total</td><td/><td className="tcNumCol">{aggregate.reduce((n,row)=>n+row.quantity,0)}</td><td className="tcMoney">{money(aggregate.reduce((n,row)=>n+row.taxable,0))}</td><td className="tcMoney">{money(aggregate.reduce((n,row)=>n+row.cgst,0))}</td><td className="tcMoney">{money(aggregate.reduce((n,row)=>n+row.sgst,0))}</td><td className="tcMoney">{money(aggregate.reduce((n,row)=>n+row.igst,0))}</td><td className="tcMoney tcStrong">{money(aggregate.reduce((n,row)=>n+row.tax,0))}</td></tr></tfoot>
  </table>;
  const totals=key=>listRows.reduce((n,row)=>n+row[key],0);
  const columns=[16,16,22,14,8,8,8,8,10];
  const head=['DATE & TRANSACTION TYPE',tab==='summary'?'DOCUMENT NO.':(tab==='output'?'INVOICE / DOCUMENT NO.':'BILL / DOCUMENT NO.'),tab==='summary'?'CUSTOMER / SUPPLIER':(tab==='output'?'CUSTOMER':'SUPPLIER'),'GSTIN','TAXABLE AMOUNT','CGST','SGST','IGST','TOTAL GST'];
  return <table className="tcFixed">
   <caption className="tcCaption">{listRows.length} of {rows.length} GST documents{busy?' · filtering':''}</caption>
   <colgroup>{columns.map((width,index)=><col key={index} style={{width:width+'%'}}/>)}</colgroup>
   <thead><tr>{head.map((label,index)=><th key={label} className={index>=4?'tcRight':''}>{label}</th>)}</tr></thead>
   <tbody>
    {listRows.map((row,index)=>transactionRow(row,paged&&(index<startIndex||index>=startIndex+perPage)))}
    {!listRows.length&&<tr className="emptyStateRow"><td colSpan={head.length} className="emptyStateCell"><EmptyState variant="journal" title={rows.length?'No transactions match your filters.':'No GST transactions found.'} description={rows.length?'Try a wider date range, or clear the filters to see every GST document in this scope.':'Record an invoice, credit note, purchase bill or debit note and its tax will appear here. It never creates sample tax data.'} actionLabel={rows.length||search||activeFilters?'Clear filters':undefined} onAction={rows.length||search||activeFilters?clear:undefined}/></td></tr>}
   </tbody>
   {listRows.length?<tfoot><tr><td colSpan={4}>Total · {listRows.length} documents</td><td className="tcMoney">{money(totals('taxable'))}</td><td className="tcMoney">{money(totals('cgst'))}</td><td className="tcMoney">{money(totals('sgst'))}</td><td className="tcMoney">{money(totals('igst'))}</td><td className="tcMoney tcStrong">{money(totals('tax'))}</td></tr></tfoot>:null}
  </table>;
 };

 return <section className="tcPage tcGstPage" aria-busy={busy}>
  <header className="tcHead">
   <div className="tcHeadText"><h1>GST / Tax Reports</h1><p>View GST collected, paid and tax positions for your business.</p></div>
   <div className="tcHeadActions">
    <DateRangeSelect from={filters.from} to={filters.to} onChange={(start,end)=>{set('from',start);set('to',end)}} onCustom={()=>setFiltersOpen(true)}/>
    <details className="tcFiltersMore" open={filtersOpen} onToggle={event=>setFiltersOpen(event.currentTarget.open)}>
     <summary aria-label="Open filters"><IconAdjustments size={17}/>Filters{activeFilters>0&&<span>{activeFilters}</span>}</summary>
     <div className="tcFilters">
      <label>Date from<input type="date" aria-label="Date from" value={filters.from} onChange={event=>set('from',event.target.value)}/></label>
      <label>Date to<input type="date" aria-label="Date to" value={filters.to} onChange={event=>set('to',event.target.value)}/></label>
      {filterSelect('type','Transaction type',options.types,'All types')}
      {filterSelect('branch','Branch',branches,'All branches')}
      {filterSelect('party','Customer / Supplier',options.parties,'All parties')}
      {filterSelect('gstin','GSTIN',options.gstins,'All GSTINs')}
      <label>Tax rate<select aria-label="Tax rate" value={filters.rate} onChange={event=>set('rate',event.target.value)}><option value={ALL}>All rates</option>{options.rates.map(value=><option key={value} value={value}>{value}%</option>)}</select></label>
      {filterSelect('taxType','Tax type',TAX_TYPES,'All tax types')}
      <div className="tcFilterActions"><button type="button" onClick={()=>{refresh();setStamp(new Date())}}><IconRefresh size={15}/>Refresh</button><button type="button" onClick={clear}>Clear filters</button></div>
     </div>
    </details>
    <ReportExportMenu items={[{key:'excel',label:'Export Excel',icon:<IconFileSpreadsheet size={17}/>,onClick:exportExcel,disabled:!listRows.length&&!aggregate.length},{key:'pdf',label:'Export PDF',icon:<IconFileTypePdf size={17}/>,onClick:print,disabled:!visible.length}]}/>
   </div>
  </header>

  {error&&<div className="tcError" role="alert"><IconAlertTriangle size={18}/><span>Unable to load GST report. {error}</span><button type="button" onClick={refresh}>Retry</button></div>}
  <div className="tcPrintMeta"><h2>GST / Tax Reports</h2>{printMeta().map(([label,value])=><p key={label}><b>{label}:</b> {value}</p>)}</div>

  <div className="tcSummary">
   <div><span>Taxable Sales</span><strong>{money(summary.taxableSales)}</strong></div>
   <div><span>Output GST</span><strong>{money(summary.outputGst)}</strong></div>
   <div><span>Input GST</span><strong>{money(summary.inputGst)}</strong></div>
   <div><span>Net GST Position</span><strong>{money(summary.netGst)}</strong><small>Output GST less input GST</small></div>
  </div>

  <div className="tcTabs" role="tablist" aria-label="GST report views">
   {TABS.map(entry=><button key={entry.key} type="button" role="tab" id={'gst-tab-'+entry.key} aria-selected={tab===entry.key} aria-controls="gst-tabpanel" className={tab===entry.key?'active':''} onClick={()=>setTab(entry.key)}>{entry.label}</button>)}
  </div>

  <div className="tcRegisterCard" id="gst-tabpanel" role="tabpanel" aria-labelledby={'gst-tab-'+tab}>
   <div className="tcTableScroll">{table()}</div>
   {paged&&listRows.length>0&&<div className="pagination-footer tcPager">
    <span className="pagination-left">Showing {firstRow}&ndash;{lastRow} of {listRows.length} transactions</span>
    <div className="pagination-right">
     <label className="tcPerPage"><select aria-label="Transactions per page" value={perPage} onChange={event=>setPerPage(Number(event.target.value))}>{[25,50,100].map(size=><option key={size} value={size}>{size} per page</option>)}</select></label>
     <div className="pagination-nav"><button type="button" aria-label="Previous page" disabled={pageIndex<=1} onClick={()=>setPage(pageIndex-1)}>&lsaquo;</button><span>Page {pageIndex} of {pageCount}</span><button type="button" aria-label="Next page" disabled={pageIndex>=pageCount} onClick={()=>setPage(pageIndex+1)}>&rsaquo;</button></div>
    </div>
   </div>}
  </div>

  {reconciliation&&visible.length>0&&<p className={reconciliation.difference?'tcRecon warn':'tcRecon ok'} role="status">{reconciliation.difference===0?'✓ GST balances reconcile with the ledger accounts.':<>⚠ GST report difference: {money(reconciliation.difference)} · documents state {money(reconciliation.documentOutput+reconciliation.documentInput)} against {money(reconciliation.ledgerOutput+reconciliation.ledgerInput)} posted to the GST accounts.</>}</p>}
  <p className="tcNote">{tabNote}{unposted>0?' Only posted documents are stated: '+unposted+' draft or unposted document'+(unposted===1?' is':'s are')+' excluded.':''}</p>
 </section>;
}
