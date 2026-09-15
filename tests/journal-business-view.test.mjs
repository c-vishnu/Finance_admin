import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/JournalEntriesPro.jsx',import.meta.url),'utf8');
const terminology=await readFile(new URL('../src/terminology.jsx',import.meta.url),'utf8');

test('Business Owner Journal View changes labels while retaining the original screens and actions',()=>{
  assert.match(source,/return \<JournalRegister/);
  assert.match(source,/return \<JournalForm/);
  assert.match(source,/return preview\?.*\<JournalDetail/);
  assert.match(source,/\{viewMode==='business'\?'Create Adjustment':'Create manual journal'\}/);
  assert.match(source,/\{viewMode==='business'\?'Send for Review':'Submit for approval'\}/);
  assert.match(source,/\{viewMode==='business'\?'Post adjustment':'Post journal'\}/);
  assert.match(source,/\['Ledger Impact',viewMode==='business'\?'Account Activity':'Ledger Impact'\]/);
});

test('Business Owner terminology uses Financial Adjustments without changing accountant labels',()=>{
  assert.match(terminology,/business:\{[\s\S]*?journalEntries:'Financial Adjustments'/);
  assert.match(terminology,/accountant:\{[\s\S]*?journalEntries:'Journal Entries'/);
  assert.match(terminology,/create:'Create Adjustment'/);
  assert.match(terminology,/newEntry:'New Financial Adjustment'/);
});
