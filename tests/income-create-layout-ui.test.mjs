import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/* The operator asked on 2026-10-16 for the Record Income page's sections to be merged into one, and
   named the ten inputs the page should ask for: Date Received, Received From, Income For, Amount
   Received, Received In, Payment Method, Tax, Reference No., Notes and Attachment. The page used to
   split the form in two - a Basic Details card holding Date, Income Type and Amount, and a More
   Details block, closed by default, holding the tax rate, the reference, the notes and the
   attachments. Both are gone: the card the operator already reads now carries every field, and the
   page has nothing left to open before it can be read. Two of the old controls are folded rather than
   dropped, because the record still keeps what they said: the Have you received the income? switch
   and the Cash/Bank picker became the options of the ONE Received In dropdown, which offers the
   accounts the money could have landed in and a -- Not yet received -- entry for the money that has
   not arrived. A second pass on the same day took the card's "Income Details" heading, and the
   sentence under it, away, and moved the one input the operator's list does not name - the Link to
   Sales Invoice select the register's Income No./Inv No. column reads the number back out of - up
   beside the amount it is paid against, renamed Invoice. A third pass gave that select's workflow a
   body: choosing Payment for Existing Invoices draws the allocation table under the amount, so the
   the invoice link steps aside while the table is what is choosing invoices. A fourth pass, later the
   same day, answered the operator's last two instructions: the GST Information card was taken off the
   page, and the allocation card was redrawn as the Payment Received page's own Unpaid invoices section
   - the same heading, subtitle, six columns, empty sentence and Allocated / Received line - in the place
   the old card held, directly under the amount it is spread over. Nothing about the split changed: the
   FIFO arithmetic, the editable Payment cell, the Auto Allocate button, the manual-row mark and the
   advance opt-in are the module's, and the transfer to the receipt engine is untouched. A fifth pass
   removed the last thing on the page that called this a receipt: the `Receipt {documentNumber}` chip
   that sat beside the page title on a settlement. The operator own words were that this is not a
   receipt, just income they enter by hand and the accounts follow, so the chip, the value that only
   fed it and its stylesheet rule are all gone - the number a settlement is filed under is still
   minted and stored by the receipt engine, it is simply not stated here.
   A sixth pass, on the same instruction, put the payer's invoices where the payer is named: an Income For
   picker nobody has answered follows the payer into the workflow their money belongs to, so choosing a
   customer who still owes on an invoice opens the settlement table that previous pass drew, with the
   invoices listed and their payments editable, instead of holding the table behind a second choice. A
   workflow the operator has chosen is never overwritten by a payer chosen after it.
   A ninth pass, still the same day, took the last two things the operator read as wrong. The
   "Hold Rs X as a customer advance" opt-in went, with its checkbox, its liability sentence and its
   three stylesheet rules: this page posts no advance, and the money left over is now stated as the
   one thing that clears it - spread the amount received over the invoices above. The notes and the
   attachment, which each held a row of the card full width, now share one row; and the Reference
   No. box carries the document that proves it, a paperclip Attach sharing the same box as the
   number rather than a second control further down the card.
   A tenth pass, later the same day, answered the operator's last two instructions: the footer under
   this form stopped restating the allocation arithmetic, so a settlement now prints the one figure
   that arrived, and the tax the money carries - inclusive or exclusive - moved onto a row of its
   own directly above the reference number, drawn for the workflows that recognise new income and
   never for the one that settles an invoice.
   An eleventh pass read that row live and corrected the one question it could not honestly ask: by
   the time the money has arrived the amount received IS the gross, so the engine takes the tax out
   of it whatever the picker was set to - which left a picker claiming the GST is charged on top of
   the income sitting directly above the row's own sentence saying the opposite. The calculation is a
   picker only while the money is still awaited, where it decides the posting, and a stated field in
   the same field shape once the money has landed.
   A twelfth pass, on the operator's next instruction, took one thing off the page and put another on
   it. The subtitle under the title - "Record money received by your business" - is gone, so the head
   states the page alone; and the Unpaid invoices table, which was simply empty for a payer who owes
   nothing, now holds three sample rows, because the distribution that section exists to show is not
   something a blank table can demonstrate. The samples stand in only while the payer genuinely owes
   nothing in the book, are numbered apart from its own series, are marked on every row, and are
   refused by the save path: a distribution shown for a walkthrough is not a receivable the book holds.
   A thirteenth pass answered the operator's next instruction: Received In is the only question the
   destination asks, and it is one dropdown with a Cash entry and a Bank group holding every bank
   account - the Payment Method picker beside it is gone, because the account already states whether
   the money was cash or bank. The Reference No. box moved up beside Received In, where the number
   belongs to the account the money reached.
   CreateIncomePage carries two returns and only the first one - the inc-reference page - is
   reachable, so these tests read that block. */
/* Both files are normalised to LF first: they are checked out with CRLF on Windows and the
   multi-line assertions below read exact rule text, which must not depend on the checkout's endings. */
const page = readFileSync(new URL('../src/CreateIncomePage.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = readFileSync(new URL('../src/journal-form.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const nav = readFileSync(new URL('../src/Navigation.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const liveStart = page.indexOf('<section className="rt-page itemCreatePage je-create inc-create-page inc-reference-page">');
const liveEnd = page.indexOf('<section className="rt-page itemCreatePage je-create inc-create-page"');
const live = page.slice(liveStart, liveEnd);

const gridStart = live.indexOf('<div className="inc-reference-grid">');
/* The grid holds the allocation block now, which carries divs of its own, so the row is read up to
   the card's closing tag: stopping at the first </div> would cut the form off above Notes. */
const grid = live.slice(gridStart, live.indexOf('</section>', gridStart));

/* The ten labels the operator listed, in the order they listed them. */
const RECOMMENDED = [
  '<span>Date Received <b>*</b></span>',
  '<span>Received From <b>*</b></span>',
  '<span>Income For <b>*</b></span>',
  '<span>Amount Received (₹) <b>*</b></span>',
  '<span>Received In <b>*</b></span>',
  '<span>Reference No.</span>',
  '<span>Notes</span>',
  '<span>Attachment</span>'
];

test('the Record Income page renders the inc-reference layout as its first return', () => {
  assert.ok(liveStart >= 0, 'the inc-reference page is the rendered one');
  assert.ok(liveEnd > liveStart, 'and it is the return that comes first');
  assert.ok(gridStart >= 0 && gridStart < live.length, 'and the one grid sits inside it');
});

test('the whole form is one section, with nothing left to open first', () => {
  assert.equal((live.match(/<section className="inc-reference-card"/g) || []).length, 1, 'one card, not a Basic card and a More Details block');
  assert.equal((live.match(/<div className="inc-reference-grid">/g) || []).length, 1, 'and one grid inside it');
  assert.ok(!live.includes('<details'), 'the closed More Details block is gone');
  assert.ok(!live.includes('inc-more-details'), 'with the block and the rule that skinned it unnamed');
  assert.ok(!live.includes('inc-more-grid'), 'and its own row rule no longer asked for');
  assert.equal((live.match(/<h3>/g) || []).length, 1, 'and carries one heading of its own - the Unpaid invoices one - since the page title above already names the card');
  assert.ok(!live.includes('Income Details'), 'the Income Details heading the operator asked to drop is gone');
  assert.ok(!live.includes('Tell us about the money you received'), 'with the sentence that stood under it');
  assert.ok(live.includes('<section className="inc-reference-card" aria-label="Income details">'), 'so the card is named for a screen reader by its label rather than by a heading that is no longer drawn');
});

test('the nine recommended inputs are asked in one grid, in the operator order', () => {
  for (const label of RECOMMENDED) {
    assert.ok(grid.includes(label), 'the grid asks ' + label.replace(/<\/?span>|<\/?b>|\*/g, '').trim());
  }
  const order = RECOMMENDED.map(label => grid.indexOf(label));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'and asks them in the order the operator listed');
  assert.ok(grid.indexOf('<span>Date Received <b>*</b></span>') < grid.indexOf('<span>Received From <b>*</b></span>'), 'Date Received leads');
  assert.ok(grid.indexOf('<span>Amount Received (₹) <b>*</b></span>') < grid.indexOf('<span>Received In <b>*</b></span>'), 'the account the money reached is asked beside the amount that reached it');
  assert.ok(grid.indexOf('<span>Received In <b>*</b></span>') < grid.indexOf('<div className="inc-allocation inc-unpaid inc-wide-field">'), 'and stands above the table that spreads it, so what arrived and where it landed read as one line of the card');
  assert.ok(!grid.includes('GST Information'), 'the GST Information card the operator asked to remove is gone');
  assert.ok(!grid.includes('The rate and the treatment of the income this money recognises.'), 'and the sentence that stood under that heading, with the three controls it asked for replaced by the tax row the page asks instead');
  assert.ok(!grid.includes('<span>Tax<'), 'so the old Tax picker is not missed either');
  assert.ok(grid.indexOf('<span>Notes</span>') < grid.indexOf('<span>Attachment</span>'), 'and the notes before the files');
  assert.ok(!grid.includes('Income Type'), 'the old Income Type label is renamed Income For');
  assert.ok(!grid.includes('Amount (₹)'), 'and Amount is renamed Amount Received');
});

test('the tax the money carries is asked on a row of its own, and only where it can change the posting', () => {
  assert.ok(live.includes('<div className="inc-tax inc-wide-field" role="group" aria-label="Tax">'), 'the row is a wide field of the same card grid, named for a screen reader without being a label that would swallow the selects inside it');
  assert.ok((grid.split('{!isInvoicePayment && (').length - 1) === 1, 'and it is drawn by the one workflow flag, the way the settlement table is');
  assert.ok(live.includes('<span>GST Treatment</span>'), 'asking the treatment the rest of the book already uses');
  assert.ok(live.includes('{GST_TREATMENT_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}'), 'from that one vocabulary of treatments rather than a second list invented here');
  assert.ok(live.includes("onChange={e => setField('taxTreatment', e.target.value)}"), 'writing the answer the tax module is handed');
  assert.ok(live.includes('{incomeIsTaxable && ('), 'the rate is asked only while the treatment is the taxable one, because an exempt supply has no rate to name');
  assert.ok(live.includes('{gstRates.map(rate => <option key={rate} value={String(rate)}>GST {rate}%</option>)}'), 'offering the rates this book names rather than a slab list of the page own');
  assert.ok(live.includes('{form.gstRate !== \'\' && !gstRates.includes(Number(form.gstRate)) && <option value={form.gstRate}>GST {form.gstRate}%</option>}'), 'and keeping the rate a record was saved with, so reopening one cannot silently move it to another slab');
  assert.ok(live.includes("onChange={e => setField('gstRate', e.target.value)}"), 'which is written back onto the form');
  assert.ok(live.includes('<span>GST Calculation</span>'), 'beside the calculation the settings record defaults');
  assert.ok(live.includes("onChange={e => setField('taxMode', e.target.value)}") && live.includes('{TAX_MODES.map(mode =>'), 'whose answers are the engine own two, mapped rather than retyped');
  assert.ok(live.includes("mode === 'inclusive' ? 'Inclusive - the income already includes its GST'"), 'and spelled out for the operator: inclusive first, because a receipt that has arrived is always read as one');
  assert.ok(live.includes(': <label><span>GST Calculation</span><select value={form.taxMode}'), 'the picker is asked only while the money is still awaited, the one state where its answer can still move the posting');
  assert.ok(live.includes('? <div className="inc-tax-fixed"><span>GST Calculation</span><em>Inclusive - the money received already includes its GST</em></div>'), 'and a receipt that has already landed states the answer instead, because it is its own gross whatever the picker was left on');
  assert.ok(css.includes('.inc-reference-page .inc-tax-fixed{display:grid;gap:7px;min-width:0;color:#162b4e;font-size:13px;font-weight:700}'), 'the stated answer wearing the field shape of the two controls beside it');
  assert.ok(css.includes('.inc-reference-page .inc-tax-fixed>em{display:flex;align-items:center;min-height:44px;'), 'and reading as one field rather than as loose text under a label');
  assert.ok(live.includes('<small className="inc-tax-note">{taxNote}</small>'), 'with one sentence under the row saying what the answer does to the money, rather than leaving the operator to infer it from the bar');
  assert.ok(page.includes('const incomeIsTaxable = form.taxTreatment === TAXABLE_TREATMENT;'), 'the flag read off the treatment the control writes');
  assert.ok(page.includes('This income is not a taxable supply, so no GST is split out of the amount received.'), 'an untaxed supply stated as one');
  assert.ok(page.includes('A taxable income needs the rate this book charges'), 'a taxable supply this book names no rate for stated as the unanswered question it is, never quietly filed as Non-GST');
  assert.ok(page.includes('so the amount received is the gross: its GST is taken out of it'), 'and money that has arrived stated as the gross, because a receipt is never enlarged to carry tax');
  assert.ok(grid.indexOf('<span>Received In <b>*</b></span>') < grid.indexOf('<span>Reference No.</span>'), 'the reference number sits beside the account the money reached');
  assert.ok(grid.indexOf('<span>Reference No.</span>') < grid.indexOf('<div className="inc-tax inc-wide-field"'), 'with the tax row below the reference it used to sit above');
  assert.ok(css.includes('.inc-reference-page .inc-tax{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px 24px'), 'the row reading across three tracks in the page sheet, the shape of the card it sits in');
  assert.ok(css.includes('.inc-reference-page .inc-tax-note{grid-column:1/-1;'), 'with its sentence taking a line of its own under the three controls');
  assert.ok(css.includes('  .inc-reference-page .inc-tax{grid-template-columns:repeat(2,minmax(0,1fr))}'), 'stepping to two tracks where the card does');
  assert.ok(css.includes('  .inc-reference-page .inc-tax{grid-template-columns:1fr}'), 'and to one where the card steps to one');
});

test('Received In is one picker holding the three states the record keeps', () => {
  assert.ok(grid.includes('<label className="inc-account-field"><span>Received In <b>*</b></span>'), 'the account picker is labelled Received In');
  assert.ok(grid.includes('<option value="">-- Not yet received --</option>'), 'offering the money that has not arrived');
  assert.ok(page.includes('const handleReceivedIn = (code) => {'), 'through one handler');
  assert.ok(page.includes('const receivedInOptions = [];'), 'over the accounts the money could have landed in');
  assert.ok(page.includes("const cashInOptions = receivedInOptions.filter(a => a.code === '1000');"), 'split into the one cash answer');
  assert.ok(page.includes("const bankInOptions = receivedInOptions.filter(a => a.code !== '1000');"), 'and the banks the money could have reached');
  assert.ok(grid.includes('<optgroup label="Cash">'), 'the dropdown offers Cash as its own group');
  assert.ok(grid.includes('<optgroup label="Bank">'), 'and Bank as a second group');
  assert.ok(grid.includes("{a.code === '1000' ? 'Cash' : `${a.code} · ${a.name}`}"), 'with the cash box named Cash rather than by its ledger code');
  assert.ok(page.includes('for (const account of [...cashAccounts, ...bankAccounts]) {'), 'cash first, then the bank accounts');
  assert.ok(page.includes("if (receivedInOptions.length === 0) receivedInOptions.push({ code: '1010', name: 'Bank' });"), 'with the bank fallback a book holding no account still needs');
  assert.ok(page.includes("if (!code) {"), 'and the empty option states the money is still owed');
  assert.ok(page.includes("setForm(f => ({ ...f, received: false, paidThrough: '', method: '' }));"), 'clearing the account and the method with it');
  assert.ok(page.includes("paymentType: cash ? 'Cash' : 'Bank',"), 'while an account states which kind it is');
  assert.ok(page.includes("method: cash ? 'Cash' : (kept === 'Cash' ? 'Bank transfer' : kept)"), 'and a bank account pulls the method off Cash');
  assert.ok(!live.includes('inc-method-option'), 'so the Cash/Bank picker is gone');
  assert.ok(!live.includes('inc-received-question'), 'and so is the received switch it answered');
});

test('Received In states the method, so the Payment Method picker is gone', () => {
  assert.ok(!grid.includes('<span>Payment Method <b>*</b></span>'), 'the method is no longer a question of its own');
  assert.ok(!live.includes('Payment Method'), 'with the picker gone from the card');
  assert.ok(grid.includes('<label className="inc-expected-date"><span>Expected date for receiving income <b>*</b></span>'), 'and the awaiting income is asked when it is expected instead');
  assert.ok(page.includes("const receivedMethod = form.received ? (form.paidThrough === '1000' ? 'Cash' : 'Bank transfer') : null;"), 'the account the money reached states the method');
  assert.ok(page.includes('method: receivedMethod,'), 'and both save paths write that answer');
  assert.ok(page.includes("{form.received ? form.paymentType : 'Awaiting receipt'}"), 'and the footer states the awaiting income rather than a stale route');
});

test('the invoice sits with the amount, and the notes and the attachment share one wide row', () => {
  assert.ok(css.includes('.inc-reference-page .inc-reference-grid>.inc-wide-field{grid-column:1/-1}'), 'the wide fields span the row');
  assert.ok(grid.includes('<label className="inc-invoice-field"><span>Invoice</span>'), 'the link the register reads back is renamed Invoice');
  assert.ok(!grid.includes('Link to Sales Invoice (Optional)'), 'with the name it used to carry gone from the page');
  assert.ok(grid.indexOf('<span>Amount Received (₹) <b>*</b></span>') < grid.indexOf('<span>Invoice</span>'), 'and it is asked after the amount it is paid against');
  assert.ok(grid.indexOf('<span>Received In <b>*</b></span>') < grid.indexOf('<span>Invoice</span>'), 'while the account comes first, beside the amount, with the invoice link after that pair');
  assert.ok(!grid.includes('<label className="inc-wide-field"><span>Invoice</span>'), 'so it no longer takes a row of its own');
  assert.ok(grid.includes('<div className="inc-notes-attachment inc-wide-field">'), 'the notes and the files share one wide row rather than one row each');
  assert.ok(grid.includes('<label className="inc-notes-field"><span>Notes</span>'), 'with the notes named first, exactly as the operator listed the pair');
  assert.ok(grid.includes('<div className="inc-attachments"><span>Attachment</span>'), 'and the dropzone beside them rather than under them');
  assert.ok(css.includes('.inc-reference-page .inc-notes-attachment{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 24px}'), 'the pair given two tracks in the page sheet');
  assert.ok(!grid.includes('inc-wide-field inc-notes-field') && !grid.includes('inc-attachments inc-wide-field'), 'so neither field takes a row of its own, which is what the pair replaced');
  assert.ok(!css.includes('.inc-reference-page .inc-account-field{grid-column:1/-1}'), 'while the account field no longer spans the card');
  assert.ok(!css.includes('.inc-reference-page .inc-account-field select{max-width:420px}'), 'with nothing left to cap its select');
});

test('the card keeps its three-track rule and its own folds', () => {
  assert.ok(css.includes('.inc-reference-page .inc-reference-grid{grid-template-columns:repeat(3,minmax(0,1fr))}'), 'the merged grid states the third track');
  assert.ok(css.includes('@media(max-width:1024px){\n  .inc-reference-page .inc-reference-grid{grid-template-columns:repeat(2,minmax(0,1fr))}\n  .inc-reference-page .inc-notes-attachment{grid-template-columns:1fr}\n  .inc-reference-page .inc-tax{grid-template-columns:repeat(2,minmax(0,1fr))}\n}'), 'and steps back to two before the fields squeeze, with the notes, the files and the tax row folding at the same point');
  assert.ok(css.includes('@media(max-width:760px){\n  .inc-reference-page .inc-reference-grid{grid-template-columns:1fr}\n  .inc-reference-page .inc-tax{grid-template-columns:1fr}\n}'), 'and to one column at the shared fold, the tax row with it');
  assert.ok(css.indexOf('.inc-reference-page .inc-reference-grid{grid-template-columns:repeat(3') > css.indexOf('.inc-reference-grid,.inc-reference-payment,.inc-more-grid{display:grid'), 'stated after the shared base rule, so source order alone cannot lose to it');
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

test('the single card keeps a left and right gutter', () => {
  assert.ok(css.includes('.inc-reference-page .inc-reference-content{padding-left:clamp(16px,2.2vw,24px)!important;padding-right:clamp(16px,2.2vw,24px)!important}'), 'the content box insets the card, so it does not run into the nav rail or the window edge');
  assert.ok(css.includes('@media(max-width:600px){\n  .inc-reference-page .inc-reference-content{padding-left:12px!important;padding-right:12px!important}\n}'), 'and it narrows to the phone step instead of keeping the fluid gutter');
  const fullBleedContent = '.inc-reference-page .inc-reference-content{width:100%';
  assert.ok(css.indexOf('.inc-reference-page .inc-reference-content{padding-left:clamp(16px,2.2vw,24px)!important') > css.indexOf(fullBleedContent), 'and it is stated after the full-bleed content rule, so that rule cannot cancel it on source order');
});

test('the header states the page, not a receipt number, and the amount is asked before the table it drives', () => {
  assert.ok(!page.includes('inc-receipt-number'), 'the receipt number the page used to state beside its title is gone: this page records income an operator types, and the number a settlement is filed under is the receipt engine own business');
  assert.ok(!page.includes('documentNumber') && !page.includes('receiptNumberPreview'), 'so the value that only ever fed that chip goes with it instead of being left behind to mislead the next editor');
  assert.ok(!css.includes('inc-receipt-number'), 'and its stylesheet rule with the chip');
  assert.ok(grid.indexOf('<span>Amount Received (₹) <b>*</b></span>') < grid.indexOf('<div className="inc-allocation inc-unpaid inc-wide-field">'), 'and the amount is asked before the invoice section it drives');
});

test('Payment for Existing Invoices is the settlement workflow, chosen in the one Income For picker', () => {
  assert.ok(page.includes('const isInvoicePayment = form.category === INVOICE_PAYMENT_CATEGORY;'), 'the workflow is the category the allocation module knows');
  assert.ok(page.includes('{[INVOICE_PAYMENT_CATEGORY, ...categories.map(c => c.name)].map(name => <option key={name} value={name}>{name}</option>)}'), 'offered first in the picker that otherwise holds the income accounts the chart already keeps');
  assert.ok(page.includes('{isInvoicePayment && ('), 'and the allocation block is drawn for that workflow alone');
  assert.equal((page.match(/disabled={isInvoicePayment}/g) || []).length, 1, 'with the invoice link stepping aside, because the allocation table is what chooses the invoices on a settlement');
  assert.ok(!page.includes('GST already included in invoice amounts.') && !page.includes('Already accounted for in invoices'), 'and no GST block of its own is drawn under the table, because what the invoice already recorded is the whole answer and the card is gone');
});

test('the GST card is gone, and the record states the treatment it used to ask for', () => {
  assert.ok(!live.includes('inc-gst'), 'nothing of the card is drawn any more');
  assert.ok(!live.includes('GST Information') && !live.includes('<span>Tax Calculation</span>'), 'nor the heading it carried, nor the third control name: the questions themselves are asked again by the inline tax row above the reference, which the tax-row test reads');
  assert.equal((live.match(/<span>GST Treatment<\/span>/g) || []).length, 1, 'the treatment asked once in the vocabulary the rest of the book uses, on that row and nowhere else');
  assert.ok(!page.includes('GST already included in invoice amounts.'), 'and the sentence it printed for a settlement goes with it');
  assert.ok(page.includes('const taxTreatmentForTheBook = form.taxTreatment === TAXABLE_TREATMENT && !(Number(form.gstRate) > 0)'), 'a direct income the book names no rate for is read as a supply it has not taxed, rather than as one it has');
  assert.ok(page.includes('const advanceSupplyForTheBook = form.advanceSupply || UNKNOWN_SUPPLY;'), 'and a remainder nobody has classified is held as an unknown future supply - the one state that charges no tax and assumes none');
  assert.ok(page.includes('treatment: taxTreatmentForTheBook,') && page.includes('advanceSupply: advanceSupplyForTheBook,') && page.includes('advanceTaxTreatment: taxTreatmentForTheBook,'), 'both of which are what the record is written with, on either workflow');
  assert.ok(page.includes('? (UNTAXED_TREATMENTS.find(value => /non-gst|out of scope/i.test(value)) || UNTAXED_TREATMENTS[0] || form.taxTreatment)'), 'and the answer is a treatment the tax module already names, never a hardcoded label');
  assert.ok(!page.includes('balanceAfter') && !page.includes('totalOutstanding') && !page.includes('stillOwed'), 'the figures that existed only to be printed inside the replaced card go with it');
  assert.ok(!css.includes('inc-gst') && !css.includes('inc-allocation-stats') && !css.includes('inc-allocation-head') && !css.includes('inc-allocation-totals'), 'and so does its sheet, rather than being left behind to mislead the next editor');
});

test('the allocation table is the receipt page own Unpaid invoices section, inline under the amount', () => {
  assert.ok(grid.includes('<div className="inc-allocation inc-unpaid inc-wide-field">'), 'the section is a wide field of the same grid, immediately below the amount');
  assert.ok(live.includes('<div className="inc-unpaid-head">'), 'and opens on a head of its own');
  assert.ok(live.includes('<h3>Unpaid invoices <small>{samplePayee ?'), 'carrying the heading and the subtitle the Payment Received page prints, word for word');
  assert.ok(live.includes("'Sample rows · nothing can be filed against them' : 'Optional · leave blank to allocate later'"), 'with the subtitle saying which of the two kinds of row stands under it');
  assert.deepEqual([...live.matchAll(/<th>([^<]+)<\/th>/g)].map(m => m[1]), ['Date', 'Invoice number', 'Invoice amount', 'Amount due', 'Withholding tax', 'Payment'], 'and the same six columns that page reads a settlement by, in its order');
  assert.ok(live.includes('openInvoices.map(invoice => {'), 'one row per eligible invoice, the ones FIFO passes over included so a newer invoice can be picked by hand');
  assert.ok(live.includes('<td>{shortDate(invoice.date)}</td>'), 'each row dating itself');
  assert.ok(live.includes('<td className="inc-allocation-invoice" title={`Invoice total'), 'naming the invoice, with its total and its due date kept in the cell title rather than in columns of their own');
  assert.ok(live.includes('<td>{money(invoice.total)}</td>') && live.includes('<td>{money(invoice.outstanding)}</td>'), 'stating what the invoice was raised for and what is due on it');
  assert.ok(live.includes("? money(Math.round(Number(invoice.withholdingTax) * 100)) : '—'"), 'with the withholding tax beside it, or a dash where there is none');
  assert.ok(live.includes('onChange={e => handleAllocateChange(invoice.id, e.target.value)}'), 'and the payment editable in the row');
  assert.ok(live.includes('<input className="receiptAmount" type="number"') && live.includes('aria-label={`Payment for ${invoice.number}`}'), 'in the same sized box the receipt page uses, named for the invoice it pays');
  assert.ok(live.includes('{changed && <em className="inc-allocation-manual">manual</em>}'), 'and a quiet mark on the row a keystroke is keeping');
  assert.ok(live.includes('onClick={resetToFifo} title="Spread the amount received over the oldest invoices again"><IconRefresh size={15} />Auto Allocate</button>'), 'beside the action that hands the split back to FIFO, named the way the operator asked for it');
  assert.ok(live.includes('No outstanding invoices for this customer.</p>'), 'the empty state is that page own sentence, not a second wording of it');
  assert.ok(live.includes('<p className="inc-allocation-line">Allocated: {money(allocation.allocated)} · Received: {money(allocation.received)}</p>'), 'and the section closes on the same Allocated / Received line');
  assert.ok(live.includes('Allocate the remaining {money(checkedAllocation.unallocated)} across the invoices above'), 'with the remainder stated as the one thing that clears it, because this page holds no advance');
  assert.ok(page.includes('const payerInvoices = form.customerId'), 'the invoices the table reads are the payer the operator chose');
  assert.ok(page.includes('const samplePayee = isInvoicePayment && Boolean(form.customerId) && payerInvoices.length === 0;'), 'and the rows are the payer own, or the samples that stand in while they owe nothing');
  assert.ok(page.includes("? eligibleInvoices(accounts, { customerId: form.customerId, branchId: branch?.id || '', organisationId: company?.id || '' })"), 'and is filled from the payer, the branch and the organisation the form is working in');
  assert.ok(css.includes('.inc-reference-page .inc-unpaid .inc-allocation-table td:nth-child(6){width:23%;text-align:right}'), 'the page sheet gives each of the six columns a fixed share, the payment box among them');
  assert.ok(css.includes('.inc-reference-page .inc-unpaid .inc-allocation-table td:nth-child(n+3) input[type="number"]{margin-left:auto}'), 'so a figure sits under its own heading instead of drifting');
  assert.ok(css.includes('.inc-reference-page .inc-unpaid-head h3 small{display:block'), 'and states the section heading and its subtitle');
});

test('a new payer, or a new workflow, drops the allocations it inherited', () => {
  assert.ok(page.includes('const handleCustomerSelect = (customerObj) => {'), 'the payer is chosen in one handler');
  assert.ok(page.includes('allocations: {},'), 'which clears the split the previous payer had chosen');
  assert.ok(page.includes('allocationManual: false,'), 'and hands the remainder back to FIFO');
  assert.ok(page.includes('const handleCategoryChange = (categoryName) => {'), 'and so is the workflow');
  assert.ok(page.includes('...(wasSettlement === isSettlement ? {} : { allocations: {}, allocationManual: false, advance: false })'), 'whose change drops the split only when it crosses between settlement and income, so an unrelated edit does not lose it');
  assert.ok(page.includes('const resetToFifo = () => {'), 'with Auto Allocate the only other way back');
  assert.ok(!page.includes('chooseAdvance'), 'and no advance opt-in left to inherit or drop, because the ninth pass took the checkbox off the page');
  assert.ok(!live.includes('inc-allocation-choice'), 'so a new payer or a new workflow has only the split to clear, never a held remainder as well');
});

test('naming a payer who owes money opens the invoices they owe, without a second choice', () => {
  assert.ok(page.includes('const owes = customerObj'), 'the payer is read for what they still owe as they are chosen');
  assert.ok(page.includes("? eligibleInvoices(accounts, { customerId: customerObj.id, branchId: branch?.id || '', organisationId: company?.id || '' }).length > 0"), 'through the same eligible-invoice read the table itself is filled from, so the two can never disagree');
  assert.ok(page.includes('const chosen = f.categoryChosen;'), 'and the workflow follows them only while the Income For picker has not been answered');
  assert.ok(page.includes('const category = chosen ? f.category : (owes ? INVOICE_PAYMENT_CATEGORY : DEFAULT_INCOME_CATEGORY);'), 'a payer who owes money opening the settlement workflow, anybody else the plain income one');
  assert.ok(page.includes("const DEFAULT_INCOME_CATEGORY = 'Service Income';") && page.includes("const DEFAULT_INCOME_ACCOUNT = '4100';"), 'with that plain workflow named once rather than spelled into the form state');
  assert.ok(page.includes("account: matched ? matched.account : settlement ? '1100' : chosen ? f.account : DEFAULT_INCOME_ACCOUNT,"), 'and the account moving with the workflow the way the picker moves it');
  assert.ok(page.includes('categoryChosen: false, /*') && page.includes('categoryChosen: true, /* a saved record'), 'the flag opening on a fresh form and closing on a record whose picker was already answered');
  assert.ok(page.includes('category: DEFAULT_INCOME_CATEGORY,\n  account: DEFAULT_INCOME_ACCOUNT,'), 'so the blank form starts where the untouched picker would leave it');
  assert.ok(page.includes('const openInvoices = !isInvoicePayment'), 'and the table itself is still drawn by the one workflow flag, so the payer only ever opens the workflow that settles what they owe');
  assert.ok(page.includes('? sampleOutstandingInvoices(form.customerId, form.receivedFrom)'), 'with the samples standing in only inside that settlement workflow');
});

test('the footer states the money that arrived and nothing else, and still never covers a field', () => {
  assert.ok(live.includes('<div className="inc-footer-summary" aria-live="polite">'), 'the bar is one summary for every workflow, so a receipt reads like any other income');
  const footer = live.slice(live.indexOf('<footer className="inc-footer">'));
  for (const label of ['Amount received', 'Customer advance']) {
    assert.ok(footer.includes(label), 'and states ' + label);
  }
  for (const gone of ['Allocated to invoices', 'Unallocated', 'Additional GST on existing invoices', 'Total accounted for']) {
    assert.ok(!footer.includes(gone), 'while ' + gone + ' is no longer printed there: the table above states what the money settled and the invoice already states the tax it carried');
  }
  assert.ok(!page.includes('is-short'), 'with the flag that coloured an unallocated remainder removed along with the figure it coloured');
  assert.ok(!css.includes('is-allocation') && !css.includes('is-short'), 'and its rules taken off the sheet rather than left behind to mislead the next editor');
  assert.ok(css.includes('.inc-reference-page .inc-footer-summary{display:flex;flex-wrap:wrap;align-items:flex-end;gap:4px 22px'), 'the one summary reading across a line, so no figure is printed on top of its own label');
  assert.ok(css.includes('.inc-reference-page .inc-footer-summary>span{display:grid;gap:1px;min-width:0}'), 'each figure staying a label over its own value');
  assert.ok(css.includes('.inc-reference-page .inc-reference-content {\n  padding-bottom: var(--inc-bar-tail, 140px) !important;\n}'), 'while the content box keeps a tail that clears the pinned bar, so the Attachment dropzone is never left behind it');
  assert.ok(page.includes("content.style.setProperty('--inc-bar-tail', `${bar.offsetHeight + 24}px`)"), 'measured off the bar itself rather than guessed, because the summary wraps into a taller bar at narrower widths and again when the advance tiles join the row');
  assert.ok(page.includes('const observer = new ResizeObserver(sync);') && page.includes('observer.observe(bar);'), 'and re-measured whenever the bar changes height, so a wrapped figure never hides the last field');
  assert.ok(page.includes("content?.parentElement?.querySelector('.inc-footer')"), 'the bar read through the composer it belongs to rather than through the document');
  assert.ok(css.indexOf('.inc-reference-page .inc-reference-content {\n  padding-bottom:') > css.indexOf('.inc-reference-page .inc-reference-content{width:100%'), 'stated after the full-bleed content rule that zeroes its padding, so source order alone decides it: the 86px tail declared on the page before this never took effect, because the shared .inc-create-page rule asks for 32px and outranked the bare .inc-reference-page selector');
});

test('a payer who owes money is stated on the income workflow too, with the one click that settles it', () => {
  assert.ok(page.includes('{!isInvoicePayment && form.customerId && payerInvoices.length > 0 && ('), 'a direct income names the payer debt instead of hiding it');
  assert.ok(live.includes('still owes {money(payerInvoices.reduce((total, invoice) => total + (invoice.outstanding || 0), 0))}'), 'stating what that payer still owes');
  assert.ok(live.includes('onClick={() => handleCategoryChange(INVOICE_PAYMENT_CATEGORY)}>Settle these invoices</button>'), 'and offering the switch to the workflow that settles it rather than making the change behind the operator back');
  assert.ok(css.includes('.inc-reference-page .inc-owed-note,.inc-reference-page .inc-sample-note{display:flex'), 'styled as one line in the page sheet, the sample note wearing the same row');
  assert.ok(page.indexOf('{isInvoicePayment && (') < page.indexOf('{!isInvoicePayment && form.customerId'), 'and the settlement table still comes first on the page');
});

test('a settlement posts through the receipt engine, never through an income entry of its own', () => {
  assert.ok(page.includes('if (settlement) {'), 'the submit path splits on the decision it resolved, so a payer who owes nothing reaches the income half rather than a refusal');
  assert.ok(page.includes('const out = saveInvoiceReceipt({'), 'and the settlement half hands the whole thing to the receipt workflow');
  assert.ok(page.includes("import { eligibleInvoices, saveInvoiceReceipt } from './income-receipts.js';"), 'through the one module that bridges to the receipt engine, with the advance-ledger read the ninth pass took off removed from the import');
  assert.ok(page.includes('allocations: samplePayee ? [] : allocationRowsFor(openInvoices, allocationAmounts),'), 'carrying the split the table is showing, never a recomputed one, and never a sample row');
  assert.ok(page.includes('advance: requestedAdvance,'), 'and the advance the operator has to opt into');
  assert.ok(page.includes('idempotencyKey = useRef(') && page.includes('if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();'), 'with one idempotency key held for the life of the form, so a retry cannot post the same receipt twice');
  assert.ok(!page.includes('createReceiptIncome'), 'and the register row is filed inside that workflow rather than by the page');
});

/* The sixth pass fixed the one control that could not be used, and the ninth pass removed it: the
   advance opt-in row carried a sentence that asked for the whole row without the row ever being
   told it could wrap, so the sentence took that width off the label instead - "Hold Rs 490.00 as a
   customer advance" broke over two lines beside a sentence that stayed on one. The row, its
   checkbox and its three rules are gone now, because this page posts no advance, and the test that
   read the wrap is replaced by one that reads the removal. The ninth pass left the second fix of
   the sixth pass in place and the test after this one still reads it: a save that failed stated its
   reason above the card while the actions that failed sit pinned to the foot of the window, so at a
   640px window scrolled to the end the message was printed 90px above the viewport and the press
   read as though it had done nothing at all. */
test('the customer advance opt-in is gone, because this page posts no advance', () => {
  assert.ok(!live.includes('inc-allocation-choice'), 'the opt-in row is not drawn any more');
  assert.ok(!live.includes('<small>Recorded as a liability until it is applied to an invoice, never as income.</small>'), 'nor is the sentence that promised the liability');
  assert.ok(!page.includes('chooseAdvance'), 'with the handler that set it gone');
  assert.ok(!page.includes('const advanceAccount') && !page.includes('advanceLedger('), 'and the ledger read that only fed it, so nothing on the page reaches for an advance account');
  assert.ok(!css.includes('inc-allocation-choice'), 'and its stylesheet rules taken out rather than left behind to mislead the next editor');
  assert.ok(page.includes('advance: requestedAdvance,'), 'while the engine still receives the field, so the settlement path keeps posting an advance of zero rather than a missing value');
});

test('a save that fails says so where the operator is standing', () => {
  assert.ok(page.includes('role="alert"'), 'the banner is announced rather than waiting to be found');
  assert.ok(page.includes('tabIndex={-1} ref={errorRef}'), 'and focusable, which is how the page puts the operator on it');
  assert.ok(page.includes('const errorRef = useRef(null);'), 'through one ref the banner owns');
  assert.ok(page.includes("if (!error || !banner) return;"), 'the page leaving the view alone while there is nothing to state');
  assert.ok(page.includes("banner.scrollIntoView({ block: 'center' })"), 'a failure brings the message back into view, wherever the window was scrolled to');
  assert.ok(page.includes("banner.focus({ preventScroll: true })"), 'and moves focus to it, so a screen reader reads it and the keyboard lands on the reason rather than on the button that failed');
  assert.ok(page.indexOf('banner.scrollIntoView') < page.indexOf('banner.focus'), 'the scroll stated before the focus, because the focus is told not to move the view itself');
  assert.ok(page.includes('}, [error]);'), 'and only when the message itself changes');
});

/* The seventh pass fixed the one control on this page that could not be used: the payer picker.
   Received From wrapped its picker in a <label>, and a label forwards every click inside it to
   its own labelled control - which here is the picker's own button. So choosing a payer ran the
   option's handler, which closes the panel, and then the forwarded click toggled that button and
   opened it again: the panel stayed on screen over the very invoices the money is being spread
   across, and a click on the field's own heading opened it too. The field is a plain group now,
   so no click is forwarded anywhere. */
test('the payer picker is not wrapped in a label, because a label re-opens it on every choice', () => {
  assert.ok(live.includes('<div className="inc-customer-field" role="group" aria-label="Received From">'), 'the field is a group that names itself, not a label that activates the picker');
  assert.ok(!live.includes('<label className="inc-customer-field">'), 'with the label that forwarded its clicks to the picker gone');
  assert.ok(css.includes('.inc-reference-page label,.inc-reference-page .inc-customer-field,.inc-reference-page .inc-reference-field,.inc-method-picker{display:grid;gap:7px;'), 'while the field keeps the look every other field on the card has, the reference group the ninth pass made a group among them');
  assert.ok(css.includes('.inc-reference-page label>span,.inc-reference-page .inc-customer-field>span,.inc-reference-page .inc-reference-field>span,.inc-method-picker>span{line-height:1.25}'), 'including its heading');
  assert.ok(css.includes('.inc-reference-page label b,.inc-reference-page .inc-customer-field b,.inc-reference-page .inc-reference-field b,.inc-method-picker b{color:#e54861}'), 'and the required mark that heading carries');
});

/* The ninth pass gave the Reference No. box the document that proves it. An operator holding a
   cheque or a UTR slip types the number and attaches the slip in the same box, rather than typing
   it here and hunting for the Attachment row further down the card. The field is a group rather
   than a <label>, because a label forwards a click on the paperclip to the text input it wraps -
   the same fault the payer picker carried before the seventh pass. */
test('the Reference No. box carries its own attach control, in the field with the number', () => {
  assert.ok(live.includes('<div className="inc-reference-field" role="group" aria-label="Reference No."><span>Reference No.</span>'), 'the field names itself as a group, so a click on the attach control is not forwarded to the number');
  assert.ok(!live.includes('<label className="inc-wide-field"><span>Reference No.</span>'), 'and it no longer takes a row of its own, which is what it held before the ninth pass');
  assert.ok(live.includes('<div className="inc-reference-input">'), 'the number and the control share one box');
  assert.ok(live.includes('<label className="inc-reference-attach" title="Attach the document the reference number comes from'), 'the attach control states what it is for rather than leaving an unlabelled paperclip');
  assert.ok(live.includes('<IconPaperclip size={15} /><span>Attach</span><input type="file" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} /></label>'), 'and feeds the same upload handler the Attachment dropzone below uses, so the chosen file lands in the one list');
  assert.ok(css.includes('.inc-reference-page .inc-reference-input {') && css.includes('align-items: center;'), 'the box is stated as a flex row in the page sheet');
  assert.ok(css.includes('.inc-reference-page .inc-reference-input:focus-within {'), 'with the focus ring on the box rather than on the borderless input inside it');
  assert.ok(css.includes('.inc-reference-page .inc-reference-input > input {'), 'with the number filling the room the control leaves');
  assert.ok(css.includes('.inc-reference-page .inc-reference-attach > input {'), 'and the control own file input hidden rather than drawn beside the paperclip');
});

/* The eighth pass shortened the two things the Invoice picker can say. A select states its text on
   one line inside a box one track wide, so the sentence this field read out was cut off mid-word:
   the operator saw "-- Settled by the unpaid invoices belo..." where a workflow was meant to be
   named. The ninth pass shortened the settlement answer again, to "-- Settled by the table below --",
   because the two fields this box sits beside now hold the notes and the files that name the money
   too. Both answers fit the box, and this is the bound that keeps them fitting. */
test('the Invoice picker states itself in answers short enough for its own box', () => {
  const start = page.indexOf('const invoiceFieldPlaceholder');
  const block = page.slice(start, page.indexOf('const invoiceFieldTitle', start));
  const answers = block.match(/'--[^']*--'/g) || [];
  assert.equal(answers.length, 2, 'the field offers one empty answer per workflow');
  answers.forEach(answer => assert.ok(answer.length <= 36, answer + ' is ' + answer.length + ' characters, short enough to read whole in the field'));
  assert.ok(block.includes("'-- Settled by the table below --'"), 'and the settlement answer still says where the invoices are chosen');
  assert.ok(block.includes("'-- Not linked to an invoice --'"), 'while direct income still says the link is not being made');
});

/* The operator asked, on 2026-10-16, for two things on this page: the subtitle under the title to go,
   and the Unpaid invoices table to show sample invoices for the payer selected - for a demonstration,
   so that the distribution the section exists to show is never a blank table. The samples stand in
   only while the payer genuinely owes nothing, they say so on every row, and the save path refuses
   them: a distribution shown for a walkthrough is not a receivable. */
test('the head states the page alone, and a payer who owes nothing is shown the sample table', () => {
  assert.ok(!page.includes('Record money received by your business'), 'the subtitle under the page title is gone, as the operator asked');
  assert.ok(!css.includes('inc-page-subtitle'), 'and its stylesheet rule with it, rather than left behind to mislead the next editor');
  const headStart = page.indexOf('<div className="itemHeadText">');
  const headBlock = page.slice(headStart, page.indexOf('</div>', headStart));
  assert.ok(headBlock.includes('<h2 id="incomeDialogTitle">') && !headBlock.includes('<p'), 'so the head states the page and nothing else');
  assert.ok(page.includes('const samplePayee = isInvoicePayment && Boolean(form.customerId) && payerInvoices.length === 0;'), 'the samples stand in exactly while the payer the operator named owes nothing in this book');
  assert.ok(page.includes('? sampleOutstandingInvoices(form.customerId, form.receivedFrom)'), 'and are bound to that payer, so a sample row can never stand for somebody else');
  assert.ok(page.includes('isSampleInvoice, money, paise,'), 'read from the allocation module that shapes them, rather than a second list invented on the page');
  const sampleMark = '{isSampleInvoice(invoice) && <em className="inc-allocation-sample">Sample</em>}';
  assert.equal(live.split(sampleMark).length - 1, 1, 'and every sample row marked on the row itself');
  assert.ok(page.includes('{samplePayee && ('), 'and a payer who owes nothing is told so where the samples are');
  assert.ok(page.includes('onClick={() => switchToIncome()}>Record as {DEFAULT_INCOME_CATEGORY}</button>'), 'with the one click that switches the form to the income workflow that can file the money');
  assert.ok(page.includes('const switchToIncome = () => {'), 'which resolves the account out of the chart of accounts rather than leaving the settlement account on a direct income');
  assert.ok(page.includes("if (settlement && samplePayee && targetStatus !== 'Draft') {"), 'while the save path asks before it changes the workflow the operator chose, and only a posted record can be filed');
  assert.ok(page.includes('window.confirm(`'), 'stating in the question what is about to be filed and as what');
  assert.ok(!page.includes('This payer owes nothing in the book, so the rows above are samples'), 'the dead-end refusal the operator was left standing in is gone');
  assert.ok(page.includes('allocations: samplePayee ? [] : allocationRowsFor(openInvoices, allocationAmounts),'), 'and a sample row is never written into a record, so a distribution shown for a walkthrough can still not be filed as a receivable');
  assert.ok(css.includes('.inc-reference-page .inc-allocation-sample{display:block'), 'and the sheet gives the mark the same quiet line the manual one wears');
});

/* A keystroke reorganises the split instead of freezing it: the row the operator types keeps what
   they typed and every other row is re-spread over the money that is left, so a hand-typed amount
   can never leave the table over-allocated - the state the operator sent a screenshot of, where a
   typed Rs 1,500 sat on top of the Rs 15,623 that had actually arrived. */
test('a keystroke keeps the row it was typed on and re-spreads every other row', () => {
  assert.ok(page.includes('rebalanceAllocation, rupeeString'), 'the page imports the rebalance from the allocation module rather than doing the arithmetic itself');
  assert.ok(page.includes('const spread = rebalanceAllocation({ amount: form.amount, invoices: openInvoices, pinned: form.allocationManual ? form.allocations : {} });'), 'and reads the whole table through it, pinned by the rows the operator typed');
  assert.ok(page.includes('const allocationAmounts = spread.amounts;'), 'so the cells, the validation and the payload all come off one answer');
  assert.ok(page.includes('allocations: { [invoiceId]: value }'), 'editing a row pins THAT row alone');
  assert.ok(!page.includes('{ ...allocationAmounts, [invoiceId]: value }'), 'instead of snapshotting the whole table the way it used to, which is what let a typed amount stack on top of the money received');
  assert.ok(!page.includes('safePaise'), 'and the half-typed read the page used to keep is gone with it, because the module holds that one rule now');
  assert.ok(page.includes('const changed = form.allocationManual && form.allocations[invoice.id] !== undefined;'), 'the quiet mark states the row a keystroke is keeping, not every row that moved');
  assert.ok(page.includes('{changed && <em className="inc-allocation-manual">manual</em>}'), 'and it is the same mark the row already wore');
  assert.ok(page.includes('const pinnedRow = form.allocationManual'), 'the one row that was kept is read once');
  assert.ok(page.includes('{pinnedRow.number} keeps your {money(pinnedAmount)}.'), 'so the line under the table can name it and the figure it holds');
  assert.ok(page.includes("? 'The difference comes off the other invoices' : 'The money you freed goes to the other invoices'"), 'saying which way the difference went, because the whole amount received is what gets allocated');
  assert.ok(page.includes('{pinnedRow && ('), 'and the line is drawn only while a row is actually pinned');
  assert.ok(css.includes('.inc-reference-page .inc-allocation-note{display:block'), 'styled as one quiet line in the page sheet');
});
