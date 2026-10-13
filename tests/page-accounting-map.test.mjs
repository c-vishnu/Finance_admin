import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');

const docUrl = new URL('docs/PAGE-ACCOUNTING-MAP.md', root);
const doc = read('docs/PAGE-ACCOUNTING-MAP.md');

const navigation = read('src/Navigation.jsx');
const secondary = read('src/ReportsSecondaryNav.jsx');

function navigationPages() {
  const pages = new Set();
  for (const match of navigation.matchAll(/leaf\('([^']+)'(?:,\s*'([^']+)')?\)/g)) pages.add(match[2] || match[1]);
  return pages;
}

function reportPages() {
  const pages = new Set();
  for (const match of secondary.matchAll(/page:\s*'([^']+)'/g)) pages.add(match[1]);
  return pages;
}

const EXTRA_ROUTES = [
  'Income Categories',
  'Expense Categories',
  'Goods Receipts',
  'Purchase Reports',
  'Banking Settings',
  'Users & Roles',
  'Tax Settings',
  'Customer Statement',
  'Budget vs Actual',
  'Financial Reports',
  'Customer Aging',
  'Supplier Aging'
];

test('page accounting map documents every routed page', () => {
  const pages = new Set([...navigationPages(), ...reportPages(), ...EXTRA_ROUTES]);
  assert.ok(pages.size >= 45, 'expected the routed page set to be non-trivial, saw ' + pages.size);
  const missing = [...pages].filter(page => !doc.includes(page));
  assert.deepEqual(missing, [], 'PAGE-ACCOUNTING-MAP.md is missing: ' + missing.join(', '));
});

test('page accounting map carries the required metadata and posting vocabulary', () => {
  assert.ok(existsSync(docUrl), 'docs/PAGE-ACCOUNTING-MAP.md must exist');
  assert.match(doc, /\*\*Last verified:\*\* 2026-\d\d-\d\d/);
  assert.ok(doc.includes('Dr '), 'the map must state debit sides');
  assert.ok(doc.includes('Cr '), 'the map must state credit sides');
  for (const term of ['No accounting entry', 'Double entry', 'Period lock', 'Reversal']) {
    assert.ok(doc.includes(term), 'the map must explain: ' + term);
  }
});

test('pages that never post are stated as such', () => {
  for (const page of ['Sales Orders', 'Purchase Orders', 'Goods Receipts', 'Customer Statement', 'Audit Log']) {
    const section = doc.split('\n').filter(line => line.includes(page));
    assert.ok(section.length, 'expected a mention of ' + page);
  }
  assert.ok(/Sales Orders[\s\S]{0,400}none/i.test(doc), 'Sales Orders must be documented as non-posting');
  assert.ok(/Purchase Orders[\s\S]{0,400}none/i.test(doc), 'Purchase Orders must be documented as non-posting');
  assert.ok(/Goods Receipts[\s\S]{0,400}none/i.test(doc), 'Goods Receipts must be documented as non-posting');
});