import {test} from 'node:test';
import assert from 'node:assert/strict';
import {itemScopeError,orderScopeError} from '../src/sales-order-service.js';

/* The Item master writes the same scope using two reference styles: the create form seeds an
   organisation id while its scope picker writes the organisation code, and the opening-stock
   branch field accepts an id or a name. These cases pin both, so a line is never reported out of
   scope just because the two screens named the same scope differently. */
const good=overrides=>({id:'item-1',name:'Office stationery box',type:'Goods',unit:'box',trackInventory:true,organizationIds:['abc'],branchIds:['abc-kochi'],...overrides});

test('an item set up for the chosen organisation and branch is accepted',()=>{
 assert.equal(itemScopeError(good(),{organisationRefs:['abc','ABC01'],branchRefs:['abc-kochi','Kochi Branch'],organisationName:'Wayvida',branchName:'Kochi Branch'}),'');
});

test('the organisation code the Item scope picker writes is accepted as well as the id',()=>{
 assert.equal(itemScopeError(good({organizationIds:['ABC01'],organizationId:'ABC01'}),{organisationRefs:['abc','ABC01'],branchRefs:['abc-kochi'],organisationName:'Wayvida'}),'');
});

test('an item that belongs to another organisation is named on the line',()=>{
 const message=itemScopeError(good({organizationIds:['northstar']}),{organisationRefs:['abc','ABC01'],organisationName:'Wayvida'});
 assert.match(message,/Office stationery box is not set up for Wayvida in the Item master\./);
});

test('a stocked good that lives in another branch is named on the line',()=>{
 const message=itemScopeError(good({branchIds:['abc-bengaluru'],warehouseId:'abc-bengaluru'}),{organisationRefs:['abc'],branchRefs:['abc-kochi'],organisationName:'Wayvida',branchName:'Kochi Branch'});
 assert.match(message,/tracks inventory but is not stocked in Kochi Branch\./);
});

test('a stocked good with no branch or location at all is reported',()=>{
 const message=itemScopeError(good({branchIds:[],warehouseId:''}),{organisationRefs:['abc'],branchRefs:['abc-kochi'],branchName:'Kochi Branch'});
 assert.match(message,/has no branch or location set in the Item master\./);
});

test('the branch rule never applies to a service or to an untracked item',()=>{
 const scope={organisationRefs:['abc'],branchRefs:['abc-kochi'],branchName:'Kochi Branch'};
 assert.equal(itemScopeError(good({type:'Service',trackInventory:false,branchIds:[]}),scope),'');
 assert.equal(itemScopeError(good({trackInventory:false,branchIds:['abc-bengaluru'],warehouseId:'abc-bengaluru'}),scope),'');
});

test('an item with no organisation scope recorded is not blocked',()=>{
 assert.equal(itemScopeError({id:'seed',name:'Legacy item',type:'Goods',unit:'pcs'},{organisationRefs:['abc'],organisationName:'Wayvida'}),'');
});

test('the order report names the first line that cannot be fulfilled',()=>{
 const items=[good(),good({id:'item-2',name:'Consulting service',type:'Service',branchIds:[]}),good({id:'item-3',name:'Imported panel',organizationIds:['northstar']})];
 assert.equal(orderScopeError([{item:'item-2'},{item:'item-1'}],items,{organisationRefs:['abc'],branchRefs:['abc-kochi'],organisationName:'Wayvida',branchName:'Kochi Branch'}),'');
 assert.match(orderScopeError([{item:'item-2'},{item:'item-3'}],items,{organisationRefs:['abc'],organisationName:'Wayvida'}),/Imported panel is not set up for/);
 assert.equal(orderScopeError([],items,{organisationRefs:['abc']}),'');
});
