import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const store=new Map();
globalThis.localStorage={
 getItem:key=>store.has(key)?store.get(key):null,
 setItem:(key,value)=>store.set(key,String(value)),
 removeItem:key=>store.delete(key),
 clear:()=>store.clear()
};

const {readWorkingScopeVisibility,visibleScopeColumns}=await import('../src/working-scope.js');

const setScope=(companies,branches)=>{
 store.set('wayvida-context-companies',JSON.stringify(companies));
 store.set('wayvida-context-branches',JSON.stringify(branches));
};

test('one organisation and one branch hide both scope columns',()=>{
 setScope(['org-a'],['branch-a']);
 assert.deepEqual(readWorkingScopeVisibility(),{showOrganisation:false,showBranch:false,companyCount:1,branchCount:1});
});

test('one organisation with several branches shows only Branch',()=>{
 setScope(['org-a'],['branch-a','branch-b']);
 const scope=readWorkingScopeVisibility();
 assert.equal(scope.showOrganisation,false);
 assert.equal(scope.showBranch,true);
});

test('several organisations with one branch shows only Organisation',()=>{
 setScope(['org-a','org-b'],['branch-a']);
 const scope=readWorkingScopeVisibility();
 assert.equal(scope.showOrganisation,true);
 assert.equal(scope.showBranch,false);
});

test('several organisations and branches show both scope columns',()=>{
 setScope(['org-a','org-b'],['branch-a','branch-b']);
 const scope=readWorkingScopeVisibility();
 assert.equal(scope.showOrganisation,true);
 assert.equal(scope.showBranch,true);
});

test('an empty stored scope falls back to the default single context',()=>{
 store.clear();
 assert.deepEqual(readWorkingScopeVisibility(),{showOrganisation:false,showBranch:false,companyCount:1,branchCount:1});
});

test('visibleScopeColumns drops hidden scope columns and renormalises to 100%',()=>{
 const columns=[
  {key:'number',weight:50},
  {key:'organisation',weight:25,scope:'organisation'},
  {key:'branch',weight:10,scope:'branch'},
  {key:'actions',weight:15}
 ];
 const both=visibleScopeColumns(columns,{showOrganisation:true,showBranch:true});
 assert.deepEqual(both.map(column=>column.key),['number','organisation','branch','actions']);
 assert.equal(both.reduce((sum,column)=>sum+Number.parseFloat(column.width),0).toFixed(3),'100.000');

 const neither=visibleScopeColumns(columns,{showOrganisation:false,showBranch:false});
 assert.deepEqual(neither.map(column=>column.key),['number','actions']);
 assert.equal(neither.reduce((sum,column)=>sum+Number.parseFloat(column.width),0).toFixed(3),'100.000');
 assert.match(neither[0].width,/%$/);
});

test('all six registers read the shared scope helper',()=>{
 for(const file of ['SalesOrders.jsx','InvoiceWorkspace.jsx','Purchases.jsx','Receipts.jsx','VendorPayments.jsx']){
  const source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
  assert.match(source,/useWorkingScopeVisibility/,`${file} uses the scope visibility hook`);
  assert.match(source,/visibleScopeColumns\(/,`${file} filters and renormalises its columns`);
 }
});

test('each register marks its scope columns and renders them conditionally',()=>{
 for(const file of ['SalesOrders.jsx','InvoiceWorkspace.jsx','Purchases.jsx','Receipts.jsx','VendorPayments.jsx']){
  const source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
  assert.match(source,/\{key:'organisation',label:'Organisation',[^}]*scope:'organisation'\}/,`${file} marks Organisation as a scope column`);
  assert.match(source,/\{key:'branch',label:'Branch',[^}]*scope:'branch'\}/,`${file} marks Branch as a scope column`);
  assert.match(source,/\{workingScope\.showOrganisation&&<td className="scopeCell">/,`${file} renders Organisation only when the scope spans organisations`);
  assert.match(source,/\{workingScope\.showBranch&&<td className="scopeCell">/,`${file} renders Branch only when the scope spans branches`);
 }
});
