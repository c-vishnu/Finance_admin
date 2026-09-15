import test from 'node:test';
import assert from 'node:assert/strict';
import {blankItem,generateSku,openingValue,validateItem} from '../src/item-master.js';

const accounts={Income:[['4000','Sales']],Expenses:[['5000','Purchases']],Assets:[['1200','Inventory']],Equity:[['3000','Capital']]};
const valid=()=>({...blankItem({salesAccount:'4000',purchaseAccount:'5000',inventoryAccount:'1200',cogsAccount:'5000',warehouseId:'Kochi Branch'}),name:'Desk',sku:'ITEM-0001',price:'100',cost:'60',hsnSac:'9403'});

test('validates item names and SKUs within an organisation',()=>{
 const item=valid(),existing=[{...item,id:'old'}];
 assert.equal(validateItem({...item,id:'new'},existing,accounts).name,'An item with this name already exists in this organisation.');
 assert.equal(validateItem({...item,id:'new',name:'Chair'},existing,accounts).sku,'This SKU is already used in this organisation.');
 assert.equal(validateItem({...item,id:'new',organizationId:'other'},existing,accounts).sku,undefined);
});

test('goods inventory mappings must use asset and expense accounts',()=>{
 const errors=validateItem({...valid(),inventoryAccount:'4000',cogsAccount:'1200'},[],accounts);
 assert.equal(errors.inventoryAccount,'Select an inventory asset account.');
 assert.equal(errors.cogsAccount,'Select a cost of goods sold account.');
});

test('service items do not require inventory configuration',()=>{
 const item={...valid(),type:'Service',trackInventory:false,inventoryAccount:'',cogsAccount:'',hsnSac:'9983'};
 assert.deepEqual(validateItem(item,[],accounts),{});
});

test('opening value and generated SKU are deterministic',()=>{
 assert.equal(openingValue({openingQuantity:'4',openingRate:'12.50'}),50);
 assert.equal(generateSku([{organizationId:'abc',sku:'ITEM-0001'}],'abc'),'ITEM-0002');
});

