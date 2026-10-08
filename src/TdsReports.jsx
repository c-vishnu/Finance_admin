import {useDeferredValue,useEffect,useMemo,useState} from 'react';
import {IconAdjustments,IconAlertTriangle,IconFileSpreadsheet,IconFileTypePdf,IconRefresh,IconSearch} from '@tabler/icons-react';
import {readAccounts} from './account-store.js';
import {readVendors} from './vendor-store.js';
import {money} from './invoice-engine.js';
import {getAccessibleOrganizations,getCurrentOrganizationContext} from './organisation-context.js';
import {ALL,DASH,collectTdsDocuments,filterTdsRows,summarizeTds,tableExport,tdsBySection,tdsByVendor,tdsOptions,tdsReconciliation,tdsRowBalance} from './tax-compliance.js';
import {downloadReport,excelReport} from './daybook-export.js';
import EmptyState from './EmptyState.jsx';
import StatusPill from './StatusPill.jsx';
import './tax-compliance.css';
import {DateRangeSelect,ReportExportMenu} from './ReportToolbar.jsx';

/* The one date formatter the Wayvida registers share, so a TDS date reads exactly as a Transaction
   Register or Payables date reads. */
const dateText=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):DASH;
const rateText=value=>value?value+'%':DASH;

/* The two words this report can honestly derive, each on the shared status pill. The word is always
   printed beside the tone, so a state is readable without relying on its colour. */
const STATUS_TONES={Deducted:'ok',Pending:'warn'};

/* The three views, and only three: the withholding register, the documents whose withholding has been
   taken, and the balance still to be deposited. Vendor and section are a grouping of the register, so
   neither ever becomes a tab of its own or a sidebar entry. */
const TABS=[
 {key:'summary',label:'TDS Summary',note:'Tax deducted from applicable payments to vendors or other payees.'},
 {key:'deducted',label:'TDS Deducted',note:'Every applicable document whose withholding the ledger has already taken.'},
 {key:'payable',label:'TDS Payable',note:'The withholding still to be deposited, and the balance each document owes.'}
];
const PAGED=['summary','deducted','payable'];

/* The one grouping control, offered on the Summary register alone. */
const GROUPINGS=[{key:'none',label:'None'},{key:'vendor',label:'Vendor'},{key:'section',label:'TDS Section'}];

const blankFilters=()=>({from:'',to:'',branch:ALL,vendor:ALL,pan:ALL,section:ALL,rate:ALL,status:ALL});

/* The TDS Reports workspace. It reads the posted purchase bills the Purchases module already wrote and
   the TDS section and rate each vendor already carries, and states the withholding those two facts
   imply. It is read-only, and it says on the page that no challan or deposit is recorded yet, because
   none is: nothing here is presented as a statutory filing. */
export default function TdsReports({onNavigate=()=>{}}){
 const [revision,setRevision]=useState(0),[filters,setFilters]=useState(blankFilters),[search,setSearch]=useState(''),[filtersOpen,setFiltersOpen]=useState(false),[stamp,setStamp]=useState(()=>new Date()),[tab,setTab]=useState('summary'),[groupBy,setGroupBy]=useState('none'),[perPage,setPerPage]=useState(25),[page,setPage]=useState(1);
 const deferredSearch=useDeferredValue(search),busy=deferredSearch!==search;
 const organisation=getCurrentOrganizationContext().company;

 const refresh=()=>setRevision(value=>value+1);
 useEffect(()=>{window.addEventListener('wayvida-accounts-updated',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('wayvida-accounts-updated',refresh);window.removeEventListener('storage',refresh)}},[]);

 /* The book and the vendor master, read together so one revision states them consistently. */
 const {rows,error}=useMemo(()=>{
  try{
   return {rows:collectTdsDocuments({book:readAccounts(),vendors:readVendors()}),error:''};
  }catch(reason){
   return {rows:[],error:reason.message};
  }
 },[revision]);

 const visible=useMemo(()=>{
  try{return filterTdsRows(rows,{...filters,search:deferredSearch})}
  catch{return []}
 },[rows,filters,deferredSearch]);
 const summary=useMemo(()=>summarizeTds(visible),[visible]);
 const reconciliation=useMemo(()=>tdsReconciliation(visible),[visible]);
 const options=useMemo(()=>tdsOptions(rows),[rows]);
 const branches=useMemo(()=>[...new Set([...getAccessibleOrganizations().flatMap(item=>(item.branches||[]).map(branch=>branch.name)),...options.branches])].filter(Boolean).sort(),[options]);

 /* The rows under the active tab. Deducted is the documents the ledger has settled, because that is
    when the withholding is taken; Payable is the documents with a balance left, which is exactly why a
    fully paid document never reaches the outstanding table or its total. */
 const tableRows=useMemo(()=>{
  if(tab==='deducted')return visible.filter(row=>row.settled);
  if(tab==='payable')return visible.filter(row=>tdsRowBalance(row).balance>0);
  return visible;
 },[tab,visible]);

 /* Regrouping the Summary register. The groups come from the same shared builders the removed
    standalone views used, and the documents beneath each heading are the very rows the flat table
    shows - the accounting data is untouched, only the order it is read in changes. */
 const regrouped=useMemo(()=>{
  if(tab!=='summary'||groupBy==='none')return null;
  const groups=groupBy==='vendor'?tdsByVendor(visible):tdsBySection(visible);
  return groups.map(group=>{
   const key=groupBy==='vendor'?group.vendor:group.section;
   return {key,group,rows:visible.filter(row=>(groupBy==='vendor'?(row.vendor||DASH):(row.section||DASH))===key)};
  });
 },[tab,groupBy,visible]);
 const grouped=!!regrouped;

 /* One comfortable page of rows rather than one very long table, exactly as the Transaction Register
    and the purchase register count theirs. A grouped register states every group in one view, so the
    headings and their totals are never split across pages. */
 const paged=PAGED.includes(tab)&&!grouped;
 const pageCount=Math.max(1,Math.ceil(tableRows.length/perPage)),pageIndex=Math.min(page,pageCount);
 const startIndex=(pageIndex-1)*perPage,firstRow=tableRows.length?startIndex+1:0,lastRow=Math.min(startIndex+perPage,tableRows.length);
 useEffect(()=>{setPage(1)},[deferredSearch,filters,tab,perPage,groupBy]);

 const activeFilters=Object.entries(filters).filter(([,value])=>value&&value!==ALL).length;
 const set=(key,value)=>setFilters(current=>({...current,[key]:value}));
 const clear=()=>{setFilters(blankFilters());setSearch('');setPage(1)};
 const tabNote=(TABS.find(entry=>entry.key===tab)||{}).note||'';
 const groupName=()=>(GROUPINGS.find(entry=>entry.key===groupBy)||{}).label||'None';

 /* Opening a document hands off to the Purchases module through the same handshake the Transaction
    Register uses, and opening a payee hands off to the Vendors module through the handshake the
    Supplier Outstanding report uses, so one record never opens in two different places. */
 function open(entry){
  try{if(entry.handshake&&entry.recordId)sessionStorage.setItem(entry.handshake,entry.recordId)}catch{}
  if(entry.page)onNavigate(entry.page);
 }
 function openVendor(row){
  try{if(row.vendorId)sessionStorage.setItem('wayvida-open-vendor',row.vendorId)}catch{}
  onNavigate('Vendors');
 }

 const appliedFilters=()=>{
  const base={Branch:filters.branch,Vendor:filters.vendor,PAN:filters.pan,Section:filters.section,Rate:filters.rate,Status:filters.status,Search:search};
  return tab==='summary'&&grouped?{...base,Grouping:groupName()}:base;
 };
 const metaFor=(title,count)=>({title,subtitle:'View tax deducted at source for applicable payments.',organisation:organisation.name,branch:filters.branch,from:filters.from,to:filters.to,filters:appliedFilters(),count,generatedBy:'Local user',generatedAt:stamp.toISOString()});

 /* The Excel sheet for the active tab: the tab's own columns and the tab's own rows, in rupees, behind
    the report identity block, so the workbook states exactly what the screen states. A grouped Summary
    keeps its grouping as a leading column rather than as a second report, so no removed grouped view
    is ever exported as its own section. */
 function sheet(){
  const rupees=value=>value/100;
  const total=(key,list)=>(list||[]).reduce((sum,row)=>sum+Number(row[key]||0),0)/100;
  if(tab==='payable'){
   const head=['Date','Vendor / Payee','PAN','Document / Payment No.','TDS Section','TDS Amount INR','Paid INR','Balance Payable INR','Status'];
   const body=tableRows.map(row=>{const balance=tdsRowBalance(row);return [row.date,row.vendor,row.pan||DASH,row.number,row.section,rupees(balance.tds),rupees(balance.paid),rupees(balance.balance),row.state]});
   const footer=['Total','','','','',total('tds',tableRows),tableRows.reduce((sum,row)=>sum+tdsRowBalance(row).paid,0)/100,tableRows.reduce((sum,row)=>sum+tdsRowBalance(row).balance,0)/100,''];
   return {head,body:tableRows.length?[...body,footer]:body};
  }
  const head=['Date','Vendor / Payee','PAN','Document / Payment No.','TDS Section','Gross Amount INR','TDS Rate','TDS Amount INR','Status'];
  const cells=row=>[row.date,row.vendor,row.pan||DASH,row.number,row.section,rupees(row.gross),row.rate+'%',rupees(row.tds),row.state];
  const body=regrouped?regrouped.flatMap(entry=>entry.rows.map(row=>[entry.key,...cells(row)])):tableRows.map(cells);
  const footer=regrouped?['Total','','','','','',total('gross',tableRows),'',total('tds',tableRows),'']:['Total','','','','',total('gross',tableRows),'',total('tds',tableRows),''];
  return {head:regrouped?[groupBy==='vendor'?'Vendor':'TDS Section',...head]:head,body:tableRows.length?[...body,footer]:body};
 }

 function exportExcel(){
  const label=(TABS.find(entry=>entry.key===tab)||{}).label||'TDS Reports';
  const current=sheet();
  const content=excelReport(tableExport(current.head,current.body,metaFor('Wayvida Books · TDS Reports · '+label,String(tableRows.length))));
  const name=tab==='summary'&&grouped?'wayvida-tds-summary-by-'+groupBy:'wayvida-tds-'+tab;
  downloadReport(content,name+'.xml','application/xml;charset=utf-8');
 }

 function print(){setStamp(new Date());setTimeout(()=>window.print(),50)}

 const printMeta=()=>[
  ['Organisation',organisation.name],
  ['Branch',filters.branch===ALL?'All branches':filters.branch],
  ['Date range',(filters.from||'Beginning')+' to '+(filters.to||'Latest')],
  ['View',(TABS.find(entry=>entry.key===tab)||{}).label||''],
  ['Vendor / Payee',filters.vendor===ALL?'All vendors':filters.vendor],
  ['PAN',filters.pan===ALL?'All PANs':filters.pan],
  ['TDS Section',filters.section===ALL?'All sections':filters.section],
  ['TDS Rate',filters.rate===ALL?'All rates':filters.rate+'%'],
  ['Status',filters.status===ALL?'All statuses':filters.status],
  ['Grouping',tab==='summary'?groupName():'Not applicable'],
  ['Search',search||'None'],
  ['Documents',String(tableRows.length)],
  ['Generated by Local user',stamp.toLocaleString()]
 ];

 const filterSelect=(key,label,values,allLabel,format=value=>value)=><label key={key}>{label}<select aria-label={label} value={filters[key]} onChange={event=>set(key,event.target.value)}><option value={ALL}>{allLabel}</option>{values.map(value=><option key={String(value)} value={value}>{format(value)}</option>)}</select></label>;

 /* The payee is a link wherever the vendor record is known and the document number wherever the bill
    is: each opens the record the row already names, in the module that owns it. */
 const partyCell=row=>row.vendorId?<button type="button" className="tcLink" title={'Open vendor '+row.vendor} onClick={()=>openVendor(row)}>{row.vendor||DASH}</button>:(row.vendor||DASH);
 const numberCell=row=><button type="button" className="tcLink" title={'Open '+row.kind+' '+row.number} onClick={()=>open(row)}>{row.number}</button>;
 const stateCell=row=><StatusPill status={row.state} tone={STATUS_TONES[row.state]||'neutral'}/>;

 const documentRow=(row,offPage=false)=><tr key={row.id} className={offPage?'tcOffPage':''} title={[row.number,row.vendor,row.section,row.description].filter(Boolean).join(' · ')}>
  <td className="tcDateCol">{dateText(row.date)}</td>
  <td className="tcPartyCol" title={row.vendor||undefined}>{partyCell(row)}</td>
  <td className="tcPanCol">{row.pan||DASH}</td>
  <td className="tcNumberCol">{numberCell(row)}</td>
  <td className="tcSectionCol" title={row.description}><span className="tcSection">{row.section}</span></td>
  <td className="tcMoney">{money(row.gross)}</td>
  <td className="tcRateCol">{rateText(row.rate)}</td>
  <td className="tcMoney tcStrong">{money(row.tds)}</td>
  <td className="tcStateCol">{stateCell(row)}</td>
 </tr>;

 /* The outstanding table states one measure per row: what the document withheld, what has been taken
    on it, and the balance that is left - which is the whole deduction until the bill is settled. */
 const payableRow=(row,offPage=false)=>{const balance=tdsRowBalance(row);return <tr key={row.id} className={offPage?'tcOffPage':''} title={[row.number,row.vendor,row.section,row.description].filter(Boolean).join(' · ')}>
  <td className="tcDateCol">{dateText(row.date)}</td>
  <td className="tcPartyCol" title={row.vendor||undefined}>{partyCell(row)}</td>
  <td className="tcPanCol">{row.pan||DASH}</td>
  <td className="tcNumberCol">{numberCell(row)}</td>
  <td className="tcSectionCol" title={row.description}><span className="tcSection">{row.section}</span></td>
  <td className="tcMoney">{money(balance.tds)}</td>
  <td className="tcMoney">{money(balance.paid)}</td>
  <td className="tcMoney tcStrong">{money(balance.balance)}</td>
  <td className="tcStateCol">{stateCell(row)}</td>
 </tr>};

 /* One group's heading row inside the same nine columns, so regrouping adds no column and moves no
    figure - it only states the vendor or the section the rows beneath it belong to. */
 const groupRow=entry=>{
  const label=groupBy==='vendor'?entry.group.vendor+' · PAN '+(entry.group.pan||DASH):entry.group.section+' · '+entry.group.description;
  const totals=groupBy==='vendor'
   ?entry.group.documents+' documents · Gross Amount '+money(entry.group.gross)+' · TDS '+money(entry.group.deducted)
   :entry.group.documents+' documents · TDS Rate '+entry.group.rateText+' · Gross Amount '+money(entry.group.gross)+' · TDS '+money(entry.group.deducted);
  return <tr key={'group:'+entry.key} className="tcGroupRow"><td colSpan={9}><div className="tcGroupCell"><span className="tcGroupLabel">{label}</span><span className="tcGroupTotals">{totals}</span></div></td></tr>;
 };

 const table=()=>{
  const head=tab==='payable'
   ?['Date','Vendor / Payee','PAN','Document / Payment No.','TDS Section','TDS Amount','Paid','Balance Payable','Status']
   :['Date','Vendor / Payee','PAN','Document / Payment No.','TDS Section','Gross Amount','TDS Rate','TDS Amount','Status'];
  const columns=tab==='payable'?[9,16,10,14,10,11,11,12,7]:[9,17,11,15,11,11,7,10,9];
  const rowOf=(row,offPage)=>tab==='payable'?payableRow(row,offPage):documentRow(row,offPage);
  const body=()=>{
   if(regrouped)return regrouped.flatMap(entry=>[groupRow(entry),...entry.rows.map(row=>rowOf(row,false))]);
   return tableRows.map((row,index)=>rowOf(row,paged&&(index<startIndex||index>=startIndex+perPage)));
  };
  const caption=(tab==='payable'
   ?'TDS payable · '+tableRows.length+' documents with a balance'
   :(tab==='deducted'?'TDS deducted · ':'')+tableRows.length+' of '+rows.length+' TDS documents')+(busy?' · filtering':'');
  const footer=()=>{
   if(!tableRows.length)return null;
   if(tab==='payable')return <tfoot><tr><td colSpan={5}>Total · {tableRows.length} documents</td><td className="tcMoney">{money(tableRows.reduce((sum,row)=>sum+tdsRowBalance(row).tds,0))}</td><td className="tcMoney">{money(tableRows.reduce((sum,row)=>sum+tdsRowBalance(row).paid,0))}</td><td className="tcMoney tcStrong">{money(tableRows.reduce((sum,row)=>sum+tdsRowBalance(row).balance,0))}</td><td/></tr></tfoot>;
   return <tfoot><tr><td colSpan={5}>Total · {tableRows.length} documents</td><td className="tcMoney">{money(tableRows.reduce((sum,row)=>sum+row.gross,0))}</td><td/><td className="tcMoney tcStrong">{money(tableRows.reduce((sum,row)=>sum+row.tds,0))}</td><td/></tr></tfoot>;
  };
  return <table className="tcFixed">
   <caption className="tcCaption">{caption}</caption>
   <colgroup>{columns.map((width,index)=><col key={index} style={{width:width+'%'}}/>)}</colgroup>
   <thead><tr>{head.map((label,index)=><th key={label} className={index>=5&&index<=7?'tcRight':''}>{label}</th>)}</tr></thead>
   <tbody>
    {body()}
    {!tableRows.length&&<tr className="emptyStateRow"><td colSpan={head.length} className="emptyStateCell"><EmptyState variant="journal" title="No TDS transactions found" description="TDS transactions will appear here when TDS is applied to an applicable vendor transaction." actionLabel={search||activeFilters?'Clear filters':undefined} onAction={search||activeFilters?clear:undefined}/></td></tr>}
   </tbody>
   {footer()}
  </table>;
 };

 return <section className="tcPage tcTdsPage" aria-busy={busy}>
  <header className="tcHead">
   <div className="tcHeadText"><h1>TDS Reports</h1><p>View tax deducted at source for applicable payments.</p></div>
   <div className="tcHeadActions">
    <DateRangeSelect from={filters.from} to={filters.to} onChange={(start,end)=>{set('from',start);set('to',end)}} onCustom={()=>setFiltersOpen(true)}/>
    <details className="tcFiltersMore" open={filtersOpen} onToggle={event=>setFiltersOpen(event.currentTarget.open)}>
     <summary aria-label="Open filters"><IconAdjustments size={17}/>Filters{activeFilters>0&&<span>{activeFilters}</span>}</summary>
     <div className="tcFilters">
      <label>Date from<input type="date" aria-label="Date from" value={filters.from} onChange={event=>set('from',event.target.value)}/></label>
      <label>Date to<input type="date" aria-label="Date to" value={filters.to} onChange={event=>set('to',event.target.value)}/></label>
      {filterSelect('branch','Branch',branches,'All branches')}
      {filterSelect('vendor','Vendor / Payee',options.vendors,'All vendors')}
      {filterSelect('pan','PAN',options.pans,'All PANs')}
      {filterSelect('section','TDS Section',options.sections,'All sections')}
      {filterSelect('rate','TDS Rate',options.rates,'All rates',value=>value+'%')}
      {filterSelect('status','Status',options.statuses,'All statuses')}
      <div className="tcFilterActions"><button type="button" onClick={()=>{refresh();setStamp(new Date())}}><IconRefresh size={15}/>Refresh</button><button type="button" onClick={clear}>Clear filters</button></div>
     </div>
    </details>
    <ReportExportMenu items={[{key:'excel',label:'Export Excel',icon:<IconFileSpreadsheet size={17}/>,onClick:exportExcel,disabled:!tableRows.length},{key:'pdf',label:'Export PDF',icon:<IconFileTypePdf size={17}/>,onClick:print,disabled:!tableRows.length}]}/>
   </div>
  </header>

  {error&&<div className="tcError" role="alert"><IconAlertTriangle size={18}/><span>Unable to load TDS report. {error}</span><button type="button" onClick={refresh}>Retry</button></div>}
  <div className="tcPrintMeta"><h2>TDS Reports</h2>{printMeta().map(([label,value])=><p key={label}><b>{label}:</b> {value}</p>)}</div>

  <div className="tcSummary">
   <div><span>TDS Applicable Base</span><strong>{money(summary.applicable)}</strong></div>
   <div><span>TDS Deducted</span><strong>{money(summary.deducted)}</strong></div>
   <div><span>TDS Paid</span><strong>{money(summary.paid)}</strong></div>
   <div><span>TDS Payable</span><strong>{money(summary.payable)}</strong></div>
  </div>

  <div className="tcTabs" role="tablist" aria-label="TDS report views">
   {TABS.map(entry=><button key={entry.key} type="button" role="tab" id={'tds-tab-'+entry.key} aria-selected={tab===entry.key} aria-controls="tds-tabpanel" className={tab===entry.key?'active':''} onClick={()=>setTab(entry.key)}>{entry.label}</button>)}
  </div>

  <div className="tcRegisterCard" id="tds-tabpanel" role="tabpanel" aria-labelledby={'tds-tab-'+tab}>
   {tab==='summary'&&<div className="tcGroupBy" role="group" aria-label="Group by"><span className="tcGroupByLabel">Group by</span>{GROUPINGS.map(entry=><button key={entry.key} type="button" aria-pressed={groupBy===entry.key} className={groupBy===entry.key?'active':''} onClick={()=>setGroupBy(entry.key)}>{entry.label}</button>)}</div>}
   <div className="tcTableScroll">{table()}</div>
   {paged&&tableRows.length>0&&<div className="pagination-footer tcPager">
    <span className="pagination-left">Showing {firstRow}&ndash;{lastRow} of {tableRows.length} transactions</span>
    <div className="pagination-right">
     <label className="tcPerPage"><select aria-label="Transactions per page" value={perPage} onChange={event=>setPerPage(Number(event.target.value))}>{[25,50,100].map(size=><option key={size} value={size}>{size} per page</option>)}</select></label>
     <div className="pagination-nav"><button type="button" aria-label="Previous page" disabled={pageIndex<=1} onClick={()=>setPage(pageIndex-1)}>&lsaquo;</button><span>Page {pageIndex} of {pageCount}</span><button type="button" aria-label="Next page" disabled={pageIndex>=pageCount} onClick={()=>setPage(pageIndex+1)}>&rsaquo;</button></div>
    </div>
   </div>}
  </div>

  {visible.length>0&&<div className={'tcRecon '+(reconciliation.difference?'warn':'ok')}>
   <div className="tcReconFigures">
    <span className="tcReconName">TDS Reconciliation</span>
    <span>TDS Deducted<b>{money(reconciliation.deducted)}</b></span>
    <span>TDS Paid<b>{money(reconciliation.paid)}</b></span>
    <span>TDS Payable<b>{money(reconciliation.payable)}</b></span>
   </div>
   <p className="tcReconState" role="status">{reconciliation.difference?<>⚠ TDS balances need review · Difference: {money(Math.abs(reconciliation.difference))}</>:'✓ TDS balances reconcile'}</p>
  </div>}
  <p className="tcNote">{tabNote} TDS is computed from each vendor's configured section and rate on the value of supply of posted purchase bills and their debit notes. This prototype records no TDS challan or deposit, so TDS Paid is the withholding taken on the documents the ledger has already settled, and TDS Payable - the Balance Payable column of the outstanding table - is what remains.</p>
 </section>;
}
