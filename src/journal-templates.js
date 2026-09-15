// Presentation-only helpers for the Journal Entries create page.
// This module never touches the ledger, the journal store or the posting engine.

const TEMPLATE_KEY = 'wayvida-journal-templates-v1';
const PREF_KEY = 'wayvida-journal-account-prefs-v1';

export const CREATE_JOURNAL_TYPES = [
  'General Journal',
  'Adjustment Journal',
  'Opening Journal',
  'Transfer Journal',
];

export const RECURRENCE_OPTIONS = ['None', 'Every month', 'Every year'];

// Built-in templates. `code` is the preferred account for the demonstration chart of
// accounts; `match` is a name fallback. When neither resolves the account stays blank so
// the accountant must choose explicitly instead of posting to a guessed account.
export const JOURNAL_TEMPLATES = [
  {
    id: 'builtin-rent',
    name: 'Monthly Rent',
    type: 'General Journal',
    narration: 'Monthly rent for the period',
    builtIn: true,
    lines: [
      { code: '5300', match: 'rent', type: 'Expenses', description: 'Rent for the month', side: 'debit' },
      { code: '1010', match: 'bank', type: 'Assets', description: 'Rent paid from bank', side: 'credit' },
    ],
  },
  {
    id: 'builtin-salary',
    name: 'Salary Entry',
    type: 'General Journal',
    narration: 'Salary payable for the month',
    builtIn: true,
    lines: [
      { code: '5600', match: 'salary|salaries|wage', type: 'Expenses', description: 'Salaries for the month', side: 'debit' },
      { code: '1010', match: 'bank', type: 'Assets', description: 'Salaries paid from bank', side: 'credit' },
    ],
  },
  {
    id: 'builtin-depreciation',
    name: 'Depreciation',
    type: 'Adjustment Journal',
    narration: 'Depreciation for the period',
    builtIn: true,
    lines: [
      { code: '5800', match: 'depreciation', type: 'Expenses', description: 'Depreciation charge', side: 'debit' },
      { code: '', match: 'accumulated depreciation', type: 'Assets', description: 'Accumulated depreciation', side: 'credit' },
    ],
  },
  {
    id: 'builtin-transfer',
    name: 'Bank Transfer',
    type: 'Transfer Journal',
    narration: 'Funds transferred between accounts',
    builtIn: true,
    lines: [
      { code: '1010', match: 'bank', type: 'Assets', description: 'Amount received into bank', side: 'debit' },
      { code: '1000', match: 'cash', type: 'Assets', description: 'Amount transferred out of cash', side: 'credit' },
    ],
  },
];

export function resolveTemplateAccount(templateLine, accounts) {
  const list = Array.isArray(accounts) ? accounts : [];
  if (templateLine.code) {
    const byCode = list.find(account => account.code === templateLine.code);
    if (byCode) return byCode.code;
  }
  if (templateLine.match) {
    const pattern = new RegExp(templateLine.match, 'i');
    const byName = list.find(account => pattern.test(account.name || '') && (!templateLine.type || account.type === templateLine.type));
    if (byName) return byName.code;
    const loose = list.find(account => pattern.test(account.name || ''));
    if (loose) return loose.code;
  }
  return '';
}

export function resolveTemplate(template, accounts) {
  const rows = (template?.lines || []).map(line => {
    const code = resolveTemplateAccount(line, accounts);
    return {
      account: code,
      debit: line.side === 'debit' ? line.amount || '' : '',
      credit: line.side === 'credit' ? line.amount || '' : '',
      description: line.description || '',
      unresolved: !code,
    };
  });
  return {
    id: template?.id || '',
    name: template?.name || 'Template',
    type: template?.type || 'General Journal',
    narration: template?.narration || '',
    frequency: template?.frequency || 'None',
    unresolved: rows.filter(row => row.unresolved).length,
    rows,
  };
}

const readJSON = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Preference storage is optional; the form stays usable without it. */
  }
};

export function readCustomTemplates() {
  const rows = readJSON(TEMPLATE_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function allTemplates() {
  return [...JOURNAL_TEMPLATES, ...readCustomTemplates()];
}

export function saveCustomTemplate(template) {
  const name = String(template?.name || '').trim();
  if (!name) return readCustomTemplates();
  const rows = readCustomTemplates().filter(row => row.name !== name);
  const record = {
    id: 'template-' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    name,
    type: template.type || 'General Journal',
    narration: template.narration || '',
    frequency: template.frequency || 'None',
    lines: (template.lines || []).map(line => ({
      code: line.account || '',
      type: '',
      description: line.description || '',
      side: line.credit ? 'credit' : 'debit',
      amount: line.credit || line.debit || '',
    })),
  };
  const next = [record, ...rows];
  writeJSON(TEMPLATE_KEY, next);
  return next;
}

export function readAccountPrefs() {
  const value = readJSON(PREF_KEY, {});
  return {
    recents: Array.isArray(value.recents) ? value.recents : [],
    favourites: Array.isArray(value.favourites) ? value.favourites : [],
  };
}

export function recordRecentAccount(code) {
  if (!code) return readAccountPrefs();
  const current = readAccountPrefs();
  const recents = [code, ...current.recents.filter(item => item !== code)].slice(0, 6);
  writeJSON(PREF_KEY, { ...current, recents });
  return { ...current, recents };
}

export function toggleFavouriteAccount(code) {
  if (!code) return readAccountPrefs();
  const current = readAccountPrefs();
  const favourites = current.favourites.includes(code)
    ? current.favourites.filter(item => item !== code)
    : [...current.favourites, code];
  writeJSON(PREF_KEY, { ...current, favourites });
  return { ...current, favourites };
}

export function matchesAccountQuery(account, query) {
  const term = String(query || '').trim().toLowerCase();
  if (!term) return true;
  return [account?.name, account?.code, account?.type]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(term));
}

// Pre-posting conditions surfaced next to the line grid. Accounting rules live in the
// caller's validate(); this only reports the four conditions the accountant asked to see:
// debit equals credit, date is valid, period is open and accounts are active.
export function postingChecks({ form, totals, accounts, difference, periodOk = true, periodDetail = '' }) {
  const lines = form?.lines || [];
  const active = Array.isArray(accounts) ? accounts : [];
  const date = String(form?.date || '');
  const dateValid = Boolean(date) && !Number.isNaN(new Date(date + 'T00:00:00').getTime());
  const hasLines = lines.length > 0;
  const accountsChosen = hasLines && lines.every(line => Boolean(line.account));
  const accountsActive = accountsChosen && lines.every(line => active.some(account => account.code === line.account));
  const balanced = difference === 0 && (totals?.debit || 0) > 0;
  return [
    {
      id: 'balanced',
      label: 'Debit equals credit',
      ok: balanced,
      detail: balanced ? 'Balanced' : 'Difference ' + formatDifference(difference),
    },
    {
      id: 'date',
      label: 'Date is valid',
      ok: dateValid,
      detail: dateValid ? 'Valid accounting date' : 'Choose a valid date',
    },
    {
      id: 'period',
      label: 'Period is open',
      ok: Boolean(periodOk),
      detail: periodOk ? 'Open for posting' : periodDetail || 'This accounting period is locked',
    },
    {
      id: 'accounts',
      label: 'Accounts are active',
      ok: accountsActive,
      detail: accountsActive ? 'All selected accounts are active' : 'Select an active account on every line',
    },
  ];
}

export function formatDifference(minor) {
  return ((Math.abs(Number(minor) || 0)) / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}
