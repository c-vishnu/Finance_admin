import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const navigation = readFileSync(new URL('../src/Navigation.jsx', import.meta.url), 'utf8');

test('the Income register mounts once, through its portal', () => {
  assert.equal((navigation.match(/page="Income"/g) || []).length, 1, 'Navigation mounts IncomeReport once');
  assert.ok(navigation.includes("{active==='Income'&&createPortal(<div className=\"transactionPortal\">"), 'the Income register is mounted through the shared portal');
});

test('the Income route is excluded from the operational module switch', () => {
  const guard = app.indexOf("{['Income','GST Reports','TDS Reports'].includes(a)?null:");
  const operational = app.indexOf('operational.includes(a)?');
  assert.ok(guard > -1, 'Income is listed with the report routes the module switch skips');
  assert.ok(operational > -1, 'the operational module switch is still present');
  assert.ok(guard < operational, 'the skip is decided before the operational module renders, so IncomeReport is not mounted twice');
});

test('the Income route carries no welcome banner', () => {
  assert.ok(app.includes("{!(isReportPage(a)||a==='Budgets'||a==='Income')&&<div className=\"welcome\">"), 'Income is suppressed with the report pages and budgets');
});