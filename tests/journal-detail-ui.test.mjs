import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../src/JournalEntriesPro.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/journal-entries.css',import.meta.url),'utf8');

test('journal detail uses standard accessible back navigation and simple labels',()=>{
  assert.match(page,/Back to Journal Entries/);
  assert.match(page,/viewMode==='business'\?'Reference number':'Journal number'/);
  assert.match(page,/viewMode==='business'\?'Adjustment type':'Entry type'/);
  assert.match(page,/viewMode==='business'\?'Reason':'Description'/);
  assert.match(page,/lines:\(detail\.lines\|\|\[\]\)\.map\(line=>\(\{\.\.\.line,debit:amount\(line\.debit\),credit:amount\(line\.credit\)\}\)\)/);
});

test('journal detail header stays in content below the working context row',()=>{
  assert.match(css,/\.app main \.je-detail>header\{[^}]*position:static!important[^}]*inset:auto!important/s);
});
