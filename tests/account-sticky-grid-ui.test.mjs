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

test('the account grid stays a bounded scroll port so its head can stick',()=>{
  const wrap=rule('.am-coa-page .am-table-wrap:has(.am-account-grid)');
  assert.match(wrap,/overflow:auto/);
  assert.match(wrap,/max-height:max\(360px,calc\(100vh - 280px\)\)/);
  assert.match(wrap,/max-height:max\(360px,calc\(100dvh - 280px\)\)/);
  assert.match(wrap,/overscroll-behavior:contain/);
  assert.doesNotMatch(wrap,/overflow:visible/);
  assert.ok(css.includes('.am-account-grid{min-width:1120px}'),'the grid still needs its horizontal scroller');
});

test('the column header row and the account-group accordion row stick under the filter row',()=>{
  assert.match(css,/\.am-coa-page\{--am-coa-head-h:40px\}/);
  const head=rule('.am-coa-page .am-account-grid thead th');
  assert.match(head,/position:sticky;top:0;z-index:6/);
  assert.match(head,/background:#f7f9fc/);
  const group=rule('.am-coa-page .am-account-grid .am-group-row th');
  assert.match(group,/position:sticky;top:calc\(var\(--am-coa-head-h\) - 1px\);z-index:5/);
  assert.ok(css.includes('.am-table .am-group-row th{color:#35455e;background:#edf2f9;font-size:13px}'),'the group row keeps its opaque fill');
});

test('the sticky head stays below the row action menu and the heading Templates disclosure',()=>{
  assert.match(css,/\.am-table \.am-more>div\{[^}]*z-index:80!important/);
  assert.doesNotMatch(css,/\.am-coa-page \.am-account-grid \.am-group-row th\{[^}]*z-index:(8|9|1\d)/);
});

test('the grid, its scope columns and the group markup are unchanged by the sticky head',()=>{
  assert.match(workspace,/<table className="am-table am-account-grid am-coa-grid standard">/);
  assert.match(workspace,/<th>\{t\.accountName\}<\/th><th>\{t\.accountCode\}<\/th><th>\{t\.accountGroup\}<\/th><th>\{t\.status\}<\/th>/);
  assert.ok(workspace.includes('<th>Organisation</th>'),'the Organisation column is still conditional and intact');
  assert.ok(workspace.includes('<th>Branch</th>'),'the Branch column is still conditional and intact');
  assert.match(workspace,/am-group-row/);
  assert.match(workspace,/am-account-grid/);
});
