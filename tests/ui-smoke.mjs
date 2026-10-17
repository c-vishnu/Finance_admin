// Automated UI smoke test for the Wayvida Books demo app.
// Run: node tests/ui-smoke.mjs
// Requires: the app running on http://localhost:5173 and Chrome or Edge installed.
// Env: APP_URL, CHROME_PATH, SMOKE_HEADLESS=0, SMOKE_JSON=<report path>
//
// This file only drives the UI. It never writes to application storage or source files.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const APP = process.env.APP_URL || 'http://localhost:5173/';
const HEADLESS = process.env.SMOKE_HEADLESS !== '0';
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
if (!CHROME) {
  console.error('No Chrome or Edge executable found. Set CHROME_PATH.');
  process.exit(2);
}

const profile = mkdtempSync(path.join(tmpdir(), 'wb-ui-smoke-'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const issues = [];
const consoleProblems = [];

function pass(name, detail = '') { results.push({ name, status: 'pass', detail }); }
function fail(name, detail = '') { results.push({ name, status: 'fail', detail }); }
function issue(name, detail = '') { issues.push({ name, detail }); }
function check(condition, name, detail = '') { condition ? pass(name, detail) : fail(name, detail); }

const browser = spawn(CHROME, [
  HEADLESS ? '--headless=new' : '--start-maximized',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--disable-extensions',
  '--window-size=1440,900',
  APP,
], { stdio: 'ignore' });

async function waitForFile(file, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (existsSync(file)) return;
    await sleep(150);
  }
  throw new Error(`Chrome did not start (missing ${file})`);
}

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.handlers = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
        return;
      }
      for (const handler of this.handlers.get(message.method) || []) handler(message.params);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(handler);
  }
  close() { try { this.ws.close(); } catch {} }
}

let cdp;
let step = 'startup';
const IGNORE = [/React DevTools/i, /Statsig/i, /favicon/i];

async function ev(expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) {
    throw new Error((result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluate failed') + ' :: ' + expression.slice(0, 120));
  }
  return result.result.value;
}

async function waitFor(expression, label, timeout = 6000) {
  const end = Date.now() + timeout;
  let last = null;
  while (Date.now() < end) {
    try {
      last = await ev(expression);
      if (last) return last;
    } catch (error) { last = error.message; }
    await sleep(150);
  }
  throw new Error(`timeout waiting for ${label} (last=${JSON.stringify(last)})`);
}

async function nav(label, group, expect) {
  step = `nav:${label}`;
  const clicked = await ev(`(() => {
    const nav = document.querySelector('nav.erpNavigation');
    if (!nav) return 'no-nav';
    const group = ${JSON.stringify(group || null)};
    if (group) {
      const g = [...nav.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === group);
      if (!g) return 'no-group:' + group;
      if (g.getAttribute('aria-expanded') === 'false') g.click();
    }
    const b = [...nav.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === ${JSON.stringify(label)});
    if (!b) return 'no-button:' + ${JSON.stringify(label)};
    b.click();
    return 'ok';
  })()`);
  if (clicked !== 'ok') throw new Error(`navigation failed for ${label}: ${clicked}`);
  await waitFor(`(document.body.innerText || '').includes(${JSON.stringify(expect)})`, `page ${expect}`);
  await sleep(350);
}

async function clickExact(name, timeout = 6000) {
  step = `click:${name}`;
  const ok = await waitFor(`(() => {
    const el = [...document.querySelectorAll('button,a,summary')].find((e) => {
      const text = (e.innerText || '').trim();
      const aria = e.getAttribute('aria-label');
      return text === ${JSON.stringify(name)} || aria === ${JSON.stringify(name)};
    });
    if (!el) return false;
    el.click();
    return true;
  })()`, `control ${name}`, timeout);
  await sleep(600);
  return ok;
}

async function clickMatch(expression, label, timeout = 6000) {
  step = `click:${label}`;
  const ok = await waitFor(`(() => {
    const el = [...document.querySelectorAll('button,a,div')].find((e) => {
      const text = (e.innerText || '').trim();
      const aria = e.getAttribute('aria-label') || '';
      return (${expression});
    });
    if (!el) return false;
    el.click();
    return true;
  })()`, label, timeout);
  await sleep(650);
  return ok;
}

async function pageInfo() {
  return ev(`(() => {
    const text = document.body.innerText || '';
    return {
      h1: document.querySelector('h1')?.innerText?.trim() || null,
      h2: [...document.querySelectorAll('h2')].map((x) => x.innerText.trim()).slice(0, 4),
      tables: [...document.querySelectorAll('table')].map((t) => ({
        headers: [...t.querySelectorAll('thead th')].map((h) => h.innerText.trim()),
        rows: t.querySelectorAll('tbody tr').length,
      })),
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      badText: ['undefined', 'NaN', 'Invalid Date'].filter((token) => text.includes(token)),
    };
  })()`);
}

async function setValue(selector, value, index = 0) {
  const ok = await ev(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})][${index}];
    if (!el) return false;
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!ok) throw new Error(`input not found: ${selector}[${index}]`);
  await sleep(350);
}

async function exitForm() {
  step = 'exit-form';
  const cancelled = await ev(`(() => {
    const cancel = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === 'Cancel');
    if (!cancel) return false;
    cancel.click();
    return true;
  })()`);
  await sleep(500);
  if (!cancelled) {
    await clickMatch("/^Back to /i.test(text) || /^Back to /i.test(aria)", 'back to list').catch(() => {});
  }
  await sleep(300);
}

async function openDetail() {
  const clicked = await ev(`(() => {
    const row = document.querySelector('tbody tr');
    if (!row) return null;
    const buttons = [...row.querySelectorAll('button')];
    const action = buttons.find((b) => /^(View|Preview)\b/i.test((b.getAttribute('aria-label') || b.innerText || '').trim()))
      || buttons.find((b) => !/^More actions/i.test(b.getAttribute('aria-label') || ''));
    if (action) {
      action.click();
      return (action.getAttribute('aria-label') || action.innerText || '').trim();
    }
    const more = [...row.querySelectorAll('button')].find((b) => /^More actions/i.test(b.getAttribute('aria-label') || ''));
    if (more) { more.click(); return 'more-actions'; }
    return null;
  })()`);
  if (!clicked) return { opened: false, clicked: null, h1: null };
  await sleep(900);
  let opened = await ev(`!!(document.querySelector('.opsDrawer') || /^Back to /m.test(document.body.innerText) || /Close print preview/i.test(document.body.innerText) || [...document.querySelectorAll('h1')].some((h) => /details/i.test(h.innerText)) || [...document.querySelectorAll('button')].some((b) => /^Close /i.test((b.getAttribute('aria-label') || b.innerText || '').trim())))`);
  if (!opened && clicked === 'more-actions') {
    await clickMatch("/^View/.test(text) || /^View/.test(aria)", 'view details', 4000).catch(() => {});
    await sleep(800);
    opened = await ev(`!!(document.querySelector('.opsDrawer') || /^Back to /m.test(document.body.innerText) || [...document.querySelectorAll('h1')].some((h) => /details|preview/i.test(h.innerText)))`);
  }
  const h1 = await ev(`document.querySelector('h1')?.innerText || null`);
  return { opened, clicked, h1 };
}

async function closeDetail() {
  const closed = await ev(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => {
      const t = (x.getAttribute('aria-label') || x.innerText || '').trim();
      return /^Back to /i.test(t) || /^Close/i.test(t);
    });
    if (!b) return false;
    b.click();
    return true;
  })()`);
  await sleep(600);
  if (!closed) await ev(`history.back()`);
  await sleep(400);
  return closed;
}

const PAGES = [
  ['Money Categories', 'Accounting', 'Chart of Accounts'],
  ['Accounting Entries', 'Accounting', 'Journal Entries'],
  ['Items', null, 'Items'],
  ['Income', null, 'Income'],
  ['Expenses', null, 'Expense Claims'],
  ['Customers', 'Sales', 'Customers'],
  ['Sales Orders', 'Sales', 'Sales Orders'],
  ['Invoices', 'Sales', 'Invoices'],
  ['Receipts', 'Sales', 'Payments Received'],
  ['Credit Notes', 'Sales', 'Credit Notes'],
  ['Vendors', 'Purchases', 'Vendors'],
  ['Purchase Orders', 'Purchases', 'Purchase Orders'],
  ['Purchase Bills', 'Purchases', 'Purchase Bills'],
  ['Debit Notes', 'Purchases', 'Debit Notes'],
  ['Payments Made', 'Purchases', 'Payments Made'],
];

const CREATES = [
  ['Money Categories', 'Accounting', 'Chart of Accounts', 'Add Category', 'Create Account'],
  ['Accounting Entries', 'Accounting', 'Journal Entries', 'Record Transaction', 'Create Journal Entry'],
  ['Items', null, 'Items', 'Create Item', 'Create Item'],
  ['Income', null, 'Income', 'Record Income', 'Record Income'],
  ['Expenses', null, 'Expense Claims', 'Create Expense', 'Create Expense'],
  ['Customers', 'Sales', 'Customers', 'Create Customer', 'Create Customer'],
  ['Sales Orders', 'Sales', 'Sales Orders', 'New sales order', 'New sales order'],
  ['Invoices', 'Sales', 'Invoices', 'Create invoice', 'New sales invoice'],
  ['Receipts', 'Sales', 'Payments Received', 'New receipt', 'Create Receipt'],
  ['Credit Notes', 'Sales', 'Credit Notes', 'New credit note', 'New credit note'],
  ['Vendors', 'Purchases', 'Vendors', 'Create Vendor', 'Create Vendor'],
  ['Purchase Orders', 'Purchases', 'Purchase Orders', 'New purchase order', 'New purchase order'],
  ['Purchase Bills', 'Purchases', 'Purchase Bills', 'New purchase bill', 'New purchase bill'],
  ['Debit Notes', 'Purchases', 'Debit Notes', 'New Debit Note', 'New debit note'],
];

try {
  await waitForFile(path.join(profile, 'DevToolsActivePort'));
  const [port] = readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((t) => t.type === 'page' && t.url.includes('localhost:5173')) || targets.find((t) => t.type === 'page');
  if (!target) throw new Error('No page target found');

  cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.connect();
  await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Log.enable')]);
  cdp.on('Runtime.exceptionThrown', (p) => consoleProblems.push(`exception: ${p.exceptionDetails?.exception?.description || p.exceptionDetails?.text}`));
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error' || p.type === 'warning') consoleProblems.push(`${p.type}: ${p.args.map((a) => a.value ?? a.description ?? a.type).join(' ')}`);
  });
  cdp.on('Log.entryAdded', (p) => {
    if (p.entry.level === 'error' || p.entry.level === 'warning') consoleProblems.push(`${p.entry.level}: ${p.entry.text}`);
  });

  await waitFor("document.readyState === 'complete' && !!document.querySelector('nav.erpNavigation')", 'app shell');

  for (const [label, group, expect] of PAGES) {
    try {
      await nav(label, group, expect);
      const info = await pageInfo();
      check(!info.badText.length, `${label}: no invalid values`, info.badText.join(','));
      check(info.overflowX <= 1, `${label}: no horizontal overflow`, `${info.overflowX}px`);
      check(info.tables.length > 0, `${label}: register rendered`, `${info.tables.reduce((n, t) => n + t.rows, 0)} rows`);
      const joined = info.tables.flatMap((t) => t.headers.filter((h) => /(&\s*date|date\s*&|ID\s*&\s*Date)/i.test(h)));
      if (joined.length) issue(`${label}: date is not a separate column`, joined.join(', '));
    } catch (error) {
      fail(`${label}: page loads`, error.message);
    }
  }

  const DETAILS = [
    ['Money Categories', 'Accounting', 'Chart of Accounts'],
    ['Accounting Entries', 'Accounting', 'Journal Entries'],
    ['Items', null, 'Items'],
    ['Income', null, 'Income'],
    ['Expenses', null, 'Expense Claims'],
    ['Customers', 'Sales', 'Customers'],
    ['Sales Orders', 'Sales', 'Sales Orders'],
    ['Invoices', 'Sales', 'Invoices'],
    ['Receipts', 'Sales', 'Payments Received'],
    ['Credit Notes', 'Sales', 'Credit Notes'],
    ['Vendors', 'Purchases', 'Vendors'],
    ['Purchase Orders', 'Purchases', 'Purchase Orders'],
    ['Purchase Bills', 'Purchases', 'Purchase Bills'],
    ['Debit Notes', 'Purchases', 'Debit Notes'],
    ['Payments Made', 'Purchases', 'Payments Made'],
  ];

  for (const [label, group, expect] of DETAILS) {
    try {
      await nav(label, group, expect);
      const detail = await openDetail();
      check(detail.opened, `${label}: first row opens detail`, JSON.stringify(detail));
      await closeDetail();
    } catch (error) {
      fail(`${label}: detail view`, error.message);
    }
  }

  try {
    await nav('Money Categories', 'Accounting', 'Chart of Accounts');
    const duplicates = await ev(`(() => {
      const names = [...document.querySelectorAll('tbody tr')].map((r) => (r.querySelector('td')?.innerText || '').trim().split('\\n')[0]);
      const counts = names.reduce((m, n) => n ? m.set(n, (m.get(n) || 0) + 1) : m, new Map());
      return [...counts].filter(([, c]) => c > 1).map(([n, c]) => n + ' x' + c);
    })()`);
    if (duplicates.length) issue('Money Categories: duplicate account names', duplicates.join(', '));
    else pass('Money Categories: account names unique');
  } catch (error) { fail('Money Categories: duplicate names', error.message); }

  try {
    await clickMatch("/Organisation:/.test(aria) || /Organisation:/.test(text)", 'organisation switcher', 4000);
    const scope = await ev(`({ allOrg: /All organisations/i.test(document.body.innerText), allBranch: /All branches/i.test(document.body.innerText) })`);
    if (!scope.allOrg || !scope.allBranch) issue('Switcher: all organisations / all branches missing', JSON.stringify(scope));
    else pass('Switcher: all-scope options present');
    await clickMatch("/Organisation:/.test(aria) || /Organisation:/.test(text)", 'organisation switcher', 4000).catch(() => {});
  } catch (error) { fail('Switcher: all-scope options', error.message); }

  for (const [list, group, expectList, createName, expectForm] of CREATES) {
    try {
      await nav(list, group, expectList);
      await clickExact(createName);
      const opened = await waitFor(`(document.body.innerText || '').includes(${JSON.stringify(expectForm)})`, expectForm, 4000).catch(() => false);
      const fields = await ev(`document.querySelectorAll('input,select,textarea').length`);
      check(opened && fields > 0, `${list}: ${createName} opens`, `${fields} fields`);
      await exitForm();
    } catch (error) {
      fail(`${list}: ${createName}`, error.message);
    }
  }

  try {
    await nav('Income', null, 'Income');
    await clickExact('Record Income');
    await clickExact('Save Income');
    const alertText = await ev(`[...document.querySelectorAll('[role=alert]')].map((e) => e.innerText.trim()).join(' | ')`);
    check(/valid income amount/i.test(alertText), 'Income: empty submit is rejected', alertText);
    await exitForm();
  } catch (error) { fail('Income: validation', error.message); }

  try {
    await nav('Expenses', null, 'Expense Claims');
    await clickExact('Create Expense');
    const layout = await ev(`(() => {
      const input = document.querySelector('.exp-reference-input');
      const cell = input && input.parentElement;
      const card = document.querySelector('.exp-reference-card');
      if (!input || !cell || !card) return null;
      const ir = input.getBoundingClientRect(), cr = card.getBoundingClientRect();
      return { inputWidth: Math.round(ir.width), cellWidth: Math.round(cell.getBoundingClientRect().width), clippedPx: Math.max(0, Math.round(ir.right - cr.right)) };
    })()`);
    if (layout && layout.clippedPx > 0) issue('Create Expense: Reference No. is clipped', JSON.stringify(layout));
    await clickExact('Save Expense');
    const expenseError = await ev(`(document.body.innerText.match(/[^\\n]*valid expense amount[^\\n]*/i) || [null])[0]`);
    check(!!expenseError, 'Expense: empty submit is rejected', expenseError || '');
    const announced = await ev(`!!document.querySelector('[role=alert], [aria-live]')`);
    if (expenseError && !announced) issue('Expense: validation is not announced', 'error is a bare span without role=alert/aria-live');
    await exitForm();
  } catch (error) { fail('Expense: validation/layout', error.message); }

  try {
    await nav('Purchase Orders', 'Purchases', 'Purchase Orders');
    await clickExact('New purchase order');
    await clickExact('Save draft');
    const poError = await ev(`[...document.querySelectorAll('[role=alert]')].map((e) => e.innerText.trim()).join(' | ')`);
    check(/active vendor/i.test(poError), 'Purchase Order: empty submit is rejected', poError);
    await exitForm();
  } catch (error) { fail('Purchase Order: validation', error.message); }

  try {
    await nav('Items', null, 'Items');
    const rowsBase = await ev(`document.querySelectorAll('tbody tr').length`);
    await setValue('input[placeholder^="Search name"]', 'a');
    const rowsA = await ev(`document.querySelectorAll('tbody tr').length`);
    await setValue('input[placeholder^="Search name"]', 'zzzz');
    const rowsNone = await ev(`document.querySelectorAll('tbody tr').length`);
    const empty = await ev(`((document.body.innerText.match(/No items found/i) || [null])[0])`);
    check(rowsA > 0 && rowsA < rowsBase && rowsNone === 0 && !!empty, 'Items: search filters the register', `${rowsBase} -> ${rowsA} -> ${rowsNone}, ${empty || 'no empty state'}`);
    await setValue('input[placeholder^="Search name"]', '');
  } catch (error) { fail('Items: search', error.message); }

  try {
    await nav('Expenses', null, 'Expense Claims');
    await clickExact('Create Expense');
    await setValue('select', 'bills', 0);
    await clickMatch("/^Search & Select Vendor\\.\\.\\.$/.test(text) || /Vendor\\.\\.\\./.test(text)", 'vendor picker', 4000);
    await setValue('input[placeholder^="Search vendor"]', 'Kerala');
    await clickMatch('/Kerala Office Supplies/.test(text)', 'Kerala vendor', 4000);
    const bills = await ev(`[...document.querySelectorAll('.exp-allocation-table tbody tr')].map((r) => r.innerText.replace(/\\n/g, ' ').trim())`);
    await setValue('input[type=number]', '16992', 0);
    await clickExact('Auto Allocate');
    const allocation = await ev(`((document.body.innerText.match(/Allocated:[^\\n]*/) || [null])[0])`);
    check(bills.length > 0 && /Allocated: ₹[1-9]/.test(allocation || ''), 'Expense: outstanding bills and auto allocation', `${bills[0] || 'no bill'} | ${allocation || 'no allocation'}`);
    await exitForm();
  } catch (error) { fail('Expense: allocation', error.message); }

  try {
    await nav('Expenses', null, 'Expense Claims');
    await clickExact('EXP-00051');
    const drawer = await ev(`(() => {
      const d = document.querySelector('.opsDrawer');
      if (!d) return null;
      const r = d.getBoundingClientRect();
      return { x: Math.round(r.x), width: Math.round(r.width), right: Math.round(r.right), layoutWidth: document.documentElement.clientWidth };
    })()`);
    check(!!drawer && Math.abs(drawer.right - drawer.layoutWidth) <= 20, 'Expense: detail drawer is right-aligned', JSON.stringify(drawer));
    const closeName = await ev(`(() => { const b = [...document.querySelectorAll('.opsDrawer button')].find((x) => /^Close/i.test(x.getAttribute('aria-label') || x.innerText || '')); return b ? (b.getAttribute('aria-label') || b.innerText.trim()) : null; })()`);
    if (closeName) await clickExact(closeName).catch(() => {});
    await clickExact('Close').catch(() => {});
  } catch (error) { fail('Expense: detail drawer', error.message); }

  try {
    await nav('Payments Made', 'Purchases', 'Payments Made');
    await clickExact('Record Payment');
    const destination = await ev(`({ h1: document.querySelector('h1')?.innerText || null, h2: [...document.querySelectorAll('h2')].map((x) => x.innerText.trim()).slice(0, 2) })`);
    if (destination.h1 === 'Purchase Bills') issue('Payments Made: Record Payment opens Purchase Bills', JSON.stringify(destination));
    else pass('Payments Made: Record Payment target', JSON.stringify(destination));
  } catch (error) { fail('Payments Made: Record Payment', error.message); }

  try {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 700, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    await nav('Expenses', null, 'Expense Claims');
    await clickExact('Create Expense');
    const narrow = await ev(`(() => {
      const input = document.querySelector('.exp-reference-input');
      const cell = input && input.parentElement;
      const card = document.querySelector('.exp-reference-card');
      if (!input || !cell || !card) return null;
      const ir = input.getBoundingClientRect(), cr = card.getBoundingClientRect();
      return { viewport: window.innerWidth, inputWidth: Math.round(ir.width), cellWidth: Math.round(cell.getBoundingClientRect().width), clippedPx: Math.max(0, Math.round(ir.right - cr.right)) };
    })()`);
    if (narrow && narrow.clippedPx > 0) issue('Create Expense: Reference No. clips at 900px', JSON.stringify(narrow));
    await exitForm();
    await cdp.send('Emulation.clearDeviceMetricsOverride');
  } catch (error) { fail('Responsive: 900px expense form', error.message); }

  const relevantConsole = consoleProblems.filter((text) => !IGNORE.some((rx) => rx.test(text)));
  if (relevantConsole.length) issue('Console errors/warnings', relevantConsole.slice(0, 5).join(' || '));
  else pass('Console: no errors or warnings');

  const report = { app: APP, ranAt: new Date().toISOString(), results, issues, consoleProblems: relevantConsole };
  console.log('UI SMOKE REPORT');
  for (const entry of results) console.log(`${entry.status === 'pass' ? 'PASS' : 'FAIL'}  ${entry.name}${entry.detail ? '  [' + entry.detail + ']' : ''}`);
  if (issues.length) {
    console.log('\nISSUES');
    for (const entry of issues) console.log(`ISSUE ${entry.name}  ${entry.detail || ''}`);
  }
  const reportPath = process.env.SMOKE_JSON || path.join(process.cwd(), 'ui-smoke-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${reportPath}`);

  if (results.some((entry) => entry.status === 'fail')) process.exitCode = 1;
} catch (error) {
  console.error(`UI smoke crashed at step "${step}":`, error.message);
  process.exitCode = 1;
} finally {
  cdp?.close();
  browser.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}


