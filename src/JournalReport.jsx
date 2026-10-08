import {useDeferredValue,useEffect,useMemo,useState} from 'react';
import {IconAdjustments,IconAlertTriangle,IconArrowDownLeft,IconArrowUpRight,IconBook,IconCheck,IconFileSpreadsheet,IconFileTypePdf,IconInfoCircle,IconRefresh,IconSearch} from '@tabler/icons-react';
import {readAccounts} from './account-store.js';
import {ALL,JOURNAL_STATUSES,journalReport,journalReportExportRows} from './journal-report.js';
import {downloadReport,excelReport} from './daybook-export.js';
import {financialYearStart} from './profit-loss.js';
import {money,today} from './invoice-engine.js';
import {demoOrganizations} from './demo-organisations.js';
import EmptyState from './EmptyState.jsx';
import './cash-banking.css';
import './report-pages.css';
import {DateRangeSelect,ReportExportMenu} from './ReportToolbar.jsx';

const reportSeed={Assets:[['1000','Cash']],Liabilities:[['2000','Accounts Payable']],Income:[['4000','Sales']],Expenses:[['5000','Purchases']]};
const DASH='\u2014';
const dateText=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):DASH;
const dateSlash=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}):DASH;

const blankFilters=()=>({from:financialYearStart(),to:today(),branch:ALL,type:ALL,status:ALL,account:ALL});

function renderAccountCell(accountStr) {
  if (!accountStr) return DASH;
  let code = '';
  let name = accountStr;
  if (accountStr.includes(' · ')) {
    const parts = accountStr.split(' · ');
    code = parts[0];
    name = parts.slice(1).join(' · ');
  }

  if (code && name) {
    return (
      <span title={`${code} · ${name}`} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '340px' }}>
        <span style={{ color: '#64748b', fontWeight: 400 }}>{code}</span>
        <span style={{ color: '#94a3b8', margin: '0 5px' }}>·</span>
        <span style={{ color: '#0f172a', fontWeight: 550 }}>{name}</span>
      </span>
    );
  }
  return <span title={accountStr} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '340px' }}>{accountStr}</span>;
}

function normalizeTypeLabel(rawType) {
  if (!rawType) return 'Journal';
  const str = String(rawType).trim();
  if (str === 'Purchase Invoice' || str === 'Bill' || str === 'Purchase') return 'Purchase Bill';
  return str;
}

export default function JournalReport({notify,onNavigate={}}){
 const [revision,setRevision]=useState(0);
 const [filters,setFilters]=useState(blankFilters);
 const [search,setSearch]=useState('');
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [stamp,setStamp]=useState(()=>new Date());
 const [page, setPage] = useState(1);
 const [pageSize, setPageSize] = useState(10);
 const [companyId, setCompanyId] = useState(() => localStorage.getItem('wayvida-demo-company') || demoOrganizations[0]?.id || '');

 const deferredSearch=useDeferredValue(search),busy=deferredSearch!==search;
 const organization=useMemo(() => demoOrganizations.find(item=>item.id===companyId) || demoOrganizations[0] || { name: 'Wayvida Learning' }, [companyId]);

 function handleCompanyChange(e) {
  const id = e.target.value;
  setCompanyId(id);
  localStorage.setItem('wayvida-demo-company', id);
  refresh();
 }

 const refresh=()=>setRevision(value=>value+1);
 useEffect(()=>{window.addEventListener('wayvida-accounts-updated',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('wayvida-accounts-updated',refresh);window.removeEventListener('storage',refresh)}},[]);

 const {book,error}=useMemo(()=>{try{return {book:readAccounts(reportSeed),error:''}}catch(reason){return {book:{accounts:[],journals:[]},error:reason.message}}},[revision]);
 const report=useMemo(()=>journalReport(book,{...filters,search:deferredSearch}),[book,filters,deferredSearch]);

 const set=(key,value)=>setFilters(current=>({...current,[key]:value}));
 const clear=()=>{setFilters(blankFilters());setSearch('')};
 const activeFilters=(filters.from!==financialYearStart()?1:0)+(filters.to!==today()?1:0)+(filters.branch!==ALL?1:0)+(filters.type!==ALL?1:0)+(filters.status!==ALL?1:0)+(filters.account!==ALL?1:0);
 const failed=report.checks.filter(check=>!check.ok);

 // Reset to page 1 when filters or search change
 useEffect(() => {
  setPage(1);
 }, [filters, deferredSearch]);

 // Group filtered rows by Journal Entry for clean visual presentation
 const journalGroups = useMemo(() => {
  const map = new Map();
  for (const row of report.rows) {
   if (!map.has(row.journalId)) {
    const v = report.journals.find(j => j.id === row.journalId) || {};
    map.set(row.journalId, {
     id: row.journalId,
     number: row.number || v.number || row.journalId,
     date: row.date,
     type: normalizeTypeLabel(row.type || v.type),
     status: row.status,
     reference: row.reference || v.reference || '',
     party: row.party || v.party || (v.narration && v.narration !== 'Journal Entry' ? v.narration : '') || '',
     lines: []
    });
   }
   map.get(row.journalId).lines.push(row);
  }
  return Array.from(map.values());
 }, [report.rows, report.journals]);

 const totalPages = Math.max(1, Math.ceil(journalGroups.length / pageSize));

 const paginatedGroups = useMemo(() => {
  const start = (page - 1) * pageSize;
  return journalGroups.slice(start, start + pageSize);
 }, [journalGroups, page, pageSize]);

 function handleOpenDocument(type, reference) {
  if (typeof onNavigate !== 'function') return;
  const t = normalizeTypeLabel(type);
  if (t === 'Sales Invoice' || t === 'Invoices') {
   if (reference) sessionStorage.setItem('wayvida-open-invoice', reference);
   onNavigate('Invoices');
  } else if (t === 'Purchase Bill') {
   onNavigate('Purchase Bills');
  } else if (t === 'Receipt') {
   if (reference) sessionStorage.setItem('wayvida-open-receipt', reference);
   onNavigate('Payments Received');
  } else if (t === 'Payment') {
   onNavigate('Payments Made');
  } else if (t === 'Credit Note') {
   if (reference) sessionStorage.setItem('wayvida-open-credit', reference);
   onNavigate('Credit Notes');
  } else {
   onNavigate('Journal Entries');
  }
 }

 function exportExcel(){
  const content=journalReportExportRows(report,{organisation:organization.name,generatedBy:'Local user',generatedAt:stamp.toISOString()});
  downloadReport(excelReport(content),'wayvida-journal-report.xml','application/xml;charset=utf-8');
 }
 function print(){setStamp(new Date());setTimeout(()=>window.print(),50)}
 function printMeta(){
  return [['Wayvida Books - Journal Report','Every posted journal line in the selected period.'],
   ['Organisation',organization.name],['Branch',filters.branch===ALL?'All branches':filters.branch],
   ['From',filters.from||'The beginning'],['To',filters.to||'The latest entry'],
   ['Type',filters.type===ALL?'All types':filters.type],['Status',filters.status===ALL?'All statuses':filters.status],
   ['Account',filters.account===ALL?'All accounts':filters.account],
   ['Total debit',money(report.totals.debit)],['Total credit',money(report.totals.credit)],
   ['Journal entries',String(report.totals.journals)],['Lines',String(report.totals.movements)],
   ['Generated by Local user',stamp.toLocaleString()]];
 }

 const branchTitleText = filters.branch && filters.branch !== ALL ? `${organization.name} · ${filters.branch}` : organization.name;

 return <section className="cbPage cbJournal" aria-busy={busy}>
  <header className="cbHead">
   <div className="cbHeadText"><h1>Journal Report</h1><p>View every posted accounting entry and its debit/credit lines for the selected period.</p></div>
   <div className="cbHeadActions">
    <DateRangeSelect from={filters.from} to={filters.to} onChange={(start,end)=>{setFilters(current=>({...current,from:start,to:end}))}} onCustom={()=>setFiltersOpen(true)}/>
    <details className="cbFiltersMore" open={filtersOpen} onToggle={event=>setFiltersOpen(event.currentTarget.open)}>
     <summary aria-label="Open filters"><IconAdjustments size={24} stroke={2.2}/>Filters{activeFilters>0&&<span>{activeFilters}</span>}</summary>
     <div className="cbFilters">
      <label>Date From<input type="date" aria-label="Date From" value={filters.from} onChange={event=>set('from',event.target.value)}/></label>
      <label>Date To<input type="date" aria-label="Date To" value={filters.to} onChange={event=>set('to',event.target.value)}/></label>
      <label>Branch<select aria-label="Branch" value={filters.branch} onChange={event=>set('branch',event.target.value)}><option value={ALL}>All branches</option>{report.branchOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Type<select aria-label="Type" value={filters.type} onChange={event=>set('type',event.target.value)}><option value={ALL}>All types</option>{report.typeOptions.map(value=><option key={value} value={value}>{normalizeTypeLabel(value)}</option>)}</select></label>
      <label>Status<select aria-label="Status" value={filters.status} onChange={event=>set('status',event.target.value)}><option value={ALL}>All statuses</option>{JOURNAL_STATUSES.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Account<select aria-label="Account" value={filters.account} onChange={event=>set('account',event.target.value)}><option value={ALL}>All accounts</option>{report.accountOptions.map(item=><option key={item.code} value={item.code}>{item.code+' \u00b7 '+item.name}</option>)}</select></label>
      <div className="cbFilterActions"><button type="button" onClick={()=>{refresh();setStamp(new Date())}}><IconRefresh size={15}/>Refresh</button><button type="button" onClick={clear}>Clear Filters</button></div>
     </div>
    </details>
    <ReportExportMenu items={[{key:'excel',label:'Export Excel',icon:<IconFileSpreadsheet size={17}/>,onClick:exportExcel,disabled:!report.totals.movements},{key:'pdf',label:'Export PDF',icon:<IconFileTypePdf size={17}/>,onClick:print,disabled:!report.totals.movements}]}/>
   </div>
  </header>
  {error&&<div className="cbError" role="alert"><IconAlertTriangle size={18}/><span>{error}</span></div>}
  <div className="cbPrintMeta">{printMeta().map(([label,value])=><p key={label}><b>{label}:</b> {value}</p>)}</div>

  <div className="cbSummary jrSummary3">
   <div className="cbSummaryCard jrSummaryCard">
    <div className="jrSummaryIcon jrIconDebit">
     <IconArrowUpRight size={18} />
    </div>
    <div className="jrSummaryContent">
     <span className="cbSummaryLabel">Total Debit</span>
     <strong className="cbSummaryValue">{money(report.totals.debit)}</strong>
    </div>
   </div>
   <div className="cbSummaryCard jrSummaryCard">
    <div className="jrSummaryIcon jrIconCredit">
     <IconArrowDownLeft size={18} />
    </div>
    <div className="jrSummaryContent">
     <span className="cbSummaryLabel">Total Credit</span>
     <strong className="cbSummaryValue">{money(report.totals.credit)}</strong>
    </div>
   </div>
   <div className="cbSummaryCard jrSummaryCard">
    <div className="jrSummaryIcon jrIconJournals">
     <IconBook size={18} />
    </div>
    <div className="jrSummaryContent">
     <span className="cbSummaryLabel">Journal Entries</span>
     <strong className="cbSummaryValue">{report.totals.journals}</strong>
    </div>
   </div>
  </div>

  <div className="cbCard">
   <div className="cbTableScroll">
    <table className="jrContinuousTable">
     <thead>
      <tr>
       <th style={{ width: '48%' }}>Account</th>
       <th style={{ width: '24%' }}>Particulars</th>
       <th style={{ width: '14%', textAlign: 'right' }}>Debit</th>
       <th style={{ width: '14%', textAlign: 'right' }}>Credit</th>
      </tr>
     </thead>
     <tbody>
      {!paginatedGroups.length ? (
       <tr className="emptyStateRow">
        <td colSpan="4" className="emptyStateCell" style={{ padding: '32px', textAlign: 'center' }}>
         <EmptyState
          variant="journal"
          title={report.hasData ? 'No journal entries match these filters.' : 'No posted journal entries found.'}
          description={report.hasData ? (report.empty || 'Try a wider date range, or clear the filters to see the whole journal.') : 'Journal entries appear here as soon as they are posted.'}
          actionLabel={report.hasData ? 'Clear Filters' : undefined}
          onAction={report.hasData ? clear : undefined}
         />
        </td>
       </tr>
      ) : (
       paginatedGroups.map(group => {
        const groupDebit = group.lines.reduce((s, x) => s + (x.debit || 0), 0);
        const groupCredit = group.lines.reduce((s, x) => s + (x.credit || 0), 0);

        return [
         <tr className="jrHeaderRow" key={`h-${group.id}`}>
          <td colSpan="4" className="jrHeaderCell">
           <div className="jrHeaderContent">
            <div className="jrHeaderMain">
             <div className="jrHeaderLeft">
              <span className="jrDateText">{dateText(group.date)}</span>
              <span className="jrSep">·</span>
              <span className="jrTypeText">{group.type}</span>
              {group.reference ? (
               <>
                <span className="jrSep">·</span>
                <button
                 type="button"
                 className="jrLinkBtn"
                 onClick={() => handleOpenDocument(group.type, group.reference)}
                >
                 {group.reference}
                </button>
               </>
              ) : null}
             </div>
             <div className="jrHeaderRight">
              <button
               type="button"
               className="jrLinkBtn jrJournalNo"
               onClick={() => handleOpenDocument(group.type, group.reference || group.number)}
              >
               {group.number}
              </button>
             </div>
            </div>
            {group.party ? (
             <div className="jrGroupPartyRow">{group.party}</div>
            ) : null}
           </div>
          </td>
         </tr>,
         ...group.lines.map((l, i) => (
          <tr className="jrLineRow" key={`l-${group.id}-${i}`}>
           <td>{renderAccountCell(l.account ? (l.accountName ? `${l.account} · ${l.accountName}` : l.account) : 'Unknown account')}</td>
           <td>{l.particulars || DASH}</td>
           <td style={{ textAlign: 'right' }} className="cbMoney">{l.debit > 0 ? money(l.debit) : DASH}</td>
           <td style={{ textAlign: 'right' }} className="cbMoney">{l.credit > 0 ? money(l.credit) : DASH}</td>
          </tr>
         )),
         <tr className="jrTotalRow" key={`t-${group.id}`}>
          <td colSpan="2" style={{ fontWeight: 600, color: '#1e293b' }}>Journal Total</td>
          <td style={{ textAlign: 'right' }} className="cbMoney">{money(groupDebit)}</td>
          <td style={{ textAlign: 'right' }} className="cbMoney">{money(groupCredit)}</td>
         </tr>
        ];
       })
      )}
     </tbody>
    </table>
   </div>

   {journalGroups.length > 0 ? (
    <div className="jrPaginationBar">
     <div className="jrPaginationInfo">
      Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, journalGroups.length)} of {journalGroups.length} journal entries
     </div>
     <div className="jrPaginationControls">
      <span style={{ fontSize: '13px', color: '#64748b' }}>Rows per page:</span>
      <select
       value={pageSize}
       onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
       className="jrPageSizeSelect"
      >
       <option value={10}>10</option>
       <option value={25}>25</option>
       <option value={50}>50</option>
      </select>
      <button
       type="button"
       disabled={page <= 1}
       onClick={() => setPage(p => Math.max(1, p - 1))}
       className="jrPageBtn"
       aria-label="Previous Page"
      >
       ‹
      </button>
      <span className="jrPageCurrent">{page} / {totalPages}</span>
      <button
       type="button"
       disabled={page >= totalPages}
       onClick={() => setPage(p => Math.min(totalPages, p + 1))}
       className="jrPageBtn"
       aria-label="Next Page"
      >
       ›
      </button>
     </div>
    </div>
   ) : null}
  </div>

  <div className={'cbEquation ' + (failed.length ? 'mismatch' : 'balanced')} role="status" style={{ position: 'static', marginTop: '20px', boxShadow: 'none' }}>
   {failed.length ? <IconAlertTriangle size={19} /> : <IconCheck size={19} />}
   <b>{failed.length ? 'Journal Report needs review' : 'Journal Report balances'}</b>
   <span>
    {failed.length
     ? failed.map(check => check.key).join(' · ')
     : `Debit ${money(report.totals.debit)} · Credit ${money(report.totals.credit)} · Difference ${money(Math.abs(report.totals.difference))}`}
   </span>
  </div>

  <details className="jrAboutReport">
   <summary><IconInfoCircle size={16} />About this report</summary>
   <div className="jrAboutContent">
    <ul>
     <li>Grouped by posted journal entry, stating account, debit and credit lines for each voucher.</li>
     <li>Only posted entries are counted. A draft, cancelled or unposted document never reaches a journal, so it can never appear here.</li>
     <li>A reversed journal keeps its lines and is marked Reversal instead of being removed, so the period totals always describe the ledger as it stands.</li>
     <li>Day Book, General Ledger, Trial Balance and this report read the same posted journal; only the way it is grouped differs.</li>
    </ul>
   </div>
  </details>
 </section>;
}
