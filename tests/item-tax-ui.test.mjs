import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankItem,gstSplit,validateItem} from '../src/item-master.js';

test('item form states both GST rates, derives the split and no longer asks for a category',()=>{
 const source=readFileSync('src/Items.jsx','utf8');
 const kept=['taxApplicable','taxRate','cessRate','priceTaxMode','Price type *','Tax Exclusive','Tax Inclusive','Default tax'];
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
 assert.ok(source.includes('className="ivRateCell"'),'the rate cell wraps its input so the price type can sit under it');
 assert.ok(source.includes("className={'ivPriceType '+(l.priceTaxMode==='inclusive'?'is-inclusive':'is-exclusive')}>{l.priceTaxMode==='inclusive'?'Incl. Tax':'Excl. Tax'}"),'the price type is stated under the Rate field, read from the line');
 assert.match(source,/priceTaxMode:item\.priceTaxMode\|\|'exclusive'/,'and it comes from the Item master when the item has one');
 assert.ok(source.includes("priceTaxMode:'exclusive'"),'a new line - and therefore an ad hoc item - starts tax exclusive, which the operator can switch to inclusive on the line; without this the engine refused the save with Choose whether each line rate includes tax');
 assert.ok(source.includes('<option value="">Select price type</option>'),'and the line offers the choice explicitly');
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
