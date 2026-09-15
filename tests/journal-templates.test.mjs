import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key),
};

const {
  CREATE_JOURNAL_TYPES,
  JOURNAL_TEMPLATES,
  RECURRENCE_OPTIONS,
  allTemplates,
  matchesAccountQuery,
  postingChecks,
  readAccountPrefs,
  readCustomTemplates,
  recordRecentAccount,
  resolveTemplate,
  saveCustomTemplate,
  toggleFavouriteAccount,
} = await import('../src/journal-templates.js');

const accounts = [
  { code: '1000', name: 'Cash', type: 'Assets' },
  { code: '1010', name: 'Bank', type: 'Assets' },
  { code: '5300', name: 'Utilities', type: 'Expenses' },
  { code: '5600', name: 'Salaries', type: 'Expenses' },
  { code: '5800', name: 'Depreciation', type: 'Expenses' },
];

const line = (overrides = {}) => ({ account: '', debit: '', credit: '', description: '', ...overrides });

test('the create dropdown offers the four professional journal types', () => {
  assert.deepEqual(CREATE_JOURNAL_TYPES, ['General Journal', 'Adjustment Journal', 'Opening Journal', 'Transfer Journal']);
  assert.deepEqual(RECURRENCE_OPTIONS, ['None', 'Every month', 'Every year']);
});

test('built-in templates cover the requested productivity patterns', () => {
  const names = JOURNAL_TEMPLATES.map(template => template.name);
  assert.deepEqual(names, ['Monthly Rent', 'Salary Entry', 'Depreciation', 'Bank Transfer']);
  for (const template of JOURNAL_TEMPLATES) {
    assert.ok(template.lines.length >= 2, template.name);
    assert.equal(template.lines.filter(row => row.side === 'debit').length, 1, template.name);
    assert.equal(template.lines.filter(row => row.side === 'credit').length, 1, template.name);
  }
});

test('templates resolve real accounts and never guess a wrong account', () => {
  const rent = resolveTemplate(JOURNAL_TEMPLATES[0], accounts);
  assert.deepEqual(rent.rows.map(row => row.account), ['5300', '1010']);
  assert.equal(rent.unresolved, 0);
  assert.equal(rent.rows[0].description, 'Rent for the month');
  const depreciation = resolveTemplate(JOURNAL_TEMPLATES[2], accounts);
  assert.equal(depreciation.rows[0].account, '5800');
  assert.equal(depreciation.rows[1].account, '');
  assert.equal(depreciation.unresolved, 1);
});

test('templates fall back to a name match when the preferred code is absent', () => {
  const alternate = [{ code: '9001', name: 'Warehouse Rent', type: 'Expenses' }, { code: '9002', name: 'Current Account', type: 'Assets' }];
  const rent = resolveTemplate(JOURNAL_TEMPLATES[0], alternate);
  assert.equal(rent.rows[0].account, '9001');
  assert.equal(rent.rows[1].account, '');
});

test('account search matches name, code and type without case sensitivity', () => {
  assert.equal(matchesAccountQuery(accounts[1], 'bank'), true);
  assert.equal(matchesAccountQuery(accounts[1], '1010'), true);
  assert.equal(matchesAccountQuery(accounts[1], 'assets'), true);
  assert.equal(matchesAccountQuery(accounts[1], 'liability'), false);
  assert.equal(matchesAccountQuery(accounts[1], ''), true);
});

test('recent and favourite accounts persist separately from journals', () => {
  store.clear();
  recordRecentAccount('1010');
  recordRecentAccount('1000');
  recordRecentAccount('1010');
  assert.deepEqual(readAccountPrefs().recents, ['1010', '1000']);
  assert.deepEqual(toggleFavouriteAccount('5300').favourites, ['5300']);
  assert.deepEqual(toggleFavouriteAccount('5300').favourites, []);
  assert.ok(store.has('wayvida-journal-account-prefs-v1'));
});

test('custom templates are stored outside the journal store and can be re-listed', () => {
  store.clear();
  const next = saveCustomTemplate({ name: 'Quarterly GST', type: 'Adjustment Journal', narration: 'GST true-up', frequency: 'Every month', lines: [line({ account: '5300', debit: '500' }), line({ account: '1010', credit: '500' })] });
  assert.equal(next.length, 1);
  assert.equal(next[0].name, 'Quarterly GST');
  assert.equal(next[0].frequency, 'Every month');
  assert.deepEqual(readCustomTemplates().map(template => template.name), ['Quarterly GST']);
  assert.equal(store.has('wayvida-manual-journals-v2'), false);
  assert.equal(allTemplates().length, JOURNAL_TEMPLATES.length + 1);
  saveCustomTemplate({ name: 'Quarterly GST', type: 'General Journal', lines: [] });
  assert.equal(readCustomTemplates().length, 1);
  saveCustomTemplate({ name: '   ', lines: [] });
  assert.equal(readCustomTemplates().length, 1);
});

test('the pre-posting conditions report the four professional checks', () => {
  const balanced = { date: '2026-09-12', lines: [line({ account: '1000', debit: '1000' }), line({ account: '5300', credit: '1000' })] };
  const ok = postingChecks({ form: balanced, totals: { debit: 100000, credit: 100000 }, accounts, difference: 0, periodOk: true });
  assert.deepEqual(ok.map(check => check.id), ['balanced', 'date', 'period', 'accounts']);
  assert.equal(ok.every(check => check.ok), true);
  const unbalanced = postingChecks({ form: balanced, totals: { debit: 100000, credit: 99000 }, accounts, difference: 1000, periodOk: false, periodDetail: 'September 2026 is locked' });
  assert.equal(unbalanced[0].ok, false);
  assert.match(unbalanced[0].detail, /Difference/);
  assert.equal(unbalanced[2].ok, false);
  assert.equal(unbalanced[2].detail, 'September 2026 is locked');
  const inactive = postingChecks({ form: { date: '2026-09-12', lines: [line({ account: '9999', debit: '1000' }), line({ account: '5300', credit: '1000' })] }, totals: { debit: 100000, credit: 100000 }, accounts, difference: 0 });
  assert.equal(inactive[3].ok, false);
  const halfFilled = postingChecks({ form: { date: '2026-09-12', lines: [line({ account: '1000', debit: '1000' }), line({ account: '5300' })] }, totals: { debit: 100000, credit: 0 }, accounts, difference: 100000 });
  assert.equal(halfFilled.length, 4, 'required-field completeness is no longer a reported condition');
});
