import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const jsx=readFileSync(new URL('../src/PeriodClosing.jsx',import.meta.url),'utf8');
const service=readFileSync(new URL('../src/period-locking.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/period-closing.css',import.meta.url),'utf8');
const focus=readFileSync(new URL('../src/period-closing-focus.css',import.meta.url),'utf8');
const registerHead=readFileSync(new URL('../src/register-head.css',import.meta.url),'utf8');
const accounting=readFileSync(new URL('../src/AccountingSettingsPanel.jsx',import.meta.url),'utf8');
const settingsCss=readFileSync(new URL('../src/period-lock-settings.css',import.meta.url),'utf8');

test('period lock is one lean screen whose merged register row pairs the title with a journal style subheading and one split action menu',()=>{
 assert.ok(!jsx.includes('pc-section-tabs'),'the tab row is gone and the locked periods list is the page body');
 assert.ok(!jsx.includes('const TABS='),'no tab model remains');
 assert.ok(!jsx.includes('const compositeLine=')&&!jsx.includes('const statusLine='),'the repeated period, scope and lock facts leave the header');
 for(const text of ['pc-composite-line','pc-status-line','pc-missing','pc-current-actions','pc-link-action','pc-status-link']) assert.ok(!jsx.includes(text),text+' must not come back');
 assert.ok(!jsx.includes('Review accounting periods, close books, and manage period access.'),'the page subtitle is gone');
 for(const text of ['pc-title-block','registerSplitMore','Create Lock / Close']) assert.ok(jsx.includes(text),text);
 assert.ok(!jsx.includes('pc-policy-chip'),'the inline locking policy chip leaves the heading');
 assert.ok(jsx.indexOf('className="pc-register-heading pc-title-block registerHeadText"><h2>{title}</h2>')<jsx.indexOf('pc-heading-note'),'the journal style subheading sits beneath the title in the merged register row');
 assert.ok(!jsx.includes('pc-overview-cards'),'the four KPI cards stay deleted');
 assert.ok(!jsx.includes('pc-current-facts'),'the four meta cards stay deleted');
 assert.ok(!jsx.includes('Working as'),'the global VIEW AS control owns the acting role');
 assert.ok(!jsx.includes('View Period'),'the duplicate View Period action is gone');
 assert.ok(!jsx.includes('className="pc-current-period-action"><button className="primary"'),'no second close action inside the period card');
});

test('the locked periods register is the page body with a locked periods / requests toggle and a current financial year default',()=>{
 for(const text of ['pc-locks-panel','pc-view-toggle','LockRegister','pc-filters-more','pc-attention']) assert.ok(jsx.includes(text),text);
 assert.match(jsx,/const LOCK_FILTERS=\{fy:CURRENT_FY/);
 assert.match(jsx,/aria-pressed=\{!isRequests\}/);
 assert.match(jsx,/const CURRENT_FY=FINANCIAL_YEARS\[0\]\.id/,'the register opens on the current financial year');
 assert.ok(jsx.includes('All financial years'),'the financial year filter still offers every year');
 for(const text of ['Financial Year','Organisation','Branch','Closed By','Closed Type','Search period or organisation']) assert.ok(jsx.includes(text),text);
 assert.ok(jsx.includes("['Period','Organisation','Branch','Status','Closed Date','Closed By','Actions']"));
 assert.ok(jsx.includes('pc-table-fit pc-history-table'),'the register still renders its table');
 assert.ok(!jsx.includes("'Every lock for '+organisation.name"),'the register header stops repeating the organisation and year in prose');
 assert.ok(!jsx.includes("title={view==='requests'?'Unlock requests':'Locked periods'}"),'the panel heading text is replaced by the view toggle');
 assert.ok(!jsx.slice(jsx.indexOf('pc-register-bar'),jsx.indexOf('pc-register-tabs')).includes('pc-view-toggle'),'the switch is not on the toolbar row');
 assert.ok(jsx.includes('mode={lockMode}'),'the register receives the active locking mode');
});

test('the register lists past locks in automatic mode and only locks created here in manual mode',()=>{
 assert.match(jsx,/const manual=lockingOn&&settings\.lockingMode==='Manual'/);
 assert.match(jsx,/const createdLockIds=useMemo\(\(\)=>\[\.\.\.new Set\(\(data\.audit\|\|\[\]\)\.filter\(entry=>entry\.periodId&&\['Lock period created','Period closed'\]\.includes\(entry\.action\)\)\.map\(entry=>entry\.periodId\)\)/,'a period counts as created here once its lock action reaches the audit trail');
 assert.ok(jsx.includes('<EmptyState variant="lock" title="No locks created yet" description="Create a lock to close a period across your modules." actionLabel={onCreate?\'Create Lock\':null} onAction={onCreate}/>'),'the locks register shows the shared empty state with a Create Lock action');
 assert.ok(!jsx.includes('{emptyText}'),'the mode aware plain-text lock message is gone');
 assert.match(service,/export function lockRegisterRows\(periods=\[\],\{mode='Manual',today='',createdIds=\[\]\}=\{\}\)/);
 assert.match(service,/if\(mode==='Automatic'\)return rows\.filter\(period=>period\.end<today&&closingStatus\(period\)==='Closed'\)/,'automatic mode keeps only locks whose period has already ended');
 assert.match(service,/if\(mode==='Manual'\)return rows\.filter\(period=>createdIds\.includes\(period\.id\)\)/,'manual mode keeps only locks created here');
});

test('the register row owns one split create action and a compact pre-close attention pill',()=>{
 assert.ok(!jsx.includes('pc-policy-chip'),'the header no longer repeats the locking policy beside the title');
 assert.match(jsx,/registerSplitMore/);
 assert.ok(jsx.includes('Period lock settings'),'the settings entry stays in the split menu');
 assert.ok(!jsx.includes('Audit log / History'),'the lock history entry leaves the More actions menu');
 assert.match(jsx,/const lockMode=manual\?'Manual':\(lockingOn\?'Automatic':'Off'\)/);
 assert.match(jsx,/const attention=useMemo\(\(\)=>\{const failed=readiness\.checks\.filter\(check=>check\.state!=='Passed'\)/,'one computed value counts what needs attention');
 assert.ok(!jsx.includes('<em className="pc-more-badge">{attentionChecks}</em>'),'the count is stated once, never repeated in a badge');
 assert.ok(!jsx.includes('Create Lock / Close</b>'),'the create action left the More actions menu');
 assert.match(jsx,/\{lockingOn&&can\(activeRole,'lock'\)&&<div className="registerSplit"><button type="button" className="primary registerSplitMain" onClick=\{\(\)=>openLockForm\(\)\}/,'the create action is the split primary in automatic and manual mode');
 assert.ok(jsx.includes('mode={lockMode}'),'the lock drawer receives the active locking mode');
 assert.ok(jsx.includes('pc-heading-note'),'the page carries a journal style subheading');
 assert.ok(jsx.includes('pc-attention-pill'),'the pre-close review is a compact pill in the header action group');
 assert.ok(!jsx.includes('className="pc-attention '),'the full width attention strip is deleted, so the register moves up');
 assert.ok(jsx.includes("panel==='before'&&createPortal"),'the pre-close review still opens as a drawer');
});

test('closing verifies invoices, bills, journals, reconciliation and tax before closing',()=>{
 for(const text of ['All invoices posted','All bills approved','No draft journal entries','Bank reconciliation completed','Tax adjustments completed']) assert.ok(service.includes(text),text);
 assert.match(jsx,/evaluateClosingReadiness/);
 assert.match(jsx,/Continue Closing/);
 assert.match(jsx,/Close Period/);
 assert.match(jsx,/Closing reason/);
 assert.match(jsx,/function CloseDrawer\(/,'the closing dialog still exists');
});

test('the register filters by financial year, organisation, branch, open or closed and searches periods',()=>{
 assert.match(jsx,/const filterPeriods=\(source,active\)=>/);
 assert.match(jsx,/const historyRows=useMemo\(\(\)=>lockRegisterRows\(filterPeriods\(data\.periods,filters\),\{mode:lockMode,today,createdIds:createdLockIds\}\)/,'register rows follow the active locking mode');
 assert.ok(jsx.includes('All organisations'));
 assert.ok(jsx.includes('All branches'));
 assert.ok(jsx.includes('All statuses'),'the status select is still available in the wider history register');
 for(const text of ['View Requests','View Audit Log','View Details','pc-kebab-menu','Request Unlock','Close Period']) assert.ok(jsx.includes(text),text);
});

test('the lock history surface is gone: the filtered register is the only lock list',()=>{
 assert.ok(!jsx.includes('const openHistory='),'the history opener is deleted');
 assert.ok(!jsx.includes("panel==='history'"),'the history drawer is deleted');
 for(const text of ['pc-history-wide','Lock History','All locks','historyFilters','HISTORY_FILTERS']) assert.ok(!jsx.includes(text),text+' is deleted with the drawer');
 assert.ok(!css.includes('.pc-history-wide'),'the wide drawer geometry leaves the stylesheet');
 assert.ok(!jsx.includes('Audit log / History'),'the More actions entry is deleted with it');
});

test('unlock requests are raised separately from approver decisions',()=>{
 assert.match(jsx,/Request Unlock/);
 assert.match(jsx,/Submit Request/);
 assert.match(jsx,/>Approve<\/button>/,'the decision lives in the row menu as Approve');
 assert.match(jsx,/>View<\/button>/,'and every row carries the read-only View button');
 assert.ok(!jsx.includes('>Reject<'),'the reject option is gone: a request is approved or withdrawn, never rejected');
 assert.ok(!jsx.includes("onDecide(request,'Rejected')"),'no reject path is wired into the request list');
 assert.match(jsx,/Another approver must review your own request/);
 assert.match(jsx,/Unlock scope/);
 assert.match(jsx,/Unlock duration/);
 assert.ok(jsx.includes('function RequestsDrawer('),'the approvals drawer exists');
 assert.ok(jsx.includes('function RequestList('));
 assert.ok(jsx.includes('function UnlockDrawer('));
 assert.match(jsx,/requestPeriodUnlock/);
 assert.match(jsx,/decideUnlockRequest/);
 assert.match(jsx,/cancelUnlockRequest/);
 assert.match(jsx,/unlockApprover=unlockApproverFor\(activeRole,settings\)/,'the page resolves the alternate approver from the locking policy');
 assert.match(jsx,/decidable=!self\|\|Boolean\(approver\)/,'a request raised by the acting role stays decidable while another approver exists');
 assert.match(jsx,/const actor=request\.requestedBy===activeRole\?unlockApproverFor\(request\.requestedBy,settings\):activeRole/,'the decision is recorded as the alternate approver');
 assert.match(service,/export function unlockApproverFor\(requestedBy,settings\)\{/);
 assert.match(service,/export function deleteUnlockRequest\(state,\{requestId,user/,'the register can drop a request record through the engine');
 assert.match(service,/const approver=unlockApproverFor\(request\.requestedBy,value\)/,'the daily auto approval reuses one approver rule');
 assert.match(css,/\.pc \.pc-request-kebab\{flex:none;position:relative\}/,'the row menu is pinned in the actions cell');
 assert.match(css,/\.pc-request-facts\{display:grid/,'the single request drawer reads its facts as pairs');
 assert.ok(!css.includes('pc-request-card'),'the request card and its geometry leave the stylesheet');
});

test('the lock form is mode aware: a basic manual lock for every module, or the saved automatic schedule',()=>{
 assert.ok(jsx.includes('function LockDrawer('));
 for(const text of ['Manual locking','Create Lock / Close','Select period','Reason (optional)','Create Lock','all modules']) assert.ok(jsx.includes(text),text);
 assert.ok(jsx.includes("['Month','Quarter','Year','Financial Year']"));
 assert.ok(jsx.includes('resolveLockRange(manual?form.frequency:schedule.frequency'));
 assert.ok(jsx.includes("lockForm.reason.trim()||'Manual lock created for all modules'"),'a blank reason falls back to a system note');
 assert.ok(!jsx.includes('A lock reason is required'),'a lock reason is no longer mandatory');
 assert.ok(!jsx.includes('Lock strength'),'no module or strength section is shown in the manual lock form');
 assert.ok(!jsx.includes('scopeVisibility({organisations,companyIds:form.companyIds'),'the manual form drops its own organisation scope selector');
 for(const text of ['Automatic locking','LOCK_FREQUENCIES','SCHEDULE_CHOICES.notifyDays','Lock after period end','Notify before locking','pc-lock-preview']) assert.ok(jsx.includes(text),text);
 assert.ok(jsx.includes('automatic?schedule.frequency:lockForm.frequency'),'the automatic branch locks on the schedule frequency');
 assert.ok(jsx.includes("lockMode!=='Manual'"),'the drawer and the create handler switch on the active locking mode');
 assert.match(jsx,/createLockWindow\(state,\{frequency,date,companyId/);
 assert.match(jsx,/lockPeriod\(window\.state,\{periodId:window\.period\.id,lockType:lockForm\.lockType/);
 assert.ok(jsx.includes("panel==='lock'&&createPortal"));
 assert.ok(jsx.includes("panel==='override'&&createPortal"));
});

test('engine statuses stay behind the display mapper and never reach the screen',()=>{
 for(const text of ['Soft Locked','Hard Locked','Reclosed','Temporary Unlock','Pending Unlock Approval']) assert.ok(!jsx.includes(text),text+' leaked into the interface');
 assert.match(jsx,/closingStatus/);
 assert.match(service,/export const PERIOD_DISPLAY_STATUS=/);
});

test('period settings open from the lean page header in a right side popup and never write storage directly',()=>{
 assert.match(accounting,/Period control/);
 for(const text of ['Automatic period closing','Closing frequency','Unlock approval requirement','Allowed roles','Save period control']) assert.ok(accounting.includes(text),text);
 assert.ok(accounting.includes('label="Period locking"'),'the settings module carries the master locking switch');
 assert.ok(accounting.includes("setLockingMode(lockingOn?'Off':'Manual')"),'the master switch turns locking off for every module rather than writing a legacy mirror');
 assert.ok(accounting.includes("setLockingMode(automatic?'Manual':'Automatic')"),'disabling automatic locking falls back to manual');
 assert.ok(accounting.includes('disabled={!lockingOn}'),'automatic locking follows the master switch');
 assert.ok(accounting.includes('value={value.schedule.frequency}')&&accounting.includes('value={value.schedule.lockAfterDays}'),'the settings module edits the schedule the closing page actually uses');
 assert.ok(!accounting.includes("toggle('autoLockPreviousMonth')"),'the legacy mirror is derived, never toggled directly');
 assert.match(accounting,/normalisePeriodSettings/);
 assert.match(accounting,/writePeriodSettings/);
 assert.match(jsx,/PeriodLockSettings/);
 assert.ok(jsx.includes('settingsOpen&&createPortal'),'the page owns the settings portal');
 assert.ok(jsx.includes('pc-settings-drawer'));
 assert.ok(jsx.includes('aria-label="Period lock settings"'));
 assert.ok(!jsx.includes('if(settingsOpen)return'),'settings is a right side popup, not a page takeover');
 assert.ok(!jsx.includes("localStorage.setItem('wayvida-period-settings-v1'"));
});

test('closing and reopening are audit backed with the acting role kept out of the title block',()=>{
 assert.match(jsx,/PERIOD_ROLE_OPTIONS/);
 assert.match(jsx,/const allowedRoles=PERIOD_ROLE_OPTIONS\.filter/);
 assert.match(jsx,/closePeriod\(state,\{periodId,user:activeRole/);
 assert.match(service,/action:'Period closed'/);
 assert.ok(!jsx.includes('Simulated role'));
});

test('the pre-close review keeps its impact chips and opens from the attention pill',()=>{
 assert.match(jsx,/function BeforeCloseDrawer\(/);
 for(const text of ['pc-impact-chips','pc-impact-total']) assert.ok(jsx.includes(text),text);
 assert.match(jsx,/impactRows\(period\)\.map/);
 assert.ok(!jsx.includes('The system verifies the following before'),'the duplicate verification sentence leaves the pre-close drawer');
 for(const text of ['pc-ready-pill','Cannot close yet']) assert.ok(!jsx.includes(text),text+' leaves the pre-close drawer');
 assert.ok(!css.includes('.pc-ready-pill'),'the readiness pill styles are deleted with it');
 for(const label of ['Sales','Purchases','Expenses','Banking','Journal Entries']) assert.ok(jsx.includes(label),label);
 assert.match(css,/\.pc-impact-chips\{display:flex;flex-wrap:wrap/);
 assert.ok(!jsx.includes('Create missing periods'),'missing periods are out of scope for the page');
 assert.ok(!jsx.includes('findMissingPeriods'),'no missing period lookup remains');
 assert.ok(!jsx.includes('generateFinancialYearPeriods'),'no missing period generator remains');
});

test('the current period card no longer renders an activity history panel',()=>{
 assert.ok(!jsx.includes('Closing, reopen and approval events for this period.'),'the page level activity history subtitle is gone');
 assert.ok(!jsx.includes('currentTimeline'),'the current period timeline memo is gone');
 const card=jsx.slice(jsx.indexOf('function CurrentPeriodPanel('),jsx.indexOf('function LockRegister('));
 assert.ok(card.length>0,'the current period card still exists');
 assert.ok(!card.includes('<Timeline'),'the current period card renders no timeline');
});

test('history collapses to cards on small screens and keeps a table on desktop',()=>{
 assert.match(css,/\.pc-history-cards\{display:none\}/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/\.pc-history-table\{display:none\}/);
 assert.match(css,/\.pc-history-cards\{display:grid/);
 assert.ok(css.includes('.pc-view-toggle'),'the locked periods / requests toggle is styled');
 assert.ok(css.includes('.pc-locks-panel'));
});

test('every portalled period closing surface owns its own right side drawer geometry',()=>{
 for(const wrapper of ["settingsOpen&&createPortal(<><button className=\"pc-history-scrim\"","panel==='requests'&&createPortal(<div className=\"pc pc-portal-scope\">","panel==='current'&&createPortal(<div className=\"pc pc-portal-scope\">","panel==='before'&&createPortal(<div className=\"pc pc-portal-scope\">"]) assert.ok(jsx.includes(wrapper),wrapper);
 assert.match(focus,/\.pc\.pc-portal-scope\{display:contents/,'the scope wrapper adds hooks without adding a box');
 assert.match(css,/\.pc-history-scrim\{position:fixed!important;z-index:1390!important/,'the scrim sits above the page');
 assert.match(css,/\.pc-history-drawer\{position:fixed!important;z-index:1400!important[^}]*right:0!important/,'each drawer pins itself to the right edge');
 assert.match(css,/\.pc-drawer-body\{flex:1 1 auto;min-height:0;overflow:auto/,'the drawer body is the only scroller');
 assert.ok(jsx.includes('pc-drawer-footer'),'drawer actions stay inside the shell');
 assert.match(settingsCss,/\.pls header\{position:static;inset:auto;width:auto;height:auto/,'the settings popup neutralises the legacy fixed app-bar header rule');
});

test('page chrome follows the journal heading grid and no legacy top bar styling bleeds into cards',()=>{
 assert.match(css,/\.pc-heading\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/,'the heading is the journal heading grid');
 assert.match(css,/\.pc-heading-actions\{display:flex;flex-wrap:wrap/);
 assert.match(css,/\.pc-history-card>header\{[^}]*padding:0;background:transparent;border:0\}/,'history card headers drop the app top bar chrome');
 assert.match(settingsCss,/\.pls-card>header\{[^}]*padding:0;background:transparent;border:0\}/,'settings card headers drop the app top bar chrome');
 assert.ok(!css.includes('margin-left:54px'),'the current period status row uses grid placement, not a magic offset');
 assert.ok(!css.includes('.pc-title-row'),'the single child title row wrapper is deleted with the chip');
 assert.match(css,/@media\(max-width:900px\)\{\.pc \.pc-current-period\{display:grid/,'the current period card reflows with explicit placement');
});

test('the heading note keeps only the locking promise',()=>{
 assert.ok(!jsx.includes('Every close, reopen and override is written to the audit trail'),'the audit sentence leaves the page subtitle');
 assert.match(jsx,/note="Lock accounting periods and control when postings stop\."/,'the subtitle is one short line, handed to the merged register row');
});

test('the register toolbar is one compact row: the view toggle, the search box and the Filters disclosure',()=>{
 assert.ok(!jsx.includes('(onView&&showRequests))&&<header>'),'the register bar is a div, so the legacy header label rule cannot restyle the filters inside it');
 assert.ok(jsx.includes("{(title||note||(onView&&showRequests))&&<div className={'pc-register-bar'+(merged?' registerHead':'')}>"),'the bar is one div and carries the shared merged marker');
 assert.ok(jsx.indexOf('pc-view-toggle')>jsx.indexOf("className={'pc-register-bar'"),'the toggle renders inside the merged bar');
 const toolbar=jsx.slice(jsx.indexOf("{(title||note||(onView&&showRequests))&&<div className={'pc-register-bar'"),jsx.indexOf('pc-register-tabs'));
 assert.ok(!toolbar.includes('pc-filter-search')&&!toolbar.includes('pc-view-toggle'),'the toolbar row holds the title and the actions, not the grid controls');
 assert.ok(toolbar.includes('pc-title-block')||toolbar.indexOf('registerHeadText')>-1,'the title block leads the toolbar row');
 const afterBar=jsx.slice(jsx.indexOf('{actions?actions():null}</div>}')+'{actions?actions():null}</div>}'.length);
 assert.ok(afterBar.indexOf('<div className="pc-register-tabs">')>-1&&afterBar.indexOf('<div className="pc-register-tabs">')<40&&afterBar.includes('pc-view-toggle'),'the Locked Periods / Requests switch sits in its own section directly under the toolbar row');
 assert.ok(afterBar.indexOf('pc-register-tabs')<afterBar.indexOf('{isRequests?'),'and above the table');
 const rowTail=jsx.slice(jsx.indexOf('<div className="pc-filters-panel-actions">'),jsx.indexOf('{isRequests?<div className='));
 assert.ok(!rowTail.includes('pc-filter-count'),'the period and request counts leave the toolbar row');
 assert.ok(!toolbar.includes('<label className="pc-filter">')&&!toolbar.includes('<select'),'Period and Status leave the visible row');
 const panel=jsx.slice(jsx.indexOf('<div className="pc-filters-panel">'),jsx.indexOf('<div className="pc-filters-panel-actions">'));
 for(const label of ['Period','Status','Financial Year','Organisation','Branch','Closed By','Closed Type']) assert.ok(panel.includes('<span>'+label+'</span>'),label+' lives inside the Filters panel');
 assert.ok(panel.indexOf('<span>Period</span>')<panel.indexOf('<span>Financial Year</span>'),'Period and Status lead the filter panel');
 assert.ok(panel.indexOf('<span>Status</span>')<panel.indexOf('<span>Financial Year</span>'));
 assert.match(jsx,/const advanced=\[filters\.status!=='All'\?filters\.status:'',filters\.period,/,'the Filters badge counts the two filters that moved inside');
 assert.match(css,/\.pc \.pc-register-tabs \.pc-filters\{flex:0 1 auto/,'the search pair sits on the switch row');
 assert.ok(!css.includes('pc-filter-count'),'the count text and the rules that served it are deleted');
});

test('the current accounting period opens from the split menu instead of sitting on the page',()=>{
 assert.equal(jsx.split('<CurrentPeriodPanel period={currentPeriod}').length-1,1,'the period card leaves the page body for the popup');
 assert.match(jsx,/const openCurrent=\(\)=>setPanel\('current'\)/);
 assert.match(jsx,/onClick=\{menuRun\(openCurrent\)\}/,'the entry opens from the More actions menu');
 assert.match(jsx,/const currentMeta=currentPeriod\?currentPeriod\.name/,'the menu entry names the period and its status');
 assert.ok(jsx.indexOf('>Current period</button>')<jsx.indexOf('>Period lock settings</button>'),'the current period leads the split menu');
 assert.ok(jsx.indexOf('menuRun(openCurrent)')<jsx.indexOf('menuRun(openSettings)'),'the More actions entries keep their order');
 assert.ok(jsx.includes("panel==='current'&&createPortal"),'the current period popup is a right side drawer');
 assert.ok(jsx.includes('pc-current-drawer'));
 assert.ok(jsx.includes('aria-label="Current accounting period"'));
 assert.ok(jsx.includes("<CurrentPeriodPanel period={currentPeriod} organisation={organisation} approvalOn={approvalOn}"),'the popup renders the real period card');
 assert.match(css,/\.pc-current-drawer\{width:min\(520px,96vw\)!important\}/);
 assert.match(css,/\.pc-current-drawer \.pc-current-period\{display:flex!important/);
 assert.match(css,/\.pc-current-drawer \.pc-current-period-copy>span\{display:none\}/,'the popup drops the duplicate eyebrow under its own title');
 assert.match(css,/\.pc-current-drawer \.pc-current-period-copy p\{[^}]*white-space:normal/,'the period line wraps instead of truncating');
});

test('the request list renders every row in one table, with a scope column and a status column and no pager',()=>{
 assert.ok(!jsx.includes('String(request.status)'),'the status never reaches the cell raw');
 assert.ok(!jsx.includes('REQUEST_PAGE_SIZE')&&!jsx.includes('[page,setPage]')&&!jsx.includes('pageCount'),'the request list owns no page state');
 assert.ok(!jsx.includes('pc-request-pager')&&!jsx.includes('pc-pager-status')&&!css.includes('pc-request-pager')&&!css.includes('pc-pager-status'),'the pager and its stylesheet rules are deleted, so nothing caps the list again');
 assert.ok(jsx.includes('<RequestTable requests={requests} periods={periods} actions={requestActions}/>'),'every filtered request reaches the table in one rendering');
 assert.ok(jsx.includes("const status=String(request.status||'Pending approval');return status==='Pending approval'?'Requested':status"),'a pending request reads as Requested and a decided one keeps its own word');
 assert.ok(jsx.includes("{'pc-badge '+status.toLowerCase()}"),'the status reuses the page badge, so the register keeps one pill vocabulary');
 assert.ok(jsx.includes('<button type="button" className="pc-request-view" onClick={()=>onDetails(request)}>View</button>'),'every row opens with the read-only View button');
 assert.ok(!jsx.includes('>Approve Unlock</button>')&&!jsx.includes('>Cancel request</button>'),'the emphasised inline approve and the inline withdraw leave the row');
 assert.match(css,/\.pc \.pc-request-actions button\.pc-request-view\{[^}]*color:#475467/,'View is the neutral secondary button, never the primary blue');
 assert.match(css,/\.pc \.pc-request-kebab-menu button\.pc-kebab-danger\{[^}]*color:#b42318/,'Delete is the one destructive menu entry');
 assert.match(css,/\.pc \.pc-request-actions\{[^}]*align-items:center/,'the decision row is vertically centred');
});

test('the details drawer stays in product vocabulary and More actions reads as a styled menu button',()=>{
 assert.ok(!jsx.includes('<dt>Lock type</dt>'),'the Hard Lock / Soft Lock engine value leaves the period details summary');
 assert.ok(jsx.includes('<IconChevronDown size={16}/></summary>'),'the split caret is the shared chevron');
 assert.ok(registerHead.includes('.registerHead .registerSplit>.registerSplitMore>summary{display:inline-grid;place-items:center;width:38px;height:40px;'),'and the menu wears the shared register split geometry');
 assert.ok(registerHead.includes('.registerHead .registerSplit>.registerSplitMore[open]>summary{background:#245bdd;border-color:#245bdd}'),'the open caret reads as selected');
 assert.ok(registerHead.includes('.registerHead .registerSplit>.registerSplitMore>div>button:hover{background:#f4f7ff;color:#245fd9}'),'the menu rows hover like every other menu on the page');
 assert.ok(registerHead.includes('.registerHead .registerSplit>.registerSplitMore>div>button{display:flex;'),'and every entry is a real menu row');
 assert.match(css,/\.pc-heading-actions button,\.pc-heading-actions \.pc-more/,'the page still owns the action button sizing');
 assert.ok(registerHead.includes('.registerHead .registerSplit>.registerSplitMore>div{position:absolute;right:0;top:calc(100% + 6px);z-index:80;'),'the menu hangs off the caret at the shared offset');
 assert.ok(jsx.includes("document.addEventListener('pointerdown',closeOnPointerDown)"),'a pointer outside the menu dismisses it');
 assert.ok(jsx.includes("event.key==='Escape'"),'Escape dismisses the menu');
});

test('the split create action shares the shared register geometry',()=>{
 assert.ok(registerHead.includes('.registerHead .registerSplit{display:inline-flex;align-items:stretch;flex:0 0 auto;min-width:0}'),'the two halves share one box');
 assert.ok(registerHead.includes('.registerHead .registerSplit>.registerSplitMain{border-top-right-radius:0;border-bottom-right-radius:0}'),'the primary keeps its inner corners square');
 assert.ok(registerHead.includes('.registerHead .registerSplit>.registerSplitMore>summary{display:inline-grid;place-items:center;width:38px;height:40px;'),'the caret is a 40px square beside it');
 assert.match(focus,/\.pc-focused \.pc-heading-actions button\{[^}]*min-height:40px[^}]*border-radius:7px[^}]*padding:0 15px/,'the page keeps its 40px action button height');
 assert.match(css,/@media\(max-width:650px\)\{[^@]*\.pc-heading-actions button/,'the actions stretch on narrow screens');
});

test('the business view names the page Financial Lock',()=>{
 assert.ok(jsx.includes('title={t.periodClosing}'),'the heading reads the shared terminology label instead of declaring its own');
 assert.ok(!jsx.includes("business?'Close Books'")&&!jsx.includes("business?'Financial Lock'"),'no hardcoded business title is left in the page');
 assert.ok(jsx.includes("const {mode:viewMode,t}=useTerminology(),business=viewMode==='business'"),'the label and the view mode both come from the shared terminology hook');
 const terms=readFileSync(new URL('../src/terminology.jsx',import.meta.url),'utf8');
 assert.match(terms,/accountant:\{[^}]*periodClosing:'Period Lock'/,'the accountant view reads Period Lock');
 assert.match(terms,/business:\{[^}]*periodClosing:'Financial Lock'/,'the business owner view reads Financial Lock');
 assert.match(terms,/const pageLabel=\(page,t\)=>\(\{[^}]*'Period Lock':t\.periodClosing[^}]*\}\[page\]\|\|page\)/,'the sidebar and the page title resolve the same value, so they cannot disagree again');
});
test('drawer and modal close buttons survive the legacy app bar rule',()=>{
 assert.match(css,/\.pc-history-drawer>header>button,\.pc-modal>section>header>button\{display:inline-flex!important\}/,'the legacy rule hides any direct child button of a header below 1050px');
});

test('the requests register is one table whose rows carry one View button and one 3 dot menu',()=>{
 assert.ok(!jsx.includes('requestLayout')&&!jsx.includes('pc-request-view-bar'),'the cards / list switch is deleted');
 assert.ok(!jsx.includes('pc-request-card'),'no card rendering survives the switch removal');
 assert.ok(jsx.includes('function RequestTable({requests,periods=[],actions}){'),'the table is the only request rendering');
 assert.ok(jsx.includes("pc-table-fit pc-request-table"),'the table reuses the shared fit shell, so it never needs a sideways scroll');
 assert.ok(jsx.includes("['Period','Organisation & Branch','Reason','Requested','Requested By','Status','Actions']"),'the table carries one period, one combined scope column, the reason, the request facts, the status and the actions');
 assert.ok(jsx.includes('function requestScopeOf(request,periods){'),'the combined scope column resolves the period the request belongs to');
 assert.ok(jsx.includes("organisation=period?.organisationName||request.organisationName||org?.name||code"),'the scope column names the organisation rather than printing its code');
 assert.ok(jsx.includes('branchIds=period?.branchIds||request.branchIds||[]')&&jsx.includes('branchNames:names'),'the branch half of the scope column resolves real branch names and degrades to All branches');
 assert.ok(jsx.includes('periods={periods} canApprove={canApprove}'),'the register hands the periods down so a row can name its branch');
 assert.ok(!jsx.includes("'Unlock Scope','Requested'"),'the reshaped table drops the scope and approver columns');
 assert.ok(jsx.includes('<RequestList requests={requests} periods={periods} canApprove={canApprove} approver={approver} role={role} business={business} onDecide={onDecide} onCancelRequest={onCancelRequest} onDeleteRequest={onDeleteRequest}/>'),'the requests tab renders the table without a layout prop');
 assert.ok(jsx.includes('<div className="pc-request-list">'),'the register keeps the request list shell');
 assert.ok(jsx.includes('function RequestActions('),'one renderer serves the inline actions and the menu');
 assert.ok(jsx.indexOf('function RequestActions(')<jsx.indexOf('function RequestList('),'the shared renderer is declared before its callers');
 assert.ok(jsx.includes('className="pc-request-actions"')&&jsx.includes('className="pc-request-view"')&&!jsx.includes('>Approve Unlock</button>'),'every row renders the same View button, so no inline approve is left');
 assert.ok(jsx.includes("const note=!pending?'':!canApprove?'Approval requires an approver role.'"),'the note explains a missing menu entry rather than standing in for a button');
 assert.ok(jsx.includes('<details className="pc-kebab pc-request-kebab">'),'the row menu reuses the canonical 3 dot geometry');
 assert.ok(jsx.includes('<IconDots size={17}/>'),'the menu trigger is the same 3 dot icon the register rows use');
 const menu=/<div className="pc-kebab-menu pc-request-kebab-menu">(.+?)<\/div><\/details>/.exec(jsx)[1];
 for(const label of ['Approve','Cancel','View Details','Delete']) assert.ok(menu.includes('>'+label+'</button>'),'the menu offers '+label);
 assert.ok(menu.includes('<IconEye size={15}/>'),'View Details carries its own icon');
 assert.ok(menu.includes('<IconTrash size={15}/>'),'Delete carries its own icon');
 assert.ok(jsx.includes("canDelete=self||canApprove"),'Delete is offered to the requester and to an approver, and to nobody else');
 assert.ok(jsx.includes("onClick={pick(()=>onDeleteRequest(request))}"),'Delete closes the menu through the same pick helper as every other entry');
 assert.ok(jsx.includes("const pick=handler=>event=>{event.currentTarget.closest('details')?.removeAttribute('open');handler()}"),'choosing a menu row closes the menu');
 assert.ok(jsx.includes("document.querySelectorAll('.registerSplitMore[open],.pc-kebab[open],.pc-filters-more[open],.pc-attention-pop[open]')"),'the page outside click and Escape rule owns the split menu, the row menu and the attention popover');
 assert.ok(jsx.includes('return <div className="pc-request-actions"><button type="button" className="pc-request-view"'),'one return gives every row the same cell shape, decided or pending');
 assert.ok(jsx.includes('function RequestDetailsDrawer({request,onClose}){'),'View Details opens one request, not the whole period');
 assert.ok(jsx.includes('aria-label="Unlock request details"'),'the request popup names itself');
 assert.ok(jsx.includes('const [detail,setDetail]=useState(null);')&&jsx.includes('onDetails={setDetail}'),'the table owns the open request');
 assert.ok(jsx.includes('{detail&&createPortal(<div className="pc pc-portal-scope"><RequestDetailsDrawer request={detail} onClose={()=>setDetail(null)}/></div>,document.body)}'),'the request popup is portalled like every other drawer');
 assert.ok(jsx.includes('function requestScopeLabel(request){'),'the scope label is resolved once for the table and the popup');
 assert.match(css,/\.pc-request-list\{display:block;padding:0\}/,'the table shell drops the card gap padding');
 assert.ok(!focus.includes('pc-request-pager'),'no pager gutter rule is left behind');
 assert.match(focus,/\.pc \.pc-request-table th:nth-child\(7\)\{width:14%\}/,'the seven column rhythm ends on the actions column');
 assert.ok([12,19,21,11,11,12,14].every((width,index)=>focus.includes('.pc .pc-request-table th:nth-child('+(index+1)+'){width:'+width+'%}')),'every one of the seven columns keeps its own width');
 assert.match(focus,/\.pc \.pc-request-table \.pc-request-cell-actions\{vertical-align:middle;white-space:normal\}/,'the actions cell wraps instead of widening the table');
 assert.match(focus,/\.pc \.pc-request-table \.pc-badge\.requested\{background:#fff4df;color:#8a5d08\}/,'a waiting request reads amber, like every other waiting state on the page');
 assert.match(focus,/\.pc \.pc-request-table \.pc-badge\.cancelled,\.pc \.pc-request-table \.pc-badge\.rejected\{background:#ffe9ec;color:#b7374b\}/,'a refused or withdrawn request reads red and never the primary blue');
 assert.match(css,/\.pc \.pc-request-actions\{[^}]*flex-wrap:wrap/,'the decision row wraps rather than overflowing its cell');
 assert.match(css,/\.pc-requests-drawer\{width:min\(820px,96vw\)!important\}/,'the approvals drawer is wide enough for the table');
 assert.match(css,/\.pc-request-drawer\{width:min\(460px,96vw\)!important\}/,'the single request popup stays a narrow drawer');
});

test('the attention pill states the count once and opens a read-only review popover',()=>{
 assert.match(jsx,/const attention=useMemo\(\(\)=>\{const failed=readiness\.checks\.filter\(check=>check\.state!=='Passed'\),blocking=failed\.filter\(check=>check\.state==='Failed'\)\.length/,'the pill, its tone and the popover all read one computed value');
 assert.match(jsx,/tone:blocking\?'danger':failed\.length>=3\?'warn':failed\.length\?'neutral':'ok'/,'a blocking check turns the pill red, three or more amber and one or two neutral grey');
 assert.ok(jsx.includes("noun:'check'+(failed.length===1?'':'s')"),'the pill never shows a bare number');
 assert.ok(jsx.includes('{attention.count>0&&<details className="pc-attention-pop">'),'the pill disappears once the checks pass');
 assert.ok(jsx.includes("aria-label={'Review '+attention.count+' '+attention.noun+' that '+attention.verb+' attention'}"),'the pill publishes an accessible review label');
 assert.ok(jsx.includes('<span className="pc-attention-count" aria-live="polite">{attention.count+\' \'+attention.noun}</span>'),'the count is live text, not colour alone');
 assert.ok(!/chevron/i.test(jsx.slice(jsx.indexOf('<details className="pc-attention-pop">'),jsx.indexOf('<div className="registerSplit">'))),'the pill carries no trailing chevron because it opens a popover rather than navigating');
 assert.ok(jsx.includes("<b>Before you close</b><span>{attention.count?attention.count+' '+attention.noun+' '+attention.verb+' attention':'All checks passed'}"),'the popover repeats the same count with the entry total, and says All checks passed only there');
 assert.ok(jsx.includes('<Checklist readiness={readiness} onNavigate={onNavigate} only/>'),'each failing check keeps its count and its link into the filtered entries');
 assert.ok(jsx.includes('>Review all<IconArrowRight size={14}/></button>'),'the popover ends with one Review all action');
 assert.ok(!jsx.includes('pc-attention-dismiss')&&!jsx.includes('aria-label="Dismiss"'),'the pill is never dismissible');
 assert.match(css,/pc-attention-pill\.warn\{[^}]*color:#9a3412/,'the amber state is amber, never the primary blue');
 assert.match(css,/pc-attention-pill\.danger\{[^}]*color:#b42318/,'a blocking check reads red');
 assert.match(css,/pc-attention-pill\{[^}]*color:#4a5468/,'one or two soft checks stay neutral grey');
 assert.match(css,/\.pc-attention-pop-menu\{[^}]*width:min\(400px,92vw\)/,'the popover hangs off the pill inside the viewport');
 assert.match(registerHead,/\.pc-register-bar\.registerHead\{position:sticky!important;top:0!important;z-index:9!important/,'the merged register row is pinned so the attention count survives the register scrolling');
});
