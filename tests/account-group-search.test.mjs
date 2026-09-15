import test from 'node:test';
import assert from 'node:assert/strict';
import {accountGroupKey,accountGroupRows,flattenAccountGroups,matchesAccountGroup,selectedAccountGroup} from '../src/account-group-search.js';

const groups=[
 {type:'Assets',label:'Assets',options:[{purpose:'Cash',label:'Cash Accounts'},{purpose:'Bank Account',label:'Bank Accounts'},{purpose:'Customer Receivable',label:'Current Assets'}]},
 {type:'Liabilities',label:'Liabilities',options:[{purpose:'Loan',label:'Loans'}]},
 {type:'Income',label:'Income',options:[{purpose:'Sales Income',label:'Sales Income'}]}
];
const sections=rows=>rows.filter(row=>row.section).map(row=>row.section);
const labels=rows=>rows.filter(row=>row.option).map(row=>row.option.label);

test('the group key is type plus purpose and survives missing pieces',()=>{
 assert.equal(accountGroupKey({type:'Assets',purpose:'Cash'}),'Assets::Cash');
 assert.equal(accountGroupKey({type:'Assets'}),'Assets::');
 assert.equal(accountGroupKey(),'::');
 assert.equal(accountGroupKey({type:'Expenses',purpose:'Rent Expense'}),accountGroupKey({type:'Expenses',purpose:'Rent Expense'}));
});

test('the option list is flattened with its type and group filled in',()=>{
 const flat=flattenAccountGroups(groups);
 assert.equal(flat.length,5);
 assert.deepEqual(flat[0],{type:'Assets',purpose:'Cash',label:'Cash Accounts',group:'Assets'});
 assert.deepEqual(flat[3],{type:'Liabilities',purpose:'Loan',label:'Loans',group:'Liabilities'});
 assert.deepEqual(flattenAccountGroups(),[]);
 assert.deepEqual(flattenAccountGroups([{type:'Assets'}]),[],'a group without options contributes nothing');
});

test('the current selection is resolved from the stored key',()=>{
 assert.equal(selectedAccountGroup(groups,'Assets::Cash').label,'Cash Accounts');
 assert.equal(selectedAccountGroup(groups,'Income::Sales Income').type,'Income');
 assert.equal(selectedAccountGroup(groups,'Assets::Nope'),null);
 assert.equal(selectedAccountGroup(groups,''),null);
 assert.equal(selectedAccountGroup(),null);
});

test('an empty query lists every group as sections in declaration order',()=>{
 const {rows,keys}=accountGroupRows(groups,'');
 assert.deepEqual(sections(rows),['Assets','Liabilities','Income']);
 assert.deepEqual(labels(rows),['Cash Accounts','Bank Accounts','Current Assets','Loans','Sales Income']);
 assert.equal(keys.length,5,'every option row is keyboard reachable');
 assert.ok(keys.every(key=>rows[key].option));
 assert.deepEqual(keys,[...keys].sort((a,b)=>a-b),'keys stay in list order');
});

test('typing filters by name, purpose or account type and drops empty sections',()=>{
 assert.deepEqual(labels(accountGroupRows(groups,'bank').rows),['Bank Accounts']);
 assert.deepEqual(sections(accountGroupRows(groups,'bank').rows),['Assets']);
 assert.deepEqual(labels(accountGroupRows(groups,'BANK').rows),['Bank Accounts'],'matching ignores case');
 assert.deepEqual(labels(accountGroupRows(groups,'loan').rows),['Loans']);
 assert.deepEqual(labels(accountGroupRows(groups,'customer receivable').rows),['Current Assets'],'a purpose matches too');
 assert.deepEqual(sections(accountGroupRows(groups,'liabilities').rows),['Liabilities'],'the account type matches');
 assert.deepEqual(labels(accountGroupRows(groups,'liabilities').rows),['Loans']);
 assert.deepEqual(accountGroupRows(groups,'zzz').rows,[],'a miss leaves no section behind');
 assert.deepEqual(accountGroupRows(groups,'zzz').keys,[]);
});

test('missing groups and stray input never throw',()=>{
 assert.deepEqual(accountGroupRows(),{rows:[],keys:[]});
 assert.deepEqual(accountGroupRows([{type:'Assets'}],'x').rows,[]);
 assert.equal(matchesAccountGroup(undefined,''),true,'an empty query matches anything');
 assert.equal(matchesAccountGroup(undefined,'x'),false);
 assert.equal(matchesAccountGroup({label:'Loans',type:'Liabilities',purpose:'Loan'},'  '),true);
});
