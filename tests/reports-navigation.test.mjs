import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
const navigation = read('Navigation.jsx');
const secondaryNav = read('ReportsSecondaryNav.jsx');

const EXPECTED_GROUPS = [
  'TRANSACTION REPORTS',
  'ACCOUNTING REPORTS',
  'FINANCIAL STATEMENTS',
  'RECEIVABLES & PAYABLES',
  'CASH & BANKING',
  'TAX & COMPLIANCE',
  'BUSINESS REPORTS',
  'AUDIT'
];

const EXPECTED_LEAVES = [
  'Transaction Register',
  'Journal Report',
  'General Ledger',
  'Trial Balance',
  'Profit & Loss',
  'Balance Sheet',
  'Cash Flow Statement',
  'Customer Outstanding',
  'Supplier Outstanding',
  'Cash & Bank Book',
  'Bank Reconciliation',
  'GST / Tax Reports',
  'TDS Reports',
  'Sales Report',
  'Purchase Report',
  'Expense Report',
  'Fixed Asset Report',
  'Audit Log'
];

test('Primary sidebar declares Reports as a single top-level leaf module', () => {
  assert.ok(navigation.includes("{...leaf('Reports','Transaction Register'),icon:IconReport}"), 'Reports is a single top-level leaf');
  assert.ok(!navigation.includes("label:'Transaction Reports'"), 'nested report groups are removed from primary sidebar');
});

test('ReportsSecondaryNav declares all eight logical groups in order', () => {
  let previousIndex = -1;
  for (const group of EXPECTED_GROUPS) {
    const at = secondaryNav.indexOf(`heading: '${group}'`);
    assert.ok(at > -1, `${group} is declared in ReportsSecondaryNav`);
    assert.ok(at > previousIndex, `${group} appears in correct order`);
    previousIndex = at;
  }
});

test('ReportsSecondaryNav includes all expected report leaves', () => {
  for (const leaf of EXPECTED_LEAVES) {
    assert.ok(secondaryNav.includes(`label: '${leaf}'`), `${leaf} is listed in secondary navigation`);
  }
});

test('Navigation mounts ReportsSecondaryNav when viewing a report page', () => {
  assert.ok(navigation.includes("import ReportsSecondaryNav, { isReportPage } from './ReportsSecondaryNav.jsx';"), 'ReportsSecondaryNav is imported');
  assert.ok(navigation.includes("{isReportPage(active)&&<ReportsSecondaryNav active={active} onNavigate={onNavigate}/>}"), 'ReportsSecondaryNav is mounted for report pages');
});
