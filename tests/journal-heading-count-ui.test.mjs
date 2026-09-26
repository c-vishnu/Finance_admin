import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../src/JournalEntriesPro.jsx',import.meta.url),'utf8');

test('journal total is displayed once in the page heading',()=>{
 assert.match(page,/\{terms\.journalEntries\} <span className="je-heading-count">\(\{list\.length\}\)<\/span>/);
 assert.doesNotMatch(page,/\{filtered\.length\} journals/);
 assert.doesNotMatch(page,/\{list\.length\} journals/);
});
