import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/SalesOrders.jsx',import.meta.url),'utf8');
const styles=await readFile(new URL('../src/sales-orders.css',import.meta.url),'utf8');

test('sales order register uses the shared professional action pattern',()=>{
 assert.match(source,/New sales order/);
 assert.match(source,/IconEye size=\{16\}\/>Preview/);
 assert.match(source,/title="Preview and print sales order"/);
 assert.doesNotMatch(source,/>Print preview<\/button>/);
 assert.match(source,/soStatus soStatus/);
 assert.match(styles,/\.soPreviewButton/);
 assert.match(styles,/\.soStatusConfirmed/);
 assert.match(styles,/\.soGridActions\{display:(?:inline-)?flex/);
});

test('sales order register preserves accessible search and more actions',()=>{
 assert.match(source,/aria-label="Search sales orders"/);
 assert.match(source,/aria-label="Order status"/);
 assert.match(source,/<SalesOrderActions/);
});
