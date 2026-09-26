import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workspace=readFileSync(new URL('../src/BudgetWorkspace.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/budget-workspace.css',import.meta.url),'utf8');
const statements=readFileSync(new URL('../src/budget-statements.js',import.meta.url),'utf8');

const stepOne=workspace.slice(workspace.indexOf("{step===1&&<section className=\"budgetSetup\">"),workspace.indexOf("{step===2&&<section className=\"budgetSelect\">"));
const stepTwo=workspace.slice(workspace.indexOf("{step===2&&<section className=\"budgetSelect\">"),workspace.indexOf("{step===3&&<section className=\"budgetAllocation\">"));
const stepThree=workspace.slice(workspace.indexOf("{step===3&&<section className=\"budgetAllocation\">"),workspace.indexOf("{error&&<p className=\"budgetError\">"));
const footer=workspace.slice(workspace.indexOf('<footer className="budgetWizardActions">'));
const grid=workspace.slice(workspace.indexOf('export function AccountSelectGrid('),workspace.indexOf('function BudgetDetail('));

test('Create Budget asks for the details, the budget scope and an optional template',()=>{
  assert.ok(workspace.includes("const [organisations,setOrganisations]=useState(getScopeOrganisations);"),'the wizard reads the scope universe the header Change / Customize drawer offers');
  assert.ok(workspace.includes("import {getAccessibleOrganizations,getScopeOrganisations} from './organisation-context.js';"),'both organisation lists come from the shared working-context module');
  assert.ok(workspace.includes("function wizardScopeSeed(initial){"),'the opening scope comes from one shared seed helper');
  assert.ok(workspace.includes("window.addEventListener('wayvida-working-context-change',refresh)")&&workspace.includes("window.addEventListener('storage',refresh)"),'the page re-reads the universe when the working context changes');
  assert.ok(workspace.includes("const [step,setStep]=useState(importData?3:1)"),'the wizard opens on the details step');
  assert.ok(workspace.includes("{['Budget Details','Account Selection','Budget Allocation'].map((label,index)=>"),'the page is three steps: details, accounts, allocation');
  assert.ok(!workspace.includes('Review Budget'),'the separate review step is gone');
  for(const field of ['Budget name *','Financial year *','Budget period *']){
    assert.ok(stepOne.includes('>'+field+'<'),'step one asks for '+field);
  }
  assert.ok(!stepOne.includes('>Budget type<'),'the hand written budget type selector is gone from step one');
  assert.ok(stepOne.includes('<div className="budgetSetupFields">')&&stepOne.includes('<label>Budget name *'),'the name is a plain one column field of the shared details grid');
  assert.ok(stepOne.includes('>Budget duration<'),'step one reads the duration its financial year and period imply');
  assert.ok(stepOne.includes('className="budgetDurationRange"')&&stepOne.includes('className="budgetDurationMeta"'),'the duration prints the range and the period it is planned in');
  assert.ok(stepOne.includes('{customPeriod')&&stepOne.includes('className="budgetDurationDates"'),'the date inputs are reached only through the custom branch');
  assert.ok(stepOne.includes('>Start date *<input type="date" value={form.startDate||')&&stepOne.includes('>End date *<input type="date" value={form.endDate||'),'a custom period asks for real dates, not free text');
  assert.ok(stepOne.includes('min={yearRange.from} max={yearRange.to}'),'the custom dates offer the financial year as their bounds');
  assert.ok(stepOne.includes('Dates are based on the selected financial year.'),'a standard period says where its dates come from');
  assert.ok(!stepOne.includes('>Description<')&&!stepOne.includes('>Start date<'),'the create page collects no description and a standard period renders no date field at all');
  assert.ok(!stepOne.includes('<textarea')&&workspace.includes("description:initial.description||''"),'the create page collects no description while editing still reopens with the one a stored budget holds');
  assert.ok(stepOne.includes('className="budgetScopeRow"')&&!stepOne.includes('budgetScopeLabel'),'the scope row carries no Budget scope label');
  assert.ok(stepOne.indexOf('Budget name')<stepOne.indexOf('budgetScopeRow'),'the budget name leads the details grid and the organisation and branch follow it');
  assert.ok(stepOne.indexOf('budgetSetupFields')<stepOne.indexOf('Budget name')&&stepOne.indexOf('Budget name')<stepOne.indexOf('budgetScopeRow')&&stepOne.indexOf('budgetScopeRow')<stepOne.indexOf('Financial year *')&&stepOne.indexOf('Financial year *')<stepOne.indexOf('Budget period *')&&stepOne.indexOf('Budget period *')<stepOne.indexOf('budgetDuration'),'the grid reads name, then organisation and branch, then year, period and duration');
  assert.ok(stepOne.includes('<OrganisationBranchScope organisations={organisations} companyIds={form.companyIds} branchIds={form.branchIds} onChange={changeScope} label="Budget scope" showLine={false} multiple/>'),'the scope row renders the shared organisation and branch control');
  assert.ok(workspace.includes("const scopeState=scopePickerState({organisations,companyIds:form.companyIds,branchIds:form.branchIds,label:'Budget scope'});"),'the visibility and the branch options come from the shared scope rule');
  assert.ok(workspace.includes("const changeScope=next=>setForm(current=>({...current,companyIds:next.companyIds||[],branchIds:next.branchIds||[]}));"),'changing the organisation or branch writes the resolved scope back');
  assert.ok(!stepOne.includes('budgetScopeHint')&&!stepOne.includes('Planning for'),'the details step states the plan scope once, through the head chip, with no second Planning for line');
  assert.ok(workspace.includes("const scope={type:form.branchIds.length?'Branch':'Entire Organisation',name:scopeState.branchSummary,organisationId:form.companyIds[0]||'',organisationName:scopeState.organisationSummary,branchId:form.branchIds[0]||'',branchName:scopeState.branchSummary,companyIds:form.companyIds,branchIds:form.branchIds};"),'the stored scope reads the shared summaries and keeps the chosen refs so editing reopens the same scope');
  assert.ok(!stepOne.includes('BUDGET_SCOPES')&&!stepOne.includes('value={form.scope.type}'),'the wizard no longer renders a hand written scope list');
  assert.ok(workspace.includes('<option>All scopes</option>{BUDGET_SCOPES.map(value=><option key={value}>{value}</option>)}'),'the register scope filter keeps the stored scope types');
  assert.ok(!workspace.includes('budgetPurposeCards'),'the budget type card grid is gone');
});

test('the budget template is behind a switch and the page is walked with Next, Continue and Create Budget',()=>{
  assert.ok(stepOne.includes('className="budgetTemplateSwitch"')&&stepOne.includes('role="switch"')&&stepOne.includes('checked={templateOpen} onChange={toggleTemplate}'),'the template is a switch');
  assert.ok(stepOne.includes('{templateOpen&&<div className="budgetTemplateCards">'),'the template choices only render while the switch is on');
  assert.ok(workspace.includes("const toggleTemplate=()=>{const next=!templateOpen;setTemplateOpen(next);if(!next)setForm(current=>({...current,template:'Custom Budget'}))};"),'switching the template off clears the template name');
  assert.ok(workspace.includes("const [templateOpen,setTemplateOpen]=useState(()=>Boolean(initial&&initial.template&&initial.template!=='Custom Budget'));"),'editing a templated budget starts with the switch on');
  assert.ok(workspace.includes("const durationError=budgetDateError(form.financialYear,form.period,form.startDate,form.endDate);"),'the inline validation reads one shared rule');
  assert.ok(workspace.includes("if(step===1&&durationError)return setError(durationError);"),'an invalid custom range stops the step from advancing');
  assert.ok(workspace.includes("const duration=budgetDateRange(form.financialYear,form.period,form.startDate,form.endDate);")&&workspace.includes("const durationMeta=budgetDurationLabel(form.financialYear,form.period,form.startDate,form.endDate);"),'the range and its reading come from the engine, never from the view');
  assert.ok(workspace.includes("startDate:initial.startDate||'',endDate:initial.endDate||''"),'editing a plan reopens with the dates it stored instead of losing a custom range');
  assert.ok(footer.includes("{step===1?<button type=\"button\" onClick={back}>Cancel</button>"),'step one cancels the whole page');
  assert.ok(footer.includes('<button type="button" onClick={()=>setStep(step-1)}><IconArrowLeft size={16}/>Back</button>}'),'later steps go back');
  assert.ok(footer.includes("{step<3?<button type=\"button\" className=\"primary\" onClick={next}>{step===1?'Next':'Continue'}</button>"),'step one says Next and the accounts step says Continue');
  assert.ok(footer.includes("{initial?'Save Changes':'Create Budget'}"),'the last step saves with Create Budget');
  assert.ok(!workspace.includes("save(form,'Draft')")&&!workspace.includes("save(form,'Pending Approval')"),'the old Save Draft and Submit for Approval buttons are gone from the create flow');
});

test('account selection lists every chart of accounts entry under its accounting type',()=>{
  assert.ok(workspace.includes('export function AccountSelectGrid({accounts,selected,toggle,business}){'),'the selection grid is a component of the budget module');
  assert.ok(workspace.includes('const posting=accounts.filter(account=>account.active&&!account.isGroup);'),'every active posting account is offered, whatever its type');
  assert.ok(workspace.includes("import {ACCOUNT_TYPE_ORDER,accountTypeLabel,useTerminology} from './terminology.jsx';"),'the type order and the type label come from the shared terminology module');
  assert.ok(grid.includes('const sections=ACCOUNT_TYPE_ORDER.map(type=>[type,accounts.filter(account=>account.type===type)]).filter(([,rows])=>rows.length);'),'accounts are grouped under their accounting type in chart order');
  assert.ok(grid.includes("if(untyped.length)sections.push(['Other',untyped]);"),'an account with an unknown type still lands in a section');
  assert.ok(grid.includes('className="budgetGroupRow"'),'each type is a row of the grid');
  assert.ok(grid.includes('<th scope="colgroup" colSpan={2}><button type="button" className="budgetGroupCell" aria-expanded={!folded}')&&grid.includes('<b>{accountTypeLabel(type,business)}</b>'),'the type row is a spanning column-group header that folds that type away');
  assert.ok(grid.includes("{chosen?`${chosen} of ${rows.length} selected`:`${rows.length} ${rows.length===1?'account':'accounts'}`}"),'the type row counts what is chosen');
  assert.ok(grid.includes('input id={boxId} type="checkbox" aria-label={`${account.name} ${account.code}`} checked={checked} onChange={()=>toggle(account)}'),'every account is toggled by a labelled checkbox with a stable id');
  assert.ok(grid.includes('<td className="budgetAccountCell"><label htmlFor={boxId}><b>{account.name}</b><small>'),'the account name carries its code underneath inside a label bound to the checkbox');
  assert.ok(grid.includes('<table aria-label={business?')&&grid.includes('<th scope="col" className="budgetChooseCell">'),'the grid is a named two column table of choose and account');
  assert.ok(!grid.includes('Account Type'),'the separate account type column is gone now that the type is the section');
  assert.ok(css.includes('.budgetAccountGrid .budgetAccountCell label{display:flex;flex-direction:column;gap:2px;padding:11px 14px;cursor:pointer}'),'the label inside the account cell stacks the name and the code');
  assert.ok(!css.includes('td{display:flex'),'no table cell is taken out of the table layout');
  assert.ok(stepTwo.includes('<AccountSelectGrid accounts={visible} selected={form.accounts} toggle={toggle} business={business}/>'),'step two renders the grid');
  assert.ok(!stepTwo.includes('budgetAccountTabs'),'the account type tabs are gone from the selection step');
  assert.ok(stepTwo.includes('>Select all</button>')&&stepTwo.includes('>Clear all</button>'),'the search tools keep a select all and a clear all');
  assert.ok(stepTwo.includes('<select className="budgetTypeFilter" aria-label="Filter by account type" value={typeFilter}'),'the selection step filters the list by account type');
  assert.ok(workspace.includes('const visible=posting.filter(account=>!typeFilter||account.type===typeFilter)'),'the type filter narrows the same list the search narrows');
  assert.ok(stepTwo.includes('{form.accounts.length} {form.accounts.length===1?\'account\':\'accounts\'} selected'),'the step states how many accounts are selected');
  assert.ok(stepTwo.includes('placeholder="Search by name, code or type"'),'the search covers the name, the code and the type');
  assert.ok(workspace.includes("{tab==='Accounts'&&<BudgetAccountsTable budget={budget} rows={varianceRows} business={business}/>}"),'the detail Accounts tab renders the filtered budgeted accounts table');
  assert.ok(!workspace.includes('function AccountTree('),'the superseded account tree renderer is gone');
});

test('the allocation step carries the summary and the new wizard styles stay in the budget design system',()=>{
  assert.ok(stepThree.includes('className="budgetAllocationGrid"'),'the chosen accounts are allocated in one grid');
  assert.ok(stepThree.includes('className="budgetTotals"')&&stepThree.includes('>Budget totals<'),'the allocation step closes with a budget totals section');
  assert.ok(stepThree.includes('{totalsRows.map(row=>')&&stepThree.includes('row.values.map((value,index)=>'),'the totals render one row per statement line in the same period columns as the grid');
  assert.ok(workspace.includes('const totalsRows=budgetTotalRows(form.accounts,form.allocations,form.period,form.financialYear);')&&statements.includes("{key:'revenue',label:'Total Revenue'")&&statements.includes("{key:'expense',label:'Total Expenses'")&&statements.includes("label:'Net Profit / Loss'")&&statements.includes("label:'Profit Margin'"),'the totals name the revenue, the expense, the net profit or loss and its margin, read from the shared statement layer');
  assert.ok(statements.includes("label:'Total Assets'")&&statements.includes("label:'Total Liabilities'")&&statements.includes("label:'Total Equity'")&&statements.includes("label:'Total Liabilities & Equity'"),'the totals name the assets, the liabilities and the equity');
  assert.ok(statements.includes('const netWorth=liabilities.map((value,index)=>value+equity[index]+profit[index]);')&&statements.includes('const mismatch=assets.map((value,index)=>value-netWorth[index]);'),'the balance check still derives its difference from the same planned columns');
  assert.ok(stepThree.includes('{totalsRows.map(row=>')&&stepThree.includes('className={`budgetBalanceCheck ${balance.balanced?\'balanced\':\'unbalanced\'}`}'),'the allocation step closes with the statement totals and the balance check');
  assert.ok(stepThree.includes('>Total Assets<')&&stepThree.includes('>Total Liabilities + Equity<')&&stepThree.includes('>Balance Difference<'),'the balance check names the two sides and the difference');
  assert.ok(stepThree.includes('Budget is balanced')&&stepThree.includes('Budget requires adjustment'),'the check reads as balanced or as needing adjustment, never as a budget account');
  assert.ok(statements.includes('const sumsFor=rows=>Array.from({length:count},(_,index)=>rows.reduce((sum,account)=>sum+amountOf(allocations,account.code,index),0));')&&statements.includes('const profit=revenue.map((value,index)=>value-expense[index]);'),'every total is derived from the allocation cells so a total can never drift from them');
  for(const token of [
    '.budgetAccountGrid{max-height:440px;overflow:auto;border:1px solid #e8edf3;border-radius:9px}',
    '.budgetAccountGrid thead th{position:sticky;top:0;z-index:1;padding:12px 14px;background:#f6f8fb;color:#667085;font-size:12px;text-align:left}',
    '.budgetAccountGrid tr.budgetGroupRow>*{padding:0;border-top:1px solid #e8edf3;background:#f7f9fc;color:#253550;text-align:left}',
    '.budgetAccountGrid .budgetGroupCell{display:flex;align-items:center;justify-content:flex-start;gap:12px;width:100%;min-height:48px;padding:8px 14px;border:0;border-radius:0;background:#f7f9fc;color:#253550;font-weight:650;cursor:pointer}',
    '.budgetAccountGrid .budgetGroupCell span{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;background:#e4eaf4;color:#55637a;font-size:12px;font-weight:600;line-height:1}',
    '.budgetAccountGrid tr.budgetGroupRow:has(.budgetGroupCell[aria-expanded="true"])>*{background:#eef4ff}',
    '.budgetAccountGrid .budgetGroupCell[aria-expanded="true"]{background:#eef4ff;box-shadow:inset 3px 0 0 #3478f6}',
    '.budgetAccountGrid .budgetAccountCell small{color:#667085;font-size:12px}',
    '.budgetAccountGrid .budgetChooseCell input{width:18px;height:18px;accent-color:var(--budget-blue);cursor:pointer}',
    '.budgetAccountGrid tbody tr:focus-within{background:#f4f7ff}',
    '.budgetTemplateSwitch{display:flex!important;flex-direction:row!important;align-items:center!important;gap:11px!important;margin-top:18px;padding:12px 14px;border:1px solid #e1e8f2;border-radius:9px;background:#f8fafc;cursor:pointer}',
    '.budgetScopeRow .pc-field select{min-height:40px;padding:8px 10px;border:1px solid #d9e1eb;border-radius:7px;background:#fff;color:#344054}',
    '.budgetWizardActions{display:flex;align-items:center;justify-content:flex-end;gap:9px}',
    '.budgetWizardActions button{min-height:40px;padding:0 16px;white-space:nowrap}',
    '.budgetWizard .budgetSetupFields{grid-template-columns:repeat(3,minmax(0,1fr))}',
    '.budgetWizard .budgetSetupFields .budgetScopeRow{grid-column:span 2;min-width:0}',
    '.budgetScopeRow .pc-fields{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
    '.budgetWizard .budgetSetupFields .budgetDuration{margin:0;padding:0;border:0;background:transparent}',
    '@media(max-width:1100px){.budgetWizard .budgetSetupFields,.budgetScopeRow .pc-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.budgetWizard .budgetSetupFields .budgetDuration{grid-column:span 2}.budgetWizard .budgetSetupFields .budgetDurationDates{grid-template-columns:repeat(2,minmax(0,1fr))}}',
  ])assert.ok(css.includes(token),token.slice(0,70));
  for(const token of ['.budgetTotals{margin-top:18px;padding:16px;border:1px solid #e1e8f2;border-radius:10px;background:#fbfcfe}','.budgetTotalsGrid tr.budgetTotalsDerived>*{background:#f1f5fb;font-weight:700}','.budgetTotalsGrid td.budgetTotalsNegative{color:#b42318}','.budgetBalanceCheck.balanced .budgetBalanceNote{border:1px solid #cdeadd;background:#f1faf5;color:#19734c}','.budgetBalanceCheck.unbalanced .budgetBalanceNote{border:1px solid #ffe4c4;background:#fff8f0;color:#8a4b09}','.budgetAllocBand>th{padding:10px 14px;','.budgetAllocGroup>th>button{display:flex;align-items:center;justify-content:flex-start;gap:12px;','.budgetImportButton{position:relative;','.budgetVariance.favourable{color:#19734c}','.budgetVariance.unfavourable{color:#b42318}','.budgetVariance.neutral{color:#475467}'])assert.ok(css.includes(token),token.slice(0,70));
  const block=css.slice(css.indexOf('.budgetWizard .budgetSetup>.budgetSetupFields'));
  const sizes=[...block.matchAll(/font-size:([\d.]+)px/g)].map(match=>Number(match[1]));
  assert.ok(sizes.length>=4&&Math.min(...sizes)>=12,'every new wizard style stays at 12px or larger');
});

test('an imported account list opens the wizard on the allocation step with those accounts',()=>{
  assert.ok(workspace.includes('accounts:importData?.accounts||[],allocations:importData?.allocations||{}'),'an imported draft seeds its accounts on the first render');
  assert.ok(workspace.includes("useEffect(()=>{if(importData){setForm(current=>({...current,accounts:importData.accounts,allocations:importData.allocations}));setStep(3)}},[importData]);"),'a later import still lands on the allocation step');
});

test('the budget detail screen advances the approval lifecycle the wizard no longer owns',()=>{
  assert.ok(workspace.includes("const statusAction=budget.status==='Draft'?['Pending Approval','Submit for approval']:budget.status==='Pending Approval'?['Approved','Approve budget']:budget.status==='Approved'?['Active','Activate budget']:budget.status==='Active'?['Completed','Mark complete']:null;"),'one button carries the next allowed status');
  assert.ok(workspace.includes('{statusAction&&<button type="button" className="primary" onClick={()=>onStatus(statusAction[0])}><IconCircleCheck size={16}/>{statusAction[1]}</button>}'),'the detail header renders the status action as the one primary action');
  assert.ok(workspace.includes("onStatus={nextStatus=>{try{save(setBudgetStatus(state,selected,nextStatus));notify('Budget marked '+nextStatus)}catch(error){notify(error.message)}}}"),'the status action runs the budget engine transition');
  assert.ok(workspace.includes('function BudgetDetail({budget,business,initialTab,back,edit,duplicate,exportBudget,archive,remove,onStatus}){'),'the detail screen accepts the status and delete handlers');
});
test('the create page opens with the journal style back head and a numbered progress stepper',()=>{
  assert.ok(workspace.includes('<div className="budgetV3Head budgetWizardHead">'),'the wizard keeps the page heading slot, restyled');
  assert.ok(workspace.includes('<button type="button" className="budgetHeadBack" onClick={back} aria-label="Back to budgets" title="Back to budgets"><IconArrowLeft size={19}/></button>'),'the head carries the arrow back button the journal create page uses');
  assert.ok(workspace.includes('</ol><span className="budgetStepCount">Step {step} of 3</span></nav>'),'the stepper card states the step position');
  assert.ok(workspace.includes('{initial&&<small className="budgetHeadHint">Editing <b>{initial.name}</b></small>}'),'editing names the budget inside the head');
  assert.ok(!workspace.includes('Set the budget scope, choose the accounts and plan the amounts.'),'the descriptive subtitle is gone');
  const wizardHead=workspace.slice(workspace.indexOf('<div className="budgetV3Head budgetWizardHead">'),workspace.indexOf('<nav className="budgetSteps"'));
  assert.ok(wizardHead.includes('className="budgetHeadBack"'),'the wizard head carries the arrow back button');
  assert.ok(!wizardHead.includes('className="budgetBack"'),'the wizard head no longer renders the text back link');
  assert.ok(!wizardHead.includes('budgetStepCount'),'the compact head no longer carries the chip');
  assert.ok(workspace.includes('<nav className="budgetSteps" aria-label="Budget creation steps"><ol>'),'the stepper is an ordered list');
  assert.ok(workspace.includes("const state=step===index+1?'active':step>index+1?'complete':'upcoming';"),'each step derives one state');
  assert.ok(workspace.includes("aria-current={state==='active'?'step':undefined}"),'the active step is announced to assistive tech');
  assert.ok(workspace.includes('disabled={index+1>step}'),'a later step is not clickable before its turn');
  assert.ok(workspace.includes("<i>{state==='complete'?<IconCheck size={14}/>:index+1}</i>"),'a finished step shows a tick instead of its number');
  assert.ok(stepOne.includes('<div className="budgetSelectHead"><div><h2>Budget details</h2><p>Name the plan, choose the financial year and how often it is planned, then pick the organisations and branches it covers.</p></div><span className="budgetScopeSummary" aria-live="polite">{scopeSummary(form)}</span></div>'),'step one is headed like the other two, with the plan scope stated as a chip');
  assert.ok(workspace.includes('<div className="budgetV3Head budgetDetailHead">')&&workspace.includes('<span className="budgetHeadTitle">Budget Details</span>'),'the detail screen carries the same arrow-led back head as the create page');
  assert.ok(!workspace.includes('className="budgetBack"'),'the old inline text back link is gone from both budget screens');
  assert.ok(!css.includes('.budgetBack{'),'the retired text back link styling is gone');
  assert.ok(!css.includes('.budgetSteps button{flex:1;justify-content:flex-start;'),'the underline tab styling is gone');
  assert.ok(!css.includes('.budgetSteps{overflow:auto}'),'the tab scroll rule is gone');
  for(const token of [
    '.app main:has(>.budgetV3.budgetWizard){max-width:none!important;padding:0!important}',
    '.app main>.budgetV3.budgetWizard{max-width:none!important;margin:0!important;padding:0 0 28px!important}',
    '.app main>.budgetV3.budgetWizard>:not(.budgetV3Head){margin-left:clamp(16px,2.2vw,32px)!important;',
    '.app main>.budgetV3.budgetWizard>.budgetV3Head.budgetWizardHead{display:grid!important;grid-template-columns:40px minmax(0,1fr)!important;align-items:center!important;gap:14px!important;width:100%!important;',
    '.budgetV3 .budgetHeadBack{display:inline-grid;place-items:center;width:40px;height:40px;',
    '.budgetHeadTitle{overflow:hidden;color:#172033;font-size:16px;font-weight:650;',
    '.budgetHeadText{display:flex;flex-direction:column;gap:1px;min-width:0;overflow:hidden}',
    '.budgetV3 .budgetStepCount{display:inline-flex;align-items:center;justify-self:end;min-height:28px;',
    '.budgetSteps{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px;',
    '.budgetSteps>ol{display:flex;align-items:center;gap:0;margin:0;padding:0;list-style:none}',
    '.budgetSteps>ol>li{position:relative;display:flex;flex:1 1 170px;min-width:0}',
    '.budgetSteps>ol>li:not(:last-child)::after{content:"";position:absolute;z-index:0;top:12px;left:36px;right:12px;',
    '.budgetSteps>ol>li.active:not(:last-child)::after{background:linear-gradient(90deg,var(--budget-blue) 0,var(--budget-blue) 50%,#e1e6ed 50%,#e1e6ed 100%)}',
    '.budgetSteps>ol>li.upcoming:not(:last-child)::after{background:#e8edf3}',
    '.budgetV3 .budgetSteps button{position:relative;z-index:1;display:flex;align-items:center;justify-content:flex-start;',
    '.budgetV3 .budgetSteps button span{min-width:0;font-size:13px;font-weight:600;white-space:nowrap}',
    '.budgetV3 .budgetSteps button i{display:grid;place-items:center;flex:0 0 auto;width:26px;height:26px;',
    '.budgetV3 .budgetSteps button.active i{border-color:var(--budget-blue);background:var(--budget-blue);color:#fff}',
    '.budgetV3 .budgetSteps button.complete i{border-color:#bcd0f5;background:#eaf1ff;color:#245fd9}'
  ])assert.ok(css.includes(token),token.slice(0,70));
  assert.ok(!css.includes('max-width:190px'),'the wizard head is no longer pinned to the narrow 190px tile');
  assert.ok(!css.includes('budgetWizardActions button:first-child')&&!css.includes('budgetScopeHint'),'the footer never splits its two buttons and the removed scope line leaves no rule behind');
  assert.ok(css.includes('.app main>.budgetV3.budgetWizard>.budgetV3Head.budgetWizardHead{display:grid!important;grid-template-columns:40px minmax(0,1fr)!important;align-items:center!important;gap:14px!important;width:100%!important;max-width:none!important;min-height:56px!important;margin:0 0 16px!important;padding:8px 24px!important;border:1px solid var(--budget-border)!important;border-left:0!important;border-right:0!important;border-radius:0!important;background:#fff!important;box-shadow:none!important}'),'the head is the full-bleed page header the Create Journal Entry page uses, flush under the working-context bar');
  assert.ok(css.includes('.app main>.budgetV3.budgetWizard>:not(.budgetV3Head){margin-left:clamp(16px,2.2vw,32px)!important;margin-right:clamp(16px,2.2vw,32px)!important}'),'the rest of the wizard keeps the shell gutter the full-bleed head gave up');
});

test('the budget scope uses the shared multi-select organisation and branch control',async()=>{
  const component=readFileSync(new URL('../src/OrganisationBranchScope.jsx',import.meta.url),'utf8');
  const scopeCss=readFileSync(new URL('../src/organisation-branch-scope.css',import.meta.url),'utf8');
  const scope=await import('../src/organisation-scope.js');
  assert.ok(workspace.includes('showLine={false} multiple/>'),'Create Budget asks the shared control for its multi-select form');
  assert.ok(component.includes('multiple=false'),'the multi-select form is opt in, so the journal lines and Period Closing keep their one-choice selects');
  assert.ok(component.includes('if(fields&&multiple&&!readOnly){'),'the multi-select form renders from the same visibility decision as the selects');
  assert.ok(component.includes('const rows=scopePickerRows(state);'),'the checkbox rows come from the shared module');
  assert.ok(component.includes('{state.showOrganisation&&<MultiScopeField title="Organisation" summary={state.organisationSummary} rows={rows.organisationRows} onPick={pick}/>}'),'the organisation field renders those rows');
  assert.ok(component.includes('rows.branchRows.length>1'),'a scope with no branch to choose renders no branch field');
  assert.ok(component.includes('const next=toggleScopePicker(state,row);'),'toggling a row goes back through the shared module');
  assert.ok(component.includes("import {ALL_BRANCHES,normaliseScope,scopePickerState} from './organisation-scope.js';"),'the single-select import stays verbatim');
  assert.ok(!component.includes('flatMap'),'the control keeps no private branch flattening');
  for(const token of [
    '.pc-scope-picker .pc-multi-trigger{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:40px;padding:8px 10px;',
    '.pc-scope-picker .pc-multi-panel{position:absolute;z-index:60;top:calc(100% + 6px);left:0;',
    '.pc-scope-picker .pc-multi-option.checked .pc-multi-box{border-color:#3478f6;background:#3478f6}',
    '.pc-scope-picker .pc-multi-text small{color:#667085;font-size:12px}'
  ])assert.ok(scopeCss.includes(token),token.slice(0,70));
  const sizes=[...scopeCss.matchAll(/font-size:([\d.]+)px/g)].map(match=>Number(match[1]));
  assert.ok(sizes.length>=4&&Math.min(...sizes)>=12,'every multi-select style stays at 12px or larger');
  const organisations=[
    {id:'abc',code:'ABC01',name:'Wayvida',branches:[{id:'abc-kochi',name:'Kochi Branch'},{id:'abc-bengaluru',name:'Bengaluru Branch'}]},
    {id:'nsr',code:'NSR02',name:'Viskool',branches:[{id:'nsr-chennai',name:'Trivandrum Branch'}]}
  ];
  const state=scope.scopePickerState({organisations,companyIds:['ABC01','NSR02'],branchIds:['abc-kochi'],label:'Budget scope'});
  assert.equal(state.showOrganisation,true,'two available organisations keep the organisation control');
  assert.equal(state.showBranch,true,'two available organisations keep the branch control');
  const rows=scope.scopePickerRows(state);
  assert.deepEqual(rows.organisationRows.map(row=>row.label),['All organisations','Wayvida','Viskool'],'every available organisation stays selectable');
  assert.deepEqual(rows.organisationRows.filter(row=>row.checked).map(row=>row.label),['Wayvida','Viskool'],'the organisations in scope read as ticked');
  assert.deepEqual(rows.branchRows.map(row=>row.label),['All branches','Kochi Branch','Bengaluru Branch','Trivandrum Branch'],'every branch of the organisations in scope is offered');
  assert.deepEqual(rows.branchRows.filter(row=>row.checked).map(row=>row.label),['Kochi Branch'],'only the explicitly chosen branch reads as ticked');
  assert.deepEqual(rows.branchRows.filter(row=>row.label==='Trivandrum Branch').map(row=>row.meta),['Viskool'],'each branch names the organisation that owns it');
  assert.deepEqual(scope.toggleScopePicker(state,rows.branchRows[3]),{companyIds:['ABC01','NSR02'],branchIds:['abc-kochi','nsr-chennai']},'a branch of a second organisation can be added');
  assert.deepEqual(scope.toggleScopePicker(state,{kind:'branch',ref:''}),{companyIds:['ABC01','NSR02'],branchIds:[]},'All branches clears the branch narrowing');
  assert.deepEqual(scope.toggleScopePicker(state,{kind:'organisation',ref:'NSR02'}),{companyIds:['ABC01'],branchIds:['abc-kochi']},'an organisation can be taken out of scope');
  assert.deepEqual(scope.toggleScopePicker(state,{kind:'organisation',ref:''}),{companyIds:[],branchIds:['abc-kochi']},'All organisations puts every organisation back in scope');
  const narrowed=scope.scopePickerState({organisations,companyIds:['ABC01'],branchIds:[],label:'Budget scope'});
  assert.deepEqual(scope.scopePickerRows(narrowed).branchRows.map(row=>row.label),['All branches','Kochi Branch','Bengaluru Branch'],'a narrowed organisation never offers another organisation branch');
  assert.deepEqual(scope.scopePickerRows(narrowed).organisationRows.filter(row=>row.checked).map(row=>row.label),['Wayvida'],'the organisation left in scope is the ticked one');
  const oneAvailable=scope.scopePickerState({organisations:[organisations[1]],companyIds:['NSR02'],branchIds:[],label:'Budget scope'});
  assert.equal(oneAvailable.showOrganisation,false,'one available organisation hides the organisation control');
  assert.equal(oneAvailable.showBranch,false,'a one branch organisation hides the branch control too');
  assert.deepEqual(scope.scopePickerRows(oneAvailable).organisationRows,[],'a hidden control builds no rows');
  assert.deepEqual(scope.scopePickerRows({}).branchRows,[],'an empty scope builds no rows instead of throwing');
});
 
/* The grouped section rows are the same control in all three grids: the Chart of Accounts
   accordion, the budget account-selection grid and the budget allocation grid. */
test('the budget grids carry the same section rows as the Chart of Accounts accordion',()=>{
  const coa=readFileSync(new URL('../src/account-workspace.css',import.meta.url),'utf8');
  for(const token of [
    '.budgetAllocGroup>th>button>svg{flex:0 0 auto;width:22px;height:22px;padding:2px;border:1px solid #d9e1ec;border-radius:6px;background:#fff;color:#3f5b8f}',
    '.budgetAllocGroup>th>button b{font-size:13px;font-weight:650;color:#253550}',
    '.budgetAllocGroup>th>button span{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;background:#e4eaf4;color:#55637a;font-size:12px;font-weight:600;line-height:1}',
    '.budgetAllocGroup>th>button[aria-expanded="true"]{background:#eef4ff;box-shadow:inset 3px 0 0 #3478f6}',
    '.budgetAllocGroup>th>button[aria-expanded="true"] span{background:#d8e5ff;color:#2a4f9e}',
    '.budgetAllocGroup>th>button[aria-expanded="false"]>svg{border-color:#e1e6ed;color:#8392a7}',
    '.budgetAllocBand>th{padding:10px 14px;border-top:1px solid #dfe6ef;background:#e9eff8;box-shadow:inset 3px 0 0 #3478f6;color:#172033;font-size:12px;font-weight:700;text-align:left;white-space:normal;letter-spacing:.02em;text-transform:uppercase}',
    '.budgetStatementSection>th{padding:12px 14px;background:#e9eff8;box-shadow:inset 3px 0 0 #3478f6;color:#172033;font-size:13px;font-weight:700}'
  ])assert.ok(css.includes(token),'the budget section row keeps '+token);
  assert.ok(css.includes('.budgetAccountGrid .budgetGroupCell>svg{flex:0 0 auto;width:22px;height:22px;padding:2px;border:1px solid #d9e1ec;border-radius:6px;background:#fff;color:#3f5b8f}'),'the account grid uses the same chevron chip');
  assert.ok(css.includes('.budgetAccountGrid .budgetGroupCell[aria-expanded="true"]{background:#eef4ff;box-shadow:inset 3px 0 0 #3478f6}'),'and the same left accent');
  assert.ok(!coa.includes('am-group-toggle'),'the Chart of Accounts accordion the comparison used to lean on is gone, so the two budget grids keep the chip geometry between themselves');
  assert.ok(css.includes('.budgetAllocation .budgetAllocGroup>th>button{box-shadow:inset 3px 0 0 #3478f6')||css.includes('.budgetAccountGrid .budgetGroupCell[aria-expanded="true"]{background:#eef4ff;box-shadow:inset 3px 0 0 #3478f6}'),'and the accent sits on the button in the budget grids themselves, where the button cannot hide it');
  const sizes=[...css.slice(css.indexOf('/* The allocation grid carries the same section rows')).matchAll(/font-size:([\d.]+)px/g)].map(m=>Number(m[1]));
  assert.ok(sizes.length&&Math.min(...sizes)>=12,'every budget section row stays at or above the 12px floor');
});
