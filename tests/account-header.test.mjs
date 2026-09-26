import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workspace=readFileSync(new URL('../src/AccountWorkspace.jsx',import.meta.url),'utf8');
const polish=readFileSync(new URL('../src/ui-quality-polish.css',import.meta.url),'utf8');
const terminology=readFileSync(new URL('../src/terminology.jsx',import.meta.url),'utf8');

test('Chart of Accounts header shows the contextual account total once',()=>{
  assert.match(workspace,/\{t\.chartOfAccounts\} <span className="am-heading-count">\(\{count\}\)<\/span>/);
  assert.match(workspace,/count=\{db\.accounts\.length\}/,'the page still passes the live account total into the row');
  assert.equal((workspace.match(/am-heading-count/g)||[]).length,1);
  assert.doesNotMatch(workspace,/Account count/);
});

test('the accountant-facing category register is named Charts of Accounts',()=>{
  assert.match(terminology,/accountant:\{chartOfAccounts:'Charts of Accounts'/);
  assert.match(terminology,/business:\{chartOfAccounts:'Money Categories'/,'the business-facing vocabulary remains unchanged');
});

test('Charts of Accounts always reflects the global organisation and branch selection',()=>{
  assert.match(workspace,/import \{financeCategoryScope\} from '.\/finance-category-scope\.js';/);
  assert.match(workspace,/window\.addEventListener\('wayvida-working-context-change',refresh\)/);
  assert.match(workspace,/<th>Organisation<\/th><th>Branch<\/th>/);
  assert.match(workspace,/title=\{financeScope\.detail\}/,'compact scope values retain exact selected names on hover');
  assert.doesNotMatch(workspace,/accountScopeCell/,'account-specific scope does not override the global switcher selection');
});

test('Chart of Accounts uses the shared compact context and avoids duplicate local context',()=>{
  assert.doesNotMatch(workspace,/am-working-context-title/);
  assert.doesNotMatch(polish,/\.orgContextBar/);
  assert.match(readFileSync(new URL('../src/Navigation.jsx',import.meta.url),'utf8'),/WorkingContextSwitcher/);
  assert.match(workspace,/\{t\.chartSubtitle\}/);
});

test('Chart of Accounts removes summary statistics and uses the operational account columns',()=>{
  assert.doesNotMatch(workspace,/className="am-summary-strip"/);
for(const label of ['{t.accountName}','{t.accountCode}','{t.accountGroup}','{t.status}'])assert.ok(workspace.includes(label),label);
  assert.match(workspace,/<td>\{a\.group\}<\/td>/);
  assert.doesNotMatch(workspace,/<td><b>\{a\.group\}<\/b><\/td>/);
  assert.doesNotMatch(workspace,/a\.group\|\|a\.accountNature/);
  assert.doesNotMatch(workspace,/<th>Organisation &amp; Availability<\/th>/);
  assert.doesNotMatch(workspace,/am-system-label/);
  assert.doesNotMatch(workspace,/Protected posting account/);
  assert.match(workspace,/safeReadPreference/);
  assert.match(workspace,/useTerminology/);
});

test('Chart of Accounts is one flat table of accounts, with no accordion',()=>{
  assert.doesNotMatch(workspace,/am-list-meta/);
  assert.doesNotMatch(workspace,/Select all visible accounts/);
  assert.doesNotMatch(workspace,/aria-label={`Select /);
  assert.doesNotMatch(workspace,/am-group-toggle/,'the type accordion is gone');
  assert.doesNotMatch(workspace,/am-group-row/,'along with its section rows');
  assert.doesNotMatch(workspace,/openGroups/,'and the state that kept its sections open');
  assert.match(workspace,/const flatRows=typeGroups\.flatMap\(group=>group\.rows\.map\(row=>\(\{\.\.\.row,type:group\.name\}\)\)\)/,'the grid is one flat list in chart order, each row carrying the type it belongs to');
  assert.match(workspace,/<th>Account Type<\/th>/,'so the type is a column of the table instead of a section heading');
  assert.match(workspace,/<IconEdit size=\{16\}\/>Edit<\/button><button type="button" onClick=\{menuRun\(\(\)=>start\(a,true\)\)\}/,'and every row exposes Edit first in its More actions menu');
  assert.doesNotMatch(workspace,/className="am-row-edit"/,'so Edit is not duplicated as a visible row action');
});

test('Account details shows a dated current balance and accountant notation',()=>{
  assert.match(workspace,/Current Balance/);
  assert.match(workspace,/As of \{asOf\}/);
  assert.match(workspace,/view==='Accounting'/);
  assert.doesNotMatch(workspace,/Closing Balance/);
});
