import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/* The Record Income rows were regrouped on the user request of 2026-10-13, in three steps on the same
   day. The operator first asked for three inputs on a single row, then named the row they wanted -
   Received From, Have you received the income? and Received Via together - and then asked for the
   account to sit on the row after it. The live layout is therefore one row of three basic details
   (Date, Income Type, Amount), one row of three receipt details (Received From, the received switch,
   the single-cell Received Via picker) and one full-width row for the account the money landed in, so
   no row is left holding a lone control beside an empty track - the shape the operator rejected on
   Create Expense. CreateIncomePage carries two returns and only the first one - the inc-reference page -
   is reachable, so these tests read that block, and they pin the row grouping and its track rules
   rather than the field list, because every field already existed. */
/* Both files are normalised to LF first: the stylesheet is checked out with CRLF on Windows and the
   multi-line assertions below read exact rule text, which must not depend on the checkout's endings. */
const page = readFileSync(new URL('../src/CreateIncomePage.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = readFileSync(new URL('../src/journal-form.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const nav = readFileSync(new URL('../src/Navigation.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const liveStart = page.indexOf('<section className="rt-page itemCreatePage je-create inc-create-page inc-reference-page">');
const liveEnd = page.indexOf('<section className="rt-page itemCreatePage je-create inc-create-page"');
const live = page.slice(liveStart, liveEnd);

const gridStart = live.indexOf('<div className="inc-reference-grid">');
const grid = live.slice(gridStart, live.indexOf('</div>', gridStart));

const paymentStart = live.indexOf('<div className="inc-reference-payment">');
const payment = live.slice(paymentStart, live.indexOf('</section>', paymentStart));
const methodCell = payment.slice(payment.indexOf('<div className="inc-method-picker">'), payment.indexOf('<label className="inc-account-field">'));
const accountCell = payment.slice(payment.indexOf('<label className="inc-account-field">'), payment.indexOf('</> : <label className="inc-expected-date">'));

test('the Record Income page renders the inc-reference layout as its first return', () => {
  assert.ok(liveStart >= 0, 'the inc-reference page is the rendered one');
  assert.ok(liveEnd > liveStart, 'and it is the return that comes first');
  assert.ok(gridStart >= 0 && paymentStart > gridStart, 'and the basic row comes before the payment row');
});

test('Date, Income Type and Amount share the basic row', () => {
  assert.equal((grid.match(/<label/g) || []).length, 3, 'the row holds exactly three fields');
  assert.ok(grid.includes('<span>Date <b>*</b></span>'), 'Date leads it');
  assert.ok(grid.includes('<span>Income Type <b>*</b></span>'), 'Income Type follows');
  assert.ok(grid.includes('<label className="inc-amount-input"><span>Amount (₹) <b>*</b></span>'), 'and Amount closes it');
  assert.ok(!grid.includes('inc-customer-field'), 'Received From is not one of its fields');
});

test('Received From, the received question and Received Via share the payment row', () => {
  const order = ['<label className="inc-customer-field">', 'className="inc-received-question"', '<div className="inc-method-picker">'].map(marker => payment.indexOf(marker));
  assert.ok(order[0] >= 0, 'Received From leads the row');
  assert.ok(order[0] < order[1], 'the received question follows');
  assert.ok(order[1] < order[2], 'and Received Via closes it');
  assert.ok(payment.includes('<span>Received From <b>*</b></span>'), 'Received From keeps its label');
  assert.ok(payment.includes('<span>Have you received the income?</span>'), 'and the question keeps its wording');
});

test('the Received Via cell holds only the Cash/Bank options', () => {
  assert.ok(methodCell.includes('<span>Received Via <b>*</b></span>'), 'the cell is labelled Received Via');
  assert.ok(methodCell.includes('className="inc-method-options"'), 'it holds the Cash/Bank options');
  assert.equal((methodCell.match(/<\/div>/g) || []).length, 2, 'and closes twice: the options and the cell');
  assert.ok(!methodCell.includes("'Cash Account' : 'Bank Account'"), 'the account select is no longer nestable inside it');
});

test('the account lands on its own row below', () => {
  assert.ok(accountCell.includes('<span>{form.paymentType'), 'the account field follows the Received Via cell');
  assert.ok(accountCell.includes("'Cash Account' : 'Bank Account'"), 'and still names the account it posts to');
  assert.ok(payment.indexOf('<label className="inc-account-field">') > payment.indexOf('<div className="inc-method-picker">'), 'as a sibling of the picker, not its child');
  assert.ok(css.includes('.inc-reference-page .inc-account-field{grid-column:1/-1}'), 'so CSS gives it the whole row');
  assert.ok(css.includes('.inc-reference-page .inc-account-field select{max-width:420px}'), 'with its select capped rather than stretched across the card');
});

test('both rows are three tracks wide and fold on a narrow viewport', () => {
  assert.ok(css.includes('.inc-reference-page .inc-reference-grid{grid-template-columns:repeat(3,minmax(0,1fr))}'), 'the basic row states the third track');
  assert.ok(css.includes('@media(max-width:1024px){\n  .inc-reference-page .inc-reference-grid{grid-template-columns:repeat(2,minmax(0,1fr))}\n}'), 'and steps back to two before the three fields squeeze');
  assert.ok(css.includes('@media(max-width:760px){\n  .inc-reference-page .inc-reference-grid{grid-template-columns:1fr}\n}'), 'and to one column at the shared fold');
  assert.ok(css.includes('.inc-reference-page .inc-reference-payment{grid-template-columns:repeat(3,minmax(0,1fr))}'), 'the payment row keeps the three-track rule it already stated');
  assert.ok(css.includes('.inc-reference-page .inc-expected-date{grid-column:auto;max-width:none}'), 'and its expected-date cell no longer spans two tracks');
});

test('the shared row rule is still the untouched base', () => {
  assert.ok(css.includes('.inc-reference-grid,.inc-reference-payment,.inc-more-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 24px;margin-top:18px}'), 'the shared row rule still states two columns and its own spacing');
  assert.ok(!css.includes('.inc-reference-page .inc-reference-grid .inc-customer-field'), 'the stale customer-field span is gone');
  assert.equal((css.match(/\.inc-reference-page \.inc-reference-grid\{grid-template-columns/g) || []).length, 3, 'the page-scoped override appears once per breakpoint and nowhere else');
});

test('the page fills the report portal so its header meets the sidebar', () => {
  assert.ok(css.includes('.transactionPortal:has(.inc-reference-page){padding:0!important;background:#fff!important}'), 'the portal drops its 24px padding and gray background for this page, so the full-bleed page bar can reach the nav rail');
  assert.ok(nav.includes('createPortal(<div className="transactionPortal"><IncomeReport page="Income"'), 'because Navigation.jsx mounts the Income page through a body-level portal rather than .app main, which is why the .app main shell rules never reach it');
});

test('the Basic Details and More Details cards keep a left and right gutter', () => {
  assert.ok(css.includes('.inc-reference-page .inc-reference-content{padding-left:clamp(16px,2.2vw,24px)!important;padding-right:clamp(16px,2.2vw,24px)!important}'), 'the content box insets both cards, so neither runs into the nav rail or the window edge');
  assert.ok(css.includes('@media(max-width:600px){\n  .inc-reference-page .inc-reference-content{padding-left:12px!important;padding-right:12px!important}\n}'), 'and it narrows to the phone step instead of keeping the fluid gutter');
  const fullBleedContent = '.inc-reference-page .inc-reference-content{width:100%';
  assert.ok(css.indexOf('.inc-reference-page .inc-reference-content{padding-left:clamp(16px,2.2vw,24px)!important') > css.indexOf(fullBleedContent), 'and it is stated after the full-bleed content rule, so that rule cannot cancel it on source order');
});
