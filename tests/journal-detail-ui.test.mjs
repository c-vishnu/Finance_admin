import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../src/JournalEntriesPro.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/journal-entries.css',import.meta.url),'utf8');

test('journal detail uses standard accessible back navigation and simple labels',()=>{
  assert.match(page,/aria-label="Back to Journal Entries"/);
  assert.match(page,/<dt>Journal number<\/dt>/);
  assert.match(page,/<dt>Entry type<\/dt>/);
  assert.match(page,/<dt>Description<\/dt>/);
});

test('journal detail header stays in content below the working context row',()=>{
  assert.match(css,/\.app main \.je-detail>header\{[^}]*position:static!important[^}]*inset:auto!important/s);
});
