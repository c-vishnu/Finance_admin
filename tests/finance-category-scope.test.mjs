import test from 'node:test';
import assert from 'node:assert/strict';
import {financeCategoryScope} from '../src/finance-category-scope.js';

const organisations=[
  {id:'wayvida',name:'Wayvida Learning',branches:[{id:'kochi',name:'Kochi'},{id:'tvm',name:'Trivandrum'},{id:'blr',name:'Bengaluru'}]},
  {id:'viskool',name:'Viskool',branches:[{id:'tvm2',name:'Trivandrum'},{id:'tsr',name:'Thrissur'}]}
];

test('one organisation with one branch prints both selected names',()=>{
  assert.deepEqual(financeCategoryScope([{...organisations[0],branches:[organisations[0].branches[0]]}]),{organisation:'Wayvida Learning',branch:'Kochi',detail:'Wayvida Learning: Kochi'});
});

test('one organisation with all or some multiple branches uses a compact count and exact hover detail',()=>{
  const all=financeCategoryScope([organisations[0]]),partial=financeCategoryScope([{...organisations[0],branches:organisations[0].branches.slice(0,2)}]);
  assert.equal(all.branch,'3 Branches');
  assert.equal(all.detail,'Wayvida Learning: Kochi, Trivandrum, Bengaluru');
  assert.equal(partial.branch,'2 Branches');
  assert.equal(partial.detail,'Wayvida Learning: Kochi, Trivandrum');
});

test('multiple organisations retain only the exact selected branch names in their compact summary',()=>{
  const scope=financeCategoryScope([{...organisations[0],branches:[organisations[0].branches[1]]},{...organisations[1],branches:[organisations[1].branches[0]]}]);
  assert.equal(scope.organisation,'2 Organisations');
  assert.equal(scope.branch,'2 Branches');
  assert.equal(scope.detail,'Wayvida Learning: Trivandrum; Viskool: Trivandrum');
});

test('all organisations and branches provide the complete matching hover detail',()=>{
  const scope=financeCategoryScope(organisations);
  assert.equal(scope.organisation,'2 Organisations');
  assert.equal(scope.branch,'5 Branches');
  assert.equal(scope.detail,'Wayvida Learning: Kochi, Trivandrum, Bengaluru; Viskool: Trivandrum, Thrissur');
});
