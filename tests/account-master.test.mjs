import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,command,journal,reports,account} from '../src/invoice-engine.js';
import {normalizeAccounts,changeAccount,importAccounts,parseAccountCSV} from '../src/account-master.js';
const seed={Assets:[['1000','Cash'],['1100','Receivables']],Liabilities:[['2100','GST Payable']],Income:[['4100','Service Revenue']],Expenses:[['5900','Other Expenses']],Equity:[['3000','Capital']]};
const setup=()=>normalizeAccounts(initial(),seed);
const add=(s,p)=>changeAccount(s,'save',p);
test('additive normalization preserves existing records, codes and journal balances',()=>{
  const s=setup();s.journals.push({id:'j',lines:[{account:'1000',debit:10000,credit:0},{account:'3000',debit:0,credit:10000}]});
  const before=reports(s);const migrated=normalizeAccounts(JSON.parse(JSON.stringify(s)),seed);
  assert.deepEqual(reports(migrated),before);assert.equal(migrated.accounts[0].code,'1000');assert.equal(migrated.accounts[0].system,true);
  assert.equal(migrated.accounts[0].nature,'Debit');assert.equal(migrated.journals.length,1);
});
test('create, reload, edit and deactivate a custom account without posting',()=>{
  let {state,record}=add(setup(),{name:'Internet Expense',type:'Expenses'});
  assert.equal(record.code,'5000');assert.equal(record.nature,'Debit');assert.equal(state.journals.length,0);
  state=normalizeAccounts(JSON.parse(JSON.stringify(state)),seed);
  let out=add(state,{...record,description:'Connectivity'});state=out.state;record=out.record;
  assert.equal(record.description,'Connectivity');assert.equal(state.accountAudit.length,2);
  out=changeAccount(state,'toggle',record);assert.equal(out.record.active,false);
  assert.throws(()=>account(out.state,record.code),/active posting/);
  assert.throws(()=>add(out.state,{...record,name:'Stale update'}),/changed elsewhere/);
});
test('unique names and codes, mapped account and system protections',()=>{
  const s=setup();assert.throws(()=>add(s,{name:'Cash',type:'Assets'}),/name already/);
  assert.throws(()=>add(s,{name:'Petty cash',type:'Assets',code:'1000'}),/code already/);
  assert.throws(()=>changeAccount(s,'toggle',s.accounts[0]),/System/);
  const out=add(s,{name:'Petty cash',type:'Assets'});
  assert.throws(()=>changeAccount(out.state,'delete',out.record,[{code:out.record.code,label:'Customer mapping'}]),/mapped or referenced/);
  assert.throws(()=>add(s,{...s.accounts[0],code:'9999'}),/protected/);
});
test('summary hierarchy validates parent type and prevents cycles',()=>{
  let a=add(setup(),{name:'Operating Expenses',type:'Expenses',isGroup:true});
  let b=add(a.state,{name:'Office Costs',type:'Expenses',isGroup:true,parent:a.record.code});
  assert.throws(()=>add(b.state,{...a.record,parent:b.record.code}),/Circular/);
  assert.throws(()=>add(b.state,{name:'Wrong child',type:'Assets',parent:a.record.code}),/same account type/);
  assert.throws(()=>account(b.state,a.record.code),/active posting/);
  assert.throws(()=>changeAccount(b.state,'delete',a.record),/child accounts/);
});
test('used accounts cannot be deleted or reclassified',()=>{
  const out=add(setup(),{name:'Office Costs',type:'Expenses'});
  journal(out.state,{id:'source',number:'SRC'},'Test',[{account:out.record.code,debit:100,credit:0},{account:'1000',debit:0,credit:100}],'2026-09-04','test');
  assert.throws(()=>changeAccount(out.state,'delete',out.record),/posted transactions/);
  assert.throws(()=>add(out.state,{...out.record,type:'Assets'}),/protected/);
});
test('required dimensions reject postings without source dimensions',()=>{
  const out=add(setup(),{name:'Branch costs',type:'Expenses',branchRequired:true,costCentreRequired:true});
  const lines=[{account:out.record.code,debit:100,credit:0},{account:'1000',debit:0,credit:100}];
  assert.throws(()=>journal(out.state,{id:'source'},'Test',lines,'2026-09-04','a'),/requires a branch/);
  assert.throws(()=>journal(out.state,{id:'source',branch:'Kochi'},'Test',lines,'2026-09-04','a'),/requires a cost centre/);
  const j=journal(out.state,{id:'source',branch:'Kochi',costCentre:'Operations'},'Test',lines,'2026-09-04','a');
  assert.equal(j.lines[0].branch,'Kochi');assert.equal(j.lines[0].costCentre,'Operations');
});
test('new revenue account is usable by existing invoice workflow',()=>{
  let {state,record}=add(setup(),{name:'Training Income',type:'Income'});
  let out=command(state,'save',{number:'INV-TEST',date:'2026-09-04',dueDate:'2026-10-04',customerId:'c1',customerName:'Customer',place:'Kerala',lines:[{description:'Training',unit:'hour',qty:'1',rate:'1000',income:record.code,tax:'18'}]});
  out=command(out.state,'post',{id:out.result.id});assert.ok(out.state.journals[0].lines.some(l=>l.account===record.code&&l.credit===100000));assert.equal(reports(out.state).debit,reports(out.state).credit);
});
test('CSV import validates all rows atomically and parses quotes',()=>{
  const rows=parseAccountCSV('Name,Type,Description\n"Internet, phone",Expenses,"Line 1\nLine 2"\n');
  assert.equal(rows[0].name,'Internet, phone');assert.equal(rows[0].description,'Line 1\nLine 2');
  const s=setup(),out=importAccounts(s,rows);assert.equal(out.accounts.length,s.accounts.length+1);assert.equal(s.accountAudit.length,0);
  assert.throws(()=>importAccounts(s,[{name:'Unique',type:'Expenses'},{name:'Cash',type:'Assets'}]),/Row 3/);
  assert.equal(s.accounts.some(a=>a.name==='Unique'),false);assert.throws(()=>parseAccountCSV('Name\nhello'),/Name and Type/);
});
