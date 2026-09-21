/* CSV import for the Journal Entries register.

   This module is pure. It parses a CSV of journal lines, groups the lines that share a voucher into
   one journal, resolves every account against the live chart of accounts and hands back one plan per
   voucher carrying its own message, so the dialog can state exactly what will import and what will
   not. Nothing here touches the journal store or the ledger: the page turns the ready plans into
   Draft journals through the same store the create page uses, so an import can never post. */

const fail = message => { throw new Error(message) };

export const IMPORT_HEADERS = ['Voucher', 'Date', 'Type', 'Account', 'Debit', 'Credit', 'Description', 'Narration'];

export const IMPORT_TEMPLATE = [
  ['JV-2026-9001', '2026-09-05', 'General Journal', '1100', '1250.00', '', 'Invoice raised for the September renewal', 'September SaaS renewal'],
  ['JV-2026-9001', '2026-09-05', 'General Journal', '4100', '', '1250.00', 'September subscription billed', ''],
];

const clean = value => String(value == null ? '' : value).replace(/\uFEFF/g, '').trim();

/* CSV parsing follows src/account-master.js: quoted cells, doubled quotes inside them, and a
   trailing carriage return dropped so a CRLF file reads the same as an LF one. */
export function parseJournalCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n')) { row.push(cell.replace(/\r$/, '')); cell = ''; if (c === '\n') { if (row.some(x => x.trim())) rows.push(row); row = []; } }
    else cell += c;
  }
  if (quoted) fail('The CSV has an unclosed quote.');
  row.push(cell.replace(/\r$/, '')); if (row.some(x => x.trim())) rows.push(row);
  const header = rows.shift()?.map(value => clean(value).toLowerCase());
  if (!header) fail('The file is empty.');
  const missing = ['voucher', 'date', 'account'].filter(key => !header.includes(key));
  if (missing.length) fail('CSV needs Voucher, Date and Account columns. Use: ' + IMPORT_HEADERS.join(', ') + '.');
  if (rows.length > 2000) fail('Import up to 2000 journal lines at a time.');
  if (!rows.length) fail('No journal lines found in this file.');
  const at = (cells, key) => { const index = header.indexOf(key); return index < 0 ? '' : clean(cells[index]); };
  return rows.map((cells, index) => ({
    line: index + 2,
    voucher: at(cells, 'voucher'),
    date: at(cells, 'date'),
    type: at(cells, 'type'),
    account: at(cells, 'account'),
    debit: at(cells, 'debit'),
    credit: at(cells, 'credit'),
    description: at(cells, 'description'),
    narration: at(cells, 'narration'),
  }));
}

/* The register dates are ISO everywhere else, but a file exported from another system is usually
   day-first, so both shapes are accepted and normalised to ISO. */
export function journalImportDate(value) {
  const text = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(text);
  return match ? match[3] + '-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0') : '';
}

/* Amounts are read in rupees and held in paise, the unit the journal store and the posting engine
   already use, so an imported line and a typed line are indistinguishable downstream. */
export function journalImportAmount(value) {
  const text = clean(value).replace(/[^\d.\-]/g, '');
  if (!text) return 0;
  const number = Number(text);
  return Number.isFinite(number) ? Math.round(number * 100) : NaN;
}

const accountLookup = accounts => {
  const byCode = new Map(), byName = new Map();
  (accounts || []).forEach(account => {
    byCode.set(clean(account.code).toLowerCase(), account);
    byName.set(clean(account.name).toLowerCase(), account);
  });
  /* An exported file often prints the code and the name in one cell, so a leading code token is
     accepted as a last resort after the exact code and the exact name. */
  return value => {
    const key = clean(value).toLowerCase();
    if (!key) return null;
    const exact = byCode.get(key) || byName.get(key);
    if (exact) return exact;
    const leading = /^(\S+)\s+\S/.exec(key);
    return leading ? byCode.get(leading[1]) || null : null;
  };
};

const matchType = (value, types) => {
  const key = clean(value).toLowerCase();
  return (types || []).find(type => type.toLowerCase() === key) || (types || [])[0] || 'General Journal';
};

/* Rows are grouped by voucher, in first-seen order, so one file can carry many journals and the
   dialog lists them in the order the accountant wrote them. */
export function planJournalImport(rows, { accounts = [], types = [], floor = '' } = {}) {
  const resolve = accountLookup(accounts);
  const order = [], groups = new Map();
  rows.forEach(row => {
    const key = clean(row.voucher).toLowerCase() || 'line-' + row.line;
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key).push(row);
  });
  return order.map(key => {
    const rowsInGroup = groups.get(key);
    const first = rowsInGroup[0];
    const problems = [];
    const date = journalImportDate(first.date);
    if (!date) problems.push('Row ' + first.line + ': the date must be YYYY-MM-DD or DD-MM-YYYY.');
    else if (floor && date < floor) problems.push('Row ' + first.line + ': ' + date + ' falls in a closed accounting period.');
    const lines = rowsInGroup.map(row => {
      const account = resolve(row.account);
      if (!account) problems.push(row.account ? 'Row ' + row.line + ': account "' + row.account + '" is not in the chart of accounts.' : 'Row ' + row.line + ': choose an account.');
      const debit = journalImportAmount(row.debit), credit = journalImportAmount(row.credit);
      if (Number.isNaN(debit) || Number.isNaN(credit)) problems.push('Row ' + row.line + ': the amount is not a number.');
      else if (debit > 0 && credit > 0) problems.push('Row ' + row.line + ': enter either a debit or a credit, not both.');
      else if (!debit && !credit) problems.push('Row ' + row.line + ': enter a debit or a credit.');
      return {
        line: row.line,
        account: account ? account.code : '',
        accountName: account ? account.name : row.account,
        debit: debit > 0 ? (debit / 100).toFixed(2) : '',
        credit: credit > 0 ? (credit / 100).toFixed(2) : '',
        description: row.description,
      };
    });
    const debit = lines.reduce((total, line) => total + journalImportAmount(line.debit), 0);
    const credit = lines.reduce((total, line) => total + journalImportAmount(line.credit), 0);
    if (lines.length < 2) problems.push('A journal needs at least two lines.');
    if (!debit && !credit) problems.push('The journal has no amount.');
    else if (debit !== credit) problems.push('Debit and credit must match: ' + (debit / 100).toFixed(2) + ' Dr against ' + (credit / 100).toFixed(2) + ' Cr.');
    return {
      key,
      voucher: first.voucher || 'Line ' + first.line,
      date,
      type: matchType(rowsInGroup.map(row => row.type).find(Boolean) || '', types),
      reference: first.voucher,
      narration: first.narration || lines.map(line => line.description).find(Boolean) || '',
      lines,
      debit,
      credit,
      problem: problems.join(' '),
    };
  });
}

export const journalImportTemplate = () => [IMPORT_HEADERS, ...IMPORT_TEMPLATE];
