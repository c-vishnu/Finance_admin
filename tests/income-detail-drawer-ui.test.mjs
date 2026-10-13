import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page = readFileSync(new URL('../src/IncomeReport.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/income-detail-drawer.css', import.meta.url), 'utf8');
const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, '');

test('the income detail drawer is portalled onto the shared drawer shell', () => {
  assert.ok(page.includes("import { createPortal } from 'react-dom';"), 'the page imports createPortal');
  assert.ok(page.includes("import './income-detail-drawer.css';"), 'the page imports the drawer stylesheet');
  assert.ok(page.includes('{activeDrawerIncome && createPortal('), 'the drawer opens in a portal');
  assert.ok(page.includes('<div className="opsOverlay irOverlay"'), 'the overlay is the shared overlay');
  assert.ok(page.includes('<aside className="opsDrawer irDrawer" role="dialog" aria-modal="true"'), 'the panel is a named modal drawer on the shared shell');
  assert.ok(page.includes('<div className="opsDrawerBody irDrawerBody">'), 'the body is the shared scroll region');
  assert.ok(page.includes('<footer>'), 'the actions sit in the shell footer');
  assert.equal((page.match(/document\.body/g) || []).length, 2, 'the drawer and the receipt dialog both mount on document.body');
});

test('the drawer no longer paints inside the report page', () => {
  assert.ok(!page.includes("pb: '12px'"), 'the invalid pb property is gone');
  assert.ok(!page.includes('zIndex: 900'), 'the old page-level overlay z-index is gone');
  assert.ok(!page.includes("width: '500px'"), 'the inline panel width is gone');
  assert.ok(!page.includes('overflowY: '), 'the inline panel scroll is gone');
  assert.equal((page.match(/position: 'fixed'/g) || []).length, 1, 'only the receipt dialog keeps an inline fixed overlay');
});

test('the drawer keeps every income detail fact and action', () => {
  for (const token of [
    '<dt>Income Category</dt>', '<dt>Received From</dt>', '<dt>Amount</dt>', '<dt>Status</dt>',
    'Accounting Posting Details:', 'Income Account:', 'Deposit Ledger:', 'GST Tax Rate:',
    'Description / Notes', '>Close</button>', 'Cancel Record', 'className="irDanger"',
    'handleReverseIncome(activeDrawerIncome.recordId)', 'money(activeDrawerIncome.amount)',
    'STATUS_TONES[activeDrawerIncome.status]', '<StatusPill status={activeDrawerIncome.status}'
  ]) assert.ok(page.includes(token), token);
});

test('the drawer closes from the backdrop, the header and the footer', () => {
  assert.ok(page.includes('onMouseDown={event => { if (event.target === event.currentTarget) setActiveDrawerIncome(null); }}'), 'the backdrop closes the drawer');
  assert.ok(page.includes('className="irDrawerClose" aria-label="Close income details"'), 'the header close button is named');
  assert.equal((page.match(/onClick=\{\(\) => setActiveDrawerIncome\(null\)\}/g) || []).length, 2, 'the header and footer both close the drawer');
});

test('the mark-received dialog joins the drawer on the root layer', () => {
  assert.ok(page.includes('{markPaidModal && createPortal('), 'the dialog opens in a portal');
  assert.ok(page.includes('zIndex: 1200'), 'the dialog sits above the application chrome');
  assert.ok(page.includes('handleMarkAsReceivedSubmit'), 'the dialog keeps its submit path');
});

test('the drawer slides over from the right like the Expense details drawer', () => {
  assert.ok(cssRules.includes('.irOverlay .irDrawer{animation:irDrawerIn .22s ease-out both}'), 'the panel slides in, scoped above the shared shell');
  assert.ok(cssRules.includes('@keyframes irDrawerIn{from{transform:translateX(28px);opacity:.55}to{transform:translateX(0);opacity:1}}'), 'the keyframe is the same 28px slide the Expense details and Create Account drawers use');
});
test('the drawer opens on the RIGHT and restates no side of its own', () => {
  assert.ok(css.includes('.irOverlay .irDrawer{'), 'the drawer override is scoped above the generic shell');
  assert.ok(!/(^|\n)\.irDrawer/.test(css), 'no override is left unscoped');
  assert.ok(css.includes('.irOverlay .irDrawerBody{'), 'the body padding is scoped above .opsDrawerBody');
  assert.ok(!cssRules.includes('z-index'), 'the drawer never restates the shell z-index');
  assert.ok(!cssRules.includes('justify-content') && !cssRules.includes('margin-right') && !cssRules.includes('border-right'), 'the drawer declares no side of its own, so it opens on the RIGHT where the shared shell and ui-quality-polish.css put every .opsDrawer');
});