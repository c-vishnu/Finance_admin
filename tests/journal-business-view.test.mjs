import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/JournalEntriesPro.jsx',import.meta.url),'utf8');
const terminology=await readFile(new URL('../src/terminology.jsx',import.meta.url),'utf8');

test('Business Owner Journal View keeps the original screens and actions',()=>{
 assert.match(source,/return <><JournalRegister terms=\{terms\}/);
 assert.match(source,/return <JournalForm/);
 assert.match(source,/return preview\?.*<JournalDetail/);
 assert.match(source,/>Record Transaction<\/button>/);
 assert.match(source,/\{viewMode==='business'\?'Post adjustment':'Post journal'\}/);
 assert.match(source,/JOURNAL_VIEW_LABELS\.business\.newEntry/);
 assert.match(source,/JOURNAL_VIEW_LABELS\.business\.subtitle/);
 assert.match(source,/\{viewMode==='business'\?'Summary':'Journal details'\}/,'the merged section keeps the business wording for the details block');
 assert.match(source,/\{viewMode==='business'\?'Transaction Impact':'Accounting Impact'\}/);
 assert.match(source,/\{viewMode==='business'\?'History':'Audit Trail'\}/);
 assert.match(source,/viewMode==='business'\?'Documents':'Supporting Documents'/);
});

test('Business Owner terminology uses Financial Adjustments without changing accountant labels',()=>{
 assert.match(terminology,/business:\{[\s\S]*?journalEntries:'Financial Adjustments'/);
 assert.match(terminology,/accountant:\{[\s\S]*?journalEntries:'Journal Entries'/);
 assert.match(terminology,/create:'Create Adjustment'/);
 assert.match(terminology,/newEntry:'New Financial Adjustment'/);
});
