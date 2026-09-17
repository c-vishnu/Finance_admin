import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workspace=readFileSync(new URL('../src/BudgetWorkspace.jsx',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const css=readFileSync(new URL('../src/budget-workspace.css',import.meta.url),'utf8');

test('the Budgets register is a grid of Budget Name, Financial Year, Budget Period and Actions',()=>{
  assert.ok(workspace.includes('<th scope="col">Budget Name</th><th scope="col">Financial Year</th><th scope="col">Budget Period</th><th scope="col">Actions</th>'),'the four columns are declared once');
  assert.ok(workspace.includes('<td><b>{budget.name}</b></td><td>{budget.financialYear}</td><td>{budget.period}</td>'),'each row states the name, the financial year and the budget period');
  assert.ok(workspace.includes('<td colSpan="4" className="emptyStateCell"><EmptyState variant="budget" title="No budgets found" description="No budgets match these filters. Create a budget to start planning." actionLabel="Create Budget" onAction={create}/></td>'),'the empty state spans the four columns and offers Create Budget');
  for(const gone of ["'Budget Type'","'Scope'","'Total Amount'","'Status'","'Created By'","'Last Updated'"]){
    assert.ok(!workspace.includes(gone),gone+' is no longer a register column');
  }
  assert.ok(!workspace.includes('budgetMetrics'),'the status card row is gone from the register');
  for(const goneCard of ['Total Budgets','Active Budgets','Total Planned Income','Total Planned Expense']){
    assert.ok(!workspace.includes(goneCard),goneCard+' is no longer rendered above the register');
  }
  assert.ok(workspace.indexOf('className="budgetV3Head"')<workspace.indexOf('className="budgetListCard"'),'the page heading now leads straight into the register card');
});

test('the register toolbar sits inside the card above the table, like the other registers',()=>{
  assert.ok(workspace.includes('<section className="budgetListCard">\n      <div className="budgetRegisterBar">'),'the toolbar is the first child of the register card');
  assert.ok(workspace.indexOf('className="budgetRegisterBar"')<workspace.indexOf('<table className="budgetTable">'),'the toolbar renders above the table');
  assert.ok(workspace.includes('className="budgetFilterSearch"'),'the toolbar carries the search box');
  assert.ok(workspace.includes('className="budgetFilterYear"'),'the financial year select sits beside the search');
  assert.ok(workspace.includes('<details className="budgetFiltersMore">'),'one Filters button opens a disclosure');
  assert.ok(workspace.includes('<div className="budgetFiltersPanel">'),'the disclosure holds the remaining filters');
  for(const field of ['Budget type','Budget period','Scope','Status']){
    assert.ok(workspace.includes('<label className="budgetFilterField"><span>'+field+'</span><select'),field+' is filtered inside the disclosure');
  }
  const search=workspace.indexOf('className="budgetFilterSearch"');
  const year=workspace.indexOf('className="budgetFilterYear"');
  const more=workspace.indexOf('className="budgetFiltersMore"');
  assert.ok(search>-1&&search<year&&year<more,'the toolbar order is search, financial year, then Filters');
  assert.ok(workspace.includes('<div className="budgetFiltersPanelActions"><button type="button" onClick={clearAdvanced}>Clear filters</button></div>'),'the panel ends with the shared clear action row');
  assert.ok(!workspace.includes('<div className="budgetFilters">'),'the old full width filter row is gone from the register');
  assert.ok(!workspace.includes('budgetRegisterHead')&&!workspace.includes('className="budgetSearch"'),'the heading no longer carries the filters');
  assert.ok(workspace.includes('<div className="budgetV3Head"><div><h1>{business?'),'the page heading keeps the title block');
  assert.ok(workspace.includes('className="budgetHeadActions"><button onClick={()=>importRef.current?.click()}>'),'the heading keeps only Import beside the title');
  assert.ok(workspace.includes('const activeFilterCount=[')&&workspace.includes('const clearAdvanced=()=>setFilters({...filters,...advancedDefaults});'),'one computed count drives the Filters badge and the clear action');
});

test('each row offers View Details and one 3-dot menu',()=>{
  assert.ok(workspace.includes('<button type="button" className="budgetRowView" aria-label={`View Details for ${budget.name}`} onClick={()=>view(budget)}>'),'the visible action is labelled and names its budget');
  assert.ok(workspace.includes('>View Details</button>'),'the visible label matches the requested action');
  assert.ok(workspace.includes('<details className="budgetKebab"><summary aria-label={`More actions for ${budget.name}`}><IconDots size={17}/></summary>'),'the row menu is the canonical horizontal 3-dot kebab');
  const menuStart=workspace.indexOf('budgetKebabMenu');
  const menu=workspace.slice(menuStart,workspace.indexOf('</details>',menuStart));
  for(const entry of ['>View budget</button>','>Edit</button>','>Duplicate</button>','>Delete</button>']) assert.ok(menu.includes(entry),'the menu offers '+entry);
  assert.ok(menu.includes('className="budgetKebabDanger"'),'Delete is the destructive entry');
  assert.equal((menu.match(/type="button"/g)||[]).length,4,'every menu entry is a real button');
  assert.ok(workspace.includes("const menuRun=handler=>event=>{event.currentTarget.closest('details')?.removeAttribute('open');handler()};"),'running an action closes the menu');
  assert.ok(workspace.includes("document.querySelectorAll('.budgetKebab[open],.budgetFiltersMore[open]')"),'one page level dismissal closes the row menus and the filter panel');
  assert.ok(workspace.includes("window.addEventListener('keydown',closeOnEscape)")||workspace.includes("document.addEventListener('keydown',closeOnEscape)"),'Escape closes the menu');
  for(const removed of ['title="Export"','title="Archive"','title="View"','title="Edit"','title="Duplicate"']){
    assert.ok(!workspace.includes(removed),removed+' is no longer a register row control');
  }
});

test('View Details opens the budget detail on that tab',()=>{
  assert.ok(workspace.includes("view={budget=>{setSelected(budget.id);setDetailTab('Budget vs Actual');setScreen('detail')}}"),'the register action selects the Budget vs Actual tab');
  assert.ok(workspace.includes('const [detailTab,setDetailTab]=useState(BUDGET_DETAIL_DEFAULT);'),'the detail tab is page state');
  assert.ok(workspace.includes('initialTab={detailTab}'),'the chosen tab is handed to the detail screen');
  assert.ok(workspace.includes('key={budget.id+\'/\'+detailTab}'),'a different entry point remounts the detail screen');
  assert.ok(workspace.includes('function BudgetDetail({budget,business,initialTab,back,edit,duplicate,exportBudget,archive,remove,onStatus}){'),'the detail screen accepts the entry tab and the delete handler');
  assert.ok(workspace.includes('const [tab,setTab]=useState(initialTab||BUDGET_DETAIL_DEFAULT);'),'the detail screen opens on the requested tab');
  assert.ok(workspace.includes("back={()=>{setScreen('list');setDetailTab(BUDGET_DETAIL_DEFAULT)}}"),'leaving the detail resets the entry tab');
  assert.ok(workspace.includes("const BUDGET_DETAIL_TABS=[")
    &&workspace.includes("['Overview','Overview'],")
    &&workspace.includes("['Profit and Loss','Profit & Loss'],")
    &&workspace.includes("['Balance Sheet','Balance Sheet'],")
    &&workspace.includes("['Cash Flow Statement','Cash Flow'],")
    &&workspace.includes("['Budget vs Actual','Budget vs Actual'],")
    &&workspace.includes("['Accounts','Accounts'],")
    &&workspace.includes("['Activity History','Activity History'],")
    &&workspace.includes("['Revisions','Revisions']")
    &&workspace.includes("const BUDGET_DETAIL_DEFAULT='Overview';")
    &&workspace.includes('<nav className="budgetAccountTabs">{BUDGET_DETAIL_TABS.map(([key,label])=>')
    &&workspace.includes("className={tab===key?'active':''}"),'every detail view is reachable from one flat tab row');
  assert.ok(workspace.includes("viewStatement={budget=>{setSelected(budget.id);setDetailTab(BUDGET_DETAIL_DEFAULT);setScreen('detail')}}"),'View budget in the row menu opens the detail on the overview');
});

test('the register menu uses the canonical kebab geometry and the card never clips it',()=>{
  assert.ok(css.includes('.budgetRowActions{display:flex;align-items:center;gap:8px}'),'the action cell lays the control and the menu out in one row');
  assert.ok(css.includes('.budgetActionsCell .budgetRowView{min-height:34px;padding:0 11px;gap:7px;font-size:13px;font-weight:650;color:#245fd9}'),'the visible action reuses the budget control styling');
  assert.ok(!css.includes('.budgetActionsCell button{width:30px'),'the old 30px icon-only row buttons are gone');
  for(const token of [
    '.budgetKebab>summary{display:grid;place-items:center;width:32px;height:32px;padding:0;border:1px solid #d9e1ec;border-radius:7px;background:#fff;color:#475467;',
    '.budgetKebab[open]>summary{border-color:#3478f6;color:#245fd9}',
    '.budgetKebab>div{position:absolute;right:0;top:calc(100% + 6px);z-index:20;',
    'min-width:196px;padding:6px;border:1px solid #e1e6ed;border-radius:9px;background:#fff;box-shadow:0 12px 30px #1018281f}',
    '.budgetKebab>div button{display:flex;align-items:center;gap:9px;min-height:36px;padding:0 10px;border:0;border-radius:6px;background:transparent;color:#344054;',
    '.budgetKebab>div button:hover{background:#f4f7ff;color:#245fd9}',
    '.budgetKebab>div button.budgetKebabDanger{color:#b42318}'
  ])assert.ok(css.includes(token),token.slice(0,60));
  assert.ok(css.includes('.budgetListCard{overflow:visible}'),'the register card lets the open menu and the filter panel escape instead of clipping them');
  const sizes=[...css.slice(css.indexOf('.budgetRowActions{')).matchAll(/font-size:([\d.]+)px/g)].map(match=>Number(match[1]));
  assert.ok(sizes.length>=2&&Math.min(...sizes)>=12,'every register control stays at 12px or larger');
});

test('the grid matches the Period Closing register density and right aligns the actions',()=>{
  assert.ok(css.includes('.budgetRegisterBar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:14px 20px 16px;border-bottom:1px solid #eef1f6}'),'the toolbar reuses the shared register bar padding');
  assert.ok(css.includes('.budgetFilterSearch{display:flex;align-items:center;gap:8px;flex:1 1 260px;min-width:200px;min-height:38px;padding:0 10px;border:1px solid #d9e1ec;border-radius:7px;background:#fff;color:#8fa0b7}'),'the search box matches the shared filter search');
  assert.ok(css.includes('.budgetFiltersMore>summary{display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:0 14px;border:1px solid #d9e1ec;border-radius:7px;background:#fff;color:#1d293d;font-weight:600;cursor:pointer;list-style:none}'),'the Filters button matches the shared Filters summary');
  assert.ok(css.includes('.budgetFiltersMore[open]>summary{border-color:#9fbdf0;box-shadow:0 0 0 3px #eaf1ff}'),'the open Filters button keeps the shared focus ring');
  assert.ok(css.includes('.budgetFiltersPanel{position:absolute;right:0;top:44px;z-index:30;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;min-width:min(440px,90vw);padding:14px;border:1px solid #e1e6ed;border-radius:10px;background:#fff;box-shadow:0 14px 30px #0f172a1f}'),'the panel matches the shared filters panel');
  assert.ok(css.includes('.budgetFilterBadge{flex:none;margin-left:auto;'),'the filters badge matches the shared badge');
  assert.ok(css.includes('.budgetFilterField select{min-height:38px;width:100%;padding:0 10px;border:1px solid #d9e1ec;border-radius:7px;background:#fff;color:#172033}'),'the panel fields match the shared filter field');
  for(const token of [
    '.budgetListCard .budgetTable th{padding:12px 14px;background:#f5f7fb;color:#68768b;font-size:12px;font-weight:600;text-align:left;white-space:nowrap}',
    '.budgetListCard .budgetTable td{padding:13px 14px;border-top:1px solid #edf1f6;vertical-align:middle}',
    '.budgetListCard .budgetTable tbody tr:hover td{background:#fafcff}',
    '.budgetListCard .budgetTable th:last-child,.budgetListCard .budgetTable td:last-child{width:1%;text-align:right;white-space:nowrap}',
    '.budgetActionsCell{white-space:nowrap;text-align:right}',
    '.budgetActionsCell .budgetRowActions{justify-content:flex-end}'
  ])assert.ok(css.includes(token),token.slice(0,64));
  const sizes=[...css.slice(css.indexOf('/* Budget register bar and grid.'),css.indexOf('/* Create Budget: the scope row')).matchAll(/font-size:([\d.]+)px/g)].map(match=>Number(match[1]));
  assert.ok(sizes.length>=3&&Math.min(...sizes)>=12,'every register control stays at 12px or larger');
});

test('the budget detail head carries the back control, the status beside the name and one More actions menu',()=>{
  const detail=workspace.slice(workspace.indexOf('function BudgetDetail('),workspace.indexOf('export function BudgetStatementView('));
  assert.ok(detail.includes('<div className="budgetV3Head budgetDetailHead">'),'the detail page opens on its own arrow-led back head');
  assert.ok(detail.includes('<button type="button" className="budgetHeadBack" onClick={back} aria-label="Back to budgets" title="Back to budgets"><IconArrowLeft size={19}/></button>'),'the back control is the arrow button the create page uses');
  assert.ok(detail.includes('<span className="budgetHeadTitle">Budget Details</span>'),'the head names the page Budget Details');
  assert.ok(detail.includes('<div className="budgetDetailName"><h1>{budget.name}</h1><Status value={budget.status}/></div>'),'the lifecycle status sits beside the budget name');
  assert.ok(detail.includes('<p className="budgetDetailMeta">{budget.financialYear} · {budget.period} · {scopeSummary(budget.scope)} · {budget.type}</p>'),'the metadata line stays under the name');
  assert.ok(detail.includes('<div className="budgetDetailActions">{statusAction&&<button type="button" className="primary"'),'the one status action is the primary action on the right');
  assert.ok(detail.includes('<details className="budgetDetailMore"><summary className="budgetDetailMoreBtn"><IconDots size={17}/>More actions<IconChevronDown className="budgetDetailMoreCaret" size={16}/></summary>'),'a More actions disclosure sits beside it');
  for(const entry of ["onClick={menuRun(edit)}><IconEdit size={16}/>Edit</button>","onClick={menuRun(duplicate)}><IconCopy size={16}/>Duplicate</button>","onClick={menuRun(exportBudget)}><IconDownload size={16}/>Export</button>","onClick={menuRun(archive)}><IconArchive size={16}/>Archive</button>"]) assert.ok(detail.includes(entry),'the menu offers '+entry.slice(9,24));
  assert.ok(detail.includes('<button type="button" className="budgetKebabDanger" onClick={menuRun(remove)}><IconTrash size={16}/>Delete</button>'),'Delete is the destructive last entry');
  assert.ok(workspace.includes("remove={()=>{if(!window.confirm(`Delete ${budget.name}? The budget will be archived, not permanently erased.`))return;try{save(deleteBudget(state,selected));setSelected(null);setScreen('list');notify('Budget deleted and archived')}catch(error){notify(error.message)}}}"),'deleting from the detail view archives the plan and returns to the register');
  assert.ok(workspace.includes("useEffect(()=>{const openMenus=()=>document.querySelectorAll('.budgetDetailMore[open]');"),'the detail screen closes its own menu on an outside click or Escape');
  for(const token of [
    '.app main:has(>.budgetV3.budgetDetailV3){max-width:none!important;padding:0!important}',
    '.app main>.budgetV3.budgetDetailV3{max-width:none!important;margin:0!important;padding:0 0 28px!important}',
    '.app main>.budgetV3.budgetDetailV3>:not(.budgetV3Head){margin-left:clamp(16px,2.2vw,32px)!important;margin-right:clamp(16px,2.2vw,32px)!important}',
    '.app main>.budgetV3.budgetDetailV3>.budgetV3Head.budgetDetailHead{display:grid!important;grid-template-columns:40px minmax(0,1fr)!important',
    '.budgetDetailIdentityRow{display:flex;align-items:flex-start;justify-content:space-between',
    '.budgetDetailName{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '.budgetDetailMore>summary{display:inline-flex;flex:1 1 auto;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 15px',
    '.budgetDetailMoreMenu button{display:flex;align-items:center;gap:9px;width:100%;min-height:36px',
    '.budgetDetailMoreMenu button.budgetKebabDanger{color:#b42318}'
  ])assert.ok(css.includes(token),'the detail head styling is present: '+token.slice(0,52));
  const headCss=css.slice(css.indexOf('.budgetDetailIdentityRow{'),css.indexOf('@media(max-width:760px){.app main>.budgetV3.budgetDetailV3'));
  const sizes=[...headCss.matchAll(/font-size:([\d.]+)px/g)].map(match=>Number(match[1]));
  assert.ok(!sizes.length||Math.min(...sizes)>=12,'every detail head control stays at 12px or larger');
});