import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/account-workspace.css',import.meta.url),'utf8');
const polish=readFileSync(new URL('../src/ui-quality-polish.css',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../src/AccountWorkspace.jsx',import.meta.url),'utf8');

const rule=selector=>{
  const found=css.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{([^}]*)\\}'));
  assert.ok(found,'missing rule '+selector);
  return found[1];
};

test('the working content is the only scroll port, so the filter row pins at its top',()=>{
  assert.match(polish,/\.app>main\{[^}]*height:calc\(100dvh - 105px\)[^}]*overflow-x:clip;overflow-y:auto/);
  assert.match(rule('.am-coa-page>.am-filter-toolbar'),/position:sticky;top:0;z-index:9/);
});

test('the account list is not a scroll port, so the page scrolls instead',()=>{
  const wrap=rule('.am-coa-page .am-table-wrap:has(.am-account-grid)');
  assert.match(wrap,/overflow:visible/);
  assert.match(wrap,/max-height:none/);
  assert.match(wrap,/overscroll-behavior:auto/);
  assert.doesNotMatch(wrap,/max-height:max\(/,'the wrapper keeps no inner scroll height');
  assert.doesNotMatch(wrap,/overscroll-behavior:contain/);
  assert.ok(css.includes('.am-coa-page .am-table-wrap:has(.am-account-grid){overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain}'),'below 700px the wrapper is allowed a horizontal scroller so the last columns stay reachable');
  assert.ok(css.includes('.am-account-grid{min-width:1120px}'),'the grid still declares its minimum width');
});

test('the toolbar hides on the way down and the sticky rows follow it',()=>{
  assert.match(css,/\.am-coa-page\{--am-coa-head-h:40px;--am-coa-bar-h:65px\}/,'the page publishes both the header and the measured bar height');
  assert.match(rule('.am-coa-page>.am-filter-toolbar'),/transition:transform/,'the bar animates out and back');
  assert.ok(css.includes('.am-coa-page.am-coa-bar-hidden>.am-filter-toolbar{transform:translateY(calc(-100% - 32px))}'),'the hidden bar clears the shell padding as well as its own height');
  const head=rule('.am-coa-page .am-account-grid thead th');
  assert.match(head,/position:sticky;top:var\(--am-coa-bar-h\);z-index:6/,'the column header row sticks under the bar');
  assert.match(head,/background:#f7f9fc/);
  assert.ok(!css.includes('.am-group-row'),'the accordion section rows and their sticky offsets are gone, because the grid is one flat table');
  assert.ok(css.includes('.am-coa-page.am-coa-bar-hidden .am-account-grid thead th{top:0}'),'a hidden bar drops the header offset to the top edge');
  assert.ok(workspace.includes('setBarHidden(current=>current===next?current:next)'),'the toggle only re-renders when the state actually changes');
  assert.ok(workspace.includes("const next=y>4&&delta>0&&y>bar.offsetHeight"),'the bar hides only past its own height while scrolling down, and the top always shows it');
  assert.ok(workspace.includes("shell.style.setProperty('--am-coa-bar-h',bar.offsetHeight+'px')"),'the measured bar height is what the sticky rows offset by');
  assert.ok(workspace.includes("new ResizeObserver(measure)"),'and it is re-measured when the bar wraps');
});

test('the sticky head stays below the row action menu and the heading Templates disclosure',()=>{
  assert.match(css,/\.am-table \.am-more>div\{[^}]*z-index:80!important/);
});

test('the grid, its scope columns and the group markup are unchanged by the sticky head',()=>{
  assert.match(workspace,/<table className="am-table am-account-grid am-coa-grid standard">/);
  assert.match(workspace,/<th>\{t\.accountName\}<\/th><th>\{t\.accountCode\}<\/th><th>Account Type<\/th><th>\{t\.accountGroup\}<\/th><th>\{t\.status\}<\/th>/,'the type that used to head an accordion section is a column now');
  assert.ok(workspace.includes('<th>Organisation</th>'),'the Organisation column is still conditional and intact');
  assert.ok(workspace.includes('<th>Branch</th>'),'the Branch column is still conditional and intact');
  assert.doesNotMatch(workspace,/am-group-row/,'the grid carries no accordion section rows');
  assert.match(workspace,/am-account-grid/);
});
 
/* The whole Chart of Accounts header is one row. The title and subtitle lead it, then the
   search box, the Filters disclosure and the Import / Export / Add Account actions, so the
   page has no second row of controls and no separate heading band. The account-type and
   status selects live inside the Filters panel beside the four advanced filters, the panel
   badge and Reset cover all six, the summary is named Filters with the funnel icon the other
   registers use, and Import and Export are icon-only buttons with a title and an aria-label.
   Add Account needs no colour override because the shared .am button.primary token is already
   #326df4. */
test('the Chart of Accounts header is one row led by the title',()=>{
  const start=workspace.indexOf('<div className="am-toolbar am-filter-toolbar">');
  assert.notEqual(start,-1,'the shared toolbar is still the control row');
  const toolbar=workspace.slice(start,workspace.indexOf('  </div>;',start));
  for(const control of ['className="am-coa-title"','className="am-search"','className="am-filter-menu"','className="am-actions am-toolbar-actions"'])
    assert.ok(toolbar.includes(control),'the one row carries '+control);
  assert.ok(toolbar.indexOf('className="am-coa-title"')<toolbar.indexOf('className="am-search"'),'the title leads the row');
  assert.ok(toolbar.indexOf('className="am-filter-menu"')<toolbar.indexOf('className="am-actions am-toolbar-actions"'),'the actions close the row, after the filters');
  assert.match(toolbar,/<div className="am-coa-title"><h1>\{t\.chartOfAccounts\} <span className="am-heading-count">\(\{count\}\)<\/span><\/h1><p>\{t\.chartSubtitle\}<\/p><\/div>/,'the title and subtitle share the row');
  assert.match(toolbar,/<summary aria-label="Open filters"><IconFilter size=\{17\}\/>Filters\{advancedCount>0&&<span>\{advancedCount\}<\/span>\}<\/summary>/,'the disclosure is Filters with the funnel icon the other registers use');
  assert.match(toolbar,/<div className="am-split"><button type="button" className="primary am-split-main" onClick=\{onAdd\}><IconPlus size=\{18\}\/>\{t\.addAccount\}<\/button><details className="am-split-more"><summary aria-label="More account actions" title="More account actions"><IconChevronDown size=\{18\}\/><\/summary><div><button type="button" onClick=\{onImport\}><IconUpload size=\{16\}\/>Import<\/button><button type="button" onClick=\{onExport\}><IconDownload size=\{16\}\/>Export<\/button><\/div><\/details><\/div>/,'Add Account is a split button whose chevron opens the Import and Export alternatives');
  assert.ok(!workspace.includes('<div className="am-heading am-coa-heading"'),'the separate heading band is gone');
  assert.ok(!workspace.includes('Advanced filters'),'the old Advanced filters label is gone');
  assert.ok(!workspace.includes('<IconAdjustments size={18}/>Advanced filters'),'the old Advanced filters summary is gone');
  assert.match(workspace,/\{t\.chartSubtitle\}/,'the subtitle still renders');
  assert.ok(workspace.includes('count={db.accounts.length}'),'the page passes the live account total into the row');
  assert.ok(workspace.includes('onUseTemplate={useTemplate}'),'the hidden Templates disclosure is still wired');
});

test('the Filters panel owns every filter except the search box',()=>{
  const panel=workspace.slice(workspace.indexOf('<div className="am-filter-fields">'),workspace.indexOf('</details>',workspace.indexOf('<div className="am-filter-fields">')));
  for(const filter of ['className="am-type-filter"','className="am-status-filter"','aria-label="System or user created"','aria-label={t?.accountGroup','aria-label="Branch requirement"','aria-label="Balance range"'])
    assert.ok(panel.includes(filter),'the panel carries '+filter);
  assert.ok(workspace.indexOf('className="am-type-filter"')>workspace.indexOf('className="am-filter-fields"'),'the account type is inside the panel, not the toolbar');
  assert.ok(workspace.indexOf('className="am-status-filter"')>workspace.indexOf('className="am-filter-fields"'),'and so is the status');
  assert.ok(workspace.includes("const advancedCount=[type!=='All',status!=='All',creator!=='All',group!=='All',branch!=='All',balanceRange!=='All'].filter(Boolean).length;"),'the badge counts all six panel filters');
  assert.ok(workspace.includes("const resetAdvanced=()=>{setType('All');setStatus('All');setCreator('All');setGroup('All');setBranch('All');setBalanceRange('All')};"),'and Reset clears all six');
});

test('the one-row toolbar keeps its tokens and folds below the 851px line',()=>{
  assert.match(rule('.am-coa-page>.am-filter-toolbar'),/position:sticky;top:0;z-index:9/,'the row still pins to the working content');
  assert.match(rule('.am-coa-page>.am-filter-toolbar'),/flex-wrap:wrap/,'and may fold instead of overflowing');
  for(const token of ['.am-coa-page>.am-filter-toolbar .am-coa-title{display:grid;align-content:center;gap:2px;min-width:170px;max-width:min(430px,40vw);flex:1 1 300px}','.am-coa-page>.am-filter-toolbar .am-toolbar-actions{flex:0 0 auto;gap:8px;flex-wrap:nowrap}','.am-coa-page>.am-filter-toolbar .am-toolbar-actions>.am-more{display:none}'])
    assert.ok(css.includes(token),'the row keeps '+token);
  assert.ok(css.includes('.am-coa-page>.am-filter-toolbar .am-toolbar-actions button{height:40px;min-height:40px;padding:0 14px;font-size:13px;font-weight:600;gap:7px;white-space:nowrap}'),'the actions match the 40px control height of the row');
  assert.ok(css.includes('.am-coa-page>.am-filter-toolbar .am-toolbar-actions .am-split{display:inline-flex;align-items:stretch;flex:0 0 auto}'),'the split button is one inline-flex pair');
  assert.ok(css.includes('.am-coa-page>.am-filter-toolbar .am-toolbar-actions .am-split>.am-split-main{height:40px;min-height:40px;padding:0 14px;border-top-right-radius:0;border-bottom-right-radius:0;font-size:13px;font-weight:600;gap:7px}'),'the primary half keeps its inner corners square so the two halves read as one control');
  assert.ok(css.includes('.am-coa-page>.am-filter-toolbar .am-toolbar-actions .am-split>.am-split-more>summary{display:inline-grid;place-items:center;width:38px;height:40px;min-height:40px;margin:0 0 0 -1px;padding:0;border:1px solid var(--am-blue);border-left:1px solid #6c9bf9;background:var(--am-blue);color:#fff;border-radius:0 7px 7px 0;cursor:pointer;list-style:none}'),'the chevron half carries the outer radius and the divider');
  assert.ok(css.includes('.am-coa-page>.am-filter-toolbar .am-toolbar-actions .am-split>.am-split-more>div{position:absolute;right:0;top:calc(100% + 6px);z-index:80;display:flex;flex-direction:column;min-width:196px;padding:6px;border:1px solid #e1e6ed;border-radius:9px;background:#fff;box-shadow:0 12px 30px #1018281f}'),'the dropdown uses the canonical menu geometry');
  assert.ok(css.includes('  .am-coa-page>.am-filter-toolbar .am-search{margin-left:auto}'),'the search carries the auto margin, so it sits directly beside the Filters button');
  assert.ok(css.includes('  .am-coa-page>.am-filter-toolbar .am-filter-menu{margin-left:0}'),'and the filter menu keeps no auto margin of its own');
  assert.match(css,/@media\(min-width:851px\)\{\s+\.am-coa-page>\.am-filter-toolbar \.am-search\{flex:0 1 180px;min-width:160px\}/,'the deliberately narrow search width is scoped above the tablet fold so the shared toolbar still stacks below it');
  assert.ok(!css.includes('.am-coa-page>.am-filter-toolbar .am-type-filter{flex:0 0 auto'),'the toolbar no longer sizes the two selects it stopped rendering');
  assert.ok(!/\.am-coa-heading \.am-actions button\.primary\{/.test(css),'the dead heading primary overrides are gone');
  assert.ok(css.includes('.am>.am-heading>.am-actions>.am-more{display:none}'),'the shared heading Templates rule stays');
});
 
/* The account grid keeps the shared .am-table bones and only sharpens them. */
test('the account grid reads as one stack with a live row',()=>{
  for(const token of [
    '.am-coa-page .am-coa-grid thead th:first-child{padding-left:48px}',
    '.am-coa-page .am-coa-grid th:last-child{width:1%}',
    '.am-coa-page .am-coa-grid th:last-child,.am-coa-page .am-coa-grid td:last-child{text-align:right}',
    '.am-coa-page .am-coa-grid tbody tr:hover>td{background:#f8fbff}',
    '.am-coa-page .am-coa-grid td:nth-child(2){color:#5b6b81;font-variant-numeric:tabular-nums}',
    '.am-coa-page .am-coa-grid tbody tr:last-child>td{border-bottom:0}',
  ]) assert.ok(css.includes(token),'the grid keeps '+token);
  assert.ok(css.includes('.am-coa-page .am-coa-grid tbody tr.selected>td,.am-coa-page .am-coa-grid tbody tr.selected:hover>td{background:#eff5ff}'),'a selected row keeps its tint through the hover state');
  assert.ok(css.includes('.am-coa-page .am-coa-grid .am-tree-name>button:focus-visible,.am-coa-page .am-coa-grid .am-row-edit:focus-visible,.am-coa-page .am-coa-grid .am-more>summary:focus-visible{outline:2px solid #245fd9;outline-offset:-2px}'),'the row controls keep a visible focus ring');
  const sizes=[...css.slice(css.indexOf('/* Chart of Accounts - account grid polish.')).matchAll(/font-size:([\d.]+)px/g)].map(m=>Number(m[1]));
  assert.ok(sizes.length&&Math.min(...sizes)>=12,'every grid polish rule stays at or above the 12px floor');
  assert.ok(css.includes('.am-coa-page .am-coa-grid .am-row-edit{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;padding:0 10px;border:1px solid #d0d5dd;border-radius:7px;background:#fff;color:#344054;font-weight:600;cursor:pointer}'),'and the visible row action wears the register row-button tokens');
});
 
/* The grid is one flat table: the type that used to head an accordion section is a column, and
   every row carries the same visible Edit action beside its menu. */
test('the account grid is one flat table with a visible row action',()=>{
  for(const token of [
    ".am-coa-page .am-coa-grid .am-row-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px}",
    ".am-coa-page .am-coa-grid .am-row-actions-cell{width:1%;white-space:nowrap}",
  ]) assert.ok(css.includes(token),'the row action cluster keeps '+token);
  assert.ok(css.includes('.am-coa-page .am-coa-grid .am-row-edit:hover{border-color:#98a2b3;background:#f9fafb}'),'and the Edit button hovers like the register row buttons');
  assert.ok(!css.includes('am-group-toggle')&&!css.includes('am-group-row'),'no accordion rule is left behind');
  assert.ok(!css.includes('.am-row-more'),'and the old actions cell class is gone with it, not left dead');
  assert.match(workspace,/const flatRows=typeGroups\.flatMap\(group=>group\.rows\.map\(row=>\(\{\.\.\.row,type:group\.name\}\)\)\)/,'the body is one flat list in chart order');
  assert.match(workspace,/className="am-row-edit" onClick=\{\(\)=>start\(a\)\}/,'each row opens its editor from a visible button');
  assert.doesNotMatch(workspace,/openGroups|onToggleGroup|am-group-toggle/,'and the accordion state and markup are gone');
});

/* The Account Type column carries one mark per type, so the five types read at a glance. */
test('every account type has its own mark and tone in the type column',()=>{
  for(const [type,tone] of [['Assets','assets'],['Liabilities','liabilities'],['Equity','equity'],['Income','income'],['Expenses','expenses']])
    assert.ok(workspace.includes(type+':{icon:Icon')&&workspace.includes("tone:'"+tone+"'"),type+' carries its own icon and tone');
  assert.match(workspace,/<span className=\{'am-type-badge am-type-'\+\(mark\.tone\|\|'neutral'\)\}>\{Mark&&<span className="am-type-mark"><Mark size=\{13\}\/><\/span>\}/,'and the cell renders the mark beside the label');
  assert.match(workspace,/const TYPE_MARKS=\{Assets:\{icon:IconHome/,'the marks are declared once, beside the page constants');
  assert.match(workspace,/Expenses:\{icon:IconShoppingBag,tone:'expenses'\}/,"the expenses mark is the shopping bag rather than the receipt glyph the payment documents use");
  for(const token of [
    '.am-coa-page .am-coa-grid .am-type-badge{display:inline-flex;align-items:center;gap:7px;padding:2px 10px 2px 2px;border-radius:999px;background:#f1f4f8;color:#475467;font-size:12px;font-weight:600;line-height:1.6;white-space:nowrap}',
    '.am-coa-page .am-coa-grid .am-type-mark{display:inline-grid;place-items:center;flex:0 0 auto;width:20px;height:20px;border-radius:50%;background:#98a2b3;color:#fff}',
    '.am-coa-page .am-coa-grid .am-type-assets{background:#eef0fd;color:#4038a8}',
    '.am-coa-page .am-coa-grid .am-type-liabilities{background:#fbe9f4;color:#8e2f6b}',
    '.am-coa-page .am-coa-grid .am-type-equity{background:#e7f0fd;color:#1d4ed8}',
    '.am-coa-page .am-coa-grid .am-type-income{background:#e2f5f9;color:#0b6477}',
    '.am-coa-page .am-coa-grid .am-type-expenses{background:#fdf0e3;color:#96540f}',
  ]) assert.ok(css.includes(token),'the type mark keeps '+token.slice(0,58));
  assert.match(css,/\.am-coa-page \.am-coa-grid \.am-type-badge\{[^}]*font-size:12px/,'the label stays at the 12px floor');
  assert.ok(!css.includes('.am-type-assets{background:#e6f6f0')&&!css.includes('.am-type-income{background:#e9f7e3'),'and no type tone sits in a status hue: green belongs to the status pill, which is why assets are indigo and income cyan');
});
