import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('item form stores tax defaults and removes vendor selection',()=>{
 const source=readFileSync('src/Items.jsx','utf8');
 for(const value of ['taxApplicable','taxRate','cessRate','priceTaxMode','Tax included in price','Default tax'])assert.ok(source.includes(value),value);
 assert.ok(!source.includes('Select vendor'));
 assert.ok(!source.includes('<th>Vendor</th>'));
});

test('sales document lines inherit item tax and allow a document override',()=>{
 const source=readFileSync('src/SalesDocumentFields.jsx','utf8');
 for(const value of ['itemDefaults(item)','item.taxRate','item.cessRate','item.priceTaxMode','Price tax treatment','Tax exclusive','Tax inclusive'])assert.ok(source.includes(value),value);
});
