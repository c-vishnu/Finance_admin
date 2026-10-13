import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page = readFileSync(new URL('../src/ExpenseReport.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/expense-detail-drawer.css', import.meta.url), 'utf8');
const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, '');

test('the expense detail drawer is portalled onto the shared drawer shell', () => {
  assert.ok(page.includes("import {createPortal} from 'react-dom';"), 'the page imports createPortal');
  assert.ok(page.includes("import './expense-detail-drawer.css';"), 'the page imports the drawer stylesheet');
  assert.ok(page.includes('return createPortal('), 'the drawer opens in a portal, because the report is also mounted inside .transactionPortal');
  assert.ok(page.includes('<div className="opsOverlay exOverlay"'), 'the overlay is the shared overlay');
  assert.ok(page.includes('<aside className="opsDrawer exDrawer" role="dialog" aria-modal="true"'), 'the panel is a named modal drawer on the shared shell');
  assert.ok(page.includes('<div className="opsDrawerBody exDrawerBody">'), 'the body is the shared scroll region');
  assert.ok(page.includes('{detailRow&&<ExpenseDetailDrawer entry={detailRow}'), 'the register renders it for the row in hand');
  assert.equal((page.match(/document\.body/g) || []).length, 1, 'the one portal mounts on document.body');
});

test('the drawer keeps every recorded fact, the posting it makes and the description', () => {
  for (const token of [
    '<h2>{entry.name||entry.number}</h2>',
    '<dt>Amount</dt>', '<dt>Status</dt>', '<dt>Expense Account</dt>', '<dt>Paid Through</dt>',
    '<dt>Vendor / Payee</dt>', '<dt>Category</dt>', '<dt>Customer</dt>', '<dt>Branch</dt>',
    '<dt>Payment Method</dt>', '<dt>Tax</dt>', '<dt>Reference</dt>',
    'Accounting posting details:', '<li>Debit &middot; ', '<li>Credit &middot; ',
    '<h3>Description</h3>', 'No description recorded.',
    'money(entry.amount)', '<StatusPill status={entry.status}', '>Close</button>', "onNavigate('Journal Entries')"
  ]) assert.ok(page.includes(token), token);
});

test('the drawer closes from the scrim, the header and the footer', () => {
  assert.ok(page.includes('onMouseDown={event=>{if(event.target===event.currentTarget)close()}}'), 'the scrim closes the drawer');
  assert.ok(page.includes('className="exDrawerClose" aria-label="Close expense details"'), 'the header close button is named for assistive technology');
  assert.equal((page.match(/onClick=\{close\}/g) || []).length, 2, 'the header and the footer both close the drawer');
});

test('a row opens the drawer instead of leaving the register for another page', () => {
  assert.ok(page.includes('function openDocument(entry){setHandoff(null);setDetail(entry)}'), 'the row action opens the record in place');
  assert.ok(!page.includes('onNavigate(entry.page)'), 'nothing navigates away to reach the record any more');
  assert.ok(!page.includes('function remember('), 'and the handshake writer that only that navigation needed is gone');
  assert.equal((page.match(/openDocument\(entry\)\}/g) || []).length, 2, 'both the reference link and the row action call the one opener');
});

test('the Transaction Register handshake opens that one row, once', () => {
  assert.ok(page.includes("const consumeExpenseHandoff=()=>{try{const id=sessionStorage.getItem('wayvida-open-expense');"), 'the register reads the handshake the Transaction Register writes');
  assert.ok(page.includes("sessionStorage.removeItem('wayvida-open-expense');"), 'and drops it, so arriving any other way opens the list');
  assert.ok(page.includes('const [detail,setDetail]=useState(null),[handoff,setHandoff]=useState(consumeExpenseHandoff);'), 'the handoff id is state, read once as the page mounts');
  assert.ok(page.includes('const detailRow=detail||(handoff?ordered.find(row=>row.recordId===handoff):null);'), 'and resolves against the same ordered rows the table prints');
});

test('the drawer slides over from the right like the Create Account drawer', () => {
  assert.ok(cssRules.includes('.exOverlay .exDrawer{animation:exDrawerIn .22s ease-out both}'), 'the panel slides in, scoped above the shared shell');
  assert.ok(cssRules.includes('@keyframes exDrawerIn{from{transform:translateX(28px);opacity:.55}to{transform:translateX(0);opacity:1}}'), 'the keyframe is the same 28px slide the Create Account drawer uses');
});

test('the drawer opens on the RIGHT and restates no side of its own', () => {
  assert.ok(css.includes('.exOverlay .exDrawer{'), 'the drawer override is scoped above the generic shell');
  assert.ok(!/(^|\n)\.exDrawer/.test(css), 'no override is left unscoped');
  assert.ok(css.includes('.exOverlay .exDrawerBody{'), 'the body padding is scoped above .opsDrawerBody');
  assert.ok(!cssRules.includes('z-index'), 'the drawer never restates the shell z-index');
  assert.ok(!cssRules.includes('justify-content') && !cssRules.includes('margin-right') && !cssRules.includes('border-right'), 'the drawer declares no side of its own, so it opens on the RIGHT where the shared shell and ui-quality-polish.css put every .opsDrawer');
});