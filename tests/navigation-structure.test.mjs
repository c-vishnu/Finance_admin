import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const navigation=readFileSync(new URL('../src/Navigation.jsx',import.meta.url),'utf8');

test('sidebar destinations are grouped once without duplicate routes',()=>{
  for(const destination of [
    "leaf('General Ledger')",
    "leaf('Trial Balance')",
    "leaf('Day Book')",
    "leaf('Period Closing')",
    "leaf('Purchase Reports')"
  ]){
    assert.equal(navigation.split(destination).length-1,1,`${destination} must occur once`);
  }
  assert.ok(navigation.includes("{label:'Inventory',icon:IconPackage,children:[leaf('Items'),leaf('Inventory Adjustments')]}"),'Inventory holds Items with Inventory Adjustments directly below it');
  assert.ok(navigation.includes("{label:'Accounting',icon:IconBook,children:[leaf('Chart of Accounts'),leaf('Journal Entries'),leaf('Budgets'),leaf('Period Closing')]}"),'Accounting holds one Budgets destination between Journal Entries and Period Closing');
});

test('Accounting holds one Budgets destination between Journal Entries and Period Closing',()=>{
  const accounting=navigation.indexOf("{label:'Accounting'");
  const journal=navigation.indexOf("leaf('Journal Entries')");
  const budgets=navigation.indexOf("leaf('Budgets')");
  const closing=navigation.indexOf("leaf('Period Closing')");
  assert.ok(accounting>-1&&journal>-1&&budgets>-1&&closing>-1,'Accounting, Journal Entries, Budgets and Period Closing are all declared');
  assert.ok(accounting<journal&&journal<budgets&&budgets<closing,'Budgets sits between Journal Entries and Period Closing inside the Accounting group');
  assert.equal((navigation.match(/leaf\('Budgets'\)/g)||[]).length,1,'Budgets is declared once');
  assert.ok(!navigation.includes("{label:'Budget',"),'no Budget sub-group is left inside Accounting');
  assert.ok(!navigation.includes('Budget Reports')&&!navigation.includes('Budget Settings'),'the reports and settings destinations are gone from the sidebar');
  assert.ok(navigation.includes("{label:'Inventory',icon:IconPackage,children:[leaf('Items'),leaf('Inventory Adjustments')]}"),'Inventory stays a top-level section of its own');
  const items=navigation.indexOf("leaf('Items')");
  const adjustments=navigation.indexOf("leaf('Inventory Adjustments')");
  assert.ok(items>-1&&adjustments>-1&&items<adjustments,'Inventory Adjustments is declared directly below Items inside the Inventory group');
  assert.equal((navigation.match(/leaf\('Inventory Adjustments'\)/g)||[]).length,1,'Inventory Adjustments is declared once');
});
