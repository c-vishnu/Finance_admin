import {useEffect,useMemo,useState} from 'react';
import {IconArrowsExchange,IconBuilding,IconBuildingBank,IconCalendar,IconCircleCheck,IconCurrencyRupee,IconFileText,IconSitemap,IconTag,IconAlertTriangle,IconArrowLeft,IconBook,IconCheck,IconCopy,IconDots,IconDownload,IconEdit,IconEye,IconFileInvoice,IconFilter,IconChevronDown,IconHistory,IconLock,IconTemplate,IconPaperclip,IconPlus,IconPrinter,IconRefresh,IconSearch,IconSend,IconShare,IconTrash,IconUpload,IconX} from '@tabler/icons-react';
import {readAccounts,writeAccounts} from './account-store.js';
import SimpleTransactionForm,{ModeToggle} from './SimpleTransactionForm.jsx';
import {JOURNAL_ACTIONS,JOURNAL_ACTION_DUTY,MANUAL_JOURNAL_KEY,TRANSACTION_STATUSES,canEditStatus,duplicateTransaction,journalAllowed,journalTimeline,nextJournalNumber,normaliseStatus,postsToLedger,reversalRecord,statusText,transactionTypeLabel} from './simple-journal-transaction.js';
import {journalRecordAmount,journalRegisterDisplay} from './journal-register-display.js';
import {journal,money,command as invoiceCommand,outstanding} from './invoice-engine.js';
import {recordPurchasePayment} from './purchase-service.js';
import {documentInScope} from './journal-entry-reference.js';
import {validatePostingDate} from './period-locking.js';
import {assertOperationAllowed} from './period-locking.js';
import JournalPreview from './JournalPreview.jsx';
import {JOURNAL_VIEW_LABELS,useTerminology} from './terminology.jsx';
import {csvReport,downloadReport} from './daybook-export.js';
import {journalImportTemplate,parseJournalCSV,planJournalImport} from './journal-import.js';
import './journal-entries.css';
import {DATE_RANGE_PRESETS,resolveDateRange,matchDateRange} from './date-range-filter.js';
import './journal-detail-actions.css';
import './journal-period-fix.css';
import './journal-edit-action.css';
import './journal-document-actions.css';
import './journal-preview.css';
import './journal-supporting-documents.css';
import './journal-date-filter.css';
import './journal-heading-fix.css';
import './journal-filter-menu.css';
import './journal-business-view.css';
import './journal-import.css';
import EmptyState from './EmptyState.jsx';
import {getBranchesForOrganisation,getScopeVisibility} from './organisation-scope.js';
import {getAccessibleOrganizations,getCurrentOrganizationContext} from './organisation-context.js';
import JournalAccountPicker from './JournalAccountPicker.jsx';
import {CREATE_JOURNAL_TYPES,RECURRENCE_OPTIONS,allTemplates,postingChecks,recordRecentAccount,resolveTemplate,saveCustomTemplate} from './journal-templates.js';

const STORE=MANUAL_JOURNAL_KEY;
const OPEN_PERIOD_START='2026-04-01';
const TYPES=['General Journal','Adjustment Journal','Transfer Journal','Opening Balance','Correction Entry'];
/* One view of the register is ten transactions; the export still writes every filtered row. */
const PAGE_SIZE=10;
const BUSINESS_PURPOSES={'Correction Entry':'Fix a mistake',Correction:'Fix a mistake','Adjustment Journal':'Update account balance',Adjustment:'Update account balance','Transfer Journal':'Move money between accounts','Opening Balance':'Add opening balances','General Journal':'Other adjustment','Opening Journal':'Add opening balances','Business Transaction':'Business transaction'};
const typeLabel=(type,view)=>view==='business'?(BUSINESS_PURPOSES[type]||'Other adjustment'):type;
const selectableTypes=view=>view==='business'?TYPES.map(type=>({value:type,label:typeLabel(type,view)})):TYPES.map(type=>({value:type,label:type}));
const purposeFilters=view=>view==='business'?[['All','All entry purposes'],['Business Transaction','Business transaction'],['Correction Entry','Fix a mistake'],['Adjustment Journal','Update account balance'],['Transfer Journal','Move money between accounts'],['Opening Balance','Add opening balances'],['General Journal','Other adjustment']]:[['All','All journal types'],['Business Transaction','Business Transaction'],...TYPES.map(type=>[type,type])];
const canEditJournal=journal=>canEditStatus(journal.status);const isReversalJournal=journal=>!!journal.reversalOf||String(journal.reference||'').startsWith('Reversal of ');
/* The acting role simulates approval duty, exactly as src/inventory-adjustments.js
   does: it follows the View as switch instead of adding a second page control, so
   Publish and Reject only ever appear for the role that may approve. */
const reviewRole=viewMode=>viewMode==='business'?'Admin':'Accountant';
const ACTION_ICONS={Edit:IconEdit,Preview:IconEye,Duplicate:IconCopy,'Submit for Approval':IconSend,Resubmit:IconSend,Approve:IconCheck,Reject:IconTrash,Reverse:IconRefresh,Delete:IconTrash};
const ACTION_LABELS={'Submit for Approval':'Submit for approval',Approve:'Publish journal'};
const DUTY_LABELS={save:'edit',submit:'submit',export:'export',approve:'approve or reject',post:'approve',cancel:'cancel',reverse:'reverse',delete:'delete'};
/* Exactly the actions the record's status offers, minus the approval duties the
   acting role does not hold: an unauthorised approver never even sees Publish or
   Reject. A row created by another module keeps Preview only. */
const actionEntries=(journal,role,size)=>((JOURNAL_ACTIONS[normaliseStatus(journal.status)]||['Preview']))
 .filter(action=>{const duty=JOURNAL_ACTION_DUTY[action];return !duty||journalAllowed(role,duty)})
 /* An approver does not queue their own work: a draft offers Publish rather than
    Submit for approval, and only a role that may publish sees Publish at all. */
 .filter(action=>{if(normaliseStatus(journal.status)!=='Draft')return true;const publisher=journalAllowed(role,'post');if(action==='Approve')return publisher;if(action==='Submit for Approval')return !publisher;return true})
 /* Only a posting can be reversed, so a record that never reached the ledger never offers Reverse. */
 .filter(action=>!(action==='Reverse'&&!journal.ledgerJournalId))
 .map(action=>{
  const Icon=ACTION_ICONS[action]||IconEye,managed=Boolean(journal.automatic)&&action!=='Preview';
  return {action,label:ACTION_LABELS[action]||action,icon:<Icon size={size}/>,danger:['Delete','Reject','Reverse','Cancel journal'].includes(action),disabled:managed,reason:managed?'This entry is created by another module. Manage it where it was recorded.':''};
 });
const emptyLine=()=>{const{company,branch}=getCurrentOrganizationContext();return{id:crypto.randomUUID(),account:'',debit:'',credit:'',organization:company.name,branch:branch.name,costCentre:'Operations',description:''}};
const blank=()=>{const now=new Date(),context=getCurrentOrganizationContext(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;return {id:crypto.randomUUID(),number:'JV-2026-'+String(Date.now()).slice(-5),date,organization:context.company?.name||'',branch:context.branch?.name||'',type:'General Journal',reference:'',narration:'',attachments:[],status:'Draft',createdBy:'Admin',createdAt:now.toISOString(),lines:[emptyLine(),emptyLine()]}};
/* Imported journals are numbered on from the highest number already in the register, so a batch keeps
   the register's JV-2026-nnnnn shape instead of colliding with the timestamp-derived numbers. */
const nextJournalNumbers=(count,rows)=>{const used=rows.map(j=>Number(String(j.number||'').replace(/[^0-9]/g,'').slice(-5))||0);const start=used.length?Math.max(...used):Number(String(Date.now()).slice(-5));return Array.from({length:count},(_,i)=>'JV-2026-'+String(start+1+i).padStart(5,'0'))};
const readManual=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch{return []}};
const saveManual=rows=>localStorage.setItem(STORE,JSON.stringify(rows));
const readAttachments=files=>Promise.all([...files].map(file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({name:file.name,type:file.type,data:reader.result});reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)})));
const amount=v=>Math.round((Number(v)||0)*100);
const fmtDate=v=>new Date(v+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
const periodName=v=>new Date(v+'T00:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'});
const postingContext=()=>{const raw=localStorage.getItem('wayvida-demo-company')||'abc';return {companyId:{abc:'ABC01',northstar:'NSR02',malabar:'MTC03',bluewave:'BWS04'}[raw]||raw,branchId:localStorage.getItem('wayvida-demo-branch')||undefined}};
const checkPeriod=date=>{const context=postingContext(),base=validatePostingDate(date,'Admin',{...context,module:'Accounting'});if(base.allowed)return base;const detail=assertOperationAllowed({operation:'post',date,role:'Admin',...context,module:'Accounting'});return {...base,locks:detail.locks||[],lock:detail.lock||null,remedy:detail.remedy||base.message}};
const assertOpenPeriod=date=>{const result=checkPeriod(date);if(!result.allowed)throw Error(result.remedy||result.message)};
/* Import journals. The register's split menu opens this, and it is the only way a journal arrives
   from a file: the rows are parsed and planned by src/journal-import.js, the preview states what
   will import and what will not, and the page saves the ready plans as drafts through the store the
   create page already writes to, so an import can never post to the ledger. */
function JournalImportDialog({accounts,onClose,onImport}){
 const [plans,setPlans]=useState(null),[error,setError]=useState("");
 const ready=plans?plans.filter(plan=>!plan.problem):[];
 async function upload(event){
  const file=event.target.files[0];setPlans(null);setError("");
  if(!file)return;
  try{if(file.size>1024*1024)throw Error("Choose a CSV smaller than 1 MB.");setPlans(planJournalImport(parseJournalCSV(await file.text()),{accounts,types:TYPES,floor:OPEN_PERIOD_START}))}catch(reason){setError(reason.message)}
  event.target.value="";
 }
 return <div className="je-reverse-overlay" onMouseDown={event=>event.target===event.currentTarget&&onClose()}>
  <form className="je-reverse-dialog je-import-dialog" role="dialog" aria-modal="true" aria-labelledby="je-import-title" onSubmit={event=>{event.preventDefault();if(ready.length)onImport(ready)}}>
   <h2 id="je-import-title">Import journals</h2>
   <p>One row per journal line. Rows that share a Voucher become one journal, and every imported journal is saved as a draft.</p>
   <div className="je-import-tools">
    <button type="button" onClick={()=>downloadReport(csvReport(journalImportTemplate()),"wayvida-journal-import-template.csv","text/csv;charset=utf-8")}><IconDownload size={16}/>Download template</button>
    <label className="je-import-choose">Choose CSV<input type="file" accept=".csv,text/csv" onChange={upload}/></label>
   </div>
   {error&&<p className="je-import-error" role="alert">{error}</p>}
   {plans&&!plans.length&&<p className="je-import-note">Nothing to import from that file.</p>}
   {plans?.length>0&&<div className="je-import-preview">
    <p className="je-import-count">{ready.length} of {plans.length} {plans.length===1?"journal":"journals"} ready to import{plans.length>ready.length?" · "+(plans.length-ready.length)+" need attention":""}</p>
    <ul>{plans.map(plan=><li key={plan.key} className={plan.problem?"bad":"good"}><b>{plan.voucher}</b><small>{(plan.date||"No date")+" · "+plan.lines.length+" "+(plan.lines.length===1?"line":"lines")+" · "+money(plan.debit)}</small><em>{plan.problem||"Balanced · ready to import"}</em></li>)}</ul>
   </div>}
   <footer><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit" disabled={!ready.length}>Import {ready.length} {ready.length===1?"journal":"journals"}</button></footer>
  </form>
 </div>;
}

const TIMELINE_ICONS={created:IconFileText,submitted:IconSend,resubmitted:IconSend,approved:IconCircleCheck,posted:IconCheck,rejected:IconX,reversed:IconRefresh,cancelled:IconLock,status:IconRefresh};
const STATUS_TONES={Approved:'is-approved',Rejected:'is-rejected','Pending Approval':'is-pending',Draft:'is-draft',Reversed:'is-reversed',Cancelled:'is-cancelled'};
const StatusBadge=({value})=><span className={'je-status-badge '+(STATUS_TONES[value]||'is-draft')}>{value}</span>;
const TimelineMark=({kind})=>{const Icon=TIMELINE_ICONS[kind]||IconHistory;return <span className={'je-timeline-mark is-'+kind}><Icon size={16} stroke={1.8} aria-hidden="true"/></span>};

const Status=({value})=><span className={'je-status '+value.toLowerCase().replaceAll(' ','-')}><i aria-hidden="true"/>{value}</span>;

const journalOrg=j=>{const lines=j.lines||[];const orgs=[...new Set(lines.map(l=>l.organization).filter(Boolean))];return orgs.length===1?orgs[0]:orgs.length>1?orgs[0]+' +'+String(orgs.length-1):'—'};
const journalBranch=j=>{const lines=j.lines||[];const branches=[...new Set(lines.map(l=>l.branch).filter(Boolean))];return branches.length===1?branches[0]:branches.length>1?branches[0]+' +'+String(branches.length-1):'—'};
const JournalRegister=({terms,list,filtered,totals,viewMode,role,accounts,query,setQuery,status,setStatus,typeFilter,setTypeFilter,accountFilter,setAccountFilter,orgFilter,setOrgFilter,branchFilter,setBranchFilter,fromDate,setFromDate,toDate,setToDate,typeOptions,accountOptions,organisationOptions,branchOptions,onCreate,onDetail,onEdit,onAction,onImport})=>{
 const exportRegister=()=>{
  const rows=[['Journal ID & Date','Transaction details','Account','Transaction Type','Amount','Status','Organisation','Branch'],...filtered.map(j=>{const display=journalRegisterDisplay(j,accounts);return [j.number+' · '+fmtDate(j.date),display.name,display.account,display.type,journalRecordAmount(j)/100,display.status,journalOrg(j),journalBranch(j)]})];
  downloadReport(csvReport(rows),'wayvida-journals.csv','text/csv;charset=utf-8');
 };
 const menuRun=handler=>event=>{event.currentTarget.closest('details')?.removeAttribute('open');handler()};
 const [page,setPage]=useState(1);
 const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const current=Math.min(Math.max(1,page),pageCount);
 useEffect(()=>{setPage(1)},[query,status,typeFilter,accountFilter,orgFilter,branchFilter,fromDate,toDate]);
 const visible=filtered.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE);
 const activeFilterCount=[status!=='All statuses',typeFilter!=='All types',accountFilter!=='All accounts',orgFilter!=='All organisations',branchFilter!=='All branches',!!fromDate,!!toDate].filter(Boolean).length;
 const runAction=(j,action)=>{if(action==='Preview')return onDetail(j);if(action==='Edit')return onEdit(j);return onAction(j,action)};
 return <section className="je-page">
  <div className="je-heading registerHead je-heading-flush">
   <div className="registerHeadText"><h2>{terms.journalEntries} <span className="je-heading-count">({list.length})</span></h2><p>{viewMode==='business'?JOURNAL_VIEW_LABELS.business.subtitle:'Record what happened. Wayvida creates the balanced accounting entry.'}</p></div>
   <div className="je-tools">
    <label><IconSearch size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search journal ID, transaction name or reference…"/></label>
    <details className="je-filters"><summary aria-label="Open filters"><IconFilter size={17}/>Filters{activeFilterCount>0&&<span>{activeFilterCount}</span>}</summary><div>
     <label>Status<select aria-label="Transaction status" value={status} onChange={e=>setStatus(e.target.value)}>{['All statuses',...TRANSACTION_STATUSES].map(value=><option key={value}>{value}</option>)}</select></label>
     <label>Transaction type<select aria-label="Transaction type" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>{typeOptions.map(value=><option key={value}>{value}</option>)}</select></label>
     <label>Account<select aria-label="Account" value={accountFilter} onChange={e=>setAccountFilter(e.target.value)}>{accountOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
     <label>Organisation<select aria-label="Organisation" value={orgFilter} onChange={e=>setOrgFilter(e.target.value)}>{organisationOptions.map(value=><option key={value}>{value}</option>)}</select></label>
     <label>Branch<select aria-label="Branch" value={branchFilter} onChange={e=>setBranchFilter(e.target.value)}>{branchOptions.map(value=><option key={value}>{value}</option>)}</select></label>
     <label>Date range<select aria-label="Filter by date range" value={matchDateRange(fromDate,toDate)} onChange={e=>{const range=resolveDateRange(e.target.value);setFromDate(range.from);setToDate(range.to)}}>{DATE_RANGE_PRESETS.map(([value,label])=><option key={value} value={value}>{label}</option>)}{matchDateRange(fromDate,toDate)==='custom'&&<option value="custom">Custom range</option>}</select></label>
     <label>From date<input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label>
     <label>To date<input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></label>
     <button type="button" onClick={()=>{setStatus('All statuses');setTypeFilter('All types');setAccountFilter('All accounts');setOrgFilter('All organisations');setBranchFilter('All branches');setFromDate('');setToDate('')}}>Clear filters</button>
    </div></details>
   </div>
   <div className="je-create-callout"><div className="registerSplit"><button type="button" className="primary registerSplitMain" onClick={onCreate}><IconPlus size={17}/>Record Transaction</button><details className="registerSplitMore"><summary aria-label="More journal actions" title="More journal actions"><IconChevronDown size={16}/></summary><div><button type="button" onClick={menuRun(onImport)}><IconUpload size={16}/>Import</button><button type="button" onClick={exportRegister}><IconDownload size={16}/>Export</button></div></details></div></div>
  </div>
  <div className="je-card unified"><div className="je-table-wrap"><table><thead><tr>{['Journal ID & Date','Transaction details','Account','Transaction Type','Amount','Status','Organisation','Branch','Actions'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(j=>{const display=journalRegisterDisplay(j,accounts),entries=actionEntries(j,role,16);return <tr key={j.id}>
   <td className="je-id-cell"><button type="button" className="je-link" onClick={()=>onDetail(j)}>{j.number}</button><small>{fmtDate(j.date)}</small></td>
   <td className="je-details-cell">{display.name}<small>{j.reference||'No reference'}</small></td>
   <td>{display.account}</td>
   <td>{display.type}</td>
   <td><b>{money(journalRecordAmount(j))}</b></td>
   <td><Status value={statusText(display.status,viewMode==='business')}/></td>
   <td>{journalOrg(j)}</td>
   <td>{journalBranch(j)}</td>
   <td><div className="je-row-actions"><details><summary aria-label={'More actions for '+j.number}><IconDots size={17}/></summary><div>{entries.map(entry=><button key={entry.action} type="button" disabled={entry.disabled} title={entry.reason||''} className={entry.danger?'je-row-danger':''} onClick={entry.disabled?undefined:menuRun(()=>runAction(j,entry.action))}>{entry.icon}{entry.label}</button>)}</div></details></div></td>
  </tr>})}{!filtered.length&&<tr className="emptyStateRow"><td colSpan={9} className="emptyStateCell"><EmptyState variant="journal" title="No transactions found" description="Adjust the filters or record a transaction." actionLabel="Record Transaction" onAction={onCreate}/></td></tr>}</tbody></table></div>{filtered.length>0&&<div className="pagination-footer je-pager"><span className="pagination-left">Showing {(current-1)*PAGE_SIZE+1}&ndash;{Math.min(current*PAGE_SIZE,filtered.length)} of {filtered.length}</span><div className="pagination-right"><span>{PAGE_SIZE} per page</span><div className="pagination-nav"><button type="button" aria-label="Previous page" disabled={current<=1} onClick={()=>setPage(current-1)}>&lsaquo;</button><span>Page {current} of {pageCount}</span><button type="button" aria-label="Next page" disabled={current>=pageCount} onClick={()=>setPage(current+1)}>&rsaquo;</button></div></div></div>}</div>
 </section>;
};

export default function JournalEntriesPro({seed,notify,onNavigate}){
 const {mode:viewMode,t:terms}=useTerminology();
 const [accountRevision,setAccountRevision]=useState(0),state=useMemo(()=>readAccounts(seed),[seed,accountRevision]),accounts=state.accounts.filter(a=>a.active&&!a.isGroup);
 const [manual,setManual]=useState(readManual),[preview,setPreview]=useState(null),[mode,setMode]=useState('list'),[form,setForm]=useState(null),[detail,setDetail]=useState(null),[query,setQuery]=useState(''),[status,setStatus]=useState(()=>sessionStorage.getItem('wayvida-resolve-status')||'All statuses'),[typeFilter,setTypeFilter]=useState('All types'),[accountFilter,setAccountFilter]=useState('All accounts'),[orgFilter,setOrgFilter]=useState('All organisations'),[branchFilter,setBranchFilter]=useState('All branches'),[fromDate,setFromDate]=useState(''),[toDate,setToDate]=useState(''),[error,setError]=useState(''),[importOpen,setImportOpen]=useState(false);
 const totals=j=>({debit:j.lines.reduce((n,l)=>n+amount(l.debit),0),credit:j.lines.reduce((n,l)=>n+amount(l.credit),0)});
 const openMenus=()=>document.querySelectorAll('.je-row-actions details[open],.je-detail-more[open]');
 useEffect(()=>{const closeOnPointerDown=event=>{openMenus().forEach(node=>{if(!node.contains(event.target))node.removeAttribute('open')})};const closeOnEscape=event=>{if(event.key==='Escape')openMenus().forEach(node=>node.removeAttribute('open'))};document.addEventListener('pointerdown',closeOnPointerDown);document.addEventListener('keydown',closeOnEscape);return()=>{document.removeEventListener('pointerdown',closeOnPointerDown);document.removeEventListener('keydown',closeOnEscape)}});
 const [invoicesState,setInvoicesState]=useState(()=>readAccounts(seed));
 const [billsState,setBillsState]=useState(()=>{try{return JSON.parse(localStorage.getItem('wayvida-purchase-bills-v1')||'{}')}catch{return {}}});
   const allInvoices=invoicesState.invoices||[];
   const allBills=billsState.purchaseBills||[];
   const customerPayments=(invoicesState.payments||[]).map(p=>{
     const inv=allInvoices.find(i=>i.id===p.invoiceId)||{};
     const posted=invoicesState.journals?.find(entry=>entry.id===p.journalId);
     return {id:p.id,automatic:true,number:posted?.number||p.number,reference:p.reference||inv.number,date:p.date,type:'Customer Payment',narration:'Customer Payment',amount:p.amount,status:p.reversed?'Reversed':'Approved',createdBy:'System',createdAt:p.date,ledgerJournalId:p.journalId,lines:(posted?.lines||[]).map(line=>({...line,debit:line.debit/100,credit:line.credit/100,organization:inv.organizationName||inv.organizationId||'',branch:inv.branchName||inv.branchId||inv.branch||''})),simpleTransaction:{label:'Customer Payment',partyName:inv.customerName||'',moneyAccount:p.bank,counterpartyAccount:inv.arAccount}};
   });
   const vendorPayments=(billsState.vendorPayments||[]).map(p=>{
     const bill=allBills.find(b=>b.id===p.billId)||{};
     const posted=billsState.journals?.find(entry=>entry.id===p.journalId);
     return {id:p.id,automatic:true,number:posted?.number||p.number,reference:p.reference||bill.number,date:p.date,type:'Vendor Payment',narration:'Vendor Payment',amount:p.amount,status:normaliseStatus(p.status||'Posted'),createdBy:p.createdBy||'System',createdAt:p.createdAt||p.date,ledgerJournalId:p.journalId,lines:(posted?.lines||[]).map(line=>({...line,debit:line.debit/100,credit:line.credit/100,organization:bill.organizationName||bill.organizationId||'',branch:bill.branchName||bill.branchId||bill.branch||''})),simpleTransaction:{label:'Vendor Payment',partyName:bill.vendorName||'',moneyAccount:p.bankAccount,counterpartyAccount:bill.payableAccount}};
   });
   const list=[...manual.filter(j=>!j.automatic),...customerPayments,...vendorPayments].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 const role=reviewRole(viewMode);
 /* The register reflects the working context: a row whose lines name an
    organisation and branch must match the selected pairs, while a row that
    carries no scope at all is a legacy posting that still belongs in the books. */
 const scopeKey=value=>String(value??'').trim().toLowerCase().replace(/\s+branches?$/,'');
 const scopePair=(organisation,branch)=>scopeKey(organisation)+'|'+scopeKey(branch);
 const selectedPairs=new Set(getAccessibleOrganizations().flatMap(organisation=>organisation.branches.flatMap(branch=>[[organisation.name,branch.name],[organisation.id,branch.id],[organisation.id,branch.name],[organisation.name,branch.id],[organisation.code,branch.name],[organisation.code,branch.id]].map(([org,unit])=>scopePair(org,unit)))));
 const inScope=j=>{const lines=j.lines||[];if(!lines.length)return true;if(!lines.some(line=>line.organization||line.branch))return true;return lines.some(line=>selectedPairs.has(scopePair(line.organization,line.branch)))};
 const scoped=list.filter(inScope);
 const displayOf=j=>journalRegisterDisplay(j,state.accounts);
 const searchText=typeof query==='string'?query.trim().toLowerCase():'';
 const typeOptions=['All types',...[...new Set(scoped.map(j=>displayOf(j).type).filter(Boolean))].sort()];
 const accountOptions=[['All accounts','All accounts'],...new Map(scoped.map(j=>{const name=displayOf(j).account;return [name,name]})).entries()];
 const organisationOptions=['All organisations',...new Set(scoped.map(journalOrg).filter(value=>value&&value!=='—'))];
 const branchOptions=['All branches',...new Set(scoped.map(journalBranch).filter(value=>value&&value!=='—'))];
 /* Search covers the journal ID, the transaction name and the reference, and the
    panel covers date, type, status, organisation, branch and account. */
 const filtered=scoped.filter(j=>{
  const display=displayOf(j);
  return (status==='All statuses'||display.status===status)
   &&(typeFilter==='All types'||display.type===typeFilter)
   &&(accountFilter==='All accounts'||display.account===accountFilter)
   &&(orgFilter==='All organisations'||journalOrg(j)===orgFilter)
   &&(branchFilter==='All branches'||journalBranch(j)===branchFilter)
   &&(!fromDate||j.date>=fromDate)&&(!toDate||j.date<=toDate)
   &&[j.number,j.reference,display.name,display.type,display.account,display.party,display.category].join(' ').toLowerCase().includes(searchText);
 });
 const persist=rows=>{setManual(rows);saveManual(rows)};
 /* Ready import plans become Draft journals through the same store the create page writes to, so an
    import can never post to the ledger: every imported voucher lands in the register as a draft and
    follows the normal lifecycle from there. The line shape comes from emptyLine(), so an imported
    draft opens in the editor with the same organisation and branch context a typed line carries. */
 const importJournals=plans=>{const now=new Date().toISOString();const created=plans.map((plan,index)=>({...blank(),id:crypto.randomUUID(),number:'JV-2026-'+String(Date.now()+index).slice(-5),date:plan.date,type:plan.type,reference:plan.reference||'',narration:plan.narration||'',attachments:[],status:'Draft',createdBy:'Admin',createdAt:now,modifiedAt:now,lines:plan.lines.map(line=>({...emptyLine(),account:line.account,debit:line.debit,credit:line.credit,description:line.description||''}))}));persist([...created,...manual]);setImportOpen(false);notify('Imported '+created.length+' '+(created.length===1?'journal':'journals')+' as '+(created.length===1?'a draft':'drafts'))};
 const audited=(record,actionName,previousStatus,reason='')=>({...record,audit:[...(record.audit||[]),{id:crypto.randomUUID(),user:'Admin',at:new Date().toISOString(),action:actionName,oldValue:previousStatus||'',newValue:record.status,reason}]});
 const postToLedger=(record,source='Manual Journal',token='manual-journal:'+record.id)=>{const latest=readAccounts(seed),entry=journal(latest,{id:record.id,number:record.number,organizationId:record.organizationId||localStorage.getItem('wayvida-demo-company')||'abc',branchId:record.branchId||record.lines[0]?.branch,role:'Admin',periodModule:'Accounting'},source,record.lines.map(line=>({account:line.account,debit:amount(line.debit),credit:amount(line.credit),branch:record.branchId||line.branch,costCentre:line.costCentre,description:line.description})),record.date,token);writeAccounts(latest);setInvoicesState(latest);setAccountRevision(value=>value+1);return entry};
 const openCreate=()=>{setForm(null);setError('');setMode('create')};
 const openAdvanced=copy=>{setForm(copy?{...copy,id:crypto.randomUUID(),number:copy.number||'JV-2026-'+String(Date.now()).slice(-5),status:normaliseStatus(copy.status),createdAt:new Date().toISOString(),lines:(copy.lines||[]).map(line=>({...line,id:crypto.randomUUID()}))}:blank());setError('');setMode('advanced')};
 const openEdit=record=>{setForm(record);setDetail(null);setError('');setMode(record.simpleTransaction?'create':'advanced')};
 function validate(){const t=totals(form);if(!form.date||!form.narration.trim())return 'Date and notes are required.';if(form.date<'2026-04-01')return 'This accounting period is closed. Choose a date on or after 01 Apr 2026.';if(form.lines.some(l=>!l.account))return 'Select an account for every journal line.';if(form.lines.some(l=>amount(l.debit)&&amount(l.credit)))return 'A journal line cannot contain both debit and credit.';if(form.lines.some(l=>!amount(l.debit)&&!amount(l.credit)))return 'Enter a debit or credit amount for every journal line.';if(!t.debit||t.debit!==t.credit)return `Journal is not balanced. Difference ${money(Math.abs(t.debit-t.credit))}.`;const controlled=form.lines.find(l=>state.accounts.find(a=>a.code===l.account)?.controlAccount);if(controlled)return `${state.accounts.find(a=>a.code===controlled.account)?.name} is managed automatically by the system.`;return ''}
 function commit(targetStatus){const target=normaliseStatus(targetStatus),message=target==='Draft'?'':validate();if(message){setError(message);return}if(target==='Approved'&&!journalAllowed(role,'post')){setError('Your role cannot approve or post this journal. Ask an approver to take this step.');return}try{if(target==='Approved')assertOpenPeriod(form.date)}catch(error){setError(error.message);return}const now=new Date().toISOString(),base={...form,status:target,modifiedAt:now,...(target==='Pending Approval'?{submittedBy:'Admin',submittedAt:now}:{}),...(target==='Approved'?{publishedBy:'Admin',publishedAt:now,postedBy:'Admin',postedAt:now}:{})};try{const next=audited({...base,...(target==='Approved'?{ledgerJournalId:postToLedger(base).id}:{})},target,form.createdAt===form.modifiedAt?'Created':normaliseStatus(form.status));persist([next,...manual.filter(j=>j.id!==next.id)]);notify(target==='Approved'?'Journal published and posted to the ledger.':`Journal saved as ${target.toLowerCase()}.`);setMode('list')}catch(reason){setError(reason.message)}}
 /* One place decides every lifecycle step, so the register, the detail screen and
    the engines can never disagree about what a status means. */
 function action(j,next,payload={}){
  if(next==='Duplicate'){const copy=duplicateTransaction(j);copy.number=nextJournalNumber(manual,copy.date);setForm(copy);setDetail(null);setError('');setMode(j.simpleTransaction?'create':'advanced');return}
  if(j.automatic)return;
  const current=normaliseStatus(j.status);
  /* Approval is re-checked here rather than trusted from the row menu, so hiding
     a button can never be the only guard: the acting role must hold the duty, the
     status must still offer the step, and an entry that already owns a ledger
     posting is never posted a second time. */
  const duty=JOURNAL_ACTION_DUTY[next];
  if(!(JOURNAL_ACTIONS[current]||[]).includes(next)){setError(`${j.number} is ${current.toLowerCase()} and cannot be ${next.toLowerCase()}.`);return}
  if(duty&&!journalAllowed(role,duty)){setError(`Your role cannot ${DUTY_LABELS[duty]||duty} this journal. Ask an approver to take this step.`);return}
  if(next==='Approve'&&j.ledgerJournalId){setError('This journal already owns a ledger posting. Nothing was posted twice.');return}
  if(next==='Approve'&&postsToLedger(current)){setError('This journal is already approved and posted. Nothing was published twice.');return}
  try{if(next==='Approve')assertOpenPeriod(j.date);if(next==='Reverse')assertOpenPeriod(payload.date||new Date().toISOString().slice(0,10))}catch(error){setError(error.message);return}
  if(next==='Delete'){
   if(isReversalJournal(j)){const source=manual.find(x=>x.id===j.reversalOf);const restored=source?{...source,status:'Draft',reversalJournalId:null,reversedAt:null,reversedBy:null,reversalReason:null,modifiedAt:new Date().toISOString()}:null;const nextRows=manual.filter(x=>x.id!==j.id).map(x=>restored&&x.id===restored.id?restored:x);persist(nextRows);setDetail(restored||null);notify('Reversal journal deleted; source journal restored for editing');return}
   if(!['Draft','Rejected'].includes(current))return;
   persist(manual.filter(x=>x.id!==j.id));setDetail(null);notify('Draft transaction deleted');return;
  }
  if(next==='Reverse'){
   if(current!=='Approved'||!j.ledgerJournalId||j.reversalOf||j.reversalJournalId||String(j.reference||'').startsWith('Reversal of '))return;
   const stamp=new Date().toISOString(),base=reversalRecord(j,payload.date,payload.reason);
   try{const r=audited({...base,ledgerJournalId:postToLedger(base,'Journal Reversal','manual-reversal:'+j.id).id},'Reversed','Approved',payload.reason),original=audited({...j,status:'Reversed',reversalJournalId:r.id,reversedAt:stamp,reversedBy:'Admin',reversalReason:payload.reason},'Reversed','Approved',payload.reason),rows=[r,...manual.filter(x=>x.id!==j.id),original];persist(rows);setDetail(original);notify('Reversal journal posted')}catch(reason){setError(reason.message)}
   return;
  }
  const target=next==='Submit for Approval'||next==='Resubmit'?'Pending Approval':next==='Approve'?'Approved':next==='Reject'?'Rejected':next==='Cancel journal'?'Cancelled':next;
  if(!TRANSACTION_STATUSES.includes(target))return;
  if(target==='Rejected'&&!String(payload.reason||'').trim()){setError('Enter a reason for rejecting this transaction.');return}
   if(target==='Cancelled'&&!String(payload.reason||'').trim()){setError('Enter a reason for cancelling this journal.');return}
  try{
   const stamp=new Date().toISOString(),base={...j,status:target,...(target==='Pending Approval'?{submittedBy:'Admin',submittedAt:stamp}:{}),...(target==='Approved'?{publishedBy:'Admin',publishedAt:stamp,postedBy:'Admin',postedAt:stamp}:{}),...(target==='Rejected'?{rejectedBy:'Admin',rejectedAt:stamp,rejectionReason:payload.reason}:{}),...(target==='Cancelled'?{cancelledBy:'Admin',cancelledAt:stamp,cancellationReason:payload.reason}:{})};
   const updated=audited({...base,...(target==='Approved'?{ledgerJournalId:postToLedger(base,'Journal Transaction','journal-transaction:'+base.id).id}:{})},target,current,payload.reason||'');
   persist(manual.map(x=>x.id===j.id?updated:x));setDetail(detail&&detail.id===j.id?updated:detail);notify(target==='Approved'?'Journal published and posted to the ledger.':`Transaction ${target.toLowerCase()}`);
  }catch(reason){setError(reason.message)}
 }
 /* Simple transactions post through the ledger exactly as an advanced journal
    does; only a payment against an invoice or a bill is handed to that
    document's engine instead, because the engine owns the balance update. */
 function saveSimple({payload,target,document}){
  setError('');
  try{
   const organisations=getAccessibleOrganizations(),organisation=organisations.find(org=>org.id===payload.organizationId)||organisations[0],branch=organisation?.branches.find(item=>item.id===payload.branchId)||organisation?.branches[0];
   if(!organisation||!branch)throw Error('Choose an organisation and branch in the current switcher scope.');
   if(document){
    if(document.type==='Invoice'){
     const latest=readAccounts(seed),invoice=latest.invoices.find(item=>item.id===document.id);
     if(!invoice||invoice.customerId!==payload.simpleTransaction.partyId||!documentInScope(invoice,organisation,branch))throw Error('That invoice is not available for this customer and organisation.');
     const receipt=invoiceCommand(latest,'pay',{id:document.id,amount:payload.simpleTransaction.amount,date:payload.date,bank:payload.simpleTransaction.moneyAccount,reference:payload.simpleTransaction.externalReference||'',token:payload.id});
     writeAccounts(receipt.state);setInvoicesState(receipt.state);setAccountRevision(value=>value+1);
    }else{
     const latest=JSON.parse(localStorage.getItem('wayvida-purchase-bills-v1')||'{}'),bill=latest.purchaseBills?.find(item=>item.id===document.id);
     if(!bill||bill.vendorId!==payload.simpleTransaction.partyId||!documentInScope(bill,organisation,branch))throw Error('That bill is not available for this vendor and organisation.');
     const payment=recordPurchasePayment(latest,bill,{amount:payload.simpleTransaction.amount,date:payload.date,bankAccount:payload.simpleTransaction.moneyAccount,reference:payload.simpleTransaction.externalReference||'',periodOptions:{companyId:organisation.id,branchId:branch.id,module:'Purchases'}});
     localStorage.setItem('wayvida-purchase-bills-v1',JSON.stringify(payment.state));setBillsState(payment.state);
    }
    notify(document.type==='Invoice'?'Customer payment recorded. The invoice balance is updated.':'Vendor payment recorded. The bill balance is updated.');
    setForm(null);setMode('list');return;
   }
   const created=!manual.some(row=>row.id===payload.id),stamp=new Date().toISOString(),status=normaliseStatus(target);
   const base={...payload,number:payload.number||nextJournalNumber(manual,payload.date),status,modifiedAt:stamp,...(status==='Pending Approval'?{submittedBy:'Admin',submittedAt:stamp}:{}),...(status==='Approved'?{publishedBy:'Admin',publishedAt:stamp,postedBy:'Admin',postedAt:stamp}:{})};
   const updated=audited({...base,...(status==='Approved'?{ledgerJournalId:postToLedger(base,'Journal Transaction','journal-transaction:'+base.id).id}:{})},created?'Created':status,created?'':normaliseStatus(form?.status||'Draft'));
   persist([updated,...manual.filter(j=>j.id!==updated.id)]);
   notify(status==='Approved'?'Journal published and posted to the ledger.':`Transaction saved as ${status.toLowerCase()}.`);
   setForm(null);setMode('list');
  }catch(reason){setError(reason.message)}
 }
 if(mode==='create')return <SimpleTransactionForm key={form?.id||'new'} accounts={accounts} role={role} error={error} setError={setError} initial={form} invoicesState={invoicesState} billsState={billsState} onBack={()=>{setForm(null);setError('');setMode('list')}} onSave={saveSimple} onAdvanced={()=>{setForm(blank());setError('');setMode('advanced')}}/>;
   if(mode==='advanced')return <JournalForm form={form} setForm={setForm} accounts={accounts} error={error} setError={setError} totals={totals(form)} onBack={()=>{setForm(null);setError('');setMode('list')}} onSimple={()=>{setForm(null);setError('');setMode('create')}} onCommit={commit} onNavigate={onNavigate} editing={manual.some(j=>j.id===form.id)} viewMode={viewMode}/>;
 if(detail)return preview?<JournalPreview journal={preview} accounts={state.accounts} onClose={()=>setPreview(null)}/>:<JournalDetail journal={{...detail,status:normaliseStatus(detail.status),lines:(detail.lines||[]).map(line=>({...line,debit:amount(line.debit),credit:amount(line.credit)}))}} state={state} role={role} onBack={()=>setDetail(null)} onNavigate={onNavigate} onAction={(_journal,next,payload)=>action(detail,next,payload)} onPreview={()=>setPreview(detail)} onEdit={()=>openEdit(detail)} viewMode={viewMode}/>;
 return <><JournalRegister terms={terms} list={list} filtered={filtered} totals={totals} viewMode={viewMode} role={role} accounts={accounts} query={query} setQuery={setQuery} status={status} setStatus={setStatus} typeFilter={typeFilter} setTypeFilter={setTypeFilter} accountFilter={accountFilter} setAccountFilter={setAccountFilter} orgFilter={orgFilter} setOrgFilter={setOrgFilter} branchFilter={branchFilter} setBranchFilter={setBranchFilter} fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} typeOptions={typeOptions} accountOptions={accountOptions} organisationOptions={organisationOptions} branchOptions={branchOptions} onCreate={openCreate} onDetail={journal=>setDetail(list.find(row=>row.id===journal.id)||journal)} onEdit={openEdit} onAction={(journal,next,payload)=>action(list.find(row=>row.id===journal.id)||journal,next,payload)} onImport={()=>setImportOpen(true)}/>{importOpen&&<JournalImportDialog accounts={accounts} onClose={()=>setImportOpen(false)} onImport={importJournals}/>}</>;
}

function JournalForm({form,setForm,accounts,error,setError,totals,onBack,onSimple,onCommit,onNavigate,viewMode,editing}){
 const update=(id,key,value)=>{if(key==='account'&&value){recordRecentAccount(value);setHints(current=>current.length?[]:current)}setForm({...form,lines:form.lines.map(l=>l.id===id?{...l,[key]:value,...(key==='debit'&&value?{credit:''}:{}),...(key==='credit'&&value?{debit:''}:{})}:l)})};
 const difference=Math.abs(totals.debit-totals.credit),periodCheck=checkPeriod(form.date),missing=periodCheck.code==='PERIOD_NOT_CONFIGURED',typeField=viewMode==='business'?'Adjustment type':'Journal type',dateLocked=['PERIOD_HARD_LOCKED','PERIOD_APPROVAL_REQUIRED','PERIOD_CLOSING'].includes(periodCheck.code);
 const contextOrganizations=getAccessibleOrganizations();
 const branchNamesFor=organization=>getBranchesForOrganisation(organization,contextOrganizations).map(branch=>branch.name);
 /* Organisation and Branch belong to the journal, not to a line: every line is stamped from the header, which is what the register, the reports and Period Lock keep reading. */
 const alignLine=line=>({...line,organization:form.organization||contextOrganizations[0]?.name||'',branch:form.branch||''});
 useEffect(()=>{const aligned=form.lines.map(alignLine);if(aligned.some((line,index)=>line.organization!==form.lines[index].organization||line.branch!==form.lines[index].branch))setForm(current=>({...current,lines:current.lines.map(alignLine)}))});
 const [templateList,setTemplateList]=useState(allTemplates),[templateName,setTemplateName]=useState(''),[frequency,setFrequency]=useState('None'),[hints,setHints]=useState([]);
 const isBlankLine=line=>!line.account&&!line.debit&&!line.credit&&!line.description,emptyCount=form.lines.filter(isBlankLine).length;
 const checks=postingChecks({form,totals,accounts,difference,periodOk:periodCheck.allowed,periodDetail:missing?'Accounting period is not configured':'Posting is unavailable for this period'});
 const blocking=checks.find(check=>!check.ok);
 const canPost=difference===0&&totals.debit>0&&periodCheck.allowed;
 const typeOptions=CREATE_JOURNAL_TYPES.includes(form.type)?CREATE_JOURNAL_TYPES:[...CREATE_JOURNAL_TYPES,form.type];
 const applyTemplate=(template,event)=>{const resolved=resolveTemplate(template,accounts);event.currentTarget.closest('details')?.removeAttribute('open');setForm({...form,type:resolved.type||form.type,narration:form.narration||resolved.narration,lines:resolved.rows.map(row=>({...emptyLine(),account:row.account,debit:row.debit,credit:row.credit,description:row.description}))});setFrequency(resolved.frequency||'None');setHints(resolved.rows.map((row,index)=>row.unresolved?`Line ${index+1} needs an account before it can post.`:'').filter(Boolean));setError('')};
 const addLine=()=>{const next=[...form.lines,emptyLine()];setForm({...form,lines:next});requestAnimationFrame(()=>{const rows=document.querySelectorAll('.je-create .je-line:not(.head)');rows[rows.length-1]&&rows[rows.length-1].scrollIntoView({behavior:'smooth',block:'nearest'})})};
 const removeLine=id=>setForm({...form,lines:form.lines.filter(line=>line.id!==id)});
 const chooseScopeOrganization=name=>{const branches=branchNamesFor(name);setForm({...form,organization:name,branch:branches.length?branches[0]:''})};
 const removeEmptyLines=()=>{const kept=form.lines.filter(line=>!isBlankLine(line));while(kept.length<2)kept.push(emptyLine());setForm({...form,lines:kept});setHints([])};
 const saveAsTemplate=()=>{if(!templateName.trim())return;setTemplateList(saveCustomTemplate({name:templateName.trim(),type:form.type,narration:form.narration,frequency,lines:form.lines}));setTemplateName('');setError('')};
 const submit=targetStatus=>{setError('');onCommit(targetStatus)};
 return <section className="je-create je-create-compact">
 <div className="rt-header">
  <button className="rt-back" type="button" onClick={onBack} aria-label={viewMode==='business'?'Back to Financial Adjustments':'Back to journal entries'}><IconArrowLeft size={19}/></button>
  <h1>{viewMode==='business'?JOURNAL_VIEW_LABELS.business.newEntry:'Create Journal Entry'}{editing&&<small className="je-header-hint">Editing {form.number}</small>}</h1>
  <ModeToggle mode="advanced" onSimple={onSimple}/>
  <Status value={statusText(form.status,viewMode==='business')}/>
 </div>
 <div className="je-form-card">
  <div className="je-form-grid">
   <label>Organisation *<select value={form.organization||''} onChange={event=>chooseScopeOrganization(event.target.value)}>{contextOrganizations.map(row=><option key={row.id} value={row.name}>{row.name}</option>)}</select></label>
   <label>Branch *<select value={form.branch||''} onChange={event=>setForm({...form,branch:event.target.value})}>{branchNamesFor(form.organization).map(name=><option key={name} value={name}>{name}</option>)}</select></label>
   <label className="je-date-field">Date *<input type="date" value={form.date} onChange={event=>setForm({...form,date:event.target.value})}/><small className={dateLocked?'je-date-locked':''}>{dateLocked?<><IconLock size={12}/>{periodName(form.date)} is locked · posting unavailable{periodCheck.lock?<b>{periodCheck.lock.name}</b>:null}{onNavigate&&<button type="button" className="je-inline-action" onClick={()=>onNavigate('Period Lock')}>Request unlock</button>}</>:<>Accounting period: <strong>{periodName(form.date)}</strong></>}</small></label>
   <label>{typeField} *<select value={form.type} onChange={event=>setForm({...form,type:event.target.value})}>{typeOptions.map(value=><option key={value} value={value}>{viewMode==='business'?typeLabel(value,viewMode):value}</option>)}</select></label>
   <label>Reference number <span className="je-optional">Optional</span><input value={form.reference} onChange={event=>setForm({...form,reference:event.target.value})} placeholder="Add an external reference"/></label>
   <label>Reason *<input type="text" value={form.narration} onChange={event=>setForm({...form,narration:event.target.value})} placeholder={viewMode==='business'?'Example: Corrected wrong expense category':'Explain why this entry is created'}/></label>
  </div>
 </div>
 <div className="je-lines-card">
  <div className="je-lines-title">
   <div><h3>{viewMode==='business'?'Transaction Details':'Journal lines'}</h3><p>Enter one debit or credit per line. Totals must match before posting. Posting to <b>{form.organization||contextOrganizations[0]?.name||'—'}</b>{form.branch&&<> · <b>{form.branch}</b></>}.</p></div>
   <div className="je-lines-actions">
    <details className="je-template-menu"><summary><IconTemplate size={16}/>Use Template</summary><div><p>Start from a saved pattern, then adjust the amounts.</p>{templateList.map(template=><button type="button" key={template.id} onClick={event=>applyTemplate(template,event)}><b>{template.name}</b><small>{(viewMode==='business'?typeLabel(template.type,viewMode):template.type)||'General Journal'}{template.frequency&&template.frequency!=='None'?' · '+template.frequency:''}</small></button>)}<div className="je-template-save"><input value={templateName} onChange={event=>setTemplateName(event.target.value)} placeholder="Template name" aria-label="Template name"/><select value={frequency} onChange={event=>setFrequency(event.target.value)} aria-label="Repeat this entry">{RECURRENCE_OPTIONS.map(option=><option key={option} value={option}>{option}</option>)}</select><button type="button" onClick={saveAsTemplate}>Save template</button></div><small className="je-template-note">Templates and their repeat setting are stored separately from journal entries.</small></div></details>
   <button type="button" className="je-add-line" onClick={addLine}><IconPlus size={16}/>Add Journal Line</button>
   </div>
  </div>
  <div className="je-lines">
   <div className="je-line head"><span>Account *</span><span className="je-head-amount">Debit (₹)</span><span className="je-head-amount">Credit (₹)</span><span>Description</span><span/></div>
   {form.lines.map((line,index)=><div className="je-line" key={line.id}>
    <div className="je-cell" data-label="Account"><JournalAccountPicker value={line.account} accounts={accounts} onChange={code=>update(line.id,'account',code)}/></div>
    <div className="je-cell je-cell-amount" data-label={'Debit (₹)'}><input aria-label={`Debit amount for line ${index+1}`} type="number" min="0" step="0.01" value={line.debit} disabled={Boolean(line.credit)} onChange={event=>update(line.id,'debit',event.target.value)} placeholder="0.00"/></div>
    <div className="je-cell je-cell-amount" data-label={'Credit (₹)'}><input aria-label={`Credit amount for line ${index+1}`} type="number" min="0" step="0.01" value={line.credit} disabled={Boolean(line.debit)} onChange={event=>update(line.id,'credit',event.target.value)} placeholder="0.00"/></div>
    <div className="je-cell" data-label="Description"><input aria-label={`Description for line ${index+1}`} value={line.description} onChange={event=>update(line.id,'description',event.target.value)} placeholder="Line description"/></div>
    <div className="je-cell je-cell-action"><button type="button" className="je-line-remove" disabled={form.lines.length<=2} title={form.lines.length<=2?'A journal needs at least two lines':''} aria-label={`Remove line ${index+1}`} onClick={()=>removeLine(line.id)}><IconTrash size={16}/></button></div>
   </div>)}
  </div>
  {hints.length>0&&<ul className="je-template-hints">{hints.map(hint=><li key={hint}><IconAlertTriangle size={14}/>{hint}</li>)}</ul>}
  <div className="je-lines-footer">
   <div className="je-attachments">
    <label className="je-attach-button"><input type="file" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={async event=>{setForm({...form,attachments:await readAttachments(event.target.files)});event.target.value=''}}/><IconPaperclip size={16}/>Attach files</label>
    <small className="je-attach-note">PDF, images, Word or Excel files</small>
    {form.attachments.length>0&&<div className="je-selected-files">{form.attachments.map((file,index)=>{const fileName=typeof file==='string'?file:file.name||`Attachment ${index+1}`;return <span key={`${fileName}-${index}`}>{fileName}<button type="button" aria-label={`Remove ${fileName}`} onClick={()=>setForm({...form,attachments:form.attachments.filter((_,position)=>position!==index)})}>×</button></span>})}</div>}
   </div>
   {emptyCount>0&&form.lines.length>2&&<button type="button" className="je-clear-empty" onClick={removeEmptyLines}>Remove {emptyCount} empty {emptyCount===1?'line':'lines'}</button>}
   <div className="je-balance">
   <div className="je-balance-totals">
    <span>Total Debit</span><b>{money(totals.debit)}</b><span>Total Credit</span><b>{money(totals.credit)}</b>
   </div>
   <p className={'je-balance-status '+(!difference&&totals.debit?'ok':'bad')} role="status" title={blocking?blocking.detail:'Debit equals credit'}>{!difference&&totals.debit?<><IconCheck size={16}/>Debit equals credit</>:<><IconAlertTriangle size={16}/>Difference: {money(difference)}</>}</p>
  </div>
  </div>
  {error&&<div className="je-error"><IconAlertTriangle size={18}/>{error}</div>}
 </div>
  {form.audit&&form.audit.some(entry=>entry.reason)&&<details className="je-details">
   <summary><span>Additional details</span><small>{form.audit.filter(entry=>entry.reason).length} approval comment{form.audit.filter(entry=>entry.reason).length===1?'':'s'}</small><IconChevronDown size={16}/></summary>
   <div className="je-details-body">
    <div className="je-details-field"><span>Approval comments</span><ul className="je-approval-comments">{form.audit.filter(entry=>entry.reason).map(entry=><li key={entry.id}><b>{entry.action}</b> · {entry.user} · {new Date(entry.at).toLocaleString()}<small>{entry.reason}</small></li>)}</ul></div>
   </div>
  </details>}
 <footer>
  {<button type="button" onClick={onBack}>Cancel</button>}
{form.status==='Draft'&&<button type="button" onClick={()=>submit('Draft')}>{viewMode==='business'?'Save':'Save draft'}</button>}
  {form.status==='Pending Approval'&&<button type="button" onClick={()=>submit('Pending Approval')}>Save changes</button>}
  {form.status==='Approved'&&<button type="button" onClick={()=>submit('Approved')}>Save changes</button>}
  <button className="primary" disabled={!canPost} title={canPost?'':'Complete the journal before posting'} onClick={()=>submit('Posted')}>{viewMode==='business'?'Post adjustment':'Post journal'}</button>
 </footer>
</section>;
}

function JournalDetail({journal,state,role='Admin',onBack,onNavigate,onAction,onPreview,onEdit,viewMode}){const [reverseOpen,setReverseOpen]=useState(false),[rejectOpen,setRejectOpen]=useState(false),[shareMessage,setShareMessage]=useState(''),[rejectReason,setRejectReason]=useState(''),[reverseReason,setReverseReason]=useState(''),[reverseDate,setReverseDate]=useState(new Date().toISOString().slice(0,10)),actions=actionEntries(journal,role,16),canDo=name=>actions.find(entry=>entry.action===name)||null,lines=journal.lines||[],debit=lines.reduce((n,l)=>n+(l.debit||0),0),credit=lines.reduce((n,l)=>n+(l.credit||0),0),download=()=>{const quote=value=>`"${String(value??'').replaceAll('"','""')}"`,rows=[['Journal number',journal.number],['Date',journal.date],['Type',journal.type],['Status',journal.status],['Reference',journal.reference||''],['Notes',journal.narration||''],[],['Account','Description','Branch','Cost centre','Debit','Credit'],...lines.map(line=>[state.accounts.find(account=>account.code===line.account)?.name||line.account,line.description||'',line.branch||'',line.costCentre||'',(line.debit||0)/100,(line.credit||0)/100]),[],['Total','','','',debit/100,credit/100]],url=URL.createObjectURL(new Blob([rows.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download=`${journal.number}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)},share=async()=>{const text=`Wayvida Books — Journal ${journal.number}\nDate: ${fmtDate(journal.date)}\nType: ${journal.type}\nStatus: ${journal.status}\nDebit: ${money(debit)}\nCredit: ${money(credit)}`;try{if(navigator.share)await navigator.share({title:journal.number,text});else{await navigator.clipboard.writeText(text);setShareMessage('Journal summary copied for sharing.')}}catch(error){if(error.name!=='AbortError')setShareMessage('Sharing is unavailable on this device.')}};return <section className="je-detail"><header><button onClick={onBack} aria-label={viewMode==='business'?'Back to Financial Adjustments':'Back to Journal Entries'} title={viewMode==='business'?'Back to Financial Adjustments':'Back to Journal Entries'}><IconArrowLeft size={19}/></button><div><h2>{journal.number}</h2><p>{viewMode==='business'?typeLabel(journal.type,'business'):journal.type} · {fmtDate(journal.date)}</p></div><div className="je-detail-actions"><div className="je-document-actions"><button onClick={onPreview} title="Preview transaction"><IconEye size={16}/><span>Preview</span></button></div>{canDo('Edit')&&<button className="je-secondary-action" onClick={()=>onEdit(journal)}>Edit draft</button>}{canDo('Submit for Approval')&&<button className="je-primary-action" onClick={()=>onAction(journal,'Submit for Approval')}>Submit for approval</button>}{canDo('Resubmit')&&<button className="je-primary-action" onClick={()=>onAction(journal,'Resubmit')}>Resubmit</button>}{canDo('Approve')&&<button className="je-primary-action" onClick={()=>onAction(journal,'Approve')}>Publish journal</button>}{canDo('Reject')&&<button className="je-danger-action" onClick={()=>setRejectOpen(true)}>Reject</button>}{canDo('Reverse')&&<button className="je-danger-action" onClick={()=>setReverseOpen(true)}>Reverse journal</button>}<details className="je-detail-more"><summary aria-label="More journal actions"><IconDots size={17}/></summary><div>{canDo('Duplicate')&&<button onClick={()=>onAction(journal,'Duplicate')}><IconCopy size={16}/>Duplicate</button>}{canDo('Delete')&&<button className="je-row-danger" onClick={()=>onAction(journal,'Delete')}><IconTrash size={16}/>{isReversalJournal(journal)?'Delete reversal':'Delete draft'}</button>}</div></details></div><Status value={statusText(journal.status,viewMode==='business')}/></header>{normaliseStatus(journal.status)==='Pending Approval'&&!journalAllowed(role,'post')&&<p className="je-permission-note"><IconLock size={14}/>Only an approver can publish this journal. Switch the View as control to Business owner to approve it.</p>}{shareMessage&&<div className="je-share-message" role="status">{shareMessage}</div>}<div className="je-detail-single"><div className="je-detail-main"><section className="je-detail-facts"><h3>{viewMode==='business'?'Summary':'Journal details'}</h3>{(()=>{const display=journalRegisterDisplay(journal,state.accounts),rows=journal.simpleTransaction?[['Transaction Type',display.type,IconArrowsExchange],['Transaction Name',display.name,IconFileText],['Date',fmtDate(journal.date),IconCalendar],['Pay From',display.account,IconBuildingBank],['Category',display.category,IconTag],['Amount',money(journalRecordAmount(journal)),IconCurrencyRupee],['Organisation',journalOrg(journal),IconBuilding],['Branch',journalBranch(journal),IconSitemap]]:[[viewMode==='business'?'Reference number':'Journal number',journal.number,IconBook],['Date',fmtDate(journal.date),IconCalendar],[viewMode==='business'?'Adjustment type':'Entry type',viewMode==='business'?typeLabel(journal.type,'business'):journal.type,IconTemplate]];return <dl>{rows.map(([label,value,Icon])=><div key={label}><dt>{Icon&&<Icon size={15} stroke={1.8} aria-hidden="true"/>}{label}</dt><dd>{value||'—'}</dd></div>)}{!journal.simpleTransaction&&<div><dt>Reference</dt><dd>{journal.reference||'—'}</dd></div>}<div className="wide"><dt>{viewMode==='business'?'Reason':'Description'}</dt><dd>{journal.narration||journal.source||'System-generated accounting entry'}</dd></div><div><dt>Created by</dt><dd>{journal.createdBy}</dd></div></dl>})()}<section className="je-detail-docs"><h3>{viewMode==='business'?'Documents':'Supporting Documents'}</h3><div className="je-supporting-documents">{journal.automatic&&<div className="je-source"><IconFileInvoice/><div><b>Source transaction</b><p>{journal.source} · {journal.reference||journal.number}</p></div><button onClick={()=>onNavigate(journal.invoiceId?'Invoices':journal.creditNoteId?'Credit Notes':'Day Book')}>Open source</button></div>}{journal.attachments?.length?<div className="je-attachment-list"><header><div><h3>Uploaded attachments</h3><p>{journal.attachments.length} {journal.attachments.length===1?'document':'documents'} linked to this journal.</p></div></header>{journal.attachments.map((file,index)=>{const name=typeof file==='string'?file:file.name||`Attachment ${index+1}`,href=typeof file==='object'?file.data:null;return <div className="je-attachment-row" key={name+'-'+index}><span><IconPaperclip size={17}/></span><div><b>{name}</b><small>Supporting document</small></div>{href?<div className="je-attachment-actions"><a href={href} target="_blank" rel="noreferrer"><IconEye size={15}/>View</a><a href={href} download={name}><IconDownload size={15}/>Download</a></div>:<div className="je-attachment-actions"><button type="button" disabled title="This older attachment has no stored file data."><IconEye size={15}/>View</button><button type="button" disabled title="This older attachment has no stored file data."><IconDownload size={15}/>Download</button></div>}</div>})}</div>:!journal.automatic&&<p className="je-docs-empty"><IconPaperclip size={14}/>No documents attached yet. Attachments uploaded with this journal will appear here.</p>}</div></section></section><details className="je-impact"><summary><span>View {viewMode==='business'?'Transaction Impact':'Accounting Impact'}</span><IconChevronDown size={17}/></summary><div className="je-impact-body"><table><thead><tr><th>Account</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{lines.map((l,i)=><tr key={i}><td>{state.accounts.find(a=>a.code===l.account)?.name||l.account}</td><td>{l.debit?money(l.debit):'—'}</td><td>{l.credit?money(l.credit):'—'}</td></tr>)}<tr><th>Total</th><th>{money(debit)}</th><th>{money(credit)}</th></tr></tbody></table></div></details></div><div className="je-detail-audit"><h3>{viewMode==='business'?'History':'Audit Trail'}</h3><div className="je-timeline-panel">{(()=>{const timeline=journalTimeline(journal);return timeline.length?<ol className="je-timeline">{timeline.map(entry=><li key={entry.key} className={'is-'+entry.kind}><TimelineMark kind={entry.kind}/><div className="je-timeline-body"><p><b className="je-timeline-actor">{entry.actor}</b> {entry.from&&entry.to?<>changed the status from <StatusBadge value={entry.from}/> to <StatusBadge value={entry.to}/></>:entry.text}</p>{entry.note&&<p className="je-timeline-note">{entry.note}</p>}<time dateTime={entry.at||undefined}>{entry.when}</time></div></li>)}</ol>:<p className="je-timeline-empty">No activity recorded yet.</p>})()}</div></div></div>{rejectOpen&&<div className="je-reverse-overlay" onMouseDown={event=>event.target===event.currentTarget&&setRejectOpen(false)}><form className="je-reverse-dialog" onSubmit={event=>{event.preventDefault();onAction(journal,'Reject',{reason:rejectReason});setRejectOpen(false)}} role="dialog" aria-modal="true" aria-labelledby="reject-journal-title"><h2 id="reject-journal-title">Reject {journal.number}?</h2><p>The transaction returns to the operator as Rejected with your reason. Nothing is posted to the ledger.</p><label>Reason for rejection<input required value={rejectReason} onChange={event=>setRejectReason(event.target.value)} placeholder="Explain what needs to change"/></label><footer><button type="button" onClick={()=>setRejectOpen(false)}>Go back</button><button className="danger" type="submit">Reject transaction</button></footer></form></div>}{reverseOpen&&<div className="je-reverse-overlay" onMouseDown={event=>event.target===event.currentTarget&&setReverseOpen(false)}><form className="je-reverse-dialog" onSubmit={event=>{event.preventDefault();onAction(journal,'Reverse',{date:reverseDate,reason:reverseReason});setReverseOpen(false)}} role="dialog" aria-modal="true" aria-labelledby="reverse-journal-title"><h2 id="reverse-journal-title">Reverse {journal.number}?</h2><p>This posts an equal and opposite correction entry. The original journal remains in the audit trail and cannot be reversed again.</p><label>Reversal date<input required type="date" min={journal.date} value={reverseDate} onChange={event=>setReverseDate(event.target.value)}/></label><label>Reason<input required value={reverseReason} onChange={event=>setReverseReason(event.target.value)} placeholder="Explain why this journal is being reversed"/></label><footer><button type="button" onClick={()=>setReverseOpen(false)}>Go back</button><button className="danger" type="submit">Post reversal</button></footer></form></div>}</section>}

const businessTypes=[['Correction Entry','Correction'],['Adjustment Journal','Adjustment'],['Transfer Journal','Transfer'],['Opening Balance','Opening Balance'],['General Journal','Other change']];

function BusinessJournalRegister({list,filtered,totals,query,setQuery,status,setStatus,creator,setCreator,onCreate,onDetail,onEdit}){const creators=['All creators',...new Set(list.map(j=>j.createdBy).filter(Boolean))];return <section className="je-page je-business"><div className="je-heading"><div><h2>{JOURNAL_VIEW_LABELS.business.title} <span className="je-heading-count">({list.length})</span></h2><p>{JOURNAL_VIEW_LABELS.business.subtitle}</p></div><div className="je-create-callout"><button className="primary" onClick={onCreate}><IconPlus size={17}/>{JOURNAL_VIEW_LABELS.business.create}</button></div></div><div className="je-card unified"><div className="je-tools"><label><IconSearch size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search reference or reason…"/></label><select aria-label="Adjustment status" value={status} onChange={e=>setStatus(e.target.value)}>{['All statuses','Draft','Pending Approval','Approved','Rejected','Posted','Reversed'].map(x=><option key={x} value={x}>{statusText(x,true)}</option>)}</select><details className="je-filters"><summary><IconFilter size={17}/>Filters</summary><div><label>Created by<select value={creator} onChange={e=>setCreator(e.target.value)}>{creators.map(value=><option key={value}>{value}</option>)}</select></label><button type="button" onClick={()=>setCreator('All creators')}>Clear filters</button></div></details></div><div className="je-table-wrap"><table><thead><tr>{['Reference','Date','Reason','Amount','Status','Created by','Actions'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{filtered.map(j=>{const total=totals(j);return <tr key={j.id}><td><button className="je-link" onClick={()=>onDetail(j)}>{j.reference||j.number}</button></td><td>{fmtDate(j.date)}</td><td>{j.narration||typeLabel(j.type,'business')}</td><td>{money(Math.max(total.debit,total.credit))}</td><td><Status value={statusText(j.status,true)}/></td><td>{j.createdBy}</td><td><div className="je-row-actions">{j.status==='Draft'&&<button className="je-edit-journal" onClick={()=>onEdit(j)}><IconEdit size={15}/>Edit</button>}<button onClick={()=>onDetail(j)} aria-label={`View ${j.number}`}><IconEye size={17}/></button></div></td></tr>})}{!filtered.length&&<tr className="emptyStateRow"><td colSpan={7} className="emptyStateCell"><EmptyState variant="journal" title="No adjustments found" description="Adjust the filters or create a financial adjustment." actionLabel={JOURNAL_VIEW_LABELS.business.create} onAction={onCreate}/></td></tr>}</tbody></table></div></div></section>}

function BusinessJournalForm({form,setForm,accounts,error,setError,totals,onBack,onCommit}){const update=(id,key,value)=>setForm({...form,lines:form.lines.map(line=>line.id===id?{...line,[key]:value}:line)}),setAmount=(id,value,direction)=>setForm({...form,lines:form.lines.map(line=>line.id===id?{...line,debit:direction==='increase'?value:'',credit:direction==='decrease'?value:''}:line)}),difference=Math.abs(totals.debit-totals.credit);return <section className="je-create je-business"><header><button onClick={onBack} aria-label="Back to Financial Adjustments"><IconArrowLeft size={19}/></button><div><h2>{form.status==='Draft'?JOURNAL_VIEW_LABELS.business.newEntry:form.reference||form.number}</h2><p>Record corrections or special financial changes.</p></div><Status value={statusText(form.status,true)}/></header><div className="je-form-card"><h3>Adjustment Details</h3><div className="je-form-grid"><div className="je-journal-number"><span>Reference number</span><strong>{form.number}</strong><small>Generated automatically</small></div><label className="je-date-field">Date *<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/><small>Financial period: <strong>{periodName(form.date)}</strong></small></label><label>Adjustment type *<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{businessTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>External reference <span className="je-optional">Optional</span><input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} placeholder="Add a reference"/></label><label className="wide je-notes">Why are you making this change? *<textarea value={form.narration} onChange={e=>setForm({...form,narration:e.target.value})} placeholder="Example: Corrected wrong expense category"/></label></div></div><div className="je-lines-card"><div className="je-lines-title"><div><h3>Transaction Details</h3><p>Add the accounts affected by this financial change.</p></div><button onClick={()=>setForm({...form,lines:[...form.lines,emptyLine()]})}><IconPlus size={16}/>Add transaction</button></div><div className="je-business-lines"><div className="head"><span>Account *</span><span>Amount (₹)</span><span>How it changes</span><span>Branch</span><span>Description</span><span/></div>{form.lines.map(line=>{const direction=line.debit?'increase':'decrease',value=line.debit||line.credit||'';return <div key={line.id}><select aria-label="Select account" value={line.account} onChange={e=>update(line.id,'account',e.target.value)}><option value="">Select account</option>{accounts.map(account=><option key={account.code} value={account.code}>{account.name}</option>)}</select><input aria-label="Amount" type="number" min="0" step="0.01" value={value} onChange={e=>setAmount(line.id,e.target.value,direction)} placeholder="0.00"/><select aria-label="How this account changes" value={direction} onChange={e=>setAmount(line.id,value,e.target.value)}><option value="increase">Increase</option><option value="decrease">Decrease</option></select><select value={line.branch} onChange={e=>update(line.id,'branch',e.target.value)}><option>Kochi Branch</option><option>Bengaluru Branch</option></select><input value={line.description} onChange={e=>update(line.id,'description',e.target.value)} placeholder="Description"/><button disabled={form.lines.length<=2} onClick={()=>setForm({...form,lines:form.lines.filter(x=>x.id!==line.id)})}><IconTrash size={16}/></button></div>})}</div><div className="je-business-balance"><span>Total amount</span><b>{money(Math.max(totals.debit,totals.credit))}</b>{difference>0&&<strong>Amounts must balance before review.</strong>}</div>{error&&<div className="je-error"><IconAlertTriangle size={18}/>{error}</div>}</div><footer><button onClick={onBack}>Cancel</button><button onClick={()=>{setError('');onCommit('Draft')}}>Save</button><button className="primary" onClick={()=>onCommit('Pending Approval')}>Send for Review</button></footer></section>}

function BusinessJournalDetail({journal,state,onBack,onEdit}){const [tab,setTab]=useState('Summary'),lines=journal.lines||[],total=Math.max(lines.reduce((sum,line)=>sum+(line.debit||0),0),lines.reduce((sum,line)=>sum+(line.credit||0),0));return <section className="je-detail je-business"><header><button onClick={onBack} aria-label="Back to Financial Adjustments"><IconArrowLeft size={19}/></button><div><h2>{journal.reference||journal.number}</h2><p>{fmtDate(journal.date)}</p></div>{journal.status==='Draft'&&<button className="je-secondary-action" onClick={()=>onEdit(journal)}>Edit</button>}<Status value={statusText(journal.status,true)}/></header><div className="je-detail-tabs">{['Summary','Documents','History'].map(name=><button key={name} className={tab===name?'active':''} onClick={()=>setTab(name)}>{name}</button>)}</div><div className="je-detail-card">{tab==='Summary'&&<dl><div><dt>Reason</dt><dd>{journal.narration||'Not provided'}</dd></div><div><dt>Amount</dt><dd>{money(total)}</dd></div><div><dt>Date</dt><dd>{fmtDate(journal.date)}</dd></div><div><dt>Status</dt><dd><Status value={statusText(journal.status,true)}/></dd></div><div className="wide"><dt>Accounts affected</dt><dd>{lines.map(line=>state.accounts.find(account=>account.code===line.account)?.name||line.account).join(', ')}</dd></div></dl>}{tab==='Documents'&&<div className="je-supporting-documents">{journal.attachments?.length?journal.attachments.map((file,index)=><div className="je-attachment-row" key={index}><IconPaperclip size={17}/><b>{typeof file==='string'?file:file.name||`Document ${index+1}`}</b></div>):<div className="je-empty"><IconPaperclip/><h3>No documents attached</h3><p>Documents added to this adjustment will appear here.</p></div>}</div>}{tab==='History'&&<div className="je-audit">{journal.audit?.length?journal.audit.map(event=><p key={event.id}><IconHistory/><span><b>{event.action}</b> by {event.user} · {new Date(event.at).toLocaleString()}</span></p>):<p><IconHistory/>Created by {journal.createdBy} · {new Date(journal.createdAt||Date.now()).toLocaleString()}</p>}</div>}</div></section>}







