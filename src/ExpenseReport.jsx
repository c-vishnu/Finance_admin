import {useDeferredValue,useEffect,useMemo,useState} from 'react';
import {IconAdjustments,IconAlertTriangle,IconCheck,IconEye,IconFileSpreadsheet,IconFileTypePdf,IconRefresh,IconSearch} from '@tabler/icons-react';
import {readAccounts} from './account-store.js';
import {money} from './invoice-engine.js';
import {ALL,DASH,DEFAULT_SORT,POSTED,SORT_OPTIONS,expenseExportSheet,expenseReport,sortTransactions} from './business-reports.js';
import {downloadReport,excelReport} from './daybook-export.js';
import {getAccessibleOrganizations,getCurrentOrganizationContext} from './organisation-context.js';
import {readOperations} from './operations-store.js';
import {tableExport} from './tax-compliance.js';
import EmptyState from './EmptyState.jsx';
import OutstandingActions from './OutstandingActions.jsx';
import StatusPill from './StatusPill.jsx';
import './business-reports.css';
import {DateRangeSelect,ReportExportMenu} from './ReportToolbar.jsx';

/* The one date formatter every Wayvida register shares, so a date reads here exactly as it reads in
   the Transaction Register, the Day Book and the Journal Entries register. */
const dateText=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):DASH;

const STATUS_TONES={Draft:'neutral',Pending:'warn',Posted:'ok'};

/* The Branch control is offered only when an expense in this scope actually carries a branch. The
   expense record has no branch field of its own; the branch is read from the journal the expense
   posted, and an expense recorded outside a branch context has none. Offering the control anyway
   would put a filter on the page that could only ever empty the table, which the brief forbids. */
const blankFilters=()=>({from:'',to:'',party:ALL,status:POSTED,branch:ALL,account:ALL,category:ALL,payment:ALL});

/* The Expense Report answers one question: what did we spend. It is a business report, not a ledger:
   one row per expense, stated at the amount that was recorded.

   THE TAX COLUMN IS A RATE, NOT A FIGURE. An expense stores a tax LABEL (for example "GST 18%") and
   one amount - the amount actually spent - and the expense posting debits the expense account and
   credits the payment account for that whole amount, with no separate input tax line. The model
   therefore does not know how much of an expense was tax, so the Amount column states the recorded
   amount, the Tax column states the recorded rate, and no rupee tax figure is printed anywhere.
   That is why the Tax summary card reads as a statement rather than a total. */
export default function ExpenseReport({onNavigate=()=>{}}){
 const [revision,setRevision]=useState(0),[filters,setFilters]=useState(blankFilters),[search,setSearch]=useState(''),[filtersOpen,setFiltersOpen]=useState(false),[sort,setSort]=useState(DEFAULT_SORT),[perPage,setPerPage]=useState(25),[page,setPage]=useState(1),[stamp,setStamp]=useState(()=>new Date());
 const deferredSearch=useDeferredValue(search),busy=deferredSearch!==search;
 const organisation=getCurrentOrganizationContext().company;
 /* The organisation's branch list is passed in only so a stored branch value resolves to its NAME;
    the Branch CONTROL is offered from the rows themselves, because an expense recorded outside a
    branch context carries no branch and the control would then only ever empty the table. */
 const branches=useMemo(()=>getAccessibleOrganizations().find(item=>item.id===organisation.id)?.branches||[],[organisation.id]);

 const refresh=()=>setRevision(value=>value+1);
 useEffect(()=>{window.addEventListener('wayvida-accounts-updated',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('wayvida-accounts-updated',refresh);window.removeEventListener('storage',refresh)}},[]);

 /* The accounting book supplies the expense account and payment account names; the operations store
    supplies the expenses themselves. Both are read on one revision so the page states them
    consistently, and a missing accounting store is not an error - the account CODE is still printed. */
 const {book,operations,error}=useMemo(()=>{try{return {book:readAccounts(),operations:readOperations(),error:''}}catch(reason){return {book:null,operations:{expenses:[]},error:reason.message}}},[revision]);

 const report=useMemo(()=>{
  try{return expenseReport(book||{},operations||{},{...filters,search:deferredSearch,branches,organisation:organisation.id,organisationCode:organisation.code})}
  catch{return expenseReport({},{expenses:[]},{...filters,search:deferredSearch,branches,organisation:organisation.id,organisationCode:organisation.code})}
 },[book,operations,filters,deferredSearch,branches,organisation.id,organisation.code]);

 const ordered=useMemo(()=>sortTransactions(report.rows,sort),[report.rows,sort]);
 const pageCount=Math.max(1,Math.ceil(ordered.length/perPage)),pageIndex=Math.min(page,pageCount);
 const startIndex=(pageIndex-1)*perPage,firstRow=ordered.length?startIndex+1:0,lastRow=Math.min(startIndex+perPage,ordered.length);
 useEffect(()=>{setPage(1)},[deferredSearch,filters,sort,perPage]);

 const set=(key,value)=>setFilters(current=>({...current,[key]:value}));
 const clear=()=>{setFilters(blankFilters());setSearch('');setSort(DEFAULT_SORT);setPage(1)};
 const sortLabel=(SORT_OPTIONS.find(option=>option.value===sort)||{}).label||'Newest first';
 const activeFilters=['from','to'].filter(key=>filters[key]).length+['party','account','category','payment'].filter(key=>filters[key]!==ALL).length+(filters.status!==POSTED?1:0)+(filters.branch!==ALL?1:0)+(sort!==DEFAULT_SORT?1:0);
 const failed=report.checks.filter(check=>!check.ok);

 /* What the money went through and what rate each expense recorded - both read from the rows the
    page is showing, so the cards and the note describe exactly the table underneath them. */
 const paidFromBank=useMemo(()=>report.rows.reduce((total,row)=>total+(row.paymentAccountName==='Bank'?row.amount:0),0),[report.rows]);
 const taxRates=useMemo(()=>[...new Set(report.rows.map(row=>row.tax).filter(Boolean))].sort(),[report.rows]);

 function remember(key,value){try{sessionStorage.setItem(key,value)}catch{}}
 function openDocument(entry){if(entry.handshake)remember(entry.handshake,entry.recordId);if(entry.page)onNavigate(entry.page)}
 function rowActions(entry){return [{key:'view',label:'View Expense',icon:IconEye,run:()=>openDocument(entry)}]}
 function print(){setStamp(new Date());setTimeout(()=>window.print(),50)}

 function printMeta(){return [
  ['Organisation',organisation.name],
  ['Branch',filters.branch===ALL?'All branches':filters.branch],
  ['Date range',(filters.from||'Beginning')+' to '+(filters.to||'Latest')],
  ['Expense Status',filters.status===ALL?'All statuses':filters.status],
  ['Expense Account',filters.account===ALL?'All expense accounts':filters.account],
  ['Category',filters.category===ALL?'All categories':filters.category],
  ['Payee',filters.party===ALL?'All payees':filters.party],
  ['Payment Account',filters.payment===ALL?'All payment accounts':filters.payment],
  ['Search',search||'None'],
  ['Sorted by',sortLabel],
  ['Expenses',String(report.rows.length)],
  ['Tax','Recorded as a rate label, not a separate amount'],
  ['Generated by Local user',stamp.toLocaleString()]
 ]}

 function exportExcel(){
  const sheet=expenseExportSheet(report);
  const content=excelReport(tableExport(sheet.header,sheet.rows,{
   title:'Wayvida Books · Expense Report',subtitle:'View business expenses by date, account and payee.',
   organisation:organisation.name,branch:filters.branch,from:filters.from,to:filters.to,
   filters:{'Expense Status':filters.status,'Expense Account':filters.account,Category:filters.category,Payee:filters.party,'Payment Account':filters.payment,Branch:filters.branch,Search:search,Sort:sort===DEFAULT_SORT?'':sortLabel},
   count:report.rows.length,generatedBy:'Local user',generatedAt:stamp.toISOString()
  }));
  downloadReport(content,'wayvida-expense-report.xml','application/xml;charset=utf-8');
 }

 const statusText=filters.status===ALL?'all statuses':filters.status.toLowerCase()+' expenses';

 return <section className="brPage brExpense" aria-busy={busy}>
  <header className="brHead">
   <div className="brHeadText"><h1>Expense Report</h1><p>View business expenses by date, account and payee.</p></div>
   <div className="brHeadActions">
    <label className="brSearch"><IconSearch size={17}/><input aria-label="Search expenses" placeholder="Search expense, payee or reference" value={search} onChange={event=>setSearch(event.target.value)}/></label>
    <DateRangeSelect from={filters.from} to={filters.to} onChange={(start,end)=>{set('from',start);set('to',end)}} onCustom={()=>setFiltersOpen(true)}/>
    <details className="brFiltersMore" open={filtersOpen} onToggle={event=>setFiltersOpen(event.currentTarget.open)}>
     <summary aria-label="Open filters"><IconAdjustments size={17}/>Filters{activeFilters>0&&<span>{activeFilters}</span>}</summary>
     <div className="brFilters">
      <label>Date From<input type="date" aria-label="Date From" value={filters.from} onChange={event=>set('from',event.target.value)}/></label>
      <label>Date To<input type="date" aria-label="Date To" value={filters.to} onChange={event=>set('to',event.target.value)}/></label>
      <label>Expense Account<select aria-label="Expense Account" value={filters.account} onChange={event=>set('account',event.target.value)}><option value={ALL}>All expense accounts</option>{report.accountOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Category<select aria-label="Category" value={filters.category} onChange={event=>set('category',event.target.value)}><option value={ALL}>All categories</option>{report.categoryOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Payee<select aria-label="Payee" value={filters.party} onChange={event=>set('party',event.target.value)}><option value={ALL}>All payees</option>{report.partyOptions.map(option=><option key={option.name} value={option.name}>{option.name}</option>)}</select></label>
      {report.branchOptions.length>0&&<label>Branch<select aria-label="Branch" value={filters.branch} onChange={event=>set('branch',event.target.value)}><option value={ALL}>All branches</option>{report.branchOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>}
      <label>Payment Account<select aria-label="Payment Account" value={filters.payment} onChange={event=>set('payment',event.target.value)}><option value={ALL}>All payment accounts</option>{report.paymentOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Status<select aria-label="Status" value={filters.status} onChange={event=>set('status',event.target.value)}><option value={ALL}>All statuses</option>{report.statusOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Sort<select aria-label="Sort expenses" value={sort} onChange={event=>setSort(event.target.value)}>{SORT_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <div className="brFilterActions"><button type="button" onClick={()=>{refresh();setStamp(new Date())}}><IconRefresh size={15}/>Refresh</button><button type="button" onClick={clear}>Clear filters</button></div>
     </div>
    </details>
    <ReportExportMenu items={[{key:'excel',label:'Export Excel',icon:<IconFileSpreadsheet size={17}/>,onClick:exportExcel,disabled:!report.rows.length},{key:'pdf',label:'Export PDF',icon:<IconFileTypePdf size={17}/>,onClick:print,disabled:!report.rows.length}]}/>
   </div>
  </header>
  {error&&<div className="brError" role="alert"><IconAlertTriangle size={18}/><span>Unable to load expenses. {error}</span><button type="button" onClick={refresh}>Retry</button></div>}
  <div className="brPrintMeta"><h2>Expense Report</h2>{printMeta().map(([label,value])=><p key={label}><b>{label}:</b> {value}</p>)}</div>
  <div className="brSummary">
   <div><span>Total Expenses</span><strong>{money(report.totals.total)}</strong></div>
   <div><span>Tax</span><strong className="brWord" title="An expense records a tax rate label and a single amount, not a separate tax figure.">Recorded as a rate</strong></div>
   <div><span>Number of Expenses</span><strong>{report.totals.count}</strong></div>
   <div><span>Paid from Bank</span><strong>{money(paidFromBank)}</strong></div>
  </div>
  <p className="brNote">Tax is recorded on each expense as a rate label, not as a separate amount, so no tax total is stated here. Rates in this view: {taxRates.length?taxRates.join(' · '):DASH}.</p>
  <div className="brRegisterCard"><div className="brTableScroll"><table>
   <caption className="brCaption">Showing {report.rows.length} of {report.poolSize} expenses · {statusText}{busy?' · filtering':''}</caption>
   <thead><tr><th className="brDateCol">Date</th><th className="brNumberCol">Expense No.</th><th className="brAccountCol">Expense Account</th><th className="brPartyCol">Payee</th><th className="brCategoryCol">Category</th><th className="brMoneyCol brMoney">Amount</th><th className="brMetaCol brTaxCol brMoney">Tax</th><th className="brMoneyCol brMoney">Total</th><th className="brStatusCol">Status</th><th className="brActionsCol">Actions</th></tr></thead>
   <tbody>
   {ordered.map((entry,index)=><tr key={entry.id} className={index>=startIndex&&index<startIndex+perPage?'':'brOffPage'} title={[entry.number,entry.name,entry.party].filter(Boolean).join(' · ')}>
    <td className="brDateCol">{dateText(entry.date)}</td>
    <td className="brNumberCol"><button type="button" className="brLink" title={'Open expense '+entry.number} onClick={()=>openDocument(entry)}>{entry.number}</button></td>
    <td className="brAccountCol">{entry.expenseAccountName}</td>
    <td className="brPartyCol" title={entry.party}>{entry.party}</td>
    <td className="brCategoryCol">{entry.category||DASH}</td>
    <td className="brMoneyCol brMoney">{money(entry.amount)}</td>
    <td className="brMetaCol brTaxCol brMoney">{entry.taxLabel}</td>
    <td className="brMoneyCol brMoney">{money(entry.total)}</td>
    <td className="brStatusCol"><StatusPill status={entry.status} tone={STATUS_TONES[entry.status]||'neutral'}/></td>
    <td className="brActionsCol"><OutstandingActions label={'Actions for expense '+entry.number} items={rowActions(entry)}/></td>
   </tr>)}
   {!report.rows.length&&<tr className="emptyStateRow"><td colSpan="10" className="emptyStateCell"><EmptyState variant="budget" title={report.hasRows?'No transactions match your filters.':'No expense transactions found.'} description={report.hasRows?'Try a wider date range, or clear the filters to see every expense in this scope.':'Expenses will appear here once they are posted. Draft expenses are never counted in an expense total.'} actionLabel={report.hasRows?'Clear filters':undefined} onAction={report.hasRows?clear:undefined}/></td></tr>}
   </tbody>
   {report.rows.length>0&&<tfoot><tr className="brGrandTotal">
    <th className="brDateCol brLabel" colSpan={5} scope="row">Total</th>
    <th className="brMoneyCol brMoney">{money(report.totals.total)}</th>
    <th className="brMetaCol brTaxCol"></th>
    <th className="brMoneyCol brMoney">{money(report.totals.total)}</th>
    <th className="brStatusCol">{report.totals.count}</th>
    <th className="brActionsCol"></th>
   </tr></tfoot>}
  </table></div>
  {ordered.length>0&&<div className="pagination-footer brPager">
   <span className="pagination-left">Showing {firstRow}&ndash;{lastRow} of {ordered.length} expenses</span>
   <div className="pagination-right">
    <label className="brPerPage"><select aria-label="Expenses per page" value={perPage} onChange={event=>setPerPage(Number(event.target.value))}>{[25,50,100].map(size=><option key={size} value={size}>{size} per page</option>)}</select></label>
    <div className="pagination-nav"><button type="button" aria-label="Previous page" disabled={pageIndex<=1} onClick={()=>setPage(pageIndex-1)}>&lsaquo;</button><span>Page {pageIndex} of {pageCount}</span><button type="button" aria-label="Next page" disabled={pageIndex>=pageCount} onClick={()=>setPage(pageIndex+1)}>&rsaquo;</button></div>
   </div>
  </div>}
  </div>
  <div className={'brEquation brStickyBalance '+(failed.length?'mismatch':'balanced')} role="status">
   {failed.length?<IconAlertTriangle size={19}/>:<IconCheck size={19}/>}
   <b>{failed.length?'Expense Report needs review':'Expenses agree with the transactions listed'}</b>
   <span>{failed.length?failed.map(check=>check.label).join(' · '):report.totals.count+' expenses · '+money(report.totals.total)}</span>
  </div>
 </section>;
}
