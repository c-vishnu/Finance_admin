import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workspace=readFileSync(new URL('../src/AccountWorkspace.jsx',import.meta.url),'utf8');
const polish=readFileSync(new URL('../src/ui-quality-polish.css',import.meta.url),'utf8');

test('Chart of Accounts header shows the contextual account total once',()=>{
  assert.match(workspace,/\{t\.chartOfAccounts\} <span className="am-heading-count">\(\{db\.accounts\.length\}\)<\/span>/);
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

test('Chart of Accounts list is selection-free and grouped with accessible accordions',()=>{
  assert.doesNotMatch(workspace,/am-list-meta/);
  assert.doesNotMatch(workspace,/Select all visible accounts/);
  assert.doesNotMatch(workspace,/aria-label={`Select /);
  assert.match(workspace,/className="am-group-toggle" aria-expanded=/);
  assert.match(workspace,/groupKey=`type:\$\{type\}`/);
});

test('Account details shows a dated current balance and accountant notation',()=>{
  assert.match(workspace,/Current Balance/);
  assert.match(workspace,/As of \{asOf\}/);
  assert.match(workspace,/view==='Accounting'/);
  assert.doesNotMatch(workspace,/Closing Balance/);
});
