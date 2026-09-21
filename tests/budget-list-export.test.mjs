import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetListCSV} from '../src/budget-store.js';

test('the register export quotes every cell so a name with a comma survives',()=>{
  const csv=budgetListCSV([{name:'Marketing, Q1',financialYear:'FY 2026-27',period:'Yearly',type:'Profit & Loss Budget',scope:{type:'All branches'},status:'Draft'}]);
  const lines=csv.split('\r\n');
  assert.equal(lines[0],'"Budget Name","Financial Year","Budget Period","Type","Scope","Status"');
  assert.equal(lines[1],'"Marketing, Q1","FY 2026-27","Yearly","Profit & Loss Budget","All branches","Draft"');
});

test('a quote inside a value is doubled and a missing scope reads as empty',()=>{
  const csv=budgetListCSV([{name:'He said "yes"',financialYear:'FY 2026-27',period:'Monthly',type:'Profit & Loss Budget',status:'Active'}]);
  assert.ok(csv.includes('"He said ""yes"""'),'a quote in the name is doubled');
  assert.ok(csv.split('\r\n')[1].endsWith('"","Active"'),'a budget with no scope exports an empty cell');
});

test('the export is one header row when the register is empty',()=>{
  assert.equal(budgetListCSV([]).split('\r\n').length,1);
  assert.equal(budgetListCSV().split('\r\n').length,1);
});
