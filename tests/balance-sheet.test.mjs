import test from 'node:test';
import assert from 'node:assert/strict';
import {balanceSheet} from '../src/balance-sheet.js';

const state={accounts:[
  {code:'1010',name:'Bank',type:'Assets',accountNature:'Bank',active:true},
  {code:'2000',name:'Accounts Payable',type:'Liabilities',accountNature:'Accounts Payable',active:true},
  {code:'4000',name:'Sales',type:'Income',accountNature:'Sales Income',active:true}
],journals:[{date:'2026-09-08',status:'Posted',lines:[
  {account:'1010',debit:10000,credit:0,branch:'Trivandrum Branch'},
  {account:'2000',debit:0,credit:4000,branch:'Trivandrum Branch'},
  {account:'4000',debit:0,credit:6000,branch:'Trivandrum Branch'}
]}]};

test('Balance Sheet classifies accounts and includes current earnings in equity',()=>{
  const report=balanceSheet(state,{date:'2026-09-08'});
  assert.equal(report.assets,10000);
  assert.equal(report.liabilities,4000);
  assert.equal(report.currentEarnings,6000);
  assert.equal(report.equity,6000);
  assert.equal(report.balanced,true);
  assert.equal(report.rows.find(row=>row.code==='1010').section,'Current Assets');
});

test('Balance Sheet respects date and branch filters',()=>{
  assert.equal(balanceSheet(state,{date:'2026-09-07'}).assets,0);
  assert.equal(balanceSheet(state,{date:'2026-09-08',branch:'Kochi Branch'}).assets,0);
  assert.equal(balanceSheet(state,{date:'2026-09-08',branch:'Trivandrum Branch'}).assets,10000);
});
