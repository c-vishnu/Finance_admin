import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankItem,gstSplit,validateItem} from '../src/item-master.js';

test('item form states both GST rates, derives the split and no longer asks for a category',()=>{
 const source=readFileSync('src/Items.jsx','utf8');
 const kept=['taxApplicable','taxRate','cessRate','priceTaxMode','Price includes tax?','No, add tax separately','Default tax'];
 const added=['Taxable','Intra-State Tax Rate','Inter-State Tax Rate','This item is not subject to GST.','Intra-state transactions use CGST + SGST. Inter-state transactions use IGST.','itemFormGrid3','itemSegmented','itemTaxPreview','Tax treatment'];
 for(const value of [...kept,...added])assert.ok(source.includes(value),value);
 assert.ok(!source.includes('Select vendor'));
 assert.ok(!source.includes('<th>Vendor</th>'));
 assert.ok(!source.includes('ITEM_CATEGORIES'),'the Category field is gone');
 assert.ok(!source.includes('Add the item details'),'the page subtitle is gone');
 assert.ok(source.includes("form.id?'Edit Item':'Create Item'"),'the header is Create Item / Edit Item');
 assert.ok(!source.includes("'Create item'")&&!source.includes("'Edit item'"),'the old sentence-case titles are gone');
});

test('sales document lines inherit item tax and allow a document override',()=>{
 const source=readFileSync('src/SalesDocumentFields.jsx','utf8');
 for(const value of ['itemDefaults(item)','item.taxRate','item.cessRate','item.priceTaxMode','Price tax treatment','Tax exclusive','Tax inclusive'])assert.ok(source.includes(value),value);
});

test('the intra-state rate is the CGST + SGST total and the inter-state rate is IGST',()=>{
 const split=gstSplit('18');
 assert.equal(split.cgst,9);
 assert.equal(split.sgst,9);
 assert.equal(split.igst,18);
 assert.equal(gstSplit('5').cgst,2.5);
 assert.equal(gstSplit('').igst,0);
 assert.equal(blankItem({taxRate:'5'}).interStateTaxRate,'5');
 assert.equal(blankItem({}).interStateTaxRate,'18');
});

test('an item is asked for both GST rates only while it is taxable',()=>{
 const accounts={Income:[['4000','Sales']],Expenses:[['5000','Purchase']],Assets:[['1200','Inventory']]};
 const base={...blankItem({salesAccount:'4000',purchaseAccount:'5000',inventoryAccount:'1200',cogsAccount:'5000'}),name:'Item A',price:'100',taxPreference:'Taxable',taxApplicable:true};
 assert.deepEqual(validateItem(base,[],accounts),{},'a complete taxable item is accepted');
 assert.equal(validateItem({...base,interStateTaxRate:'abc'},[],accounts).interStateTaxRate,'Select a valid GST rate.');
 assert.equal(validateItem({...base,taxRate:'101'},[],accounts).taxRate,'Select a valid GST rate.');
 assert.deepEqual(validateItem({...base,name:'Item B',taxPreference:'Exempt',taxRate:'',interStateTaxRate:''},[],accounts),{},'a non-taxable item needs no rate');
});

test('new items start non-taxable while retaining configured rates for an opt-in',()=>{
 const item=blankItem({taxRate:'18'});
 assert.equal(item.taxPreference,'Non-taxable');
 assert.equal(item.taxApplicable,false);
 assert.equal(item.taxRate,'18');
 assert.equal(item.interStateTaxRate,'18');
});
