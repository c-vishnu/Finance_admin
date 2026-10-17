import {useDeferredValue,useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {IconAdjustments,IconAlertTriangle,IconChevronDown,IconDownload,IconEye,IconFileSpreadsheet,IconFileTypePdf,IconFilter,IconPlus,IconRefresh,IconSearch,IconUpload,IconX} from '@tabler/icons-react';
import {readAccounts} from './account-store.js';
import {money} from './invoice-engine.js';
import {ALL,DASH,DEFAULT_SORT,POSTED,SORT_OPTIONS,expenseExportSheet,expenseReport,sortTransactions} from './business-reports.js';
import {downloadReport,excelReport} from './daybook-export.js';
import {getAccessibleOrganizations,getCurrentOrganizationContext} from './organisation-context.js';
import {accountingState,createExpense,readOperations,saveOperations} from './operations-store.js';
import {tableExport} from './tax-compliance.js';
import CreateExpensePage from './CreateExpensePage.jsx';
import EmptyState from './EmptyState.jsx';
import OutstandingActions from './OutstandingActions.jsx';
import StatusPill from './StatusPill.jsx';
import {ReportExportMenu} from './ReportToolbar.jsx';
import './journal-entries.css';
import './business-reports.css';
import './expense-detail-drawer.css';

const dateText=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):DASH;

const STATUS_TONES={Draft:'neutral',Pending:'warn',Posted:'ok'};

const blankFilters=()=>({from:'',to:'',party:ALL,status:POSTED,branch:ALL,account:ALL,category:ALL,payment:ALL});

/* The Transaction Register's View action hands an expense over through sessionStorage. This register
   consumes that handshake as it mounts and drops the key, so arriving any other way opens the list.
   The id is held rather than the row, because the row is derived from the report built below it and
   the handshake is read before that report exists. */
const consumeExpenseHandoff=()=>{try{const id=sessionStorage.getItem('wayvida-open-expense');if(!id)return null;sessionStorage.removeItem('wayvida-open-expense');return id}catch{return null}};

export default function ExpenseReport({onNavigate=()=>{}}){
 const [revision,setRevision]=useState(0),[filters,setFilters]=useState(blankFilters),[search,setSearch]=useState(''),[filtersOpen,setFiltersOpen]=useState(false),[sort,setSort]=useState(DEFAULT_SORT),[perPage,setPerPage]=useState(25),[page,setPage]=useState(1),[stamp,setStamp]=useState(()=>new Date());
 const [mode, setMode] = useState('list'); // 'list' | 'create'
 const [detail,setDetail]=useState(null),[handoff,setHandoff]=useState(consumeExpenseHandoff);
 const deferredSearch=useDeferredValue(search),busy=deferredSearch!==search;
 const organisation=getCurrentOrganizationContext().company;
 const branches=useMemo(()=>getAccessibleOrganizations().find(item=>item.id===organisation.id)?.branches||[],[organisation.id]);

 const refresh=()=>setRevision(value=>value+1);
 useEffect(()=>{window.addEventListener('wayvida-accounts-updated',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('wayvida-accounts-updated',refresh);window.removeEventListener('storage',refresh)}},[]);

 const {book,operations,error}=useMemo(()=>{try{return {book:readAccounts(),operations:readOperations(),error:''}}catch(reason){return {book:null,operations:{expenses:[]},error:reason.message}}},[revision]);

 const report=useMemo(()=>{
  try{return expenseReport(book||{},operations||{},{...filters,search:deferredSearch,branches,organisation:organisation.id,organisationCode:organisation.code})}
  catch{return expenseReport({},{expenses:[]},{...filters,search:deferredSearch,branches,organisation:organisation.id,organisationCode:organisation.code})}
 },[book,operations,filters,deferredSearch,branches,organisation.id,organisation.code]);

 const ordered=useMemo(()=>sortTransactions(report.rows,sort),[report.rows,sort]);
 /* One source for the open drawer: the row the operator clicked, or the row the handoff names. */
 const detailRow=detail||(handoff?ordered.find(row=>row.recordId===handoff):null);
 const pageCount=Math.max(1,Math.ceil(ordered.length/perPage)),pageIndex=Math.min(page,pageCount);
 const startIndex=(pageIndex-1)*perPage,firstRow=ordered.length?startIndex+1:0,lastRow=Math.min(startIndex+perPage,ordered.length);
 useEffect(()=>{setPage(1)},[deferredSearch,filters,sort,perPage]);

 const set=(key,value)=>setFilters(current=>({...current,[key]:value}));
 const clear=()=>{setFilters(blankFilters());setSearch('');setSort(DEFAULT_SORT);setPage(1)};
 const sortLabel=(SORT_OPTIONS.find(option=>option.value===sort)||{}).label||'Newest first';
 const activeFilters=['from','to'].filter(key=>filters[key]).length+['party','account','category','payment'].filter(key=>filters[key]!==ALL).length+(filters.status!==POSTED?1:0)+(filters.branch!==ALL?1:0)+(sort!==DEFAULT_SORT?1:0);

 function openDocument(entry){setHandoff(null);setDetail(entry)}
 function rowActions(entry){return [{key:'view',label:'View Expense',icon:IconEye,run:()=>openDocument(entry)}]}
 function print(){setStamp(new Date());setTimeout(()=>window.print(),50)}

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

 function triggerImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv, .json';
  input.onchange = (e) => {
   const file = e.target.files?.[0];
   if (!file) return;
   const reader = new FileReader();
   reader.onload = (evt) => {
    try {
     const text = evt.target?.result;
     if (!text) return;
     let importedRows = [];
     if (file.name.endsWith('.json')) {
      importedRows = JSON.parse(text);
     } else {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
      importedRows = lines.slice(1).map(line => {
       const values = line.split(',');
       const row = {};
       headers.forEach((h, i) => row[h] = values[i]?.trim());
       return {
        date: row.date || new Date().toISOString().split('T')[0],
        name: row.name || row.description || row.notes || 'Imported Expense',
        category: row.category || 'Office supplies',
        payee: row.vendor || row.payee || 'Vendor',
        amount: Number(row.amount || 0),
        account: row.account || '5900',
        paidThrough: row.paidthrough || '1010',
        status: 'Posted',
       };
      });
     }
     if (Array.isArray(importedRows) && importedRows.length > 0) {
      const store = readOperations();
      const db = accountingState();
      importedRows.forEach(item => {
       if (item.amount > 0) {
        createExpense(store, db, item);
       }
      });
      saveOperations(store);
      refresh();
      alert(`Successfully imported ${importedRows.length} expense records.`);
     }
    } catch (err) {
     alert('Import failed: ' + err.message);
    }
   };
   reader.readAsText(file);
  };
  input.click();
 }

 if (mode === 'create') {
  return <CreateExpensePage onCancel={() => setMode('list')} onSaved={() => { refresh(); setMode('list'); }} />;
 }

 return <section className="je-page brExpense" aria-busy={busy}>
  <div className="je-heading registerHead je-heading-flush">
   <div className="registerHeadText">
    <h2>Expenses <span className="je-heading-count">({report.rows.length})</span></h2>
    <p>View business expenses by date, account and payee.</p>
   </div>
   <div className="je-tools">
    <label>
     <IconSearch size={17}/>
     <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search expense reference, vendor or account…"/>
    </label>
    <details className="je-filters" open={filtersOpen} onToggle={event=>setFiltersOpen(event.currentTarget.open)}>
     <summary aria-label="Open filters"><IconFilter size={17}/>Filters{activeFilters>0&&<span>{activeFilters}</span>}</summary>
     <div>
      <label>Date From<input type="date" aria-label="Date From" value={filters.from} onChange={event=>set('from',event.target.value)}/></label>
      <label>Date To<input type="date" aria-label="Date To" value={filters.to} onChange={event=>set('to',event.target.value)}/></label>
      <label>Expense Account<select aria-label="Expense Account" value={filters.account} onChange={event=>set('account',event.target.value)}><option value={ALL}>All expense accounts</option>{report.accountOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Category<select aria-label="Category" value={filters.category} onChange={event=>set('category',event.target.value)}><option value={ALL}>All categories</option>{report.categoryOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Vendor Name<select aria-label="Vendor Name" value={filters.party} onChange={event=>set('party',event.target.value)}><option value={ALL}>All payees</option>{report.partyOptions.map(option=><option key={option.name} value={option.name}>{option.name}</option>)}</select></label>
      {report.branchOptions.length>0&&<label>Branch<select aria-label="Branch" value={filters.branch} onChange={event=>set('branch',event.target.value)}><option value={ALL}>All branches</option>{report.branchOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>}
      <label>Payment Account<select aria-label="Payment Account" value={filters.payment} onChange={event=>set('payment',event.target.value)}><option value={ALL}>All payment accounts</option>{report.paymentOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Status<select aria-label="Status" value={filters.status} onChange={event=>set('status',event.target.value)}><option value={ALL}>All statuses</option>{report.statusOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Sort<select aria-label="Sort expenses" value={sort} onChange={event=>setSort(event.target.value)}>{SORT_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <div className="brFilterActions"><button type="button" onClick={()=>{refresh();setStamp(new Date())}}><IconRefresh size={15}/>Refresh</button><button type="button" onClick={clear}>Clear filters</button></div>
     </div>
    </details>
   </div>
   <div className="je-create-callout">
    <div style={{ display: 'inline-flex', alignItems: 'center', background: '#1f61c9', borderRadius: '8px', boxShadow: '0 2px 8px rgba(31, 97, 201, 0.22)', position: 'relative' }}>
     <button type="button" onClick={() => setMode('create')} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 16px', background: 'transparent', color: '#fff', border: 0, fontWeight: 600, cursor: 'pointer', fontSize: '13.5px' }}>
      <IconPlus size={18} /> Create Expense
     </button>
     <div style={{ width: '1px', height: '22px', background: 'rgba(255, 255, 255, 0.35)' }} />
     <details style={{ position: 'relative' }}>
      <summary style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '40px', background: 'transparent', color: '#fff', border: 0, cursor: 'pointer', listStyle: 'none' }}>
       <IconChevronDown size={18} />
      </summary>
      <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '175px', padding: '6px', background: '#fff', border: '1px solid #eaecf0', borderRadius: '8px', boxShadow: '0 10px 30px rgba(16, 24, 40, 0.15)' }}>
       <button type="button" onClick={triggerImport} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 0, borderRadius: '6px', background: 'transparent', color: '#344054', fontSize: '13px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}>
        <IconUpload size={16} /> Import Expenses
       </button>
       <button type="button" onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 0, borderRadius: '6px', background: 'transparent', color: '#344054', fontSize: '13px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}>
        <IconFileSpreadsheet size={16} /> Export Excel
       </button>
      </div>
     </details>
    </div>
   </div>
  </div>

  {error&&<div className="brError" role="alert"><IconAlertTriangle size={18}/><span>Unable to load expenses. {error}</span><button type="button" onClick={refresh}>Retry</button></div>}

  <div className="je-card unified">
   <div className="je-table-wrap">
    <table className="expenseRegister">
     <thead>
      <tr>
       <th>Date</th>
       <th>Expense No.</th>
       <th>Paid To</th>
       <th>Payment For</th>
       <th>Bill Reference</th>
       <th>Payment Method</th>
       <th>Paid From</th>
       <th>Amount Paid</th>
       <th>Status</th>
       <th>Actions</th>
      </tr>
     </thead>
     <tbody>
      {ordered.slice(startIndex,startIndex+perPage).map(entry=><tr key={entry.id}>
       <td>{dateText(entry.date)}</td>
       <td><button type="button" className="je-link" title={'Open expense '+entry.number} onClick={()=>openDocument(entry)}>{entry.number}</button></td>
       <td>{entry.party||DASH}</td>
       <td>{entry.expenseAccountName||entry.expenseAccount||DASH}</td>
       <td>{entry.reference||DASH}</td>
       <td>{entry.method||DASH}</td>
       <td>{entry.paymentAccountName||entry.paymentAccount||DASH}</td>
       <td><b>{money(entry.amount)}</b></td>
       <td><StatusPill status={entry.status} tone={STATUS_TONES[entry.status]||'neutral'}/></td>
       <td><div className="je-row-actions"><OutstandingActions label={'Actions for expense '+entry.number} items={rowActions(entry)}/></div></td>
      </tr>)}
      {!report.rows.length&&<tr className="emptyStateRow"><td colSpan={10} className="emptyStateCell"><EmptyState variant="budget" title={report.hasRows?'No transactions match your filters.':'No expense transactions found.'} description={report.hasRows?'Try a wider date range, or clear the filters to see every expense in this scope.':'Expenses will appear here once they are posted.'} actionLabel={report.hasRows?'Clear filters':undefined} onAction={report.hasRows?clear:undefined}/></td></tr>}
     </tbody>
    </table>
   </div>
   {ordered.length>0&&<div className="pagination-footer je-pager">
    <span className="pagination-left">Showing {firstRow}&ndash;{lastRow} of {ordered.length} expenses</span>
    <div className="pagination-right">
     <label className="brPerPage"><select aria-label="Expenses per page" value={perPage} onChange={event=>setPerPage(Number(event.target.value))}>{[25,50,100].map(size=><option key={size} value={size}>{size} per page</option>)}</select></label>
     <div className="pagination-nav"><button type="button" aria-label="Previous page" disabled={pageIndex<=1} onClick={()=>setPage(pageIndex-1)}>&lsaquo;</button><span>Page {pageIndex} of {pageCount}</span><button type="button" aria-label="Next page" disabled={pageIndex>=pageCount} onClick={()=>setPage(pageIndex+1)}>&rsaquo;</button></div>
    </div>
   </div>}
  </div>

  {detailRow&&<ExpenseDetailDrawer entry={detailRow} close={()=>{setDetail(null);setHandoff(null)}} onNavigate={onNavigate}/>}
 </section>;
}

/* The expense a register row names, read in place: the recorded figures, the posting the engine makes
   from them, and the description. It renders through `createPortal` on the shared drawer shell for
   the reason its stylesheet records - this page is also mounted inside `.transactionPortal`, a
   stacking context at z-index 45, where a fixed overlay raised in the page cannot clear the
   application chrome. `Close` and `View journal` are the two things left to do with a posted expense
   from here; nothing in this drawer posts, edits or deletes one. */
function ExpenseDetailDrawer({entry,close,onNavigate}){
 const account=(name,code)=>[name,code].filter(Boolean).join(' · ')||'Not recorded';
 const label=value=>value||DASH;
 return createPortal(
  <div className="opsOverlay exOverlay" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}>
   <aside className="opsDrawer exDrawer" role="dialog" aria-modal="true" aria-label={'Expense details '+entry.number}>
    <header>
     <div>
      <h2>{entry.name||entry.number}</h2>
      <p>{entry.number} &middot; {dateText(entry.date)}</p>
     </div>
     <button type="button" className="exDrawerClose" aria-label="Close expense details" onClick={close}><IconX size={20}/></button>
    </header>

    <div className="opsDrawerBody exDrawerBody">
     <dl className="exFacts">
      <div><dt>Amount</dt><dd><b>{money(entry.amount)}</b></dd></div>
      <div><dt>Status</dt><dd><StatusPill status={entry.status} tone={STATUS_TONES[entry.status]||'neutral'}/></dd></div>
      <div><dt>Expense Account</dt><dd>{account(entry.expenseAccountName,entry.expenseAccount)}</dd></div>
      <div><dt>Paid Through</dt><dd>{account(entry.paymentAccountName,entry.paymentAccount)}</dd></div>
      <div><dt>Vendor / Payee</dt><dd>{label(entry.party)}</dd></div>
      <div><dt>Category</dt><dd>{label(entry.category)}</dd></div>
      <div><dt>Customer</dt><dd>{label(entry.customerName)}</dd></div>
      <div><dt>Branch</dt><dd>{label(entry.branchName)}</dd></div>
      <div><dt>Payment Method</dt><dd>{label(entry.method)}</dd></div>
      <div><dt>Tax</dt><dd>{label(entry.taxLabel)}</dd></div>
      <div><dt>Reference</dt><dd>{label(entry.reference)}</dd></div>
     </dl>

     <div className="exPosting">
      <h3>Accounting posting details:</h3>
      <ul>
       <li>Debit &middot; {account(entry.expenseAccountName,entry.expenseAccount)}</li>
       <li>Credit &middot; {account(entry.paymentAccountName,entry.paymentAccount)}</li>
       {entry.taxLabel&&entry.taxLabel!==DASH&&<li>Tax &middot; {entry.taxLabel}</li>}
      </ul>
     </div>

     <div className="exNotes">
      <h3>Description</h3>
      <p>{entry.description||'No description recorded.'}</p>
     </div>
    </div>

    <footer>
     <button type="button" onClick={close}>Close</button>
     <button type="button" onClick={()=>onNavigate('Journal Entries')}>View journal</button>
    </footer>
   </aside>
  </div>,
  document.body
 );
}
