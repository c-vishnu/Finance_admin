import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, command} from '../src/invoice-engine.js';
import {
  ALLOCATION_RESIDUE, INVOICE_PAYMENT_CATEGORY, allocationSummary, balanceAfter, effectiveDueDate,
  fifoAllocation, fifoOrder, isSampleInvoice, money, outstandingInvoices, paise, rebalanceAllocation,
  rupeeString, sampleOutstandingInvoices, validateAllocation
} from '../src/income-allocation.js';

/* The FIFO allocation is a pure function, so it is tested as one: every case below states the
   invoices, the money received, and the exact split the operator asked for - the example they wrote
   out, the manual override they then typed, the boundary amounts (smaller than the first invoice,
   equal to the whole book, larger than everything owed), zero and negative money, and the rules that
   must be refused before anything is stored. Amounts are paise throughout, which is what makes "no
   floating-point arithmetic" checkable rather than a claim. */

const invoice = (id, date, dueDate, outstanding, number = id) => ({id, number, date, dueDate, outstanding});

/* The operator's example: Rs 13,000 against Rs 5,000, Rs 10,000 and Rs 8,000 of outstanding. */
const specInvoices = () => [
  invoice('inv-1', '2026-09-01', '2026-09-10', 500000, 'INV-001'),
  invoice('inv-2', '2026-09-02', '2026-09-20', 1000000, 'INV-002'),
  invoice('inv-3', '2026-09-03', '2026-10-05', 800000, 'INV-003')
];

test('FIFO fills the oldest invoice first and leaves the newest untouched', () => {
  const result = fifoAllocation({amount: '13000', invoices: specInvoices()});
  assert.deepEqual(result.allocations, [{invoiceId: 'inv-1', amount: 500000}, {invoiceId: 'inv-2', amount: 800000}]);
  assert.equal(result.allocated, 1300000, 'Rs 13,000 is allocated in total');
  assert.equal(result.unallocated, 0, 'and nothing is left over');
  assert.equal(result.rows.length, 3, 'every eligible invoice is reported, the skipped one included');
  assert.equal(result.rows[2].amount, 0, 'INV-003 received nothing');
  assert.equal(result.rows[2].outstanding, 800000, 'and is still owed its full balance');
});

test('FIFO is the default recommendation, never a forced order', () => {
  /* The operator's own override: INV-001 Rs 3,000, INV-002 Rs 10,000, INV-003 nothing. The stored
     split is the one they typed, not the one FIFO would have produced. */
  const manual = [{invoiceId: 'inv-1', amount: '3000'}, {invoiceId: 'inv-2', amount: '10000'}, {invoiceId: 'inv-3', amount: '0'}];
  const checked = validateAllocation({amount: '13000', rows: manual, invoices: specInvoices()});
  assert.deepEqual(checked.errors, [], 'the manual distribution is valid');
  assert.deepEqual(checked.allocations, [{invoiceId: 'inv-1', amount: 300000}, {invoiceId: 'inv-2', amount: 1000000}]);
  assert.equal(checked.allocated, 1300000);
  assert.equal(checked.unallocated, 0);
  assert.equal(balanceAfter(500000, 300000), 200000, 'INV-001 is left owed Rs 2,000');
  assert.equal(balanceAfter(1000000, 1000000), 0, 'INV-002 is settled');
  assert.equal(balanceAfter(800000, 0), 800000, 'INV-003 is untouched');
  const fifo = fifoAllocation({amount: '13000', invoices: specInvoices()});
  assert.notDeepEqual(checked.allocations, fifo.allocations, 'and it differs from the FIFO suggestion, which is the point of allowing it');
});

test('a payment smaller than the first invoice settles nothing else', () => {
  const result = fifoAllocation({amount: '2500', invoices: specInvoices()});
  assert.deepEqual(result.allocations, [{invoiceId: 'inv-1', amount: 250000}]);
  assert.equal(result.unallocated, 0);
  assert.equal(balanceAfter(500000, 250000), 250000);
});

test('a payment equal to the whole book settles every invoice; a larger one leaves an unallocated remainder', () => {
  const owed = 500000 + 1000000 + 800000;
  const exact = fifoAllocation({amount: '23000', invoices: specInvoices()});
  assert.equal(exact.allocated, owed, 'Rs 23,000 clears the book');
  assert.equal(exact.unallocated, 0);
  assert.deepEqual(exact.rows.map(row => row.amount), [500000, 1000000, 800000]);
  const excess = fifoAllocation({amount: '25000', invoices: specInvoices()});
  assert.equal(excess.allocated, owed, 'no invoice is ever paid more than it is owed');
  assert.equal(excess.unallocated, 200000, 'and Rs 2,000 is reported as unallocated rather than absorbed');
  assert.deepEqual(excess.allocations.map(row => row.amount), [500000, 1000000, 800000]);
});

test('invoices are ordered by due date, then invoice date, then id - and a missing due date falls back to the invoice date', () => {
  const rows = [
    invoice('c', '2026-09-01', '', 100),
    invoice('a', '2026-09-05', '2026-09-08', 100),
    invoice('b', '2026-09-02', '2026-09-08', 100),
    invoice('z', '2026-09-02', '2026-09-08', 100)
  ];
  assert.equal(effectiveDueDate(rows[0]), '2026-09-01', 'an invoice with no due date is due on its own date');
  assert.deepEqual(fifoOrder(rows).map(row => row.id), ['c', 'b', 'z', 'a'], 'due date, then invoice date, then id breaks every tie');
  assert.deepEqual(fifoAllocation({amount: '2', invoices: rows}).rows.map(row => row.invoiceId), ['c', 'b', 'z', 'a'], 'and the algorithm walks that order');
  assert.deepEqual(fifoOrder(rows).map(row => row.id), ['c', 'b', 'z', 'a'], 'sorting does not mutate the caller list');
});

test('an over-allocation, a duplicate, a foreign invoice and bad money are refused with the reason', () => {
  const over = validateAllocation({amount: '13000', rows: [{invoiceId: 'inv-1', amount: '6000'}], invoices: specInvoices()});
  assert.match(over.errors.join(' '), /cannot be larger than that/, 'an allocation above one invoice outstanding is refused');
  assert.deepEqual(over.allocations, [], 'and nothing is kept from a refused row');
  const overTotal = validateAllocation({amount: '500', rows: [{invoiceId: 'inv-1', amount: '300'}, {invoiceId: 'inv-2', amount: '400'}], invoices: specInvoices()});
  assert.match(overTotal.errors.join(' '), /more than the amount received/, 'and so is a total above the money received, even when every row fits its own invoice');
  const duplicate = validateAllocation({amount: '13000', rows: [{invoiceId: 'inv-1', amount: '1000'}, {invoiceId: 'inv-1', amount: '1000'}], invoices: specInvoices()});
  assert.match(duplicate.errors.join(' '), /listed twice/, 'the same invoice cannot be listed twice');
  const foreign = validateAllocation({amount: '13000', rows: [{invoiceId: 'someone-elses', amount: '1000'}], invoices: specInvoices()});
  assert.match(foreign.errors.join(' '), /no longer open for this customer/, 'an invoice outside the eligible set is refused');
  const fractional = validateAllocation({amount: '13000', rows: [{invoiceId: 'inv-1', amount: '10.005'}], invoices: specInvoices()});
  assert.match(fractional.errors.join(' '), /valid amount/, 'a third decimal is not money');
  const negative = validateAllocation({amount: '13000', rows: [{invoiceId: 'inv-1', amount: '-100'}], invoices: specInvoices()});
  assert.match(negative.errors.join(' '), /valid amount/, 'and neither is a negative one');
  assert.equal(paise(''), 0, 'a blank amount is zero, not an error');
  assert.equal(paise('13000.5'), 1300050, 'rupees are read as paise with no float');
  assert.equal(paise(13000), 1300000, 'a number is read the same way as the string the input holds');
  assert.throws(() => paise('-1'), /non-negative/, 'a negative amount is refused by the shared parser');
  assert.throws(() => paise('12x'), /two decimals/, 'and so is anything that is not a number');
  assert.deepEqual(fifoAllocation({amount: '', invoices: specInvoices()}).allocations, [], 'no money allocates nothing');
  assert.deepEqual(fifoAllocation({amount: '0', invoices: specInvoices()}).allocations, []);
  assert.equal(validateAllocation({amount: '0', rows: [{invoiceId: 'inv-1', amount: '0'}], invoices: specInvoices()}).errors.length, 0, 'a row of zero is how an invoice is skipped');
});

test('the summary states what is accounted for and what is not, and advance is never income', () => {
  const nothing = allocationSummary({amount: '13000', allocations: []});
  assert.deepEqual(nothing, {received: 1300000, allocated: 0, advance: 0, unallocated: 1300000, accountedFor: 0, balanced: false});
  const settled = allocationSummary({amount: '13000', allocations: [{amount: 1000000}, {amount: 300000}]});
  assert.equal(settled.balanced, true);
  assert.equal(settled.unallocated, 0);
  const advance = allocationSummary({amount: '13000', allocations: [{amount: 1000000}], advance: 300000});
  assert.equal(advance.balanced, true, 'Rs 10,000 against an invoice plus a Rs 3,000 advance is fully accounted for');
  assert.equal(advance.advance, 300000, 'with the advance stated as its own line rather than as income');
  assert.equal(ALLOCATION_RESIDUE.ADVANCE, 'advance');
  assert.equal(INVOICE_PAYMENT_CATEGORY, 'Payment for Existing Invoices', 'the settlement workflow is named, and is not an income account');
  assert.equal(money(1300000), '₹13,000.00', 'money is written for display and never read back');
});

/* The eligible set is the other half of the algorithm: what FIFO is allowed to see. It is checked
   against a real book built by the invoice engine, so the outstanding balances are the ones
   `outstanding()` resolves, not numbers this test made up. */
function book() {
  let state = initial();
  state.accounts = [['1100', 'Receivables', 'Assets'], ['1010', 'Bank', 'Assets'], ['4100', 'Sales', 'Income'], ['2100', 'GST', 'Liabilities']]
    .map(([code, name, type]) => ({code, name, type, active: true}));
  const add = (date, dueDate, rate, customerId = 'c1') => {
    const out = command(state, 'save', {customerId, customerName: customerId === 'c1' ? 'Customer One' : 'Customer Two', date, dueDate, place: 'Kerala', lines: [{description: 'Service', qty: 1, unit: 'service', rate, discount: 0, tax: '0', cess: 0}]});
    state = command(out.state, 'post', {id: out.result.id}).state;
    return state.invoices.find(row => row.id === out.result.id);
  };
  /* A getter, not a snapshot: every `command` returns a fresh state object, so a captured one goes
     stale the moment the next invoice is written. */
  return {get state() { return state; }, add};
}

test('only the selected customer\'s open, posted, permitted invoices are offered to the allocation', () => {
  const shelf = book();
  const first = shelf.add('2026-09-01', '2026-09-10', '5000');
  const second = shelf.add('2026-09-02', '2026-09-20', '8000');
  shelf.add('2026-09-03', '2026-09-30', '2000', 'c2');
  const cancelled = shelf.add('2026-09-04', '2026-09-25', '4000');
  shelf.state.invoices = shelf.state.invoices.map(row => row.id === cancelled.id ? {...row, status: 'Cancelled'} : row);
  const draft = command(shelf.state, 'save', {customerId: 'c1', customerName: 'Customer One', date: '2026-09-05', dueDate: '2026-10-01', place: 'Kerala', lines: [{description: 'Service', qty: 1, unit: 'service', rate: '1000', discount: 0, tax: '0', cess: 0}]}).state;

  const eligible = outstandingInvoices(draft, {customerId: 'c1'});
  assert.deepEqual(eligible.map(row => row.id), [first.id, second.id], 'the other customer\'s invoice, the cancelled one and the unposted one are all left out');
  assert.equal(eligible[0].outstanding, 500000, 'and the outstanding balance is the engine\'s, not a stored total');
  assert.equal(eligible[0].total, 500000, 'with the invoice total carried beside it for the table');
  assert.deepEqual(outstandingInvoices(draft, {}), [], 'no customer, no invoices');

  /* Paying the first invoice takes it out of the eligible set, so a second receipt is offered only
     what is genuinely still open - which is what makes the frontend preview non-authoritative. */
  const paid = {...draft, payments: [...(draft.payments || []), {id: 'p1', invoiceId: first.id, amount: 500000, date: '2026-09-06'}]};
  assert.deepEqual(outstandingInvoices(paid, {customerId: 'c1'}).map(row => row.id), [second.id], 'a settled invoice is no longer offered');
  const blocked = {...draft, invoices: draft.invoices.map(row => row.id === first.id ? {...row, blockedFromPayment: true} : row)};
  assert.deepEqual(outstandingInvoices(blocked, {customerId: 'c1'}).map(row => row.id), [second.id], 'and an invoice blocked from payment is left out too');
});


/* The book this page is handed is the app's own ledger, and it writes the organisation it belongs to
   under the same key the invoice document uses - organizationId - through the demo seed and the Sales
   module. A scoped read that only understood one spelling would silently offer every organisation's
   invoices, so both spellings are read as the one fact they are. */
test('an organisation is read whichever spelling the document stores it under', () => {
  const shelf = book();
  const mine = shelf.add('2026-09-01', '2026-09-10', '1000');
  const theirs = shelf.add('2026-09-02', '2026-09-11', '2000');
  const scoped = {...shelf.state, invoices: shelf.state.invoices.map(row => row.id === mine.id ? {...row, organizationId: 'abc'} : {...row, organizationId: 'northstar'})};
  assert.deepEqual(outstandingInvoices(scoped, {customerId: 'c1', organisationId: 'abc'}).map(row => row.id), [mine.id], 'the working organisation is the only one offered');
  assert.deepEqual(outstandingInvoices(scoped, {customerId: 'c1', organisationId: 'northstar'}).map(row => row.id), [theirs.id], 'and the other way round, so neither spelling can be walked past');
  const legacy = {...shelf.state, invoices: shelf.state.invoices.map(row => row.id === mine.id ? {...row, organisationId: 'abc'} : {...row, organisation: 'northstar'})};
  assert.deepEqual(outstandingInvoices(legacy, {customerId: 'c1', organisationId: 'northstar'}).map(row => row.id), [theirs.id], 'while the spellings the older documents carry still scope as they always did');
});

/* What the sample rows can be filed against, stated at the engine rather than only on the page.
   The surface no longer refuses the money - a payer who owes nothing is asked whether to file it as
   income instead - so the guarantee has to hold where it matters: a distribution drawn over rows the
   book does not hold can never reach an invoice, because no invoice of the eligible set carries their
   id, and the validator refuses a row whose invoice is not open for this customer. */
test('a sample row can never be posted, because the engine is only ever handed the book\'s own invoices', () => {
  const shelf = book();
  const real = shelf.add('2026-09-01', '2026-09-10', '5000');
  const samples = sampleOutstandingInvoices('c1', 'Customer One');
  const booked = outstandingInvoices(shelf.state, {customerId: 'c1'});
  assert.deepEqual(booked.map(row => row.id), [real.id], 'the book holds one invoice for the customer, and the samples are not it');
  const split = fifoAllocation({amount: '5900', invoices: samples});
  const filed = validateAllocation({amount: '5900', rows: split.allocations, invoices: booked});
  assert.ok(filed.errors.every(error => error.includes('no longer open for this customer')), 'so the split the samples produced is refused row by row: ' + filed.errors.join(' | '));
  assert.deepEqual(filed.allocations, [], 'and nothing is left to store or post against them');
  const honest = validateAllocation({amount: '5000', rows: [{invoiceId: real.id, amount: '5000'}], invoices: booked});
  assert.deepEqual(honest.errors, [], 'while the invoice the book does hold is settled by the same validator without complaint');
});

test('branch and organisation scope keep another branch\'s invoice out of the customer\'s allocation', () => {
  const shelf = book();
  const kochi = shelf.add('2026-09-01', '2026-09-10', '1000');
  shelf.add('2026-09-02', '2026-09-11', '2000');
  const scoped = {...shelf.state, invoices: shelf.state.invoices.map(row => row.id === kochi.id ? {...row, branch: 'kochi'} : {...row, branch: 'trivandrum'})};
  assert.deepEqual(outstandingInvoices(scoped, {customerId: 'c1', branchId: 'kochi'}).map(row => row.id), [kochi.id], 'only the working branch is offered');
  assert.equal(outstandingInvoices(scoped, {customerId: 'c1'}).length, 2, 'with no branch in the working context, both are');
  assert.equal(outstandingInvoices(scoped, {customerId: 'c1', organisationId: 'other-org'}).length, 2, 'an invoice that names no organisation is read as the working one');
  assert.equal(outstandingInvoices(scoped, {customerId: 'c1', currency: 'USD'}).length, 2, 'and one that names no currency likewise');
  const foreign = {...scoped, invoices: scoped.invoices.map(row => ({...row, currency: 'USD'}))};
  assert.deepEqual(outstandingInvoices(foreign, {customerId: 'c1', currency: 'INR'}), [], 'a foreign-currency invoice is not offered');
});

/* The rows the surface falls back to when the payer it is pointed at owes nothing. They exist so a
   demonstration of the distribution is never a blank table, which makes the two promises below the
   ones that matter: they are shaped like the book's own rows so every calculation treats them
   identically, and they are stamped so the surface can refuse to file them. */
test('the sample rows a payer who owes nothing is shown are the book own shape, marked and never fileable', () => {
  const rows = sampleOutstandingInvoices('cus-9', 'Coastal Traders');
  assert.equal(rows.length, 3, 'three rows stand in');
  assert.deepEqual(rows.map(row => row.number), ['INV-S001', 'INV-S002', 'INV-S003'], 'numbered apart from the book own series');
  assert.ok(rows.every(row => row.customerId === 'cus-9' && row.customerName === 'Coastal Traders'), 'each bound to the payer the operator named');
  assert.ok(rows.every(row => isSampleInvoice(row)), 'and each stamped, which is what the surface refuses to file');
  assert.ok(!isSampleInvoice({ id: 'inv-0', number: 'INV-00001', outstanding: 100 }), 'while a row of the book is not');
  assert.deepEqual(rows.map(row => row.outstanding), [590000, 1180000, 944000], 'carrying the amounts the project own worked example uses');
  assert.deepEqual(rows.map(row => row.total), rows.map(row => row.outstanding), 'each owed in full, so the two columns agree');
  assert.deepEqual(rows.map(row => row.dueDate), [...rows.map(row => row.dueDate)].sort(), 'in the FIFO order the table prints them in');
  assert.deepEqual(sampleOutstandingInvoices('', ''), [], 'naming no payer offers nothing at all');

  const split = fifoAllocation({ amount: '13000', invoices: rows });
  assert.deepEqual(split.allocations, [{ invoiceId: rows[0].id, amount: 590000 }, { invoiceId: rows[1].id, amount: 710000 }], 'so Rs 13,000 over them is the split the documentation states');
  assert.equal(split.allocated, 1300000, 'with the whole amount distributed');
  assert.equal(split.unallocated, 0, 'and nothing left over');
  assert.deepEqual(split.rows.map(row => row.amount), [590000, 710000, 0], 'the newest invoice passed over rather than dropped from the table');

  const typed = validateAllocation({ amount: '13000', rows: [{ invoiceId: rows[0].id, amount: '3000' }, { invoiceId: rows[1].id, amount: '10000' }], invoices: rows });
  assert.deepEqual(typed.errors, [], 'and the manual split the operator types is validated against them like any other row');
  assert.equal(typed.allocated, 1300000, 'totalling what was typed');
  assert.equal(typed.unallocated, 0, 'with nothing left over here either');
});

/* The keystroke rule: the row the operator types keeps what they typed and every other row is
   re-spread over the money that is left, oldest first. The operator's own screenshot is the first
   case below - Rs 15,623 received and Rs 1,500 typed onto the newest invoice, where the Rs 1,500 has
   to come off the invoice that was carrying it rather than be stacked on top of the money received. */
test('a hand-typed amount is re-spread around the row it was typed on, never stacked on top of the money', () => {
  const rows = sampleOutstandingInvoices('cus-9', 'Coastal Traders');
  const screenshot = rebalanceAllocation({ amount: '15623', invoices: rows, pinned: { [rows[2].id]: '1500' } });
  assert.deepEqual(screenshot.rows.map(row => row.amount), [590000, 822300, 150000], 'Rs 15,623 with Rs 1,500 typed on the newest invoice');
  assert.equal(screenshot.amounts[rows[2].id], '1500', 'the box keeps exactly the characters that were typed into it');
  assert.equal(screenshot.amounts[rows[1].id], '8223.00', 'while every other row is handed the rupee string the form stores');
  assert.equal(screenshot.allocated, 1562300, 'and the whole amount received is allocated');
  assert.equal(screenshot.unallocated, 0, 'with nothing left over');
  assert.equal(screenshot.overAllocated, 0, 'and nothing stacked on top of the money either');
  assert.equal(fifoAllocation({ amount: '15623', invoices: rows }).rows[1].amount - screenshot.rows[1].amount, 150000, 'because the difference came off the invoice that was carrying it, to the paisa');
  assert.deepEqual(screenshot.pinned, [rows[2].id], 'and the typed row is the only one reported as pinned');

  const untouched = rebalanceAllocation({ amount: '15623', invoices: rows, pinned: {} });
  assert.deepEqual(untouched.rows.map(row => row.amount), [590000, 972300, 0], 'pinning nothing is the FIFO suggestion the table opens on');
  assert.deepEqual(untouched.amounts, { [rows[0].id]: '5900.00', [rows[1].id]: '9723.00', [rows[2].id]: '0.00' }, 'in the form own rupee strings, keyed by invoice');
  assert.deepEqual(rebalanceAllocation({ amount: '15623', invoices: rows }).rows.map(row => row.amount), [590000, 972300, 0], 'and a caller that pins nothing at all reads the same split');
});

test('typing less than FIFO, or nothing at all, hands the money forward instead of leaving it loose', () => {
  const part = rebalanceAllocation({ amount: '13000', invoices: specInvoices(), pinned: { 'inv-1': '2000' } });
  assert.deepEqual(part.rows.map(row => row.amount), [200000, 1000000, 100000], 'INV-001 holds Rs 2,000 and the Rs 3,000 it freed fills the invoices after it');
  assert.equal(part.allocated, 1300000);
  assert.equal(part.unallocated, 0, 'so the amount received stays fully allocated');

  const skipped = rebalanceAllocation({ amount: '13000', invoices: specInvoices(), pinned: { 'inv-1': '0' } });
  assert.deepEqual(skipped.rows.map(row => row.amount), [0, 1000000, 300000], 'skipping the oldest invoice passes its money down the queue');
  assert.equal(skipped.amounts['inv-1'], '0', 'and the skipped row states the zero the operator typed');

  const cleared = rebalanceAllocation({ amount: '13000', invoices: specInvoices(), pinned: { 'inv-3': '' } });
  assert.equal(cleared.amounts['inv-3'], '', 'a box the operator has cleared keeps its emptiness while the rest is spread around it');
  assert.deepEqual(cleared.rows.map(row => row.amount), [500000, 800000, 0], 'which is the FIFO suggestion with that row held at nothing');
});

test('a typed amount larger than the money received is reported, never silently clamped', () => {
  const over = rebalanceAllocation({ amount: '3000', invoices: specInvoices(), pinned: { 'inv-3': '4000' } });
  assert.equal(over.allocated, 400000, 'the typed row keeps what was typed');
  assert.deepEqual(over.rows.map(row => row.amount), [0, 0, 400000], 'and no other invoice is handed money that is not there');
  assert.equal(over.unallocated, -100000, 'so the split reads as Rs 1,000 over what arrived');
  assert.equal(over.overAllocated, 100000, 'which the surface states as its own figure');
  const refused = validateAllocation({ amount: '3000', rows: over.rows.map(row => ({ invoiceId: row.invoiceId, amount: rupeeString(row.amount) })), invoices: specInvoices() });
  assert.ok(refused.errors.some(error => error.includes('more than the amount received')), 'and the save gate names it rather than the table quietly rewriting the entry');

  const rows = sampleOutstandingInvoices('cus-9', 'Coastal Traders');
  const past = rebalanceAllocation({ amount: '15623', invoices: rows, pinned: { [rows[1].id]: '15623' } });
  assert.equal(past.rows[1].amount, 1562300, 'a row typed past what its invoice is owed is left exactly as it was typed');
  assert.equal(past.overAllocated, 0, 'which is an over-payment of that invoice rather than of the money, so the split itself still balances');
  const named = validateAllocation({ amount: '15623', rows: [{ invoiceId: rows[1].id, amount: '15623' }], invoices: rows });
  assert.ok(named.errors.some(error => error.includes('cannot be larger than that')), 'because the invoice it overpays is what refuses it');
});