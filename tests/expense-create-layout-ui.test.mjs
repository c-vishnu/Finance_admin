import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/* Create Expense was restructured on the user request of 2026-10-17: the Basic Details heading and
   its "Tell us about the expense." sentence are gone, the collapsed More Details block is gone, and
   the whole form is one card in the operator's order - Date Paid, Paid To, Payment For, Amount Paid,
   Paid From, Reference No., Outstanding Bills, Tax / GST, Payment Method, Notes, Attachment. The
   helper lines are gone, Reference No. carries its own attach control like Record Income, and
   Notes and Attachment share a closing row. CreateExpensePage
   carries two returns and only the first one - the exp-reference page - is reachable, so these tests
   read that block. */
/* Both files are normalised to LF first: the stylesheet is checked out with CRLF on Windows and the
   multi-line assertions below read exact rule text, which must not depend on the checkout's endings. */
const page = readFileSync(new URL('../src/CreateExpensePage.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = readFileSync(new URL('../src/journal-form.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const liveStart = page.indexOf('<section className="rt-page itemCreatePage je-create exp-create-page exp-reference-page">');
const liveEnd = page.indexOf('<section className="rt-page itemCreatePage je-create exp-create-page"');
const live = page.slice(liveStart, liveEnd);

test('the Create Expense page is one card with no Basic Details or More Details headings', () => {
  assert.ok(liveStart >= 0, 'the exp-reference page is the rendered one');
  assert.ok(liveEnd > liveStart, 'and it is the return that comes first');
  assert.ok(!live.includes('Basic Details'), 'the Basic Details heading is removed');
  assert.ok(!live.includes('Tell us about the expense.'), 'and so is its sentence');
  assert.ok(!live.includes('exp-more-details'), 'the collapsed More Details block is removed');
  assert.ok(!live.includes('<details'), 'nothing is left to open on the form');
  assert.equal((live.match(/<section className="exp-reference-card">/g) || []).length, 1, 'the form is one card');
});

test('the operator fields appear in the requested order', () => {
  const order = [
    '<span>Date Paid <b>*</b></span>',
    '<span>Paid To</span>',
    '<span>Payment For <b>*</b></span>',
    '<span>Amount Paid (₹) <b>*</b></span>',
    '<span>Paid From <b>*</b></span>',
    '<span>Reference No.</span>',
    '<h3>Outstanding Bills',
    '<span>Tax / GST</span>',
    '<span>GST Rate</span>',
    '<span>Notes</span>',
    '<span>Attachment</span>'
  ];
  let previous = -1;
  for (const marker of order) {
    const at = live.indexOf(marker);
    assert.ok(at > previous, `${marker} comes after the field before it`);
    previous = at;
  }
});

test('the helper lines are removed from the form', () => {
  const hints = [
    'When was the money paid?',
    'Select vendor, person, or business',
    'Existing Purchase Bills / Other Expense',
    'How much money did you pay?',
    'For direct expenses only; existing bill tax is already recorded.',
    'Cash or Bank account',
    'Cash, UPI, Bank Transfer, Cheque, Card',
    'UTR / Cheque / Transaction ID',
    'Optional explanation',
    'Receipt or payment proof'
  ];
  assert.ok(!live.includes('exp-field-hint'), 'no purpose line remains under a control');
  for (const hint of hints) assert.ok(!live.includes(hint), hint);
});

test('the Payment For field names both workflows and carries accounts under Other Expense', () => {
  assert.ok(live.includes('<select aria-label="Payment For" value={settlement ? \'bills\' : form.expenseAccount} onChange={e => handlePaymentForChange(e.target.value)}>'), 'the workflow and account are one dropdown');
  assert.ok(live.includes('<option value="bills">Existing Purchase Bills</option>'), 'the payables workflow is named plainly');
  assert.ok(live.includes('<optgroup label="Other Expense">'), 'the direct-expense accounts are grouped under Other Expense');
  assert.ok(live.includes('{expenseAccountOptions.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}'), 'the chart accounts live in that group');
  assert.ok(!live.includes('aria-label="Expense Account"'), 'there is no second account picker beneath the workflow');
  assert.ok(page.includes('const handlePaymentForChange = (mode) =>'), 'the single handler still sets the workflow');
  assert.ok(page.includes("const directAccount = isSettlement ? (f.directExpenseAccount || '5900') : (mode || f.directExpenseAccount || '5900');"), 'choosing an account records it as the direct account');
  assert.ok(page.includes('directExpenseAccount: directAccount,'), 'the remembered direct account follows the selection');
  assert.ok(!page.includes('handleExpenseAccountChange'), 'the separate account handler is gone');
});

test('Paid From is one grouped Cash and Bank account dropdown', () => {
  assert.ok(live.includes('<select aria-label="Paid From" value={form.paidThrough} onChange={e => handlePaidFromChange(e.target.value)}>'), 'one select chooses the money account');
  assert.ok(live.includes('<optgroup label="Cash">'), 'cash ledgers are a named group');
  assert.ok(live.includes('<optgroup label="Bank">'), 'bank ledgers are the other named group');
  assert.ok(page.includes("if (!bankPaymentAccounts.length) bankPaymentAccounts.push({ code: '1010', name: 'Bank Account' });"), 'a bank account remains available in an empty book');
  assert.ok(page.includes('const handlePaidFromChange = (code) =>'), 'the ledger choice also states Cash or Bank');
  assert.ok(page.includes("return code === '1000' || /cash/.test(name) || account.accountPurpose === 'Cash';"), 'cash is read from the ledger itself, not the shared Cash and Bank group');
  assert.ok(!live.includes('aria-label="Payment Account"'), 'the old second account picker is gone');
  assert.ok(!live.includes("handlePaidFromMode('Cash')"), 'and so are the Cash/Bank buttons');
});

test('Tax / GST and GST Rate are offered for direct expenses only', () => {
  const tax = live.indexOf('<span>Tax / GST</span>');
  const reference = live.indexOf('<span>Reference No.</span>');
  const gstRate = live.indexOf('<span>GST Rate</span>');
  assert.ok(tax > live.indexOf('<h3>Outstanding Bills'), 'it follows Outstanding Bills in the order');
  assert.ok(tax > reference, 'it follows the Amount / Paid From / Reference row');
  assert.ok(gstRate > tax, 'GST Rate follows Tax / GST');
  assert.ok(!live.includes('Payment Method'), 'the account choice states the method, so there is no second picker');
  assert.ok(!page.includes('form.paymentMethod'), 'no stored payment-method field remains');
  assert.ok(page.includes("const paymentMethod = paidFromAccount && isCashPaymentAccount(paidFromAccount) ? 'Cash' : 'Bank Transfer';"), 'the saved method is derived from Paid From');
  assert.ok(live.includes('{!settlement && ('), 'the tax band is rendered only when the payment is a direct expense');
});

test('the form uses the Record Income three-track grid and folds at the same breakpoints', () => {
  assert.ok(css.includes('.exp-reference-page .exp-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px 24px;margin-top:18px}'), 'three fields per row with the form spacing');
  assert.ok(css.includes('.exp-reference-page .exp-form-grid{align-items:start}'), 'rows align at the top instead of stretching a short field to a taller neighbour');
  assert.ok(css.includes('.exp-reference-page .exp-field{align-content:start}'), 'and each field keeps its own control heights');
  assert.ok(css.includes('.exp-reference-page .exp-field-wide{grid-column:1/-1}'), 'Outstanding Bills, Notes and Attachment take the whole row');
  assert.equal((live.match(/<div className="exp-form-grid">/g) || []).length, 1, 'the main fields share one grid like Record Income');
  const firstRow = live.slice(live.indexOf('<div className="exp-form-grid">'), live.indexOf('<span>Amount Paid'));
  assert.ok(firstRow.includes('<span>Date Paid <b>*</b></span>'), 'Date Paid opens the three-track row');
  assert.ok(firstRow.includes('<span>Paid To</span>'), 'Paid To is the second field in that row');
  assert.ok(firstRow.includes('<span>Payment For <b>*</b></span>'), 'and Payment For is the third');
  const secondRow = live.slice(live.indexOf('<span>Amount Paid'), live.indexOf('<h3>Outstanding Bills'));
  assert.ok(secondRow.includes('<span>Paid From <b>*</b></span>'), 'Paid From sits beside Amount Paid');
  assert.ok(secondRow.includes('<span>Reference No.</span>'), 'and Reference No. is the third field in that row');
  assert.ok(live.includes('className="exp-field exp-paid-from"'), 'Paid From is one of the three inputs, not a full-width field');
  assert.ok(live.includes('className="exp-field exp-reference-no" role="group" aria-label="Reference No."'), 'Reference No. is its own field group');
  assert.ok(live.includes('className="exp-reference-input"'), 'the reference number and its upload share one box');
  assert.ok(live.includes('className="exp-reference-attach"'), 'the upload is the Record Income Attach control');
  assert.ok(live.includes('className="exp-field-wide exp-notes-attachment"'), 'Notes and Attachment share one full-width row');
  assert.ok(css.includes('.exp-reference-page .exp-notes-attachment{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 24px}'), 'the closing row has two tracks');
  assert.ok(css.includes('.exp-reference-page .exp-notes{grid-column:auto}'), 'Notes stays in one of those tracks instead of spanning the old full-width row');
  assert.ok(css.includes('.exp-reference-page .exp-reference-input{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 6px 0 13px;border:1px solid #cfdced;border-radius:9px;background:#fff}'), 'the reference box keeps the Record Income border and height');
  assert.ok(css.includes('@media(max-width:820px){\n  .exp-reference-page .exp-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}'), 'the grid keeps three tracks through the in-app desktop width and steps down to two at 820px');
  assert.ok(css.includes('@media(max-width:760px){\n  .exp-reference-page .exp-form-grid{grid-template-columns:1fr}'), 'and to one column at the shared phone width');
});


/* The operator then asked, on the same day, for the Cancel / Save Draft / Save Expense bar to sit still
   at the bottom of the page the way the Record Income bar does, instead of trailing the form - and
   said again that the buttons still had to be scrolled to, which is what exposed the second mount:
   the sidebar's Expenses entry renders this page inside .app main as an operational module, while the
   Expense Report page mounts the same sheet through the body-level div.transactionPortal. The bar is
   therefore stated for BOTH paths, and both read one --exp-footer-left token off the body, because
   neither a page-scoped rule nor the .app main rules can win in both mounts at once. */
test('the Create Expense actions are pinned to the bar the Record Income page uses', () => {
  const bar = '.transactionPortal:has(.exp-reference-page) .rt-page.exp-reference-page>.exp-footer,\nbody:has(.exp-reference-page) .app main .rt-page.exp-reference-page>.exp-footer{position:fixed!important;';
  assert.ok(css.includes(bar), 'both mounts state the pinned bar, so the sidebar Expenses entry and the Expense Report page get the same treatment');
  assert.ok(css.includes('top:auto!important;right:0!important;bottom:0!important;left:var(--exp-footer-left,250px)!important;z-index:30!important'), 'and the bar spans the window from the rail to the right edge');
  assert.ok(css.includes('min-height:72px!important;margin:0!important;padding:12px 28px!important;border:0!important;border-top:1px solid #dce5f0!important'), 'with the Record Income bar metrics rather than the old static card');
  assert.ok(css.includes('background:rgba(255,255,255,.97)!important;box-shadow:0 -5px 18px rgba(16,38,76,.07)!important'), 'and the same translucent white surface');
});

test('the actions keep the Record Income button metrics in both mounts', () => {
  assert.ok(css.includes('body:has(.exp-reference-page) .app main .rt-page.exp-reference-page>.exp-footer button{min-width:112px!important;height:44px!important;border:1px solid #cfdbeb!important;border-radius:8px!important;background:#fff!important;color:#1d3153!important;font-weight:650!important}'), 'the main mount carries the same 44px buttons as the portal mount');
  assert.ok(css.includes('body:has(.exp-reference-page) .app main .rt-page.exp-reference-page>.exp-footer .primary{min-width:144px!important;border-color:#146cf4!important;background:#146cf4!important;color:#fff!important}'), 'and the primary Save Expense keeps its fill');
});

test('the bar left edge follows the rail and the reports sidebar in both mounts', () => {
  assert.ok(css.includes('body:has(.exp-reference-page){--exp-footer-left:250px}'), 'the token is declared on the body so both mounts inherit it');
  assert.ok(css.includes('body.navCollapsed:has(.exp-reference-page){--exp-footer-left:72px}'), 'the 72px compact rail');
  assert.ok(css.includes('body.hasReportsNav:has(.exp-reference-page){--exp-footer-left:490px}'), 'the reports secondary sidebar adds its 240px');
  assert.ok(css.includes('body.navCollapsed.hasReportsNav:has(.exp-reference-page){--exp-footer-left:312px}'), 'and rail plus sidebar together, which is the state the Expense Report sheet runs in');
  assert.ok(css.includes('@media(max-width:900px){\n  body.hasReportsNav:has(.exp-reference-page){--exp-footer-left:250px}'), 'the sidebar overlays without taking rail space under 900px');
  assert.ok(css.includes('  body.navCollapsed.hasReportsNav:has(.exp-reference-page){--exp-footer-left:72px}'), 'in the collapsed rail state too');
  assert.ok(css.includes('@media(max-width:700px){\n  body:has(.exp-reference-page),\n  body.navCollapsed:has(.exp-reference-page),\n  body.hasReportsNav:has(.exp-reference-page),\n  body.navCollapsed.hasReportsNav:has(.exp-reference-page){--exp-footer-left:0}'), 'and the rail itself folds away under 700px, where the bar starts at the window edge');
  assert.equal((css.match(/--exp-footer-left:250px\}/g) || []).length, 2, 'the rail width is stated once for desktop and once for the 900px step');
  assert.equal((css.match(/--exp-footer-left:312px\}/g) || []).length, 1, 'and the rail-plus-sidebar offset once');
});

test('the pinned bar outranks the static rules it replaces', () => {
  const pinned = css.indexOf('body:has(.exp-reference-page) .app main .rt-page.exp-reference-page>.exp-footer{position:fixed!important;');
  assert.ok(pinned > css.indexOf('.exp-reference-page .exp-footer{position:static!important;'), 'the main-mount bar is stated after the page-scoped static rule');
  assert.ok(pinned > css.indexOf('body:has(.exp-reference-page) .app main .rt-page.exp-reference-page>.exp-footer{position:static!important;'), 'and after the .app main static card, which is the mount the sidebar Expenses entry uses');
  assert.ok(pinned > css.indexOf('.exp-reference-page .exp-footer{box-sizing:border-box;'), 'and after the single-gutter rule whose padding and margins it takes over');
  assert.ok(css.includes('/* Static Create Expense actions - superseded by the pinned bar at the end of this file. */'), 'and the superseded checkpoint is annotated rather than deleted');
  assert.ok(css.includes('.exp-reference-page .exp-reference-content{display:grid;width:100%;max-width:none;margin:0!important;padding:16px 24px 94px!important;'), 'while the form keeps the 94px tail that stops the bar covering the last field');
});

test('the bar folds to shared buttons on a phone', () => {
  assert.ok(css.includes('@media(max-width:760px){\n  .transactionPortal:has(.exp-reference-page) .rt-page.exp-reference-page>.exp-footer,\n  body:has(.exp-reference-page) .app main .rt-page.exp-reference-page>.exp-footer{padding:10px 12px!important}'), 'the bar narrows its padding at the shared fold, in both mounts');
  assert.ok(css.includes('  body:has(.exp-reference-page) .app main .rt-page.exp-reference-page>.exp-footer button{min-width:0!important;flex:1 1 100px!important}'), 'and the three buttons share the width, the way the Record Income footer does');
});
