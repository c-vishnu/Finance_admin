import {Fragment,useEffect,useMemo,useRef,useState} from 'react';
import {IconAlertTriangle,IconArchive,IconArrowLeft,IconCalendar,IconChartBar,IconCheck,IconChecklist,IconChevronDown,IconChevronRight,IconCircleCheck,IconClock,IconCopy,IconDeviceFloppy,IconDots,IconDownload,IconEdit,IconEye,IconFileExport,IconFilter,IconInfoCircle,IconPlayerPlay,IconPlus,IconRefresh,IconSearch,IconSend,IconSettings,IconTrash,IconTrendingDown,IconTrendingUp,IconUpload,IconX} from '@tabler/icons-react';
import {readAccounts} from './account-store.js';
import {money} from './invoice-engine.js';
import {
  BUDGET_PERIODS,BUDGET_SCOPES,BUDGET_TEMPLATES,BUDGET_TYPES,FINANCIAL_YEARS,MONTHS,QUARTERS,
  actualForAccount,activateBudget,approveBudget,archiveBudget,budgetDateError,budgetDateRange,budgetDurationLabel,budgetToCSV,completeBudget,computeAlerts,computeForecast,computeSummary,computeVarianceRows,createBudget,createRevision,deleteBudget,duplicateBudget,financialYearRange,parseBudgetCSV,periodCount,periodLabels,plannedTotal,readBudgets,logBudgetActivity,restoreRevision,setBudgetStatus,totalOf,updateBudget,varianceDirection,writeBudgets
} from './budget-store.js';
import {ACCOUNT_TYPE_ORDER,accountTypeLabel,useTerminology} from './terminology.jsx';
import {normaliseScope,scopePickerState} from './organisation-scope.js';
import {getAccessibleOrganizations,getScopeOrganisations} from './organisation-context.js';
import EmptyState from './EmptyState.jsx';
import OrganisationBranchScope from './OrganisationBranchScope.jsx';
import {BUDGET_STATEMENTS,budgetBalanceCheck,budgetStatementRows,budgetTotalRows} from './budget-statements.js';
import './budget-workspace.css';

const inr=value=>money(Math.round(Number(value||0)*100));
/* The one date reading the budget screens print, matching the journal and
   Period Lock date style: 01 Apr 2026. */
const fmtDate=value=>value?new Date(`${value}T00:00:00`).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—';
const statusClass=status=>String(status).toLowerCase().replace(/\s+/g,'-');
const scopeText=scope=>scope?.organisationName?`${scope.organisationName} · ${scope.branchName||'All branches'}`:(scope?.type==='Entire Organisation'?'All branches':scope?.name||scope?.type||'All branches');
const menuRun=handler=>event=>{event.currentTarget.closest('details')?.removeAttribute('open');handler()};
const BUDGET_DETAIL_TABS=[
  ['Overview','Overview'],
  ['Profit and Loss','Profit & Loss'],
  ['Balance Sheet','Balance Sheet'],
  ['Cash Flow Statement','Cash Flow'],
  ['Budget vs Actual','Budget vs Actual'],
  ['Accounts','Accounts'],
  ['Activity History','Activity History'],
  ['Revisions','Revisions']
];
const BUDGET_DETAIL_DEFAULT='Overview';

/* The two statements the allocation grid groups its accounts under, so a planner
   reads the same profit and loss and balance sheet blocks the statements show. */
const BUDGET_ALLOCATION_BANDS=[['Profit & Loss',['Income','Expenses']],['Balance Sheet',['Assets','Liabilities','Equity']]];
/* How wide a plan is, said in the words the scope control uses. A budget stored
   before the scope picker keeps the summary it holds. */
function scopeSummary(scope){
  const organisations=(scope?.companyIds||[]).filter(Boolean).length;
  const branches=(scope?.branchIds||[]).filter(Boolean).length;
  if(!organisations&&!branches)return scopeText(scope);
  return `${organisations} ${organisations===1?'Organisation':'Organisations'} · ${branches} ${branches===1?'Branch':'Branches'}`;
}

function Status({value}){return <span className={`budgetStatus ${statusClass(value)}`}>{value}</span>}

function downloadText(filename,text,type='text/csv'){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;anchor.click();
  URL.revokeObjectURL(url);
}

export default function BudgetWorkspace({page='Budgets',notify=()=>{}}){
  const {mode}=useTerminology(),business=mode==='business';
  const [state,setState]=useState(readBudgets);
  const [screen,setScreen]=useState('list');
  const [selected,setSelected]=useState(null);
  const [detailTab,setDetailTab]=useState(BUDGET_DETAIL_DEFAULT);
  const [importPayload,setImportPayload]=useState(null);
  const save=next=>{setState(next);writeBudgets(next)};
  const accounts=useMemo(()=>{try{return readAccounts().accounts.filter(account=>account.active)}catch{return []}},[]);
  useEffect(()=>{const create=e=>{const {budgetId,label}=e.detail||{};try{save(createRevision(state,budgetId,label));notify('Revision created')}catch(error){notify(error.message)}};const restore=e=>{const {budgetId,revisionId}=e.detail||{};try{save(restoreRevision(state,budgetId,revisionId));notify('Revision restored')}catch(error){notify(error.message)}};window.addEventListener('wayvida-budget-revision',create);window.addEventListener('wayvida-budget-restore',restore);return()=>{window.removeEventListener('wayvida-budget-revision',create);window.removeEventListener('wayvida-budget-restore',restore)}},[state,save]);
  if(screen==='wizard')return <BudgetWizard importData={importPayload} initial={selected?state.budgets.find(item=>item.id===selected):null} accounts={accounts} business={business} back={()=>setScreen('list')} save={(input,status)=>{try{const next=selected?updateBudget(state,selected,{...input,status}):createBudget(state,{...input,status});save(next);notify(selected?'Budget updated':status==='Draft'?'Budget saved as draft':'Budget submitted for approval');setScreen('list');setSelected(null)}catch(error){notify(error.message)}}}/>;
  if(screen==='detail'&&selected){const budget=state.budgets.find(item=>item.id===selected);if(budget)return <BudgetDetail key={budget.id+'/'+detailTab} budget={budget} business={business} initialTab={detailTab} back={()=>{setScreen('list');setDetailTab(BUDGET_DETAIL_DEFAULT)}} onStatus={nextStatus=>{try{save(setBudgetStatus(state,selected,nextStatus));notify('Budget marked '+nextStatus)}catch(error){notify(error.message)}}} edit={()=>setScreen('wizard')} save={next=>{save(next);setSelected(next.budgets.find(item=>item.id===selected)?selected:null)}} duplicate={()=>{try{const next=duplicateBudget(state,selected);save(next);notify('Budget duplicated')}catch(error){notify(error.message)}}} exportBudget={()=>{downloadText(`${budget.name}.csv`,budgetToCSV(budget));notify('Budget exported as CSV')}} archive={()=>{try{save(archiveBudget(state,selected));notify('Budget archived')}catch(error){notify(error.message)}}} remove={()=>{if(!window.confirm(`Delete ${budget.name}? The budget will be archived, not permanently erased.`))return;try{save(deleteBudget(state,selected));setSelected(null);setScreen('list');notify('Budget deleted and archived')}catch(error){notify(error.message)}}}/>;}
  return <BudgetList state={state} accounts={accounts} business={business} create={()=>{setSelected(null);setImportPayload(null);setScreen('wizard')}} view={budget=>{setSelected(budget.id);setDetailTab('Budget vs Actual');setScreen('detail')}} viewStatement={budget=>{setSelected(budget.id);setDetailTab(BUDGET_DETAIL_DEFAULT);setScreen('detail')}} edit={budget=>{setSelected(budget.id);setScreen('wizard')}} save={save} duplicate={budget=>{try{save(duplicateBudget(state,budget.id));notify('Budget duplicated')}catch(error){notify(error.message)}}} exportBudget={budget=>{downloadText(`${budget.name}.csv`,budgetToCSV(budget));notify('Budget exported as CSV')}} archive={budget=>{try{save(archiveBudget(state,budget.id));notify('Budget archived')}catch(error){notify(error.message)}}} remove={budget=>{if(!window.confirm(`Delete ${budget.name}? The budget will be archived, not permanently erased.`))return;try{save(deleteBudget(state,budget.id));notify('Budget deleted and archived')}catch(error){notify(error.message)}}} importFile={file=>{const reader=new FileReader();reader.onload=()=>{try{const parsed=parseBudgetCSV(reader.result,accounts);setSelected(null);setImportPayload(parsed);setScreen('wizard')}catch(error){notify(error.message)}};reader.readAsText(file)}}/>;
}

function BudgetList({state,business,create,view,viewStatement,edit,duplicate,exportBudget,archive,remove,importFile}){
  const [filters,setFilters]=useState({query:'',year:'All years',type:'All types',period:'All periods',scope:'All scopes',status:'All statuses'});
  useEffect(()=>{const openMenus=()=>document.querySelectorAll('.budgetKebab[open],.budgetFiltersMore[open]');const closeOnPointerDown=event=>{openMenus().forEach(node=>{if(!node.contains(event.target))node.removeAttribute('open')})};const closeOnEscape=event=>{if(event.key==='Escape')openMenus().forEach(node=>node.removeAttribute('open'))};document.addEventListener('pointerdown',closeOnPointerDown);document.addEventListener('keydown',closeOnEscape);return()=>{document.removeEventListener('pointerdown',closeOnPointerDown);document.removeEventListener('keydown',closeOnEscape)}},[]);
  const budgets=state.budgets.filter(budget=>!budget.deleted);
  const list=budgets.filter(budget=>(filters.year==='All years'||budget.financialYear===filters.year)&&(filters.type==='All types'||budget.type===filters.type)&&(filters.period==='All periods'||budget.period===filters.period)&&(filters.scope==='All scopes'||budget.scope?.type===filters.scope)&&(filters.status==='All statuses'||budget.status===filters.status)&&budget.name.toLowerCase().includes(filters.query.toLowerCase()));
  const advancedDefaults={year:'All years',type:'All types',period:'All periods',scope:'All scopes',status:'All statuses'};
  const activeFilterCount=['year','type','period','scope','status'].filter(key=>filters[key]!==advancedDefaults[key]).length;
  const clearAdvanced=()=>setFilters({...filters,...advancedDefaults});
  return <section className="budgetV3">
    <div className="budgetV3Head registerHead"><div className="registerHeadText"><h2>{business?'Budgets':'Budget Management'} <span className="budgetHeadingCount">({budgets.length})</span></h2><p>Plan, monitor and control financial performance.</p></div><div className="budgetRegisterBar"><label className="budgetFilterSearch"><IconSearch size={17}/><input value={filters.query} onChange={event=>setFilters({...filters,query:event.target.value})} placeholder="Search budget or financial year" aria-label="Search budgets"/></label><details className="budgetFiltersMore"><summary aria-label="Open filters"><IconFilter size={17}/>Filters{activeFilterCount?<em className="budgetFilterBadge">{activeFilterCount}</em>:null}</summary><div className="budgetFiltersPanel"><label className="budgetFilterField"><span>Financial year</span><select className="budgetFilterYear" aria-label="Financial year" value={filters.year} onChange={event=>setFilters({...filters,year:event.target.value})}><option>All years</option>{FINANCIAL_YEARS.map(value=><option key={value}>{value}</option>)}</select></label><label className="budgetFilterField"><span>Budget type</span><select value={filters.type} onChange={event=>setFilters({...filters,type:event.target.value})}><option>All types</option>{BUDGET_TYPES.map(type=><option key={type.id}>{type.id}</option>)}</select></label><label className="budgetFilterField"><span>Budget period</span><select value={filters.period} onChange={event=>setFilters({...filters,period:event.target.value})}><option>All periods</option>{BUDGET_PERIODS.map(value=><option key={value}>{value}</option>)}</select></label><label className="budgetFilterField"><span>Scope</span><select value={filters.scope} onChange={event=>setFilters({...filters,scope:event.target.value})}><option>All scopes</option>{BUDGET_SCOPES.map(value=><option key={value}>{value}</option>)}</select></label><label className="budgetFilterField"><span>Status</span><select value={filters.status} onChange={event=>setFilters({...filters,status:event.target.value})}><option>All statuses</option>{['Draft','Pending Approval','Approved','Active','Completed','Archived'].map(value=><option key={value}>{value}</option>)}</select></label>{activeFilterCount?<div className="budgetFiltersPanelActions"><button type="button" onClick={clearAdvanced}>Clear filters</button></div>:null}</div></details></div><div className="budgetHeadActions"><button type="button" className="primary" onClick={create}><IconPlus size={17}/>Create Budget</button></div></div>
    <section className="budgetListCard">
      <table className="budgetTable"><thead><tr><th scope="col">Budget Name</th><th scope="col">Financial Year</th><th scope="col">Budget Period</th><th scope="col">Actions</th></tr></thead><tbody>{list.map(budget=><tr key={budget.id}><td><b>{budget.name}</b></td><td>{budget.financialYear}</td><td>{budget.period}</td><td className="budgetActionsCell"><div className="budgetRowActions"><button type="button" className="budgetRowView" aria-label={`View Details for ${budget.name}`} onClick={()=>view(budget)}><IconEye size={15}/>View Details</button><details className="budgetKebab"><summary aria-label={`More actions for ${budget.name}`}><IconDots size={17}/></summary><div className="budgetKebabMenu"><button type="button" onClick={menuRun(()=>viewStatement(budget))}><IconEye size={16}/>View budget</button><button type="button" onClick={menuRun(()=>edit(budget))}><IconEdit size={16}/>Edit</button><button type="button" onClick={menuRun(()=>duplicate(budget))}><IconCopy size={16}/>Duplicate</button><button type="button" className="budgetKebabDanger" onClick={menuRun(()=>remove(budget))}><IconTrash size={16}/>Delete</button></div></details></div></td></tr>)}{!list.length&&<tr className="emptyStateRow"><td colSpan="4" className="emptyStateCell"><EmptyState variant="budget" title="No budgets found" description="No budgets match these filters. Create a budget to start planning." actionLabel="Create Budget" onAction={create}/></td></tr>}</tbody></table>
    </section>
  </section>;
}

/* The scope a budget opens with: the working context the header is on, so a plan
   starts where the user is, and the whole accessible universe sits behind the
   control ready to widen it. A saved budget keeps the scope it was stored with,
   so editing a plan never silently re-scopes it. */
function wizardScopeSeed(initial){
  const stored={companyIds:(initial?.scope?.companyIds||[]).filter(Boolean),branchIds:(initial?.scope?.branchIds||[]).filter(Boolean)};
  if(stored.companyIds.length)return stored;
  const context=getAccessibleOrganizations();
  return {companyIds:context.map(organisation=>organisation.code),branchIds:context.flatMap(organisation=>organisation.branches.map(branch=>branch.id))};
}

export function BudgetWizard({initial,importData,accounts,business,back,save}){
  const [organisations,setOrganisations]=useState(getScopeOrganisations);
  const [growthPercent,setGrowthPercent]=useState(10),[closedGroups,setClosedGroups]=useState([]),[typeFilter,setTypeFilter]=useState('');
  const [step,setStep]=useState(importData?3:1),[query,setQuery]=useState(''),[error,setError]=useState('');
  const [templateOpen,setTemplateOpen]=useState(()=>Boolean(initial&&initial.template&&initial.template!=='Custom Budget'));
  const [form,setForm]=useState(()=>{const seed=wizardScopeSeed(initial),base={companyIds:seed.companyIds,branchIds:seed.branchIds};return initial?{name:initial.name,financialYear:initial.financialYear,period:initial.period,startDate:initial.startDate||'',endDate:initial.endDate||'',type:initial.type,template:initial.template||'Custom Budget',description:initial.description||'',accounts:initial.accounts,allocations:initial.allocations,...base}:{name:'',financialYear:FINANCIAL_YEARS[0],period:'Monthly',type:'Profit & Loss Budget',template:'Custom Budget',description:'',accounts:importData?.accounts||[],allocations:importData?.allocations||{},...base}});
  useEffect(()=>{if(importData){setForm(current=>({...current,accounts:importData.accounts,allocations:importData.allocations}));setStep(3)}},[importData]);
  useEffect(()=>{const refresh=()=>{const next=getScopeOrganisations();setOrganisations(next);setForm(current=>{if(!current.companyIds.length)return current;const aligned=normaliseScope({organisations:next,companyIds:current.companyIds,branchIds:current.branchIds});return {...current,companyIds:aligned.companyIds,branchIds:aligned.branchIds}})};window.addEventListener('wayvida-working-context-change',refresh);window.addEventListener('wayvida-organization-change',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('wayvida-working-context-change',refresh);window.removeEventListener('wayvida-organization-change',refresh);window.removeEventListener('storage',refresh)}},[]);
  const posting=accounts.filter(account=>account.active&&!account.isGroup);
  const visible=posting.filter(account=>!typeFilter||account.type===typeFilter).filter(account=>`${account.name} ${account.code} ${account.group||''} ${account.type}`.toLowerCase().includes(query.toLowerCase()));
  const count=periodCount(form.period),labels=periodLabels(form.period,form.financialYear);
  const customPeriod=form.period==='Custom';
  const yearRange=financialYearRange(form.financialYear);
  const duration=budgetDateRange(form.financialYear,form.period,form.startDate,form.endDate);
  const durationMeta=budgetDurationLabel(form.financialYear,form.period,form.startDate,form.endDate);
  const durationError=budgetDateError(form.financialYear,form.period,form.startDate,form.endDate);
  const scopeState=scopePickerState({organisations,companyIds:form.companyIds,branchIds:form.branchIds,label:'Budget scope'});
  const scope={type:form.branchIds.length?'Branch':'Entire Organisation',name:scopeState.branchSummary,organisationId:form.companyIds[0]||'',organisationName:scopeState.organisationSummary,branchId:form.branchIds[0]||'',branchName:scopeState.branchSummary,companyIds:form.companyIds,branchIds:form.branchIds};
  const changeScope=next=>setForm(current=>({...current,companyIds:next.companyIds||[],branchIds:next.branchIds||[]}));
  const toggle=account=>setForm(current=>({...current,accounts:current.accounts.some(item=>item.code===account.code)?current.accounts.filter(item=>item.code!==account.code):[...current.accounts,account]}));
  const selectAll=()=>setForm(current=>({...current,accounts:[...new Map([...current.accounts,...visible].map(account=>[account.code,account])).values()]}));
  const clearSelection=()=>setForm(current=>({...current,accounts:current.accounts.filter(account=>!visible.some(item=>item.code===account.code))}));
  const update=(code,key,value)=>setForm(current=>({...current,allocations:{...current.allocations,[code]:{...current.allocations[code],[key]:value}}}));
  const makePeriods=value=>Object.fromEntries(Array.from({length:count},(_,index)=>[`p${index+1}`,value]));
  const toggleGroup=type=>setClosedGroups(current=>current.includes(type)?current.filter(item=>item!==type):[...current,type]);
  const clearAllocation=()=>setForm(current=>({...current,allocations:{}}));
  const fill=(kind)=>setForm(current=>{const growth=1+Number(growthPercent||0)/100;const sourceValue=Number(current.allocations?.[current.accounts[0]?.code]?.p1||0);const allocations=Object.fromEntries(current.accounts.map(account=>{let value=0;if(kind==='copy'){value=Number(current.allocations?.[account.code]?.p1||0)}else if(kind==='distribute'){value=sourceValue}else if(kind==='average'){value=Math.round(actualForAccount(account,current.financialYear)/12)}else if(kind==='growth'){const planned=totalOf(current.allocations?.[account.code]||{});const base=planned>0?planned:actualForAccount(account,current.financialYear);value=Math.round(base*growth/12)}return [account.code,makePeriods(value)]}));return {...current,allocations}});
  const importFile=event=>{const file=event.target.files&&event.target.files[0];event.target.value='';if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=parseBudgetCSV(reader.result,posting);setError('');setForm(current=>({...current,accounts:parsed.accounts,allocations:parsed.allocations}))}catch(failure){setError(failure.message)}};reader.onerror=()=>setError('The file could not be read.');reader.readAsText(file)};
  const chooseTemplate=(template)=>{const keywords=template[3];const matches=!keywords.length?[]:posting.filter(account=>keywords.some(keyword=>`${account.name} ${account.group||''}`.toLowerCase().includes(keyword)));setForm(current=>({...current,template:template[0],accounts:matches,allocations:{}}))};
  const toggleTemplate=()=>{const next=!templateOpen;setTemplateOpen(next);if(!next)setForm(current=>({...current,template:'Custom Budget'}))};
  const next=()=>{if(step===1&&!form.name.trim())return setError('Enter a budget name.');if(step===1&&durationError)return setError(durationError);if(step===2&&!form.accounts.length)return setError('Select at least one account.');setError('');setStep(step+1)};
  const totalsRows=budgetTotalRows(form.accounts,form.allocations,form.period,form.financialYear);
  const balance=budgetBalanceCheck(form.accounts,form.allocations,form.period,form.financialYear);
  const allocationSections=BUDGET_ALLOCATION_BANDS.map(([band,types])=>[band,types.map(type=>[type,form.accounts.filter(account=>account.type===type)]).filter(([,rows])=>rows.length)]).filter(([,types])=>types.length);
  return <section className="budgetV3 budgetWizard">
    <div className="budgetV3Head budgetWizardHead"><button type="button" className="budgetHeadBack" onClick={back} aria-label="Back to budgets" title="Back to budgets"><IconArrowLeft size={19}/></button><div className="budgetHeadText"><span className="budgetHeadTitle">{initial?'Edit Budget':'Create Budget'}</span>{initial&&<small className="budgetHeadHint">Editing <b>{initial.name}</b></small>}</div></div>
    <nav className="budgetSteps" aria-label="Budget creation steps"><ol>{['Budget Details','Account Selection','Budget Allocation'].map((label,index)=>{const state=step===index+1?'active':step>index+1?'complete':'upcoming';return <li key={label} className={state}><button type="button" className={state} disabled={index+1>step} aria-current={state==='active'?'step':undefined} onClick={()=>index+1<step&&setStep(index+1)}><i>{state==='complete'?<IconCheck size={14}/>:index+1}</i><span>{label}</span></button></li>})}</ol><span className="budgetStepCount">Step {step} of 3</span></nav>
    {step===1&&<section className="budgetSetup">
      <div className="budgetSelectHead"><div><h2>Budget details</h2><p>Name the plan, choose the financial year and how often it is planned, then pick the organisations and branches it covers.</p></div><span className="budgetScopeSummary" aria-live="polite">{scopeSummary(form)}</span></div>
      <div className="budgetSetupFields">
        <label>Budget name *<input autoFocus value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="FY 2026-27 Marketing Plan"/></label>
        <div className="budgetScopeRow">
          <OrganisationBranchScope organisations={organisations} companyIds={form.companyIds} branchIds={form.branchIds} onChange={changeScope} label="Budget scope" showLine={false} multiple/>
        </div>
        <label>Financial year *<select value={form.financialYear} onChange={event=>setForm({...form,financialYear:event.target.value})}>{FINANCIAL_YEARS.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Budget period *<select value={form.period} onChange={event=>setForm({...form,period:event.target.value})}>{BUDGET_PERIODS.map(value=><option key={value}>{value}</option>)}</select></label>
        <div className="budgetDuration">
          <span className="budgetDurationLabel">Budget duration</span>
          <p className="budgetDurationRange">{duration.from?`${fmtDate(duration.from)} → ${fmtDate(duration.to)}`:'Choose the dates below'}</p>
          <p className="budgetDurationMeta">{durationMeta}</p>
          {customPeriod
            ?<div className="budgetDurationDates">
              <label>Start date *<input type="date" value={form.startDate||''} min={yearRange.from} max={yearRange.to} onChange={event=>setForm({...form,startDate:event.target.value})}/></label>
              <label>End date *<input type="date" value={form.endDate||''} min={yearRange.from} max={yearRange.to} onChange={event=>setForm({...form,endDate:event.target.value})}/></label>
            </div>
            :<p className="budgetDurationHint"><IconInfoCircle size={15}/>Dates are based on the selected financial year.</p>}
          {durationError?<p className="budgetDurationError" role="alert"><IconAlertTriangle size={15}/>{durationError}</p>:null}
        </div>
      </div>
      <label className="budgetTemplateSwitch"><input type="checkbox" role="switch" checked={templateOpen} onChange={toggleTemplate}/><span><b>Use a budget template</b><small>Start from a ready-made set of accounts.</small></span></label>
      {templateOpen&&<div className="budgetTemplateCards">{BUDGET_TEMPLATES.map(template=><button key={template[0]} type="button" className={form.template===template[0]?'active':''} onClick={()=>chooseTemplate(template)}><b>{template[1]}</b><small>{template[2]}</small></button>)}</div>}
    </section>}
    {step===2&&<section className="budgetSelect">
      <div className="budgetSelectHead"><div><h2>Select accounts</h2><p>{business?'Tick the money categories this budget should plan. They are listed under their money type.':'Tick the accounts this budget should plan. Every account is listed under its accounting type, with its code beneath the name; budgets only reference accounts and never change the Chart of Accounts.'}</p></div><span className="budgetSelectedCount">{form.accounts.length} {form.accounts.length===1?'account':'accounts'} selected</span></div>
      <div className="budgetSelectionTools"><label><IconSearch size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search by name, code or type" aria-label="Search accounts"/></label><select className="budgetTypeFilter" aria-label="Filter by account type" value={typeFilter} onChange={event=>setTypeFilter(event.target.value)}><option value="">All account types</option>{ACCOUNT_TYPE_ORDER.filter(type=>posting.some(account=>account.type===type)).map(type=><option key={type} value={type}>{accountTypeLabel(type,business)}</option>)}</select><button type="button" onClick={selectAll}>Select all</button><button type="button" onClick={clearSelection}>Clear all</button></div>
      <AccountSelectGrid accounts={visible} selected={form.accounts} toggle={toggle} business={business}/>
    </section>}
    {step===3&&<section className="budgetAllocation">
      <div className="budgetSelectHead"><div><h2>Budget allocation</h2><p>Set planned amounts for each account and period. Every cell stays editable, and the shortcuts fill the grid for you.</p></div>
        <div className="budgetAllocationActions">
          <button type="button" onClick={()=>fill('copy')}>Copy Previous Year</button>
          <button type="button" onClick={()=>fill('distribute')}>Distribute Equally</button>
          <button type="button" onClick={()=>fill('average')}>Use Average Spending</button>
          <label className="budgetGrowthField">Growth %<input type="number" min="-100" max="500" value={growthPercent} onChange={event=>setGrowthPercent(event.target.value)} aria-label="Growth percentage"/></label>
          <button type="button" onClick={()=>fill('growth')}>Apply Growth %</button>
          <label className="budgetImportButton"><IconUpload size={16}/>Import Budget<input type="file" accept=".csv,text/csv" onChange={importFile}/></label>
          <button type="button" className="budgetClearAll" onClick={clearAllocation}>Clear All</button>
        </div>
      </div>
      <div className="budgetAllocationGrid"><table aria-label={`Budget allocation for ${form.name||'this budget'}`}>
        <thead><tr><th scope="col" className="budgetStickyCol">Account</th>{labels.map(label=><th scope="col" key={label}>{label}</th>)}<th scope="col">Total</th></tr></thead>
        <tbody>{allocationSections.map(([band,types])=><Fragment key={band}>
          <tr className="budgetAllocBand"><th scope="rowgroup" colSpan={count+2}>{band}</th></tr>
          {types.map(([type,rows])=>{const closed=closedGroups.includes(type);return <Fragment key={type}>
            <tr className="budgetAllocGroup"><th scope="rowgroup" colSpan={count+2}><button type="button" aria-expanded={!closed} onClick={()=>toggleGroup(type)}>{closed?<IconChevronRight size={15}/>:<IconChevronDown size={15}/>}<b>{accountTypeLabel(type,business)}</b><span>{rows.length} {rows.length===1?'account':'accounts'}</span></button></th></tr>
            {!closed&&rows.map(account=>{const row=form.allocations[account.code]||{};return <tr key={account.code}><td className="budgetStickyCol"><b>{account.name}</b>{!business&&<small>{account.code}</small>}</td>{Array.from({length:count},(_,index)=><td key={index}><input min="0" type="number" value={row[`p${index+1}`]||''} onChange={event=>update(account.code,`p${index+1}`,event.target.value)} placeholder="0" aria-label={`${account.name} period ${index+1}`}/></td>)}<td><b>{inr(plannedTotal(row,count))}</b></td></tr>})}
          </Fragment>})}
        </Fragment>)}</tbody></table>
        {!form.accounts.length&&<p className="budgetEmpty">No account is selected yet. Go back to Account Selection to choose the accounts this plan covers.</p>}
      </div>
      <section className="budgetTotals" aria-labelledby="budgetTotalsTitle">
        <div className="budgetTotalsHead"><h2 id="budgetTotalsTitle">Budget totals</h2><p>Planned totals for the whole budget. Profit and Loss is revenue less expense, and every figure is read from the same statement layer the reports use.</p></div>
        <div className="budgetTotalsGrid"><table aria-label="Budget totals for each period"><thead><tr><th scope="col"><span className="budgetSrOnly">Statement total</span></th>{labels.map(label=><th scope="col" key={label}>{label}</th>)}<th scope="col">Total</th></tr></thead><tbody>{totalsRows.map(row=><tr key={row.key} className={row.className||''}><th scope="row">{row.label}{row.note&&<small>{row.note}</small>}</th>{row.values.map((value,index)=><td key={index} className={value<0?'budgetTotalsNegative':''}>{row.percent?`${value}%`:inr(value)}</td>)}<td className={row.total<0?'budgetTotalsNegative':''}>{row.percent?`${row.total}%`:inr(row.total)}</td></tr>)}</tbody></table></div>
      </section>
      <section className={`budgetBalanceCheck ${balance.balanced?'balanced':'unbalanced'}`} aria-labelledby="budgetBalanceTitle">
        <div className="budgetPanelHead"><h2 id="budgetBalanceTitle">Budget balance check</h2><span>{balance.balanced?'Budget is balanced':'Budget requires adjustment'}</span></div>
        <dl>
          <div><dt>Total Assets</dt><dd>{inr(balance.assets)}</dd></div>
          <div><dt>Total Liabilities + Equity</dt><dd>{inr(balance.liabilitiesAndEquity)}</dd></div>
          <div className="budgetBalanceDifference"><dt>Balance Difference</dt><dd>{inr(balance.difference)}</dd></div>
        </dl>
        <p className="budgetBalanceNote">{balance.balanced?'Budget is balanced. Planned assets equal planned liabilities and equity.':balance.difference>0?`Budget requires adjustment. Assets exceed Liabilities & Equity by ${inr(balance.difference)}.`:`Budget requires adjustment. Liabilities & Equity exceed Assets by ${inr(-balance.difference)}.`}</p>
      </section>
    </section>}
    {error&&<p className="budgetError"><IconAlertTriangle size={16}/>{error}</p>}
    <footer className="budgetWizardActions">{step===1?<button type="button" onClick={back}>Cancel</button>:<button type="button" onClick={()=>setStep(step-1)}><IconArrowLeft size={16}/>Back</button>}{step<3?<button type="button" className="primary" onClick={next}>{step===1?'Next':'Continue'}</button>:<button type="button" className="primary" onClick={()=>save({...form,scope},initial?initial.status||'Draft':'Draft')}><IconCheck size={16}/>{initial?'Save Changes':'Create Budget'}</button>}</footer>
  </section>;
}

export function AccountSelectGrid({accounts,selected,toggle,business}){
  const [closed,setClosed]=useState([]);
  const sections=ACCOUNT_TYPE_ORDER.map(type=>[type,accounts.filter(account=>account.type===type)]).filter(([,rows])=>rows.length);
  const untyped=accounts.filter(account=>!ACCOUNT_TYPE_ORDER.includes(account.type));
  if(untyped.length)sections.push(['Other',untyped]);
  return <div className="budgetAccountGrid"><table aria-label={business?'Money categories in the chart of accounts':'Accounts in the chart of accounts'}><thead><tr><th scope="col" className="budgetChooseCell"><span className="budgetSrOnly">Choose</span></th><th scope="col">{business?'Money category':'Account'}</th></tr></thead><tbody>{sections.map(([type,rows])=>{const chosen=rows.filter(account=>selected.some(item=>item.code===account.code)).length;const folded=closed.includes(type);return [<tr key={type} className="budgetGroupRow"><th scope="colgroup" colSpan={2}><button type="button" className="budgetGroupCell" aria-expanded={!folded} onClick={()=>setClosed(folded?closed.filter(item=>item!==type):[...closed,type])}>{folded?<IconChevronRight size={15}/>:<IconChevronDown size={15}/>}<b>{accountTypeLabel(type,business)}</b><span>{chosen?`${chosen} of ${rows.length} selected`:`${rows.length} ${rows.length===1?'account':'accounts'}`}</span></button></th></tr>,...(folded?[]:rows.map(account=>{const checked=selected.some(item=>item.code===account.code),boxId=`budget-account-${account.code}`;return <tr key={account.code} className={checked?'budgetRowChosen':''}><td className="budgetChooseCell"><input id={boxId} type="checkbox" aria-label={`${account.name} ${account.code}`} checked={checked} onChange={()=>toggle(account)}/></td><td className="budgetAccountCell"><label htmlFor={boxId}><b>{account.name}</b><small>{account.group&&account.group!==account.type?`${account.code} · ${account.group}`:account.code}</small></label></td></tr>}))]})}{!accounts.length&&<tr><td colSpan={2} className="budgetEmpty">No matching active posting accounts.</td></tr>}</tbody></table></div>;
}

function BudgetDetail({budget,business,initialTab,back,edit,duplicate,exportBudget,archive,remove,onStatus}){
  const [tab,setTab]=useState(initialTab||BUDGET_DETAIL_DEFAULT);
  useEffect(()=>{const openMenus=()=>document.querySelectorAll('.budgetDetailMore[open]');const closeOnPointerDown=event=>{openMenus().forEach(node=>{if(!node.contains(event.target))node.removeAttribute('open')})};const closeOnEscape=event=>{if(event.key==='Escape')openMenus().forEach(node=>node.removeAttribute('open'))};document.addEventListener('pointerdown',closeOnPointerDown);document.addEventListener('keydown',closeOnEscape);return()=>{document.removeEventListener('pointerdown',closeOnPointerDown);document.removeEventListener('keydown',closeOnEscape)}},[]);
  const summary=computeSummary(budget);
  const varianceRows=computeVarianceRows(budget);
  const forecast=computeForecast(budget);
  const alerts=computeAlerts(budget);
  const utilisation=summary.total?Math.round(varianceRows.reduce((sum,row)=>sum+row.actual,0)/summary.total*100):0;
  const statusAction=budget.status==='Draft'?['Pending Approval','Submit for approval']:budget.status==='Pending Approval'?['Approved','Approve budget']:budget.status==='Approved'?['Active','Activate budget']:budget.status==='Active'?['Completed','Mark complete']:null;
  return <section className="budgetV3 budgetDetailV3">
    <div className="budgetV3Head budgetDetailHead"><button type="button" className="budgetHeadBack" onClick={back} aria-label="Back to budgets" title="Back to budgets"><IconArrowLeft size={19}/></button><div className="budgetHeadText"><span className="budgetHeadTitle">Budget Details</span><small className="budgetHeadHint">Back to budgets</small></div></div>
    <div className="budgetDetailIdentityRow"><div className="budgetDetailIdentity"><div className="budgetDetailName"><h1>{budget.name}</h1><Status value={budget.status}/></div><p className="budgetDetailMeta">{budget.financialYear} · {budget.period} · {scopeSummary(budget.scope)} · {budget.type}</p></div><div className="budgetDetailActions">{statusAction&&<button type="button" className="primary" onClick={()=>onStatus(statusAction[0])}><IconCircleCheck size={16}/>{statusAction[1]}</button>}<details className="budgetDetailMore"><summary className="budgetDetailMoreBtn"><IconDots size={17}/>More actions<IconChevronDown className="budgetDetailMoreCaret" size={16}/></summary><div className="budgetDetailMoreMenu"><button type="button" onClick={menuRun(edit)}><IconEdit size={16}/>Edit</button><button type="button" onClick={menuRun(duplicate)}><IconCopy size={16}/>Duplicate</button><button type="button" onClick={menuRun(exportBudget)}><IconDownload size={16}/>Export</button><button type="button" onClick={menuRun(archive)}><IconArchive size={16}/>Archive</button><button type="button" className="budgetKebabDanger" onClick={menuRun(remove)}><IconTrash size={16}/>Delete</button></div></details></div></div>
    <nav className="budgetAccountTabs">{BUDGET_DETAIL_TABS.map(([key,label])=><button key={key} type="button" className={tab===key?'active':''} onClick={()=>setTab(key)}>{label}</button>)}</nav>
    <section className="budgetDetailBody">
      {tab==='Overview'&&<BudgetOverview budget={budget} business={business}/>}
      {BUDGET_STATEMENTS.includes(tab)&&<BudgetStatementView statement={tab} budget={budget} business={business}/>}
      {tab==='Budget vs Actual'&&<VsActual rows={varianceRows} business={business}/>}
      {tab==='Accounts'&&<BudgetAccountsTable budget={budget} rows={varianceRows} business={business}/>}
      {tab==='Activity History'&&<div className="budgetActivity">{budget.activity.map(item=><article key={item.at}><b>{item.action}</b><span>{item.by} · {new Date(item.at).toLocaleString('en-IN')}</span></article>)}</div>}
      {tab==='Revisions'&&<RevisionPanel budget={budget}/>}
    </section>
  </section>;
}

/* The budget statement view: the same planned amounts the allocation step
   collected, read as one of the three standard statements. Every figure comes
   from budgetStatementRows, so the view never totals the grid for itself and a
   statement can never disagree with the allocation step. */
export function BudgetStatementView({statement,budget,business}){
  const labels=periodLabels(budget.period,budget.financialYear);
  const rows=budgetStatementRows(statement,budget.accounts,budget.allocations,budget.period,budget.financialYear);
  const bands={section:'budgetStatementSection',type:'budgetStatementType',group:'budgetStatementGroup'};
  return <div className="budgetStatement">
    <div className="budgetAllocationGrid"><table aria-label={`${statement} for ${budget.name}`}>
      <thead><tr><th scope="col">Account</th>{labels.map(label=><th scope="col" key={label}>{label}</th>)}<th scope="col">Total</th></tr></thead>
      <tbody>{rows.map(row=>{
        if(bands[row.kind])return <tr key={row.key} className={bands[row.kind]}><th scope="rowgroup" colSpan={labels.length+2}>{row.label}</th></tr>;
        const amounts=<>{row.values.map((value,index)=><td key={index} className={value<0?'budgetStatementNegative':''}>{inr(value)}</td>)}<td className={row.total<0?'budgetStatementNegative':''}>{inr(row.total)}</td></>;
        if(row.kind==='account')return <tr key={row.key} className="budgetStatementRow"><td><b>{row.account.name}</b>{!business&&<small>{row.account.code}</small>}</td>{amounts}</tr>;
        if(row.kind==='check')return <tr key={row.key} className="budgetStatementCheck budgetStatementTotal"><th scope="row">{row.label}{row.note&&<small>{row.note}</small>}</th>{amounts}</tr>;
        return <tr key={row.key} className={`budgetStatementTotal${row.className?' '+row.className:''}`}><th scope="row">{row.label}{row.note&&<small>{row.note}</small>}</th>{amounts}</tr>;
      })}</tbody>
    </table></div>
    {!rows.length&&<p className="budgetEmpty">This budget plans no accounts for the {statement} yet.</p>}
  </div>;
}

/* The plan's own details, read only: what the wizard collected, including the
   accounts the budget references. Nothing here is an input, so the page can
   never edit a stored budget by accident. */
function BudgetDetailsPanel({budget,business}){
  const groups=budget.accounts.reduce((result,account)=>{const group=account.group||account.type;(result[group]??=[]).push(account);return result},{});
  return <section className="budgetDetailsPanel" aria-labelledby="budgetDetailsTitle">
    <div className="budgetPanelHead"><h2 id="budgetDetailsTitle">Budget details</h2><span>{budget.accounts.length} {budget.accounts.length===1?'account':'accounts'} selected</span></div>
    <dl className="budgetDetailsFacts">
      <div><dt>Budget name</dt><dd>{budget.name}</dd></div>
      <div><dt>Financial year</dt><dd>{budget.financialYear}</dd></div>
      <div><dt>Budget period</dt><dd>{budget.period}</dd></div>
      <div><dt>Budget scope</dt><dd>{scopeSummary(budget.scope)}</dd></div>
      {(budget.startDate||budget.endDate)?<div><dt>Budget duration</dt><dd>{budget.startDate?fmtDate(budget.startDate):'—'} → {budget.endDate?fmtDate(budget.endDate):'—'}</dd></div>:null}
      <div><dt>Budget type</dt><dd>{budget.type}</dd></div>
      {budget.description?<div className="budgetDetailsWide"><dt>Description</dt><dd>{budget.description}</dd></div>:null}
    </dl>
    <div className="budgetDetailsAccounts">
      <b>Selected accounts</b>
      {Object.entries(groups).map(([group,rows])=><div key={group} className="budgetDetailsGroup"><span>{group}</span><ul>{rows.map(account=><li key={account.code}><b>{account.name}</b>{!business&&<code>{account.code}</code>}</li>)}</ul></div>)}
      {!budget.accounts.length&&<p className="budgetEmpty">No account is selected for this budget.</p>}
    </div>
  </section>;
}

/* The overview the detail page opens on: how far the year has actually moved
   against the plan, the result the plan expects, and the alerts those figures
   raise. Every number is read from the budget and the posted journals through
   the engine, so the overview can never disagree with the statements. */
function BudgetOverview({budget,business}){
  const summary=computeSummary(budget);
  const rows=computeVarianceRows(budget);
  const forecast=computeForecast(budget);
  const alerts=computeAlerts(budget);
  const utilisation=summary.total?Math.round(rows.reduce((sum,row)=>sum+row.actual,0)/summary.total*100):0;
  const actualFor=type=>rows.filter(row=>row.account.type===type).reduce((sum,row)=>sum+row.actual,0);
  const health=[
    {key:'revenue',label:'Revenue',planned:summary.income,actual:actualFor('Income')},
    {key:'expenses',label:'Expenses',planned:summary.expense,actual:actualFor('Expenses')}
  ];
  const unit=budget.period==='Monthly'?'months':budget.period==='Quarterly'?'quarters':budget.period==='Half-Yearly'?'half years':'periods';
  return <div className="budgetOverview">
    <div className="budgetSummaryCards"><article><span>Revenue Budget</span><b>{inr(summary.income)}</b></article><article><span>Expense Budget</span><b>{inr(summary.expense)}</b></article><article><span>Expected Profit / Loss</span><b className={summary.expectedProfit<0?'budgetOver':'budgetUnder'}>{inr(summary.expectedProfit)}</b></article><article><span>Budget Utilization</span><b>{utilisation}%</b></article></div>
    <BudgetDetailsPanel budget={budget} business={business}/>
    <section className="budgetPanel budgetHealth" aria-labelledby="budgetHealthTitle">
      <div className="budgetPanelHead"><h2 id="budgetHealthTitle">Budget health</h2><span>Planned against posted actuals</span></div>
      <div className="budgetHealthBars">{health.map(item=>{const percent=item.planned?Math.round(item.actual/item.planned*1000)/10:0;return <article key={item.key}><div><b>{item.label}</b><span>{inr(item.actual)} of {inr(item.planned)}</span></div><div className="budgetHealthTrack"><i style={{width:`${Math.min(100,Math.max(0,percent))}%`}}/></div><em>{percent}%</em></article>})}</div>
      <div className="budgetHealthResult"><div><span>Profit / Loss</span><b className={summary.expectedProfit<0?'budgetOver':'budgetUnder'}>{inr(summary.expectedProfit)}</b></div><small>Projected year end {inr(forecast.projectedYearEnd)} · {forecast.remaining} {unit} remaining</small></div>
    </section>
    <section className="budgetPanel budgetAlertsPanel" aria-labelledby="budgetAlertsTitle">
      <div className="budgetPanelHead"><h2 id="budgetAlertsTitle">Alerts</h2><span>{alerts.length?`${alerts.length} to review`:'Nothing needs attention'}</span></div>
      {alerts.length?<div className="budgetAlerts">{alerts.map((alert,index)=><p key={index} className={alert.level}><IconAlertTriangle size={15}/>{alert.message}</p>)}</div>:<p className="budgetEmpty">No budget alert is raised for this plan. Alerts follow the saved alert thresholds.</p>}
    </section>
  </div>;
}

/* Every account the plan references, with the budget, the posted actual, the
   variance and the two percentages. The filters narrow the list; they never
   change a figure. */
function BudgetAccountsTable({budget,rows,business}){
  const [filters,setFilters]=useState({query:'',type:'All types',group:'All groups'});
  const types=[...new Set(rows.map(row=>row.account.type))].sort();
  const groups=[...new Set(rows.map(row=>row.account.group||row.account.type))].sort();
  const list=rows.filter(row=>(filters.type==='All types'||row.account.type===filters.type)&&(filters.group==='All groups'||(row.account.group||row.account.type)===filters.group)&&`${row.account.name} ${row.account.code}`.toLowerCase().includes(filters.query.toLowerCase()));
  return <div className="budgetAccountsView">
    <div className="budgetAccountFilters">
      <label className="budgetFilterSearch"><IconSearch size={17}/><input value={filters.query} onChange={event=>setFilters({...filters,query:event.target.value})} placeholder="Search account or code" aria-label="Search budgeted accounts"/></label>
      <select aria-label="Account type" value={filters.type} onChange={event=>setFilters({...filters,type:event.target.value})}><option>All types</option>{types.map(type=><option key={type}>{type}</option>)}</select>
      <select aria-label="Account group" value={filters.group} onChange={event=>setFilters({...filters,group:event.target.value})}><option>All groups</option>{groups.map(group=><option key={group}>{group}</option>)}</select>
      <span>Budget scope {scopeSummary(budget.scope)}</span>
    </div>
    <div className="budgetAllocationGrid"><table aria-label={`Budgeted accounts for ${budget.name}`}>
      <thead><tr><th scope="col">Account</th><th scope="col">Account Type</th><th scope="col">Budget</th><th scope="col">Actual</th><th scope="col">Variance</th><th scope="col">Variance %</th></tr></thead>
      <tbody>{list.map(row=><tr key={row.account.code}><td><b>{row.account.name}</b>{!business&&<small>{row.account.code}</small>}</td><td>{row.account.type}</td><td>{inr(row.budget)}</td><td>{inr(row.actual)}</td><td className={`budgetVariance ${row.direction}`}>{inr(row.variance)}</td><td className={`budgetVariance ${row.direction}`}>{row.percent>0?'+':''}{row.percent}%</td></tr>)}</tbody>
    </table>{!list.length&&<p className="budgetEmpty">No budgeted account matches these filters.</p>}</div>
  </div>;
}

/* Budget against actual. The variance is actual less budget, so a positive
   figure means more moved than was planned; whether that is good news depends
   on the account, which is why the colour comes from the engine's direction and
   not from the sign. Achievement - actual over budget - is a different figure
   and is labelled as itself. */
function VsActual({rows,business}){
  const totals=rows.reduce((sum,row)=>({budget:sum.budget+row.budget,actual:sum.actual+row.actual,variance:sum.variance+row.variance}),{budget:0,actual:0,variance:0});
  return <div className="budgetAllocationGrid budgetVarianceGrid"><table aria-label="Budget against actual for every budgeted account">
    <thead><tr><th scope="col">Account</th><th scope="col">Budget</th><th scope="col">Actual</th><th scope="col">Variance</th><th scope="col">Variance %</th><th scope="col">Achievement %</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.account.code}><td><b>{row.account.name}</b>{!business&&<small>{row.account.code}</small>}</td><td>{inr(row.budget)}</td><td>{inr(row.actual)}</td><td className={`budgetVariance ${row.direction}`}>{inr(row.variance)}</td><td className={`budgetVariance ${row.direction}`}>{row.percent>0?'+':''}{row.percent}%</td><td>{row.achievement}%</td></tr>)}
    </tbody>
    <tfoot><tr><th scope="row">Total</th><td>{inr(totals.budget)}</td><td>{inr(totals.actual)}</td><td className="budgetVariance neutral">{inr(totals.variance)}</td><td className="budgetVariance neutral">{totals.budget?(Math.round(totals.variance/totals.budget*1000)/10>0?'+':'')+(Math.round(totals.variance/totals.budget*1000)/10)+'%':'0%'}</td><td className="budgetVariance neutral">{totals.budget?Math.round(totals.actual/totals.budget*1000)/10+'%':'0%'}</td></tr></tfoot>
  </table></div>;
}

/* Budget versions, newest first, each with the total it planned. */
function RevisionPanel({budget}){
  const revisionTotal=revision=>Object.values(revision.allocations||{}).reduce((sum,row)=>sum+totalOf(row),0);
  return <div className="budgetRevisions"><button className="primary" onClick={()=>{const label=window.prompt('Revision label',`Revision ${budget.revisions.length+1}`);if(!label)return;window.dispatchEvent(new CustomEvent('wayvida-budget-revision',{detail:{budgetId:budget.id,label}}))}}><IconPlus size={15}/>Create Revision</button>{budget.revisions.map((revision,index)=><article key={revision.id}><div><b>Version {budget.revisions.length-index} · {revision.label}</b><span>{new Date(revision.createdAt).toLocaleString('en-IN')} · Updated by Admin · <b>{inr(revisionTotal(revision))}</b> total budget</span></div><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('wayvida-budget-restore',{detail:{budgetId:budget.id,revisionId:revision.id}}))}>Restore</button></article>)}{!budget.revisions.length&&<p className="budgetEmpty">No revision has been taken for this budget yet.</p>}</div>;
}






