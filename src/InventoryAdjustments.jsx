/* Inventory Adjustments - Inventory > Inventory Adjustments.

   One destination with three screens: the register, the create page and the
   detail page. Every rule that decides what an adjustment means lives in
   src/inventory-adjustments.js, and this file only renders it:

     adjustment -> quantity/value difference -> financial impact -> inventory
     position -> journal entry -> posted transaction -> financial statements

   A draft or a cancelled adjustment changes nothing. Only an Adjusted document
   moves stock and posts the generated entry, and an adjusted record is never
   edited in place: it is corrected by a reversal document. Nothing here touches
   a cash or bank account, which is why an inventory adjustment can never create
   a cash movement of its own. */
import {useEffect,useMemo,useRef,useState} from 'react';
import {IconAlertTriangle,IconArrowBackUp,IconArrowLeft,IconBan,IconCheck,IconCopy,IconDotsVertical,IconEdit,IconEye,IconFileDownload,IconFilter,IconHistory,IconInfoCircle,IconPlus,IconSearch,IconTrash,IconX} from '@tabler/icons-react';
import {money,today} from './invoice-engine.js';
import {readAccounts,writeAccounts} from './account-store.js';
import {findOrganisation,getBranchesForOrganisation,organisationBranches,scopePickerState} from './organisation-scope.js';
import {getAccessibleOrganizations,getScopeOrganisations} from './organisation-context.js';
import OrganisationBranchScope from './OrganisationBranchScope.jsx';
import JournalAccountPicker from './JournalAccountPicker.jsx';
import {readSettings} from './settings-store.js';
import {useTerminology} from './terminology.jsx';
import {itemSeeds} from './Items.jsx';
import {ADJUSTMENT_ACTIONS,ADJUSTMENT_ENTRY_MODES,ADJUSTMENT_REASONS,ADJUSTMENT_STATUSES,ADJUSTMENT_TYPES,accountingPreview,adjustmentActivity,adjustmentAllowed,adjustmentCommand,adjustmentCsv,adjustmentImpact,adjustmentRows,blankAdjustment,blankLine,canonicalItems,configuredAdjustmentAccount,duplicateAdjustment,formatQuantity,itemsForOrganisation,nextAdjustmentNumber,storedLines,suggestedAdjustmentAccount,validateAdjustment} from './inventory-adjustments.js';
import './operational-modules.css';
import './inventory-adjustments.css';
import EmptyState from './EmptyState.jsx';

const ITEMS_KEY='finance-erp-items';
const VALUE_TYPE=ADJUSTMENT_TYPES[1];
const PAGE_SIZE=10;
const sum=(rows,key)=>rows.reduce((total,row)=>total+(Number(row?.[key])||0),0);
const fmtDate=value=>value?new Date(value+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'Not recorded';
const stamp=value=>{if(!value)return 'Not recorded';const date=new Date(value);if(Number.isNaN(date.getTime()))return String(value);return date.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})+' · '+date.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',hour12:true})};
const signedMoney=value=>{const amount=Number(value)||0;return (amount<0?'-':amount>0?'+':'')+money(Math.abs(amount))};
const statusClass=status=>String(status||'').toLowerCase().replace(/\s+/g,'-');
const readItems=()=>{try{const stored=JSON.parse(localStorage.getItem(ITEMS_KEY));return Array.isArray(stored)&&stored.length?stored:itemSeeds}catch{return itemSeeds}};
const downloadText=(filename,text,type='text/csv;charset=utf-8')=>{const url=URL.createObjectURL(new Blob([text],{type})),anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();URL.revokeObjectURL(url)};
const adjustmentTotal=row=>sum(storedLines(row),'valueImpact');
/* Viewing is always allowed. Every other entry is gated by the adjustment role
   duty that the command enforces again on its own side. */
const ACTION_ICONS={View:IconEye,Edit:IconEdit,Duplicate:IconCopy,Export:IconFileDownload,Cancel:IconBan,Reverse:IconArrowBackUp};
const ACTION_DUTY={Edit:'save',Duplicate:'save',Export:'export',Cancel:'cancel',Reverse:'reverse'};
const ACTION_LABELS={Reverse:'Create reversal'};

function Badge({value}){return <span className={`opsBadge iaBadge ${statusClass(value)}`}>{value}</span>}
function Empty({title,text,variant="default"}){return <EmptyState variant={variant} title={title} description={text}/>}
function Kebab({label,entries,onPick}){return <details className="iaKebab"><summary aria-label={label}><IconDotsVertical size={17}/></summary><div className="iaKebabMenu">{entries.map(entry=><button type="button" key={entry.action} className={entry.danger?'iaDanger':''} disabled={entry.disabled} title={entry.disabled?entry.reason:''} onClick={event=>{event.stopPropagation();event.currentTarget.closest('details')?.removeAttribute('open');onPick(entry.action)}}>{entry.icon}<span>{entry.label}</span></button>)}</div></details>}

export default function InventoryAdjustments({seed,notify=()=>{},onNavigate=()=>{}}){
  const [db,setDb]=useState(()=>{try{return readAccounts(seed)}catch{return null}});
  const [error,setError]=useState('');
  const [banner,setBanner]=useState('');
  /* The acting role is not a page control any more: it follows the View as switch
     in the header account menu - Business owner (Admin) or Head of Accountant
     (Staff) - so the register, the create page and the detail page agree with the
     rest of the workspace. */
  const {mode}=useTerminology();
  const role=mode==='business'?'Admin':'Accountant';
  const [view,setView]=useState('list');
  const [selectedId,setSelectedId]=useState('');
  const [form,setForm]=useState(null);
  const [touched,setTouched]=useState(false);
  const [dialog,setDialog]=useState(null);
  const [inventoryItems,setInventoryItems]=useState(readItems);
  const [organisations,setOrganisations]=useState(getScopeOrganisations);
  const settings=useMemo(()=>readSettings(),[]);
  const dbRef=useRef(db);
  dbRef.current=db;
  const accountingState=()=>{if(!dbRef.current)throw Error('Stored accounting data could not be read. No data has been overwritten.');return dbRef.current};

  useEffect(()=>{
    const refresh=()=>{setInventoryItems(readItems());setOrganisations(getScopeOrganisations())};
    window.addEventListener('storage',refresh);
    window.addEventListener('wayvida-working-context-change',refresh);
    window.addEventListener('wayvida-organization-change',refresh);
    return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('wayvida-working-context-change',refresh);window.removeEventListener('wayvida-organization-change',refresh)};
  },[]);
  useEffect(()=>{
    const away=event=>document.querySelectorAll('details.iaKebab[open],details.iaFilters[open]').forEach(node=>{if(!node.contains(event.target))node.removeAttribute('open')});
    const escape=event=>{if(event.key!=='Escape')return;document.querySelectorAll('details.iaKebab[open],details.iaFilters[open]').forEach(node=>node.removeAttribute('open'));setDialog(null)};
    document.addEventListener('pointerdown',away);
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',escape)};
  },[]);

  const branches=useMemo(()=>organisationBranches(organisations),[organisations]);
  const items=useMemo(()=>canonicalItems(inventoryItems,branches),[inventoryItems,branches]);
  const rows=useMemo(()=>adjustmentRows(db||{}).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.number||'').localeCompare(String(a.number||''))),[db]);
  const postingAccounts=useMemo(()=>[...(db?.accounts||[])].filter(account=>account.active&&!account.isGroup),[db]);
  const selected=rows.find(row=>row.id===selectedId)||null;
  const organisationOf=reference=>findOrganisation(reference,organisations);
  const branchesOf=reference=>getBranchesForOrganisation(reference,organisations);
  const accountNameOf=code=>(db?.accounts||[]).find(account=>account.code===code)?.name||code||'Not mapped';
  const branchLabel=code=>branches.find(branch=>String(branch.id)===String(code))?.name||String(code||'')||'Not recorded';

  /* Every mutation goes through the one command, so role duty, period locking,
     balanced posting and the audit trail are applied once for all three screens. */
  function run(action,payload={}){
    try{
      const result=adjustmentCommand(accountingState(),action,payload,{actor:role,role,settings,items,periodRole:role,state:accountingState()});
      dbRef.current=result.state;
      writeAccounts(result.state);
      setDb(result.state);
      setError('');
      return result.result;
    }catch(issue){setError(issue.message||'The inventory adjustment could not be processed.');return null}
  }
  function defaultAccount(){const configured=configuredAdjustmentAccount(settings);if(postingAccounts.some(account=>account.code===configured))return configured;return suggestedAdjustmentAccount(postingAccounts)||''}
  function newAdjustment(){
    const scope=getAccessibleOrganizations(),organisation=scope[0]||{code:'',name:'',branches:[]},branch=(organisation.branches||[])[0];
    const base=blankAdjustment({date:today(),type:ADJUSTMENT_TYPES[0],account:defaultAccount(),reason:'',organisation:{companyId:organisation.code,companyName:organisation.name,branchId:branch?.id||'',branchName:branch?.name||''}});
    return {...base,number:nextAdjustmentNumber(dbRef.current||{}),lines:[blankLine('',branch?.id||'')]};
  }
  const openCreate=preset=>{setError('');setBanner('');setTouched(false);setForm(preset||newAdjustment());setView('create')};
  const openDetail=row=>{setError('');setBanner('');setSelectedId(row.id);setView('detail')};
  /* An edited draft is re-opened in rupees, because the stored line keeps paise. */
  const openEdit=row=>{setError('');setBanner('');setTouched(false);setForm({...row,number:row.number,lines:storedLines(row).map(line=>({id:line.id,itemId:line.itemId,locationId:line.locationId,qtyDelta:line.qtyDelta==null?'':String(line.qtyDelta),newQty:line.newQty==null?'':String(line.newQty),valueDelta:line.valueDelta==null?'':String(line.valueDelta/100),newValue:line.newValue==null?'':String(line.newValue/100)}))});setView('create')};
  const backToList=()=>{setForm(null);setTouched(false);setDialog(null);setView('list')};
  function saveDraft(){const doc=run('save',form||{});if(doc){backToList();setBanner(doc.number+' saved as draft');notify('Inventory adjustment saved as draft')}return doc}
  function saveAndAdjust(){const doc=run('save-and-adjust',form||{});if(doc){setTouched(false);setForm(null);setSelectedId(doc.id);setView('detail');setBanner(doc.number+' adjusted'+(doc.journalId?' and posted to the ledger':''));notify('Inventory and accounting updated')}return doc}
  function submitForApproval(){const saved=run('save',form||{});if(!saved)return null;const submitted=run('submit',{id:saved.id});if(submitted){backToList();setBanner(saved.number+' submitted for approval');notify('Adjustment submitted for approval')}return submitted}
  function duplicateRow(row){openCreate({...duplicateAdjustment(dbRef.current||{},row),id:''})}
  function exportRow(row){downloadText((row.number||'inventory-adjustment')+'.csv','\ufeff'+adjustmentCsv(row,{items,settings}))}
  function adjustRow(id){const doc=run('adjust',{id});if(doc){setSelectedId(doc.id);setView('detail');setBanner(doc.number+' adjusted'+(doc.journalId?' and posted to the ledger':''));notify('Inventory and accounting updated')}}
  function submitRow(id){const doc=run('submit',{id});if(doc){setBanner(doc.number+' submitted for approval');notify('Adjustment submitted for approval')}}
  function confirmDialog(){
    const payload=dialog.kind==='cancel'?{id:dialog.id,cancellationReason:dialog.reason}:{id:dialog.id,date:dialog.date,reason:dialog.reason};
    const doc=run(dialog.kind==='cancel'?'cancel':'reverse',payload);
    if(!doc)return;
    setDialog(null);
    setSelectedId(doc.id);
    setView('detail');
    setBanner(dialog.kind==='cancel'?doc.number+' cancelled':'Correcting adjustment '+doc.number+' created and posted');
    notify(dialog.kind==='cancel'?'Adjustment cancelled':'Correcting adjustment posted');
  }

  if(!db)return <section className="opsPage iaPage"><div className="opsCard iaCard"><Empty title="Inventory adjustments are unavailable" text="Stored accounting data could not be read, so nothing was changed. Reload the workspace to try again."/></div></section>;

  return <section className="opsPage iaPage">
    {view==='list'&&<RegisterPage rows={rows} role={role} banner={banner} branchNameOf={branchLabel} accountNameOf={accountNameOf} onNew={()=>openCreate()} onOpen={openDetail} onEdit={openEdit} onDuplicate={duplicateRow} onExport={exportRow} onCancel={row=>setDialog({kind:'cancel',id:row.id,reason:''})} onReverse={row=>setDialog({kind:'reverse',id:row.id,date:today(),reason:''})}/>}
    {view==='create'&&form&&<CreatePage db={db} form={form} setForm={setForm} touched={touched} setTouched={setTouched} role={role} settings={settings} items={items} organisations={organisations} postingAccounts={postingAccounts} organisationOf={organisationOf} branchesOf={branchesOf} onBack={backToList} onSaveDraft={saveDraft} onSaveAndAdjust={saveAndAdjust} onSubmit={submitForApproval}/>}
    {view==='detail'&&(selected?<DetailPage row={selected} db={db} items={items} settings={settings} role={role} branchNameOf={branchLabel} accountNameOf={accountNameOf} onBack={backToList} onOpen={openDetail} onEdit={openEdit} onDuplicate={duplicateRow} onExport={exportRow} onCancel={row=>setDialog({kind:'cancel',id:row.id,reason:''})} onReverse={row=>setDialog({kind:'reverse',id:row.id,date:today(),reason:''})} onAdjust={adjustRow} onSubmit={submitRow} onNavigate={onNavigate}/>:<div className="opsCard iaCard"><Empty title="Adjustment not found" text="This adjustment is no longer in the register."/></div>)}
    {dialog&&<AdjustmentDialog dialog={dialog} setDialog={setDialog} onConfirm={confirmDialog}/>}
    {error&&<p role="alert" className="opsError"><IconAlertTriangle/>{error}<button type="button" aria-label="Dismiss message" onClick={()=>setError('')}><IconX/></button></p>}
  </section>;
}
const lineLabel=line=>[line.name,line.sku].filter(Boolean).join(' · ')||'Item';
const REGISTER_COLUMNS=['Reference','Date','Type','Organisation','Branch','Items','Amount','Status','Created By','Actions'];

/* The register: one enterprise table with search, filters, sorting, pagination,
   a row click into the detail screen and a status-aware action menu. */
function RegisterPage({rows,role,banner,branchNameOf,accountNameOf,onNew,onOpen,onEdit,onDuplicate,onExport,onCancel,onReverse}){
  const [query,setQuery]=useState('');
  const [type,setType]=useState('All types');
  const [status,setStatus]=useState('All statuses');
  const [company,setCompany]=useState('All organisations');
  const [branch,setBranch]=useState('All branches');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [page,setPage]=useState(1);
  const organisations=useMemo(()=>[...new Map(rows.filter(row=>row.companyId).map(row=>[row.companyId,{value:row.companyId,label:row.companyName||row.companyId}])).values()],[rows]);
  const locations=useMemo(()=>[...new Map(rows.filter(row=>row.branchId).map(row=>[row.branchId,{value:row.branchId,label:row.branchName||row.branchId}])).values()],[rows]);
  useEffect(()=>setPage(1),[query,type,status,company,branch,from,to]);
  const text=query.trim().toLowerCase();
  const filtered=rows.filter(row=>(type==='All types'||row.type===type)&&(status==='All statuses'||row.status===status)&&(company==='All organisations'||row.companyId===company)&&(branch==='All branches'||row.branchId===branch)&&(!from||String(row.date||'')>=from)&&(!to||String(row.date||'')<=to)&&(!text||[row.number,row.type,row.companyName,row.branchName,row.reason,row.account,row.notes,row.createdBy,...storedLines(row).map(lineLabel)].join(' ').toLowerCase().includes(text)));
  /* The register follows the Journal Entries and Budgets registers: no column
     sorting control, one Filters panel instead of a row of loose dropdowns. */
  const activeFilterCount=(type!=='All types'?1:0)+(status!=='All statuses'?1:0)+(company!=='All organisations'?1:0)+(branch!=='All branches'?1:0)+(from?1:0)+(to?1:0);
  const clearFilters=()=>{setType('All types');setStatus('All statuses');setCompany('All organisations');setBranch('All branches');setFrom('');setTo('')};
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const current=Math.min(page,pages);
  const visible=filtered.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE);
  const handlers={View:onOpen,Edit:onEdit,Duplicate:onDuplicate,Export:onExport,Cancel:onCancel,Reverse:onReverse};
  const entriesFor=row=>(ADJUSTMENT_ACTIONS[row.status]||['View']).map(action=>{const duty=ACTION_DUTY[action],allowed=!duty||adjustmentAllowed(role,duty),Icon=ACTION_ICONS[action];return {action,label:ACTION_LABELS[action]||action,icon:<Icon size={16}/>,danger:action==='Cancel'||action==='Reverse',disabled:!allowed,reason:`Your adjustment role (${role}) cannot ${action.toLowerCase()} this record.`}});
  const total=adjustmentTotal;
  return <>
    <div className="iaHeading">
      <div><h1>Inventory Adjustments</h1><p>Adjust inventory quantities or values and keep your accounting records accurate.</p></div>
      <div className="iaHeadActions"><button className="primary" type="button" onClick={onNew}><IconPlus/>New Adjustment</button></div>
    </div>
    {banner&&<p className="iaBanner" role="status"><IconCheck size={16}/>{banner}</p>}
    <div className="opsCard iaCard iaRegisterCard">
      <div className="iaRegisterBar">
        <label className="iaSearch"><IconSearch/><input aria-label="Search adjustments" placeholder="Search reference, item, reason or person&hellip;" value={query} onChange={event=>setQuery(event.target.value)}/></label>
        <details className="iaFilters">
          <summary aria-label="Open filters"><IconFilter size={16}/>Filters{!!activeFilterCount&&<em className="iaFilterBadge">{activeFilterCount}</em>}</summary>
          <div className="iaFiltersPanel">
            <label className="iaFilterField"><span>Adjustment type</span><select aria-label="Adjustment type" value={type} onChange={event=>setType(event.target.value)}><option>All types</option>{ADJUSTMENT_TYPES.map(value=><option key={value}>{value}</option>)}</select></label>
            <label className="iaFilterField"><span>Status</span><select aria-label="Status" value={status} onChange={event=>setStatus(event.target.value)}><option>All statuses</option>{ADJUSTMENT_STATUSES.map(value=><option key={value}>{value}</option>)}</select></label>
            <label className="iaFilterField"><span>Organisation</span><select aria-label="Organisation" value={company} onChange={event=>setCompany(event.target.value)}><option>All organisations</option>{organisations.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="iaFilterField"><span>Branch / location</span><select aria-label="Branch or location" value={branch} onChange={event=>setBranch(event.target.value)}><option>All branches</option>{locations.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="iaFilterField"><span>From date</span><input type="date" aria-label="From date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
            <label className="iaFilterField"><span>To date</span><input type="date" aria-label="To date" value={to} onChange={event=>setTo(event.target.value)}/></label>
            {!!activeFilterCount&&<div className="iaFiltersPanelActions"><button type="button" onClick={clearFilters}>Clear filters</button></div>}
          </div>
        </details>
      </div>
      <div className="opsTable iaTable">
        <table>
          <thead><tr>{REGISTER_COLUMNS.map(column=><th key={column} scope="col" className={column==='Actions'?'iaActionsCell':column==='Amount'?'iaNum':undefined}>{column}</th>)}</tr></thead>
          <tbody>
            {visible.map(row=><tr key={row.id} className="iaRow" onClick={()=>onOpen(row)}>
              <td><button type="button" className="iaLink" onClick={()=>onOpen(row)}>{row.number}</button><small>{row.reason||'Reason not recorded'}</small></td>
              <td>{fmtDate(row.date)}</td>
              <td>{row.type}</td>
              <td>{row.companyName||row.companyId||'Not recorded'}<small>{row.account?accountNameOf(row.account):'Account not mapped'}</small></td>
              <td>{branchNameOf(row.branchId)||'Not recorded'}</td>
              <td>{storedLines(row).length} {storedLines(row).length===1?'item':'items'}</td>
              <td className={'iaNum '+(total(row)<0?'iaDown':total(row)>0?'iaUp':'')}>{signedMoney(total(row))}</td>
              <td><Badge value={row.status}/></td>
              <td>{row.createdBy||'Not recorded'}</td>
              <td className="iaActionsCell" onClick={event=>event.stopPropagation()}><button type="button" onClick={()=>onOpen(row)}><IconEye size={16}/>View</button><Kebab label={'More actions for '+row.number} entries={entriesFor(row)} onPick={action=>handlers[action](row)}/></td>
            </tr>)}
            {!visible.length&&<tr className="emptyStateRow"><td colSpan={REGISTER_COLUMNS.length} className="emptyStateCell"><EmptyState variant="adjustment" title="No adjustments found" description="Create an inventory adjustment to correct a quantity or value." actionLabel="Create Adjustment" onAction={onNew}/></td></tr>}
          </tbody>
        </table>
      </div>
      {!!filtered.length&&<div className="iaPager">
        <span>Showing {(current-1)*PAGE_SIZE+1}&ndash;{Math.min(current*PAGE_SIZE,filtered.length)} of {filtered.length}</span>
        <div><button type="button" disabled={current<=1} onClick={()=>setPage(current-1)}>Previous</button><span>Page {current} of {pages}</span><button type="button" disabled={current>=pages} onClick={()=>setPage(current+1)}>Next</button></div>
      </div>}
    </div>
  </>;
}

const toneOf=value=>value<0?'iaDown':value>0?'iaUp':'';

/* The create page: adjustment details, the item table that differs by adjustment
   type, the compact inventory impact summary and the collapsible accounting
   preview. Nothing is posted until the document becomes Adjusted. */
function CreatePage({db,form,setForm,touched,setTouched,role,settings,items,organisations,postingAccounts,organisationOf,branchesOf,onBack,onSaveDraft,onSaveAndAdjust,onSubmit}){
  const valueType=form.type===VALUE_TYPE;
  const approval=settings.approvals?.inventoryAdjustments!==false;
  const canPost=adjustmentAllowed(role,'post');
  const referenceEditable=settings.transactions?.reference!==false;
  const organisation=organisationOf(form.companyId);
  const stockItems=itemsForOrganisation(items,organisation?.id||'');
  const locationOptions=branchesOf(form.companyId);
  const scopeState=scopePickerState({organisations,companyIds:[form.companyId],branchIds:[form.branchId],label:'Adjustment scope'});
  const impact=useMemo(()=>adjustmentImpact(db,items,form),[db,items,form]);
  const preview=useMemo(()=>accountingPreview(db,items,form,settings,db.accounts||[]),[db,items,form,settings]);
  const errors=useMemo(()=>validateAdjustment(db,form,{items,settings}),[db,form,items,settings]);
  const computed=new Map(impact.lines.map(line=>[line.id,line]));
  const stored=storedLines(form);
  const entryMode=form.entryMode==='Set New Value'?'Set New Value':'Adjust By';
  const entryKey=entryMode==='Adjust By'?(valueType?'valueDelta':'qtyDelta'):(valueType?'newValue':'newQty');
  const entryLabel=valueType?(entryMode==='Adjust By'?'Value adjusted':'New value'):(entryMode==='Adjust By'?'Quantity adjusted':'New quantity');
  const derivedLabel=valueType?(entryMode==='Adjust By'?'New value':'Value adjusted'):(entryMode==='Adjust By'?'New quantity':'Quantity adjusted');
  const set=(key,value)=>setForm(current=>({...current,[key]:value}));
  const setLine=(id,key,value)=>setForm(current=>({...current,lines:current.lines.map(line=>line.id===id?{...line,[key]:value}:line)}));
  const addLine=()=>setForm(current=>({...current,lines:[...current.lines,blankLine('',current.branchId||'')]}));
  const removeLine=id=>setForm(current=>({...current,lines:current.lines.length<2?current.lines:current.lines.filter(line=>line.id!==id)}));
  const changeType=type=>setForm(current=>({...current,type,entryMode:'Adjust By',lines:current.lines.map(line=>({...line,qtyDelta:'',newQty:'',valueDelta:'',newValue:''}))}));
  const showError=key=>touched?(errors[key]||''):'';
  const lineMessage=line=>{const index=stored.findIndex(row=>row.id===line.id),message=index>=0?(errors['line-'+index]||''):'Choose an item.';return message==='Choose an item.'&&!touched?'':message};
  function changeScope(next){
    const chosen=organisationOf(next.companyId),allowed=new Set(itemsForOrganisation(items,chosen?.id||'').map(item=>item.id)),options=branchesOf(next.companyId),branch=options.find(entry=>entry.id===next.branchId)||options[0]||null;
    setForm(current=>({...current,companyId:next.companyId||'',companyName:chosen?.name||'',branchId:branch?.id||'',branchName:branch?.name||'',lines:current.lines.map(line=>({...line,itemId:allowed.has(line.itemId)?line.itemId:'',locationId:options.some(entry=>entry.id===line.locationId)?line.locationId:(branch?.id||'')}))}));
  }
  /* The derived column is always the other half of the pair the user typed in:
     the resulting figure while they adjust by, and the adjustment itself once
     they set the new figure. A quantity correction therefore never prints a
     currency figure here - the estimated value impact belongs to the inventory
     impact summary below the table. */
  const derivedText=line=>{const row=computed.get(line.id);if(!row)return '—';if(valueType)return entryMode==='Adjust By'?money(row.newValue):signedMoney(row.valueDelta);return entryMode==='Adjust By'?formatQuantity(row.newQty)+(row.unit?' '+row.unit:''):(row.qtyDelta>0?'+':'')+formatQuantity(row.qtyDelta)+(row.unit?' '+row.unit:'')};
  const derivedTone=line=>{const row=computed.get(line.id);if(!row)return '';return entryMode==='Adjust By'?'':toneOf(valueType?row.valueDelta:row.qtyDelta)};
  return <>
    <header className="opsHead">
      <div className="iaHeadIdentity">
        <button type="button" className="iaBack" aria-label="Back to inventory adjustments" onClick={onBack}><IconArrowLeft/></button>
        <div><span>Inventory</span><h1>{form.id?'Edit Inventory Adjustment':'New Inventory Adjustment'}</h1><p>Correct inventory quantities or values without creating a purchase or sales transaction.</p></div>
      </div>
      <div className="iaHeadSide"><Badge value={form.status||'Draft'}/></div>
    </header>
    <div className="opsCard iaCard">
      <header className="iaCardHead"><div><h2>Adjustment details</h2><p>Choose what is being corrected and where it is accounted for.</p></div><span className="iaRefChip">{form.number||'Reference assigned on save'}</span></header>
      <div className="iaFields">
        <div className="iaField iaFieldWide">
          <span className="iaLabel">Adjustment type *</span>
          <div className="iaSegmented" role="group" aria-label="Adjustment type">
            {ADJUSTMENT_TYPES.map(option=><button type="button" key={option} aria-pressed={form.type===option} className={form.type===option?'active':''} onClick={()=>changeType(option)}>{option}</button>)}
          </div>
          <small className="iaHelp">{valueType?'Correct the financial value without changing the quantity.':'Correct the physical quantity of an item.'}</small>
          {showError('type')&&<small className="iaError">{showError('type')}</small>}
        </div>
        <label className="iaField">Date *<input type="date" value={form.date||''} onChange={event=>set('date',event.target.value)}/>{showError('date')&&<small className="iaError">{showError('date')}</small>}</label>
        <label className="iaField">Reference number<input value={form.number||''} readOnly={!referenceEditable} onChange={event=>set('number',event.target.value)}/>{referenceEditable?<small className="iaHelp">Generated automatically · edit only if the organisation numbering policy allows it.</small>:<small className="iaHelp">Reference editing is switched off in accounting settings.</small>}</label>
        <div className="iaField iaFieldWide">
          <span className="iaLabel">Organisation and branch / location *</span>
          {scopeState.showOrganisation||scopeState.showBranch
            ?<OrganisationBranchScope organisations={organisations} companyIds={[form.companyId]} branchIds={[form.branchId]} onChange={changeScope} label="Adjustment scope" showLine={false} strip={form.companyName+' · '+form.branchName}/>
            :<output className="iaScopeStatic">{form.companyName||'No organisation'} · {form.branchName||'No branch'}</output>}
          <small className="iaHelp">Branches are filtered by the selected organisation, and every item line is keyed to its own location.</small>
          {(showError('companyId')||showError('branchId'))&&<small className="iaError">{showError('companyId')||showError('branchId')}</small>}
        </div>
        <div className="iaField">
          <span className="iaLabel">Adjustment account *</span>
          <JournalAccountPicker value={form.account||''} accounts={postingAccounts} onChange={code=>set('account',code)}/>
          <small className="iaHelp">The account the gain or loss is posted to. Configured in accounting settings and always chosen from the Chart of Accounts.</small>
          {showError('account')&&<small className="iaError">{showError('account')}</small>}
        </div>
        <label className="iaField">Reason *<select value={form.reason||''} onChange={event=>set('reason',event.target.value)}><option value="">Select a reason</option>{ADJUSTMENT_REASONS.map(reason=><option key={reason}>{reason}</option>)}</select>{showError('reason')&&<small className="iaError">{showError('reason')}</small>}</label>
        <label className="iaField iaFieldWide">Notes<textarea rows={2} value={form.notes||''} placeholder="Explain the adjustment for the approval trail (optional)" onChange={event=>set('notes',event.target.value)}/></label>
      </div>
    </div>
    <div className="opsCard iaCard iaItemsCard">
      <header className="iaCardHead">
        <div><h2>Items</h2><p>{valueType?'Current quantity stays unchanged: only the stock value moves.':'Stock value follows the item rate, so a quantity correction is always valued. '}At least one item is required.</p></div>
        <div className="iaItemsTools">
          <div className="iaSegmented iaModeToggle" role="group" aria-label="Entry mode">
            {ADJUSTMENT_ENTRY_MODES.map(mode=><button type="button" key={mode} aria-pressed={entryMode===mode} className={entryMode===mode?'active':''} onClick={()=>set('entryMode',mode)}>{mode==='Adjust By'?'Adjust By':(valueType?'Set New Value':'Set New Quantity')}</button>)}
          </div>
          <button type="button" onClick={addLine}><IconPlus/>Add Item</button>
        </div>
      </header>
      <div className="iaItemsScroll">
        <table className="iaItemTable">
          <thead><tr>
            <th scope="col" className="iaStickyCol">Item</th>
            <th scope="col">Location</th>
            <th scope="col" className="iaNum">Current quantity</th>
            {valueType&&<th scope="col" className="iaNum">Current value</th>}
            <th scope="col" className="iaNum">{entryLabel}</th>
            <th scope="col" className="iaNum">{derivedLabel}</th>
            <th scope="col" className="iaActionsCell"><span className="iaSrOnly">Remove</span></th>
          </tr></thead>
          <tbody>
            {form.lines.map((line,index)=>{
              const row=computed.get(line.id),message=lineMessage(line);
              return <tr key={line.id} className={message?'iaRowInvalid':''}>
                <td className="iaStickyCol">
                  <select aria-label={'Item for line '+(index+1)} value={line.itemId||''} onChange={event=>setLine(line.id,'itemId',event.target.value)}>
                    <option value="">Select item</option>
                    {stockItems.map(item=><option key={item.id} value={item.id}>{item.name}{item.sku?' · '+item.sku:''}</option>)}
                  </select>
                  {message?<small className="iaError">{message}</small>:row?<small className="iaMuted">Priced at {money(row.rate)} per unit</small>:null}
                  {!stockItems.length&&<small className="iaHelp">No stock item belongs to this organisation yet. Create one under Inventory → Items.</small>}
                </td>
                <td><select aria-label={'Location for line '+(index+1)} value={line.locationId||''} onChange={event=>setLine(line.id,'locationId',event.target.value)}><option value="">Select location</option>{locationOptions.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></td>
                <td className="iaNum">{row?formatQuantity(row.currentQty)+(row.unit?' '+row.unit:''):'—'}</td>
                {valueType&&<td className="iaNum">{row?money(row.currentValue):'—'}</td>}
                <td className="iaNum"><input className="iaEntry" type="text" inputMode="decimal" aria-label={entryLabel+' for line '+(index+1)} placeholder={valueType?(entryMode==='Adjust By'?'-5000 or 5000':'45000'):(entryMode==='Adjust By'?'-3 or 5':'97')} value={line[entryKey]||''} onChange={event=>setLine(line.id,entryKey,event.target.value)}/></td>
                <td className={'iaNum iaDerived '+derivedTone(line)}>{derivedText(line)}</td>
                <td className="iaActionsCell"><button type="button" className="iaRemove" aria-label={'Remove line '+(index+1)} disabled={form.lines.length<2} onClick={()=>removeLine(line.id)}><IconTrash size={16}/></button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <section className="iaImpact" aria-label="Inventory impact summary">
        <h3>Inventory impact</h3>
        <dl>
          <div><dt>Total items</dt><dd>{impact.totals.items}</dd></div>
          {valueType?<>
            <div><dt>Current inventory value</dt><dd>{money(impact.totals.currentValue)}</dd></div>
            <div><dt>Value adjustment</dt><dd className={toneOf(impact.totals.valueDelta)}>{signedMoney(impact.totals.valueDelta)}</dd></div>
            <div><dt>New inventory value</dt><dd>{money(impact.totals.newValue)}</dd></div>
          </>:<>
            <div><dt>Quantity increased</dt><dd className={impact.totals.increased>0?'iaUp':''}>{impact.totals.increased>0?'+'+formatQuantity(impact.totals.increased):'—'}</dd></div>
            <div><dt>Quantity decreased</dt><dd className={impact.totals.decreased<0?'iaDown':''}>{impact.totals.decreased<0?formatQuantity(impact.totals.decreased):'—'}</dd></div>
            <div><dt>Net quantity change</dt><dd className={toneOf(impact.totals.netQuantity)}>{impact.totals.netQuantity>0?'+':''}{formatQuantity(impact.totals.netQuantity)}</dd></div>
            <div><dt>Estimated value impact</dt><dd className={toneOf(impact.totals.valueImpact)}>{signedMoney(impact.totals.valueImpact)}</dd></div>
          </>}
        </dl>
      </section>
    </div>
    <details className="iaAccounting">
      <summary><IconInfoCircle size={16}/><span>Accounting impact</span><span className={'iaBalanceChip '+(preview.balanced?'balanced':'unbalanced')}>{preview.balanced?'Debit equals credit':'Out of balance'}</span></summary>
      <div className="iaAccountingBody">
        {preview.lines.length
          ?<table className="iaEntryTable">
            <thead><tr><th scope="col">Account</th><th scope="col" className="iaNum">Debit</th><th scope="col" className="iaNum">Credit</th></tr></thead>
            <tbody>{preview.lines.map((entry,index)=><tr key={index}><td>{entry.name}<small>{entry.account} · generated from this adjustment</small></td><td className="iaNum">{entry.debit?money(entry.debit):'—'}</td><td className="iaNum">{entry.credit?money(entry.credit):'—'}</td></tr>)}</tbody>
            <tfoot><tr><th scope="row">Total</th><th className="iaNum">{money(preview.totalDebit)}</th><th className="iaNum">{money(preview.totalCredit)}</th></tr></tfoot>
          </table>
          :<p className="iaNote">{preview.note}</p>}
        <p className="iaNote">Wayvida Books generates this entry when the adjustment becomes Adjusted, so no debit or credit has to be entered by hand. Inventory Adjustments never post to cash or bank, and a draft or cancelled adjustment changes neither inventory nor accounting.</p>
      </div>
    </details>
    <footer className="iaFooter">
      <p className="iaFooterNote">{approval?'Approval is required for inventory adjustments: save the draft, submit it, and a finance manager or administrator approves it to update inventory and post the entry.':'Approval is switched off in settings, so Save & Adjust updates inventory and posts the entry immediately.'}</p>
      <div className="iaFooterActions">
        <button type="button" onClick={onBack}>Cancel</button>
        <button type="button" onClick={()=>{if(!onSaveDraft())setTouched(true)}}>Save as Draft</button>
        {approval
          ?<button type="button" className="primary" onClick={()=>{if(!onSubmit())setTouched(true)}}>Submit for Approval</button>
          :<button type="button" className="primary" disabled={!canPost} title={canPost?'':'Your adjustment role ('+role+') cannot post an adjustment. A finance manager or administrator posts it.'} onClick={()=>{if(!onSaveAndAdjust())setTouched(true)}}>Save &amp; Adjust</button>}
      </div>
    </footer>
  </>;
}

/* The detail screen is the adjustment's own record: what it did - or will do - to
   inventory and to the ledger, and who touched it. A posted adjustment is never
   edited here; it is corrected by a reversal document instead. */
function DetailPage({row,db,items,settings,role,branchNameOf,accountNameOf,onBack,onOpen,onEdit,onDuplicate,onExport,onCancel,onReverse,onAdjust,onSubmit,onNavigate}){
  const lines=storedLines(row);
  const valueType=row.type===VALUE_TYPE;
  const approval=settings.approvals?.inventoryAdjustments!==false;
  const journal=row.journalId?(db.journals||[]).find(entry=>entry.id===row.journalId):null;
  const preview=useMemo(()=>accountingPreview(db,items,row,settings,db.accounts||[]),[db,items,row,settings]);
  const correction=row.reversedBy?adjustmentRows(db).find(entry=>entry.id===row.reversedBy):null;
  const corrected=row.reversalOf?adjustmentRows(db).find(entry=>entry.id===row.reversalOf):null;
  const entries=journal?journal.lines.filter(line=>line.debit||line.credit).map(line=>({account:line.account,name:accountNameOf(line.account),debit:line.debit,credit:line.credit})):preview.lines;
  const totalDebit=sum(entries,'debit'),totalCredit=sum(entries,'credit');
  const totals={items:lines.length,qty:sum(lines,'qtyDelta'),increased:sum(lines.filter(line=>line.qtyDelta>0),'qtyDelta'),decreased:sum(lines.filter(line=>line.qtyDelta<0),'qtyDelta'),value:sum(lines,'valueImpact'),previousValue:sum(lines,'previousValue'),valueDelta:sum(lines,'valueDelta'),newValue:sum(lines,'newValue')};
  /* Only a step this role may actually take is offered, and the command refuses
     it again on its own side. A draft needs submitting while approval is on, and
     posting once it is off; a pending document needs an approver. */
  const canPost=adjustmentAllowed(role,'post');
  const statusAction=row.status==='Draft'
    ?(approval?{label:'Submit for approval',run:()=>onSubmit(row.id)}:canPost?{label:'Save & adjust',run:()=>onAdjust(row.id)}:null)
    :row.status==='Pending Approval'&&adjustmentAllowed(role,'approve')?{label:'Approve & adjust',run:()=>onAdjust(row.id)}:null;
  const menuActions=(ADJUSTMENT_ACTIONS[row.status]||['Export']).filter(action=>action!=='View'&&!(action==='Reverse'&&row.reversedBy));
  const menuHandlers={Edit:onEdit,Duplicate:onDuplicate,Export:onExport,Cancel:onCancel,Reverse:onReverse};
  const menuEntries=menuActions.map(action=>{const duty=ACTION_DUTY[action],allowed=!duty||adjustmentAllowed(role,duty),Icon=ACTION_ICONS[action];return {action,label:ACTION_LABELS[action]||action,icon:<Icon size={16}/>,danger:action==='Cancel'||action==='Reverse',disabled:!allowed,reason:`Your adjustment role (${role}) cannot ${action.toLowerCase()} this record.`}});
  const reversalAllowed=row.status==='Adjusted'&&!row.reversedBy&&adjustmentAllowed(role,'reverse');
  return <>
    <header className="opsHead">
      <div className="iaHeadIdentity">
        <button type="button" className="iaBack" aria-label="Back to inventory adjustments" onClick={onBack}><IconArrowLeft/></button>
        <div><span>Inventory</span><h1>{row.number}</h1><p>{row.type} · {fmtDate(row.date)} · {row.companyName||'No organisation'} · {row.branchName||branchNameOf(row.branchId)}</p></div>
      </div>
      <div className="iaHeadSide">
        <Badge value={row.status}/>
        {statusAction&&<button type="button" className="primary" onClick={statusAction.run}>{statusAction.label}</button>}
        {reversalAllowed&&<button type="button" onClick={()=>onReverse(row)}><IconArrowBackUp size={16}/>Create reversal</button>}
        <Kebab label={'More actions for '+row.number} entries={menuEntries} onPick={action=>menuHandlers[action](row)}/>
      </div>
    </header>
    {corrected&&<p className="iaNotice">This document corrects <button type="button" className="iaLink" onClick={()=>onOpen(corrected)}>{corrected.number}</button>.</p>}
    {correction&&<p className="iaNotice">This document was corrected by <button type="button" className="iaLink" onClick={()=>onOpen(correction)}>{correction.number}</button>.</p>}
    {row.status==='Draft'&&<p className="iaNotice">Draft adjustments do not change inventory quantities, inventory valuation or the ledger. Nothing is posted until the document becomes Adjusted.</p>}
    {row.status==='Cancelled'&&<p className="iaNotice">Cancelled on {stamp(row.cancelledAt)} by {row.cancelledBy||'Not recorded'}{row.cancellationReason?': '+row.cancellationReason:'.'} Inventory and accounting were never changed.</p>}
    <div className="opsCard iaCard">
      <header className="iaCardHead"><div><h2>Adjustment information</h2><p>The scope, reason and accounting account decided when the adjustment was raised.</p></div></header>
      <dl className="iaFacts">
        <div><dt>Date</dt><dd>{fmtDate(row.date)}</dd></div>
        <div><dt>Adjustment type</dt><dd>{row.type}</dd></div>
        <div><dt>Organisation</dt><dd>{row.companyName||row.companyId||'Not recorded'}</dd></div>
        <div><dt>Branch / location</dt><dd>{row.branchName||branchNameOf(row.branchId)}</dd></div>
        <div><dt>Reason</dt><dd>{row.reason||'Not recorded'}</dd></div>
        <div><dt>Adjustment account</dt><dd>{accountNameOf(row.account)}<small>{row.account||'Not mapped'}</small></dd></div>
        <div><dt>Created by</dt><dd>{row.createdBy||'Not recorded'}<small>{stamp(row.createdAt)}</small></dd></div>
        <div><dt>Last updated</dt><dd>{row.updatedBy||'Not recorded'}<small>{stamp(row.updatedAt)}</small></dd></div>
        {row.notes&&<div className="iaWide"><dt>Notes</dt><dd>{row.notes}</dd></div>}
      </dl>
    </div>
    <div className="opsCard iaCard">
      <header className="iaCardHead"><div><h2>Adjustment summary</h2><p>What this document changes for the selected items.</p></div></header>
      <div className="iaSummary">
        <article><span>Total items</span><strong>{totals.items}</strong><small>{totals.items===1?'item adjusted':'items adjusted'}</small></article>
        {valueType
          ?<><article><span>Current inventory value</span><strong>{money(totals.previousValue)}</strong><small>Before this adjustment</small></article>
            <article><span>Value adjustment</span><strong className={toneOf(totals.valueDelta)}>{signedMoney(totals.valueDelta)}</strong><small>Financial impact</small></article>
            <article><span>New inventory value</span><strong>{money(totals.newValue)}</strong><small>After this adjustment</small></article></>
          :<><article><span>Quantity change</span><strong className={toneOf(totals.qty)}>{totals.qty>0?'+':''}{formatQuantity(totals.qty)}</strong><small>{formatQuantity(totals.increased)} in · {formatQuantity(totals.decreased)} out</small></article>
            <article><span>Value impact</span><strong className={toneOf(totals.value)}>{signedMoney(totals.value)}</strong><small>Valued at the item rate</small></article>
            <article><span>Accounting</span><strong>{row.posted?'Posted':'Not posted'}</strong><small>{journal?journal.number:'No journal entry'}</small></article></>}
      </div>
      <div className="opsTable iaTable">
        <table className="iaItemTable">
          <thead><tr>
            <th scope="col" className="iaStickyCol">Item</th>
            <th scope="col">Location</th>
            {valueType
              ?<><th scope="col" className="iaNum">Quantity</th><th scope="col" className="iaNum">Previous value</th><th scope="col" className="iaNum">Value adjustment</th><th scope="col" className="iaNum">New value</th></>
              :<><th scope="col" className="iaNum">Previous quantity</th><th scope="col" className="iaNum">Adjustment</th><th scope="col" className="iaNum">New quantity</th><th scope="col" className="iaNum">Value impact</th></>}
          </tr></thead>
          <tbody>
            {lines.map(line=><tr key={line.id}>
              <td className="iaStickyCol">{line.name||'Unknown item'}<small>{line.sku||'No SKU'}{line.unit?' · '+line.unit:''}</small></td>
              <td>{branchNameOf(line.locationId)}</td>
              {valueType
                ?<><td className="iaNum">{formatQuantity(line.currentQty)}</td>
                  <td className="iaNum">{money(line.previousValue)}</td>
                  <td className={'iaNum '+toneOf(line.valueDelta)}>{signedMoney(line.valueDelta)}</td>
                  <td className="iaNum">{money(line.newValue)}</td></>
                :<><td className="iaNum">{formatQuantity(line.previousQty)}</td>
                  <td className={'iaNum '+toneOf(line.qtyDelta)}>{line.qtyDelta>0?'+':''}{formatQuantity(line.qtyDelta)}</td>
                  <td className="iaNum">{formatQuantity(line.newQty)}</td>
                  <td className={'iaNum '+toneOf(line.valueImpact)}>{signedMoney(line.valueImpact)}<small>at {money(line.rate||0)} each</small></td></>}
            </tr>)}
          </tbody>
          <tfoot><tr>
            <th scope="row" className="iaStickyCol">Total</th>
            <td>{lines.length} {lines.length===1?'line':'lines'}</td>
            {valueType
              ?<><td className="iaNum">—</td><td className="iaNum">{money(totals.previousValue)}</td><td className={'iaNum '+toneOf(totals.valueDelta)}>{signedMoney(totals.valueDelta)}</td><td className="iaNum">{money(totals.newValue)}</td></>
              :<><td className="iaNum">—</td><td className={'iaNum '+toneOf(totals.qty)}>{totals.qty>0?'+':''}{formatQuantity(totals.qty)}</td><td className="iaNum">—</td><td className={'iaNum '+toneOf(totals.value)}>{signedMoney(totals.value)}</td></>}
          </tr></tfoot>
        </table>
      </div>
    </div>
    <details className="iaAccounting" open>
      <summary><IconInfoCircle size={16}/><span>Accounting impact</span><span className={'iaBalanceChip '+(totalDebit===totalCredit?'balanced':'unbalanced')}>{totalDebit===totalCredit?'Debit equals credit':'Difference '+money(Math.abs(totalDebit-totalCredit))}</span></summary>
      <div className="iaAccountingBody">
        {entries.length
          ?<table className="iaEntryTable">
            <thead><tr><th scope="col">Account</th><th scope="col" className="iaNum">Debit</th><th scope="col" className="iaNum">Credit</th></tr></thead>
            <tbody>{entries.map((entry,index)=><tr key={entry.account+index}><td>{entry.name}<small>{entry.account}</small></td><td className="iaNum">{entry.debit?money(entry.debit):'—'}</td><td className="iaNum">{entry.credit?money(entry.credit):'—'}</td></tr>)}</tbody>
            <tfoot><tr><th scope="row">Total</th><th className="iaNum">{money(totalDebit)}</th><th className="iaNum">{money(totalCredit)}</th></tr></tfoot>
          </table>
          :<p className="iaNote">{row.posted?'No journal entry was required: the adjusted lines carry no stock value.':'No accounting entry is generated until the adjustment is posted.'}</p>}
        <p className="iaNote">{row.posted?'This entry is posted to the ledger, so Inventory Asset on the Balance Sheet and the gain, loss or expense on the Profit & Loss already reflect it. Inventory adjustments never create a cash movement.':'Wayvida Books generates this entry automatically when the adjustment becomes Adjusted. Debit and credit always balance, and no cash or bank account is touched.'}</p>
        <div className="iaAccountingActions">
          <button type="button" disabled={!journal} onClick={()=>onNavigate('Journal Entries')}><IconHistory size={16}/>{journal?'View Journal Entry':'Journal entry not posted'}</button>
          {journal&&<span className="iaMuted">{journal.number} · {journal.source} · posted by {journal.createdBy||'Not recorded'}</span>}
        </div>
      </div>
    </details>
    <div className="opsCard iaCard">
      <header className="iaCardHead"><div><h2>Activity history</h2><p>Every step recorded by the adjustment command, in order.</p></div></header>
      {adjustmentActivity(row).length
        ?<ol className="iaTimeline">{adjustmentActivity(row).map(entry=><li key={entry.id}><time>{stamp(entry.at)}</time><b>{entry.action}</b><small>by {entry.by||'Not recorded'}</small>{entry.note&&<p>{entry.note}</p>}</li>)}</ol>
        :<p className="iaNote">No activity has been recorded for this adjustment yet.</p>}
    </div>
    <footer className="iaFooter">
      <p className="iaFooterNote">{row.status==='Adjusted'?'A posted adjustment is never edited. Raise a correcting adjustment to change it, so the original entry and its reversal both stay in the ledger.':'This adjustment has not been posted, so inventory and accounting are unchanged.'}</p>
      <div className="iaFooterActions">
        <button type="button" onClick={onBack}>Back to adjustments</button>
        {row.status==='Draft'&&adjustmentAllowed(role,'save')&&<button type="button" onClick={()=>onEdit(row)}><IconEdit size={16}/>Edit draft</button>}
        {reversalAllowed&&<button type="button" className="primary" onClick={()=>onReverse(row)}><IconArrowBackUp size={16}/>Create Reversal / Correcting Adjustment</button>}
        {statusAction&&!reversalAllowed&&<button type="button" className="primary" onClick={statusAction.run}>{statusAction.label}</button>}
      </div>
    </footer>
  </>;
}

/* Cancellation and reversal both need a reason before the command will run, so
   the dialog collects it and the command stays the only place that acts. */
function AdjustmentDialog({dialog,setDialog,onConfirm}){
  const cancelling=dialog.kind==='cancel',reason=String(dialog.reason||'').trim();
  const field=(key,value)=>setDialog(current=>({...current,[key]:value}));
  return <div className="iaScrim" onMouseDown={event=>{if(event.target===event.currentTarget)setDialog(null)}}>
    <form className="iaModal" role="dialog" aria-modal="true" aria-labelledby="ia-dialog-title" onSubmit={event=>{event.preventDefault();if(reason)onConfirm()}}>
      <header>
        <div><span>Inventory</span><h2 id="ia-dialog-title">{cancelling?'Cancel this adjustment':'Create a correcting adjustment'}</h2><p>{cancelling?'A cancelled adjustment never changes inventory or accounting, and it stays in the register for the audit trail.':'A posted adjustment is corrected by a reversal document that mirrors it. The original entry is never edited or deleted.'}</p></div>
        <button type="button" aria-label="Close dialog" onClick={()=>setDialog(null)}><IconX/></button>
      </header>
      <div className="iaModalBody">
        {!cancelling&&<label className="iaField">Reversal date *<input type="date" value={dialog.date||''} onChange={event=>field('date',event.target.value)}/><small className="iaHelp">The reversal cannot be dated before the adjustment it corrects.</small></label>}
        <label className="iaField">{cancelling?'Cancellation reason *':'Reason for the reversal *'}<textarea rows={3} value={dialog.reason||''} onChange={event=>field('reason',event.target.value)} placeholder={cancelling?'Why is this adjustment being cancelled?':'What is being corrected?'}/></label>
      </div>
      <footer>
        <button type="button" onClick={()=>setDialog(null)}>Keep the adjustment</button>
        <button type="submit" className="primary" disabled={!reason}>{cancelling?'Cancel adjustment':'Create and post reversal'}</button>
      </footer>
    </form>
  </div>;
}
