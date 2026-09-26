import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const navigation=readFileSync(new URL('../src/Navigation.jsx',import.meta.url),'utf8');

test('sidebar destinations are grouped once without duplicate routes',()=>{
  for(const destination of [
    "leaf('General Ledger')",
    "leaf('Trial Balance')",
    "leaf('Day Book')",
    "leaf('Period Lock')",
    "leaf('Purchase Reports')"
  ]){
    assert.equal(navigation.split(destination).length-1,1,`${destination} must occur once`);
  }
  assert.ok(navigation.includes("{...leaf('Items'),icon:IconPackage}"),'Items is a destination of its own, not a child of an Inventory group');
  assert.ok(navigation.includes("{label:'Accounting',icon:IconBook,children:[leaf('Chart of Accounts'),leaf('Journal','Journal Entries')]}"),'Accounting holds the chart of accounts and the journal');
  assert.ok(navigation.includes("{label:'Settings',icon:IconSettings,children:[leaf('Settings Center'),leaf('Company'),leaf('Branch','Branches'),{label:'Other',children:[leaf('Budgets'),leaf('Period Lock'),leaf('Inventory Adjustments')]}]}"),'Budgets, Period Lock and Inventory Adjustments are one Other group inside Settings');
});

test('Budgets and Period Lock sit together in their own section, out of Accounting',()=>{
  const accounting=navigation.indexOf("{label:'Accounting'");
  const journal=navigation.indexOf("leaf('Journal','Journal Entries')");
  const other=navigation.indexOf("{label:'Other'");
  const budgets=navigation.indexOf("leaf('Budgets')");
  const closing=navigation.indexOf("leaf('Period Lock')");
  assert.ok(accounting>-1&&journal>-1&&other>-1&&budgets>-1&&closing>-1,'Accounting, Journal Entries, Other, Budgets and Period Lock are all declared');
  assert.ok(accounting<journal&&journal<other&&other<budgets&&budgets<closing,'the Other section follows Accounting and holds Budgets above Period Lock');
  assert.equal((navigation.match(/leaf\('Budgets'\)/g)||[]).length,1,'Budgets is declared once');
  assert.ok(!navigation.includes("{label:'Budget',"),'no Budget sub-group is left inside Accounting');
  assert.ok(!navigation.includes('Budget Reports')&&!navigation.includes('Budget Settings'),'the reports and settings destinations are gone from the sidebar');
  assert.ok(!navigation.includes("{label:'Inventory',"),'the Inventory group is dissolved: Items is a destination of its own and Inventory Adjustments moved under Other');
  const items=navigation.indexOf("{...leaf('Items')");
  const sales=navigation.indexOf("{label:'Sales'");
  assert.ok(items>-1&&sales>-1&&items<sales,'Items is declared between Accounting and Sales');
  const adjustments=navigation.indexOf("leaf('Inventory Adjustments')");
  assert.ok(items>-1&&adjustments>-1&&items<adjustments,'Inventory Adjustments is declared directly below Items inside the Inventory group');
  assert.equal((navigation.match(/leaf\('Inventory Adjustments'\)/g)||[]).length,1,'Inventory Adjustments is declared once');
});
