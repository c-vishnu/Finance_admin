import test from 'node:test';
import assert from 'node:assert/strict';
import {bootstrapDemoData,DEMO_MARKER} from '../src/demo-data.js';
import {KEY,reports} from '../src/invoice-engine.js';

const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),values}};

test('demo bootstrap fills every implemented data area with linked records',()=>{
 const storage=memory(),result=bootstrapDemoData(storage),accounting=JSON.parse(storage.getItem(KEY));
 assert.equal(result.loaded,true);assert.ok(accounting.invoices.length>=2);assert.ok(accounting.receipts.length>=1);assert.ok(accounting.purchaseBills.length>=1);assert.ok(accounting.journals.length>=5);assert.equal(reports(accounting).debit,reports(accounting).credit);
 for(const key of ['wayvida-customers','finance-erp-items','wayvida-vendors-v1','wayvida-sales-orders','wayvida-purchase-orders-v1','wayvida-purchase-bills-v1','wayvida-goods-receipts-v1','wayvida-vendor-payments-v1','wayvida-debit-notes-v1','wayvida-banking-v1','wayvida-operations-v1'])assert.ok(JSON.parse(storage.getItem(key)),key);
});

test('demo bootstrap is idempotent and preserves existing module data',()=>{
 const storage=memory();storage.setItem('wayvida-customers',JSON.stringify([{id:'user-record'}]));bootstrapDemoData(storage);const before=storage.getItem(KEY);assert.equal(bootstrapDemoData(storage).loaded,false);assert.equal(storage.getItem(KEY),before);assert.deepEqual(JSON.parse(storage.getItem('wayvida-customers')),[{id:'user-record'}]);assert.equal(storage.getItem(DEMO_MARKER),'1');
});
