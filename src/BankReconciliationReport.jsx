import {useDeferredValue,useEffect,useMemo,useState} from 'react';
import {IconAdjustments,IconAlertTriangle,IconCheck,IconEye,IconFileSpreadsheet,IconFileTypePdf,IconRefresh,IconSearch,IconUpload} from '@tabler/icons-react';
import {readAccounts} from './account-store.js';
import {readBanking} from './banking-service.js';
import {ALL,DASH,bankReconciliation,bankReconciliationExportRows,financialYearStart} from './cash-banking.js';
import {downloadReport,excelReport} from './daybook-export.js';
import {money,today} from './invoice-engine.js';
import {demoOrganizations} from './demo-organisations.js';
import EmptyState from './EmptyState.jsx';
import OutstandingActions from './OutstandingActions.jsx';
import StatusPill from './StatusPill.jsx';
import './cash-banking.css';
import {DateRangeSelect,ReportExportMenu} from './ReportToolbar.jsx';

/* The same chart fallback the other statements carry, so an empty browser store still renders a
   readable report instead of a broken table. */
const reportSeed={Assets:[['1000','Cash'],['1010','Bank']]};
const dateText=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):DASH;

/* The three reconciliation words a row can carry, each on the shared status pill. The word is always
   printed beside the tone, so a status is readable without relying on its colour. */
const STATUS_TONES={Reconciled:'ok',Unreconciled:'warn',Excluded:'neutral'};
const FILTER_STATUSES=['Reconciled','Unreconciled','Excluded'];

const blankFilters=()=>({bankAccount:'',from:financialYearStart(),to:today(),status:ALL,branch:ALL,reference:''});

/* The Bank Reconciliation report answers one question: do the transactions in Wayvida match the
   transactions shown by the bank. It is a control report. Reconciling a statement line records a
   match; it never creates revenue or expense and never moves a ledger balance, so the accounting
   records this report reads are the same records the rest of Wayvida Books posts.

   The projection itself lives in src/cash-banking.js and reuses the Banking module own book
   transactions, imported statement lines, matches and reconciliation summary. This file owns the
   shell: the heading with its search, Filters disclosure, the statement-import handoff and the
   exports, the five summary cards, the paged register, the reconciliation strip, the empty and error
   states, and the handoffs that open the existing workflows rather than a second copy of them. */
export default function BankReconciliationReport({onNavigate=()=>{}}){
 const [revision,setRevision]=useState(0),[filters,setFilters]=useState(blankFilters),[search,setSearch]=useState(''),[filtersOpen,setFiltersOpen]=useState(false),[perPage,setPerPage]=useState(25),[page,setPage]=useState(1),[stamp,setStamp]=useState(()=>new Date());
 const deferredSearch=useDeferredValue(search),busy=deferredSearch!==search;
 const organization=demoOrganizations.find(x=>x.id===localStorage.getItem('wayvida-demo-company'))||demoOrganizations[0];

 const refresh=()=>setRevision(value=>value+1);
 useEffect(()=>{window.addEventListener('wayvida-accounts-updated',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('wayvida-accounts-updated',refresh);window.removeEventListener('storage',refresh)}},[]);

 const {book,banking,error}=useMemo(()=>{try{return {book:readAccounts(reportSeed),banking:readBanking(),error:''}}catch(reason){return {book:null,banking:null,error:reason.message}}},[revision]);
 const report=useMemo(()=>{
  try{return bankReconciliation(book||{},banking||{}, {...filters,search:deferredSearch})}
  catch{return bankReconciliation({},{}, {...filters,search:deferredSearch})}
 },[book,banking,filters,deferredSearch]);

 const pageCount=Math.max(1,Math.ceil(report.rows.length/perPage)),pageIndex=Math.min(page,pageCount);
 const startIndex=(pageIndex-1)*perPage,firstRow=report.rows.length?startIndex+1:0,lastRow=Math.min(startIndex+perPage,report.rows.length);
 useEffect(()=>{setPage(1)},[deferredSearch,filters,perPage]);

 const set=(key,value)=>setFilters(current=>({...current,[key]:value}));
 const clear=()=>{setFilters(blankFilters());setSearch('');setPage(1)};
 const activeFilters=(filters.bankAccount!==''?1:0)+(filters.from!==financialYearStart()?1:0)+(filters.to!==today()?1:0)+(filters.status!==ALL?1:0)+(filters.branch!==ALL?1:0)+(filters.reference!==''?1:0);
 const failed=report.checks.filter(check=>!check.ok);
 const bankLabel=report.bank?(report.bank.bankName||'')+' \u00b7 '+report.bank.accountName:'No bank account selected';
 const totals={book:report.rows.reduce((total,row)=>total+(row.bookAmount||0),0),bank:report.rows.reduce((total,row)=>total+(row.bankAmount||0),0),difference:report.rows.reduce((total,row)=>total+(row.difference||0),0)};

 /* Both handoffs open the workflow that owns the record. The import, the match, the unmatch and the
    categorisation all live in the Banking workspace this report opens; the ledger handoff is the same
    `wayvida-open-account` key the Profit & Loss, the Balance Sheet and the Cash Flow Statement use. */
 function openWorkspace(){try{sessionStorage.setItem('wayvida-open-bank',report.bank?.id||'')}catch{}onNavigate('Bank Reconciliation')}
 function openLedger(row){try{sessionStorage.setItem('wayvida-open-account',row.accountCode)}catch{}onNavigate('General Ledger')}
 function print(){setStamp(new Date());setTimeout(()=>window.print(),50)}

 function printMeta(){return [
  ['Organisation',organization.name],
  ['Branch',filters.branch===ALL?'All branches':filters.branch],
  ['Bank account',bankLabel],
  ['Statement period',(filters.from||'Beginning')+' to '+(filters.to||'Latest')],
  ['Reconciliation status',filters.status===ALL?'All':filters.status],
  ['Reference',filters.reference||'None'],
  ['Search',search||'None'],
  ['Book balance',money(report.bookBalance)],
  ['Bank statement balance',report.statementAvailable?money(report.bankBalance):'Not available'],
  ['Reconciled amount',money(report.reconciledAmount)],
  ['Unreconciled amount',money(report.unreconciledAmount)],
  ['Difference',report.statementAvailable?money(report.difference):'Not available'],
  ['Transactions',String(report.rows.length)],
  ['Generated by Local user',stamp.toLocaleString()]
 ]}

 function exportExcel(){
  downloadReport(excelReport(bankReconciliationExportRows(report,{organisation:organization.name,branch:filters.branch===ALL?'All branches':filters.branch,generatedBy:'Local user',generatedAt:stamp.toISOString()})),'wayvida-bank-reconciliation.xml','application/xml;charset=utf-8');
 }

 /* A match is only ever created in the Banking workspace, so every action here opens that workspace
    for the selected account, or the ledger the book line was posted in. No second match control and
    no second transaction page exists on this report. */
 function rowActions(row){
  const items=[];
  if(row.statementId)items.push({key:'statement',label:row.status==='Unreconciled'?'Match':'View Statement Line',icon:IconEye,run:openWorkspace});
  if(row.bookTransactionId)items.push({key:'transaction',label:'View Transaction',icon:IconCheck,run:()=>openLedger(row)});
  return items;
 }

 const emptyTitle=!report.bank?'No bank reconciliation data found.':!report.statementAvailable?'No bank statement has been imported for this account and period.':'No bank reconciliation data found.';
 const emptyDescription=!report.bank
  ?'Link a bank account to a cash-and-bank ledger and import its statement, and the reconciliation will be reported here.'
  :report.rows.length?'Clear the filters to see every statement line and book transaction in this period.'
  :!report.statementAvailable?'Import this account statement from the Banking workspace, then match its lines against the posted bank ledger.'
  :'Clear the filters to see every statement line and book transaction in this period.';
 const emptyAction=!report.bank?{label:'Open Banking',run:()=>onNavigate('Bank Accounts')}:!report.statementAvailable?{label:'Import Statement',run:openWorkspace}:{label:'Clear Filters',run:clear};

 const cell=(row,index)=><tr key={row.id} className={index>=startIndex&&index<startIndex+perPage?'':'cbOffPage'} title={[row.date,row.description,row.reference].filter(Boolean).join(' \u00b7 ')}>
  <td className="cbDateCol">{dateText(row.date)}</td>
  <td className="cbDescCol" title={row.description}>{row.description||DASH}</td>
  <td className="cbRefCol">{row.reference||DASH}</td>
  <td className="cbBookCol cbMoney">{row.bookAmount==null?DASH:money(row.bookAmount)}</td>
  <td className="cbBankCol cbMoney">{row.bankAmount==null?DASH:money(row.bankAmount)}</td>
  <td className="cbDiffCol cbMoney">{row.difference==null?DASH:money(row.difference)}</td>
  <td className="cbStatusCol"><StatusPill status={row.status} tone={STATUS_TONES[row.status]||'neutral'}/></td>
  <td className="cbActionsCol"><OutstandingActions label={'Actions for '+row.date+' '+(row.reference||'')} items={rowActions(row)}/></td>
 </tr>;

 return <section className="cbPage cbRecon" aria-busy={busy}>
  <header className="cbHead">
   <div className="cbHeadText"><h1>Bank Reconciliation</h1><p>Compare your bank records with your accounting records.</p></div>
   <div className="cbHeadActions">
    <label className="cbSearch"><IconSearch size={17}/><input aria-label="Search bank reconciliation" placeholder="Search transaction, reference or account" value={search} onChange={event=>setSearch(event.target.value)}/></label>
    <DateRangeSelect from={filters.from} to={filters.to} onChange={(start,end)=>{set('from',start);set('to',end)}} onCustom={()=>setFiltersOpen(true)}/>
    <details className="cbFiltersMore" open={filtersOpen} onToggle={event=>setFiltersOpen(event.currentTarget.open)}>
     <summary aria-label="Open filters"><IconAdjustments size={17}/>Filters{activeFilters>0&&<span>{activeFilters}</span>}</summary>
     <div className="cbFilters">
      <label>Bank Account<select aria-label="Bank Account" value={report.bank?.id||''} onChange={event=>set('bankAccount',event.target.value)}>{report.selectable.map(item=><option key={item.id} value={item.id}>{item.accountName}{' \u00b7 '}{item.bankName}</option>)}</select></label>
      <label>Branch<select aria-label="Branch" value={filters.branch} onChange={event=>set('branch',event.target.value)}><option value={ALL}>All branches</option>{report.branchOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Statement Date From<input type="date" aria-label="Statement Date From" value={filters.from} onChange={event=>set('from',event.target.value)}/></label>
      <label>Statement Date To<input type="date" aria-label="Statement Date To" value={filters.to} onChange={event=>set('to',event.target.value)}/></label>
      <label>Reconciliation Status<select aria-label="Reconciliation Status" value={filters.status} onChange={event=>set('status',event.target.value)}><option value={ALL}>All</option>{FILTER_STATUSES.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Reference<input type="search" aria-label="Reference" placeholder="Statement or book reference" value={filters.reference} onChange={event=>set('reference',event.target.value)}/></label>
      <div className="cbFilterActions"><button type="button" onClick={()=>{refresh();setStamp(new Date())}}><IconRefresh size={15}/>Refresh</button><button type="button" onClick={clear}>Clear Filters</button></div>
     </div>
    </details>
    <button type="button" onClick={openWorkspace}><IconUpload size={17}/>Import Statement</button>
    <ReportExportMenu items={[{key:'excel',label:'Export Excel',icon:<IconFileSpreadsheet size={17}/>,onClick:exportExcel,disabled:!report.rows.length},{key:'pdf',label:'Export PDF',icon:<IconFileTypePdf size={17}/>,onClick:print,disabled:!report.rows.length}]}/>
   </div>
  </header>
  {error&&<div className="cbError" role="alert"><IconAlertTriangle size={18}/><span>Unable to load the bank reconciliation. {error}</span><button type="button" onClick={refresh}>Retry</button></div>}
  <div className="cbPrintMeta"><h2>Bank Reconciliation</h2>{printMeta().map(([label,value])=><p key={label}><b>{label}:</b> {value}</p>)}</div>
  <div className="cbReconSummary">
   <div><span>Book Balance</span><strong>{money(report.bookBalance)}</strong></div>
   <div><span>Bank Statement Balance</span><strong className={report.statementAvailable?'':'cbWord'}>{report.statementAvailable?money(report.bankBalance):'Not available'}</strong></div>
   <div className="cbInflow"><span>Reconciled Amount</span><strong>{money(report.reconciledAmount)}</strong></div>
   <div className="cbOutflow"><span>Unreconciled Amount</span><strong>{money(report.unreconciledAmount)}</strong></div>
   <div className="cbClosing"><span>Difference</span><strong className={report.statementAvailable?'':'cbWord'}>{report.statementAvailable?money(report.difference):'Not available'}</strong></div>
  </div>
  <div className="cbCard"><div className="cbTableScroll"><table>
   <caption className="cbCaption">{bankLabel}{' \u00b7 '}showing {report.rows.length} of {report.poolSize} transactions{(filters.from||filters.to)?' \u00b7 '+(filters.from||'Beginning')+' to '+(filters.to||'Latest'):''}{report.statementAvailable?'':' \u00b7 no statement imported'}{busy?' \u00b7 filtering':''}</caption>
   <thead><tr><th className="cbDateCol">Date</th><th className="cbDescCol">Description</th><th className="cbRefCol">Reference</th><th className="cbBookCol cbMoney">Book Amount</th><th className="cbBankCol cbMoney">Bank Amount</th><th className="cbDiffCol cbMoney">Difference</th><th className="cbStatusCol">Status</th><th className="cbActionsCol">Actions</th></tr></thead>
   <tbody>
   {report.rows.map(cell)}
   {!report.rows.length&&<tr className="emptyStateRow"><td colSpan="8" className="emptyStateCell"><EmptyState variant="journal" title={emptyTitle} description={emptyDescription} actionLabel={emptyAction.label} onAction={emptyAction.run}/></td></tr>}
   </tbody>
   {report.rows.length>0&&<tfoot><tr className="cbGrandTotal">
    <th className="cbLabel" colSpan="3" scope="row">{report.rows.length} transactions</th>
    <th className="cbMoney">{money(totals.book)}</th>
    <th className="cbMoney">{money(totals.bank)}</th>
    <th className="cbMoney">{money(totals.difference)}</th>
    <th className="cbStatusCol"></th>
    <th className="cbActionsCol"></th>
   </tr></tfoot>}
  </table></div>
  {report.rows.length>0&&<div className="pagination-footer cbPager">
   <span className="pagination-left">Showing {firstRow}&ndash;{lastRow} of {report.rows.length} transactions</span>
   <div className="pagination-right">
    <label className="cbPerPage"><select aria-label="Transactions per page" value={perPage} onChange={event=>setPerPage(Number(event.target.value))}>{[25,50,100].map(size=><option key={size} value={size}>{size} per page</option>)}</select></label>
    <div className="pagination-nav"><button type="button" aria-label="Previous page" disabled={pageIndex<=1} onClick={()=>setPage(pageIndex-1)}>&lsaquo;</button><span>Page {pageIndex} of {pageCount}</span><button type="button" aria-label="Next page" disabled={pageIndex>=pageCount} onClick={()=>setPage(pageIndex+1)}>&rsaquo;</button></div>
   </div>
  </div>}
  </div>
  <div className={'cbEquation cbStickyBalance '+(failed.length?'mismatch':report.statementAvailable&&report.difference===0?'balanced':'unknown')} role="status">
   {failed.length?<IconAlertTriangle size={19}/>:<IconCheck size={19}/>}
   <b>{failed.length?'Bank reconciliation needs review':!report.statementAvailable?'No bank statement has been imported for this period':report.difference===0?'Bank reconciliation agrees':'Bank reconciliation has a difference'}</b>
   <span>{failed.length?failed.map(check=>check.label||check.key).join(' \u00b7 '):(report.statementAvailable?'Book balance '+money(report.bookBalance)+' \u00b7 statement balance '+money(report.bankBalance)+(report.difference!==0?' \u00b7 out by '+money(report.difference):''):'Book balance '+money(report.bookBalance)+' \u00b7 import a statement to compare it')}</span>
  </div>
  <div className="cbNote">
   <ul>
    <li>Matching a statement line to a book line records the match only. It never posts, never changes a ledger balance, and never changes customer outstanding, supplier outstanding, GST or TDS.</li>
    <li>A match is created, changed or removed in the Banking workspace this report opens. This report never changes one, so a row is reconciled because the reconciliation module says so, never because a date and an amount happen to agree.</li>
    <li>Book Amount and Bank Amount are stated with the direction of the movement: a receipt or deposit is positive, a payment or withdrawal negative. Where a transaction exists in only one of the two records the other side is left blank rather than shown as zero.</li>
    <li>Book Balance is the posted bank ledger balance. Bank Statement Balance, Reconciled Amount, Unreconciled Amount and Difference come from the Banking module own imported statement and matches for the same period; a period with no imported statement says so instead of stating a balance.</li>
    <li>Only the bank accounts linked to a cash-and-bank ledger are offered, so an ordinary expense or revenue account can never be reconciled here.</li>
   </ul>
  </div>
 </section>;
}
