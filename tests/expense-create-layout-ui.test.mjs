import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/* The Create Expense basic details were regrouped on the user request of 2026-10-13 and tightened the
   same day, when the operator reported that a row showed only two inputs: Date, Expense Type and Paid To
   share the top row, and Amount, the Paid Via Cash/Bank picker and Payment Account share the second, so
   every row in the card carries three fields and no row is left holding a lone control beside an empty
   track. CreateExpensePage carries two returns and only the first one - the exp-reference page - is
   reachable, so these tests read that block, and they pin the row grouping rather than the field list,
   because every field already existed. */
/* Both files are normalised to LF first: the stylesheet is checked out with CRLF on Windows and the
   multi-line assertions below read exact rule text, which must not depend on the checkout's endings. */
const page = readFileSync(new URL('../src/CreateExpensePage.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = readFileSync(new URL('../src/journal-form.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const liveStart = page.indexOf('<section className="rt-page itemCreatePage je-create exp-create-page exp-reference-page">');
const liveEnd = page.indexOf('<section className="rt-page itemCreatePage je-create exp-create-page"');
const live = page.slice(liveStart, liveEnd);

const rowStarts = [...live.matchAll(/<div className="exp-reference-(?:grid|payment)[^"]*">/g)].map(match => match.index);
const rowEnd = live.indexOf('</section>');
const rows = rowStarts.map((start, index) => live.slice(start, index + 1 < rowStarts.length ? rowStarts[index + 1] : rowEnd));

test('the Create Expense page renders the exp-reference layout as two rows', () => {
  assert.ok(liveStart >= 0, 'the exp-reference page is the rendered one');
  assert.ok(liveEnd > liveStart, 'and it is the return that comes first');
  assert.equal(rowStarts.length, 2, 'Basic Details is two rows');
});

test('Date, Expense Type and Paid To share the top row', () => {
  const top = rows[0];
  assert.ok(top.includes('className="exp-reference-grid exp-reference-top"'), 'the top row is the three-track grid');
  assert.ok(top.includes('<span>Date <b>*</b></span>'), 'Date leads it');
  assert.ok(top.includes('<span>Expense Type <b>*</b></span>'), 'Expense Type follows');
  assert.ok(top.includes('<span>Paid To</span>'), 'and Paid To closes it');
  assert.ok(!top.includes('exp-amount'), 'Amount is not in the top row');
  assert.equal((top.match(/<label/g) || []).length, 3, 'and the row holds exactly three fields');
});

test('Amount, the Paid Via picker and Payment Account share the second row', () => {
  const second = rows[1];
  assert.ok(second.includes('className="exp-reference-payment"'), 'the row is the shared two-column row');
  assert.ok(second.includes('<label className="exp-amount">'), 'Amount is its first field');
  assert.ok(second.includes('<div className="exp-method-picker"><span>Paid Via <b>*</b></span>'), 'the Cash/Bank picker is its second');
  assert.ok(second.includes('<span>Payment Account <b>*</b></span>'), 'and Payment Account is its third');
  assert.equal((second.match(/<label/g) || []).length, 2, 'so two labels sit beside the picker');
  assert.equal(rows[2], undefined, 'and no row is left holding the payment account alone');
});

test('both rows are three tracks wide and fold on a narrow viewport', () => {
  assert.ok(css.includes('.exp-reference-page .exp-reference-top,\n.exp-reference-page .exp-reference-payment{grid-template-columns:repeat(3,minmax(0,1fr))}'), 'the third track is stated for both rows, above the shared row rule');
  assert.ok(css.includes('@media(max-width:1024px){\n  .exp-reference-page .exp-reference-top,\n  .exp-reference-page .exp-reference-payment{grid-template-columns:repeat(2,minmax(0,1fr))}\n}'), 'and steps back to two before the three fields squeeze');
  assert.ok(css.includes('@media(max-width:760px){\n  .exp-reference-page .exp-reference-top,\n  .exp-reference-page .exp-reference-payment{grid-template-columns:1fr}\n}'), 'and to one column at the shared fold');
});

test('the shared two-column row rule is still the untouched base', () => {
  assert.ok(css.includes('.exp-reference-grid,.exp-reference-payment{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 24px;margin-top:16px}'), 'the shared row rule still states two columns and its own spacing');
  assert.equal((css.match(/\.exp-reference-page \.exp-reference-payment\{grid-template-columns/g) || []).length, 3, 'the page-scoped override appears once per breakpoint and nowhere else');
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
