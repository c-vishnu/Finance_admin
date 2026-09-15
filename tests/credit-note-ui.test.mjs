import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/CreditNotes.jsx',import.meta.url),'utf8');
const styles=await readFile(new URL('../src/credit-notes.css',import.meta.url),'utf8');

test('Apply Credit shows eligible allocations and blocks an empty submission',()=>{
 assert.match(source,/targets=\{applicationTargets\}/);
 assert.match(source,/No unpaid invoices are available for adjustment/);
 assert.match(source,/Customer outstanding/);
 assert.match(source,/Why other invoices are not eligible/);
 assert.match(source,/Confirm Apply Credit/);
 assert.match(source,/disabled=\{modal\.action==='apply'/);
 assert.match(source,/max=\{maximum\}/);
 assert.match(styles,/\.cnApplyTable/);
 assert.match(styles,/\.cnApplyEmpty/);
});
