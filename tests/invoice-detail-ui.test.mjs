import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const workspace=fs.readFileSync(new URL('../src/InvoiceWorkspace.jsx',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../src/invoice-detail.css',import.meta.url),'utf8');
test('invoice overview contains embedded financial context without a fixed side panel',()=>{for(const label of ['Invoice information','Amount summary','Accounting summary','Payment summary','Related documents'])assert.match(workspace,new RegExp(label));assert.doesNotMatch(css,/position:\s*fixed/)});
test('invoice details provide five simple tabs and journal ledger navigation',()=>{assert.match(workspace,/\['Overview','Items','Payments','Accounting','Activity'\]/);assert.match(workspace,/View Journal/);assert.match(workspace,/View Ledger/)});
