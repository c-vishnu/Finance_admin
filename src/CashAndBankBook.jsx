import {useDeferredValue,useEffect,useMemo,useState} from 'react';
import {IconAdjustments,IconAlertTriangle,IconCheck,IconFileSpreadsheet,IconFileTypePdf,IconRefresh,IconSearch} from '@tabler/icons-react';
import {readAccounts} from './account-store.js';
import {readBanking} from './banking-service.js';
import {ALL,DASH,cashBankBook,cashBankBookExportRows,financialYearStart} from './cash-banking.js';
import {downloadReport,excelReport} from './daybook-export.js';
import {money,today} from './invoice-engine.js';
import {demoOrganizations} from './demo-organisations.js';
import EmptyState from './EmptyState.jsx';
import StatusPill from './StatusPill.jsx';
import './cash-banking.css';
import {DateRangeSelect,ReportExportMenu} from './ReportToolbar.jsx';

/* The same chart fallback the other statements carry, so an empty browser store still renders a
   readable report instead of a broken table. Real balances only ever come from the posted journal:
   the report reads the cash and bank accounts the Chart of Accounts already classifies. */
const reportSeed={Assets:[['1000','Cash'],['1010','Bank']]};

/* The one date formatter every Wayvida register shares, so a date reads here exactly as it reads in
   the Transaction Register, the Day Book and the Business Reports. The projection keeps its dates in
   the comparable ISO form - the filters compare strings with it - and only this page renders them. */
const dateText=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):DASH;

/* The four reconciliation words a book row can carry, each on the shared status pill. The word is
   always printed beside the tone, so a status is readable without relying on its colour. */
const STATUS_TONES={Reconciled:'ok',Unreconciled:'warn',Excluded:'neutral',Posted:'info'};

const blankFilters=()=>({from:financialYearStart(),to:today(),account:ALL,branch:ALL,type:ALL,status:ALL});

/* The Cash & Bank Book answers one question: what money moved through my cash and financial accounts.
   It is a transaction-level book, not a statement: one row per posted journal line, with the running
   balance the ledger itself carries. The Cash Flow Statement classifies the same movements into
   operating, investing and financing activity; the account and the balances then belong to the
   ledger, and this report never re-derives either.

   The projection itself lives in src/cash-banking.js, so what this file owns is the shell every other
   report uses: the heading with its search, Filters disclosure and exports, the four summary cards,
   the account-balance block, the paged register, the reconciliation strip, the empty and error
   states, and the handoff that opens an account where it already lives. */
export default function CashAndBankBook({onNavigate=()=>{}}){
 const [revision,setRevision]=useState(0),[filters,setFilters]=useState(blankFilters),[search,setSearch]=useState(''),[filtersOpen,setFiltersOpen]=useState(false),[perPage,setPerPage]=useState(25),[page,setPage]=useState(1),[stamp,setStamp]=useState(()=>new Date());
 const deferredSearch=useDeferredValue(search),busy=deferredSearch!==search;
 const organization=demoOrganizations.find(x=>x.id===localStorage.getItem('wayvida-demo-company'))||demoOrganizations[0];

 const refresh=()=>setRevision(value=>value+1);
 useEffect(()=>{window.addEventListener('wayvida-accounts-updated',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('wayvida-accounts-updated',refresh);window.removeEventListener('storage',refresh)}},[]);

 /* The ledger and the banking records, read together on one revision so a match and a balance can
    never be stated from two different reads. */
 const {book,banking,error}=useMemo(()=>{try{return {book:readAccounts(reportSeed),banking:readBanking(),error:''}}catch(reason){return {book:null,banking:null,error:reason.message}}},[revision]);
 const report=useMemo(()=>{
  try{return cashBankBook(book||{},banking||{}, {...filters,search:deferredSearch})}
  catch{return cashBankBook({}, {}, {...filters,search:deferredSearch})}
 },[book,banking,filters,deferredSearch]);

 /* The register shows one comfortable page of rows rather than one very long table. The rows arrive
    oldest first, because that is the only order a running balance reads in. */
 const pageCount=Math.max(1,Math.ceil(report.rows.length/perPage)),pageIndex=Math.min(page,pageCount);
 const startIndex=(pageIndex-1)*perPage,firstRow=report.rows.length?startIndex+1:0,lastRow=Math.min(startIndex+perPage,report.rows.length);
 useEffect(()=>{setPage(1)},[deferredSearch,filters,perPage]);

 const set=(key,value)=>setFilters(current=>({...current,[key]:value}));
 const clear=()=>{setFilters(blankFilters());setSearch('');setPage(1)};
 const activeFilters=(filters.from!==financialYearStart()?1:0)+(filters.to!==today()?1:0)+(filters.account!==ALL?1:0)+(filters.branch!==ALL?1:0)+(filters.type!==ALL?1:0)+(filters.status!==ALL?1:0);
 const failed=report.checks.filter(check=>!check.ok);
 const accountLabel=value=>{const found=(report.accountOptions||[]).find(item=>String(item.code)===String(value));return found?value+' \u00b7 '+found.name:value};

 function openLedger(entry){try{sessionStorage.setItem('wayvida-open-account',entry.accountCode)}catch{}onNavigate('General Ledger')}
 function print(){setStamp(new Date());setTimeout(()=>window.print(),50)}

 function printMeta(){return [
  ['Organisation',organization.name],
  ['Branch',filters.branch===ALL?'All branches':filters.branch],
  ['Account',filters.account===ALL?'All cash and bank accounts':accountLabel(filters.account)],
  ['Date range',(filters.from||'Beginning')+' to '+(filters.to||'Latest')],
  ['Transaction type',filters.type===ALL?'All types':filters.type],
  ['Reconciliation status',filters.status===ALL?'All statuses':filters.status],
  ['Search',search||'None'],
  ['Opening balance',money(report.opening)],
  ['Total receipts',money(report.receipts)],
  ['Total payments',money(report.payments)],
  ['Closing balance',money(report.closing)],
  ['Ledger closing balance',money(report.ledgerClosing)],
  ['Transactions',String(report.rows.length)],
  ['Generated by Local user',stamp.toLocaleString()]
 ]}

 function exportExcel(){
  downloadReport(excelReport(cashBankBookExportRows(report,{organisation:organization.name,branch:filters.branch===ALL?'All branches':filters.branch,generatedBy:'Local user',generatedAt:stamp.toISOString()})),'wayvida-cash-and-bank-book.xml','application/xml;charset=utf-8');
 }

 const cell=(row,index)=><tr key={row.id} className={index>=startIndex&&index<startIndex+perPage?'':'cbOffPage'} title={[row.date,row.accountName,row.type,row.reference,row.particulars].filter(Boolean).join(' \u00b7 ')}>
  <td className="cbDateTypeCol"><div className="cbDateVal">{dateText(row.date)}</div><div className="cbTypeVal">{row.type}{row.internal?<span className="cbInternalMark">Internal transfer</span>:null}</div></td>
  <td className="cbAccountCol"><button type="button" className="cbLink" title={'Open the ledger for '+row.accountName} onClick={()=>openLedger(row)}>{row.accountCode}{' \u00b7 '}{row.accountName}</button></td>
  <td className="cbRefCol">{row.reference||DASH}</td>
  <td className="cbDebitCol cbMoney">{row.debit?money(row.debit):DASH}</td>
  <td className="cbCreditCol cbMoney">{row.credit?money(row.credit):DASH}</td>
  <td className="cbBalanceCol cbMoney">{row.balance==null?DASH:money(row.balance)}</td>
  <td className="cbStatusCol"><StatusPill status={row.status} tone={STATUS_TONES[row.status]||'neutral'}/></td>
 </tr>;

 const accountRow=group=><tr key={group.code} className={String(report.selected?.code)===String(group.code)?'cbSelectedRow':undefined}>
  <td>{group.code}</td>
  <td>{group.name}</td>
  <td className="cbMoney">{money(group.opening)}</td>
  <td className="cbMoney">{money(group.receipts)}</td>
  <td className="cbMoney">{money(group.payments)}</td>
  <td className="cbMoney"><b>{money(group.closing)}</b></td>
 </tr>;

 return <section className="cbPage cbBook" aria-busy={busy}>
  <header className="cbHead">
   <div className="cbHeadText"><h1>Cash &amp; Bank Book</h1><p>View cash, bank and payment-account transactions and balances.</p></div>
   <div className="cbHeadActions">
    <DateRangeSelect from={filters.from} to={filters.to} onChange={(start,end)=>{set('from',start);set('to',end)}} onCustom={()=>setFiltersOpen(true)}/>
    <details className="cbFiltersMore" open={filtersOpen} onToggle={event=>setFiltersOpen(event.currentTarget.open)}>
     <summary aria-label="Open filters"><IconAdjustments size={17}/>Filters{activeFilters>0&&<span>{activeFilters}</span>}</summary>
     <div className="cbFilters">
      <label>Date From<input type="date" aria-label="Date From" value={filters.from} onChange={event=>set('from',event.target.value)}/></label>
      <label>Date To<input type="date" aria-label="Date To" value={filters.to} onChange={event=>set('to',event.target.value)}/></label>
      <label>Account<select aria-label="Account" value={filters.account} onChange={event=>set('account',event.target.value)}><option value={ALL}>All cash and bank accounts</option>{report.accountOptions.map(item=><option key={item.code} value={item.code}>{item.code}{' \u00b7 '}{item.name}</option>)}</select></label>
      <label>Branch<select aria-label="Branch" value={filters.branch} onChange={event=>set('branch',event.target.value)}><option value={ALL}>All branches</option>{report.branchOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Transaction Type<select aria-label="Transaction Type" value={filters.type} onChange={event=>set('type',event.target.value)}><option value={ALL}>All types</option>{report.typeOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Reconciliation Status<select aria-label="Reconciliation Status" value={filters.status} onChange={event=>set('status',event.target.value)}><option value={ALL}>All statuses</option>{report.statusOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <div className="cbFilterActions"><button type="button" onClick={()=>{refresh();setStamp(new Date())}}><IconRefresh size={15}/>Refresh</button><button type="button" onClick={clear}>Clear Filters</button></div>
     </div>
    </details>
    <ReportExportMenu items={[{key:'excel',label:'Export Excel',icon:<IconFileSpreadsheet size={17}/>,onClick:exportExcel,disabled:!report.rows.length},{key:'pdf',label:'Export PDF',icon:<IconFileTypePdf size={17}/>,onClick:print,disabled:!report.rows.length}]}/>
   </div>
  </header>
  {error&&<div className="cbError" role="alert"><IconAlertTriangle size={18}/><span>Unable to load the cash and bank book. {error}</span><button type="button" onClick={refresh}>Retry</button></div>}
  <div className="cbPrintMeta"><h2>Cash &amp; Bank Book</h2>{printMeta().map(([label,value])=><p key={label}><b>{label}:</b> {value}</p>)}</div>
  <div className="cbSummary">
   <div><span>Opening Balance</span><strong>{money(report.opening)}</strong></div>
   <div className="cbInflow"><span>Total Receipts</span><strong>{money(report.receipts)}</strong></div>
   <div className="cbOutflow"><span>Total Payments</span><strong>{money(report.payments)}</strong></div>
   <div className="cbClosing"><span>Closing Balance</span><strong>{money(report.closing)}</strong></div>
  </div>
  <div className="cbAccountsCard"><div className="cbTableScroll"><table>
   <caption className="cbCaption">{report.selected?'Balance for '+report.selected.code+' \u00b7 '+report.selected.name:'Account balances'} for {filters.from||'the beginning'} to {filters.to||'the latest entry'}{' \u00b7 '}{report.scope.length} accounts</caption>
   <thead><tr><th>ACCOUNT CODE</th><th>ACCOUNT</th><th className="cbMoney">OPENING</th><th className="cbMoney">RECEIPTS</th><th className="cbMoney">PAYMENTS</th><th className="cbMoney">CLOSING</th></tr></thead>
   <tbody>{report.groups.map(accountRow)}</tbody>
  </table></div></div>
  <div className="cbCard"><div className="cbTableScroll"><table>
   <caption className="cbCaption">Showing {report.rows.length} of {report.scoped.length} transactions{busy?' \u00b7 filtering':''}{report.selected?' \u00b7 running balance stated':' \u00b7 running balance stated per account above'}</caption>
   <thead><tr><th className="cbDateTypeCol">DATE &amp; TRANSACTION TYPE</th><th className="cbAccountCol">ACCOUNT</th><th className="cbRefCol">REFERENCE</th><th className="cbDebitCol cbMoney">DEBIT</th><th className="cbCreditCol cbMoney">CREDIT</th><th className="cbBalanceCol cbMoney">BALANCE</th><th className="cbStatusCol">STATUS</th></tr></thead>
   <tbody>
   {report.rows.map(cell)}
   {!report.rows.length&&<tr className="emptyStateRow"><td colSpan="7" className="emptyStateCell"><EmptyState variant="journal" title={report.hasRows?'No transactions match your filters.':'No cash or bank transactions found.'} description={report.hasRows?'Try a wider date range, or clear the filters to see every movement through these accounts.':'Cash, bank and payment-account movements will appear here once they are posted. Draft and cancelled documents never reach a journal, so they can never move a balance.'} actionLabel={report.hasRows?'Clear Filters':undefined} onAction={report.hasRows?clear:undefined}/></td></tr>}
   </tbody>
   {report.rows.length>0&&<tfoot><tr className="cbGrandTotal">
    <th className="cbLabel" colSpan="3" scope="row">{report.rows.length} transactions</th>
    <th className="cbMoney">{money(report.receipts)}</th>
    <th className="cbMoney">{money(report.payments)}</th>
    <th className="cbMoney">{money(report.closing)}</th>
    <th className="cbStatusCol"></th>
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
  <div className={'cbEquation cbStickyBalance '+(failed.length?'mismatch':report.difference===0?'balanced':'unknown')} role="status">
   {failed.length?<IconAlertTriangle size={19}/>:<IconCheck size={19}/>}
   <b>{failed.length?'Cash & Bank Book needs review':report.difference===0?'Cash & Bank Book agrees with the ledger':'Filters narrow the rows listed'}</b>
   <span>{failed.length?failed.map(check=>check.label||check.key).join(' \u00b7 '):'Opening balance '+money(report.opening)+' \u00b7 ledger closing balance '+money(report.ledgerClosing)+(report.difference!==0?' \u00b7 out by '+money(report.difference):'')}</span>
  </div>
  <div className="cbNote">
   {filters.account===ALL&&<p>Debit and credit amounts follow your accounting records.</p>}
   <ul>
    <li>Only posted entries are counted. A draft, cancelled or unposted document never reaches a journal, so it can never move a cash or bank balance.</li>
    <li>Opening Balance is the account balance immediately before the date range, not the sum of the rows inside it, and Closing Balance is the opening balance plus the movement of the rows listed.</li>
    <li>A transfer between two of your own cash or bank accounts is stated once on each account and marked as an internal transfer, so it affects neither the combined opening nor the combined closing balance.</li>
    <li>Balance states a running balance only when one account is selected. Across every account it is left blank, and each account\'s own opening and closing balance is stated in the table above instead.</li>
    <li>Reconciled, Unreconciled and Excluded come from the Banking module\'s own bank matches. A cash account has no statement to be checked against, so it stays Posted.</li>
   </ul>
  </div>
 </section>;
}
