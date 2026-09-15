import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../src/JournalEntriesPro.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/journal-detail-actions.css',import.meta.url),'utf8');

test('manual journal detail exposes status-aware actions',()=>{
  for(const label of ['Edit draft','Submit for approval','Approve','Post journal','Reverse journal','Duplicate'])assert.ok(page.includes(label),label);
  assert.match(page,/journal\.status==='Draft'&&<button className="je-secondary-action" onClick=\{\(\)=>onAction\(journal,'Pending Approval'\)\}>Submit for approval/);
  assert.match(page,/journal\.status==='Posted'[^\n]*!journal\.reversalOf[^\n]*!journal\.reversalJournalId/);
  assert.match(css,/\.je-detail-actions\{/);
});

test('reversal is confirmed, linked and makes the original single-use',()=>{
  assert.match(page,/reversalOf:j\.id/);
  assert.match(page,/status:'Reversed',reversalJournalId:r\.id/);
  assert.match(page,/reversalReason:payload\.reason/);
  assert.match(page,/className="je-reverse-dialog"/);
  assert.match(page,/The original journal remains in the audit trail and cannot be reversed again/);
});
