import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workspace=readFileSync(new URL('../src/AccountWorkspace.jsx',import.meta.url),'utf8');
const polish=readFileSync(new URL('../src/ui-quality-polish.css',import.meta.url),'utf8');

test('Chart of Accounts header shows the contextual account total once',()=>{
  assert.match(workspace,/\{t\.chartOfAccounts\} <span className="am-heading-count">\(\{count\}\)<\/span>/);
  assert.match(workspace,/count=\{db\.accounts\.length\}/,'the page still passes the live account total into the row');
  assert.equal((workspace.match(/am-heading-count/g)||[]).length,1);
  assert.doesNotMatch(workspace,/Account count/);
});

test('Chart of Accounts uses the shared compact context and avoids duplicate local context',()=>{
  assert.doesNotMatch(workspace,/am-working-context-title/);
  assert.match(polish,/\.orgContextBar/);
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
  assert.match(workspace,/className="am-row-edit" onClick=\{\(\)=>start\(a\)\}/,'and every row carries one visible Edit action');
});

test('Account details shows a dated current balance and accountant notation',()=>{
  assert.match(workspace,/Current Balance/);
  assert.match(workspace,/As of \{asOf\}/);
  assert.match(workspace,/view==='Accounting'/);
  assert.doesNotMatch(workspace,/Closing Balance/);
});
