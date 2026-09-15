import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/Receipts.jsx',import.meta.url),'utf8');
const styles=await readFile(new URL('../src/receipts.css',import.meta.url),'utf8');

test('receipt matching consumes incoming Banking module lines and explains an empty state',()=>{
 assert.match(source,/wayvida-banking-v1/);
 assert.match(source,/line\.credit>0/);
 assert.match(source,/No imported incoming transactions for this bank account/);
 assert.match(source,/Import bank transaction/);
 assert.match(source,/disabled=\{!match\.bankLineId\|\|!Number\(match\.amount\)\}/);
 assert.match(styles,/\.receiptBankEmpty/);
});
