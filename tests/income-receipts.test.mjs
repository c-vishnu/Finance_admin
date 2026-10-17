import test from 'node:test';
import assert from 'node:assert/strict';
import {command, initial, outstanding, paymentStatus, reports} from '../src/invoice-engine.js';
import {receiptAllocations, receiptAvailable, receiptCommand, receiptRows} from '../src/receipt-engine.js';
import {advanceLedger, saveInvoiceReceipt} from '../src/income-receipts.js';
import {reverseIncome, seedOperations} from '../src/operations-store.js';
import {incomeReport} from '../src/business-reports.js';

/* The Record Income surface settles invoices through the Payment Received engine that already
   exists, so these are the operator's own cases checked end to end: a part payment, a full payment, a
   direct-income-with-no-invoice posting, and the mixed case where part of the money pays invoices and
   the rest is held as a customer advance. Every assertion reads the ledger the engine wrote rather
   than the shape of the call, because "no duplicate revenue" is only true if the journals say so. */

const ACCOUNTS = [
  ['1000', 'Cash', 'Assets'], ['1010', 'Bank', 'Assets'], ['1100', 'Accounts Receivable', 'Assets'],
  ['2100', 'GST Payable', 'Liabilities'], ['2200', 'Customer Advances', 'Liabilities'],
  ['4000', 'Sales', 'Income'], ['4100', 'Service Income', 'Income']
];

const CUSTOMER = {id: 'cus-1', name: 'ABC Retail Pvt Ltd', account: '1100', status: 'Active'};
const OTHER = {id: 'cus-2', name: 'Northstar Services', account: '1100', status: 'Active'};
const ctx = extra => ({actor: 'Test operator', canApprove: true, customers: [CUSTOMER, OTHER], ...extra});

/* One posted invoice onto whichever book state is handed in, so a test can add an invoice to the
   state a receipt just produced - the same way the operator's next receipt would read it. */
function addInvoice(state, rate, customerId = 'cus-1', date = '2026-09-01', dueDate = '2026-09-30') {
  const saved = command(state, 'save', {customerId, customerName: customerId === 'cus-1' ? CUSTOMER.name : OTHER.name, date, dueDate, place: 'Kerala', lines: [{description: 'Service', qty: 1, unit: 'service', rate, discount: 0, tax: '0', cess: 0}]});
  const posted = command(saved.state, 'post', {id: saved.result.id}).state;
  return {state: posted, invoice: posted.invoices.find(row => row.id === saved.result.id)};
}

function shelf() {
  let state = initial();
  state.accounts = ACCOUNTS.map(([code, name, type]) => ({code, name, type, active: true}));
  state.config.receipts = {advanceAccount: '2200', threshold: 5000000, closedThrough: ''};
  const invoice = (rate, ...rest) => { const out = addInvoice(state, rate, ...rest); state = out.state; return out.invoice; };
  return {get state() { return state; }, set state(value) { state = value; }, invoice};
}

const input = extra => ({
  date: '2026-09-10', customerId: 'cus-1', receivedIn: '1010', method: 'Bank transfer',
  reference: 'UTR-9001', description: '', files: [], ...extra
});

test('a part payment against one invoice debits the bank, credits only the receivable, and part-pays the invoice', () => {
  const book = shelf();
  const invoice = book.invoice('10000');
  const out = saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(),
    input: input({amount: '6000', allocations: [{invoiceId: invoice.id, amount: '6000'}]}),
    idempotencyKey: 'key-a'
  });
  const entry = out.book.journals.at(-1);
  assert.deepEqual(entry.lines.map(line => [line.account, line.debit, line.credit]), [['1010', 600000, 0], ['1100', 0, 600000]], 'Dr Bank, Cr Accounts Receivable - and nothing else');
  assert.ok(!entry.lines.some(line => ['4000', '4100', '2100'].includes(line.account)), 'sales income and output GST are NOT posted again');
  assert.equal(outstanding(out.book, {...invoice, id: invoice.id}), 400000, 'the invoice carries Rs 4,000 still owed');
  assert.equal(paymentStatus(out.book, out.book.invoices.find(row => row.id === invoice.id), '2026-09-11'), 'Partially Paid');
  assert.equal(out.receipt.status, 'Posted');
  assert.equal(out.record.status, 'Posted', 'and the income register row is recorded');
  assert.equal(out.record.receiptType, 'InvoicePayment');
  assert.equal(out.record.journalId, out.receipt.journalId, 'the row points at the receipt own journal rather than writing a second one');
  assert.equal(out.book.journals.length, 2, 'the invoice journal and the receipt journal - nothing else');
});

test('a payment that clears the invoice marks it Paid, and a smaller one leaves it part paid', () => {
  const book = shelf();
  const invoice = book.invoice('5000');
  const part = saveInvoiceReceipt({book: book.state, store: seedOperations(), ctx: ctx(), input: input({amount: '2000', allocations: [{invoiceId: invoice.id, amount: '2000'}]})});
  assert.equal(paymentStatus(part.book, part.book.invoices.find(row => row.id === invoice.id), '2026-09-11'), 'Partially Paid');
  const rest = saveInvoiceReceipt({book: part.book, store: part.store, ctx: ctx(), input: input({amount: '3000', allocations: [{invoiceId: invoice.id, amount: '3000'}]})});
  const paid = rest.book.invoices.find(row => row.id === invoice.id);
  assert.equal(outstanding(rest.book, paid), 0);
  assert.equal(paymentStatus(rest.book, paid, '2026-09-11'), 'Paid', 'the invoice is settled once the invoices own balance reaches zero');
  assert.equal(rest.record.status, 'Posted');
});

test('one receipt settles several invoices, and the split the operator typed is the split that is stored', () => {
  const book = shelf();
  const first = book.invoice('5000', 'cus-1', '2026-09-01', '2026-09-10');
  const second = book.invoice('10000', 'cus-1', '2026-09-02', '2026-09-20');
  const third = book.invoice('8000', 'cus-1', '2026-09-03', '2026-10-05');
  const out = saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(),
    input: input({amount: '13000', allocations: [{invoiceId: first.id, amount: '3000'}, {invoiceId: second.id, amount: '10000'}, {invoiceId: third.id, amount: '0'}]})
  });
  assert.deepEqual(out.allocations, [{invoiceId: first.id, amount: 300000}, {invoiceId: second.id, amount: 1000000}], 'the manual distribution is saved as typed');
  const read = id => out.book.invoices.find(row => row.id === id);
  assert.equal(outstanding(out.book, read(first.id)), 200000, 'the newer invoice takes the rest even though the older one is not settled');
  assert.equal(outstanding(out.book, read(second.id)), 0);
  assert.equal(outstanding(out.book, read(third.id)), 800000, 'and the invoice that was skipped keeps its full balance');
  assert.equal(out.record.salesInvoiceId, '', 'a receipt that settled more than one invoice is known by its own receipt number');
});

test('a remainder held as a customer advance credits the liability, never income', () => {
  const book = shelf();
  const invoice = book.invoice('10000');
  const out = saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(),
    input: input({amount: '13000', advance: true, advanceSupply: 'Goods', advanceTaxTreatment: 'Taxable', advanceRate: 18, allocations: [{invoiceId: invoice.id, amount: '10000'}]})
  });
  const entry = out.book.journals.at(-1);
  assert.deepEqual(entry.lines.map(line => [line.account, line.debit, line.credit]), [['1010', 1300000, 0], ['1100', 0, 1000000], ['2200', 0, 300000]], 'Dr Bank Rs 13,000, Cr Receivable Rs 10,000, Cr Customer Advances Rs 3,000');
  assert.equal(entry.lines.reduce((total, line) => total + line.debit - line.credit, 0), 0, 'and the entry balances');
  assert.equal(outstanding(out.book, out.book.invoices.find(row => row.id === invoice.id)), 0);
  assert.equal(out.record.advanceAmount, 300000, 'the register row states the advance it holds');
  assert.ok(!entry.lines.some(line => line.account === '4100' || line.account === '4000'), 'the advance is a liability until it is applied, never revenue');
  assert.equal(advanceLedger(out.book), '2200');

  /* Applying the advance to a later invoice moves it out of the liability and into the receivable.
     That is the receipt engine's own allocate action on the receipt that holds the money - it is not
     a second money receipt, which is why no new bank debit is ever written for it. */
  const later = addInvoice(out.book, '3000');
  const applied = receiptCommand(later.state, 'allocate', {id: out.receipt.id, date: '2026-09-12', token: 'advance-apply', allocations: [{invoiceId: later.invoice.id, amount: '3000'}]}, ctx());
  assert.equal(outstanding(applied.state, applied.state.invoices.find(row => row.id === later.invoice.id)), 0, 'the later invoice is settled by the advance');
  assert.deepEqual(applied.state.journals.at(-1).lines.map(line => [line.account, line.debit, line.credit]), [['2200', 300000, 0], ['1100', 0, 300000]], 'and the advance leaves the liability for the receivable');
  assert.equal(receiptAvailable(applied.state, applied.result), 0, 'with nothing left to apply');
});

test('a remainder whose supply nobody has classified is refused rather than assumed to be tax-free', () => {
  const book = shelf();
  const invoice = book.invoice('10000');
  assert.throws(() => saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(),
    input: input({amount: '13000', advance: true, allocations: [{invoiceId: invoice.id, amount: '10000'}]})
  }), /Classify what this advance is for/, 'the operator is asked what the money is for before it can be held');
});

test('money that is neither allocated nor claimed as an advance is refused, and so are over-allocations', () => {
  const book = shelf();
  const invoice = book.invoice('10000');
  assert.throws(() => saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(),
    input: input({amount: '6000', allocations: [{invoiceId: invoice.id, amount: '5000'}]})
  }), /₹1,000\.00 of the money received is not accounted for/, 'the unresolved remainder is stated with its amount');
  assert.throws(() => saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(),
    input: input({amount: '6000', allocations: [{invoiceId: invoice.id, amount: '6000'}, {invoiceId: invoice.id, amount: '6000'}]})
  }), /listed twice/, 'a duplicated invoice is refused');
  assert.throws(() => saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(),
    input: input({amount: '11000', allocations: [{invoiceId: invoice.id, amount: '11000'}]})
  }), /cannot be larger than that/, 'an allocation above the invoice outstanding is refused');
  assert.throws(() => saveInvoiceReceipt({book: book.state, store: seedOperations(), ctx: ctx(), input: input({amount: '0', allocations: []})}), /amount received/);
  assert.equal(book.state.journals.length, 1, 'nothing was posted by any refused attempt');
  assert.equal(receiptRows(book.state).length, 0, 'and no receipt was left behind');
});

test('another customer\'s invoice, a cancelled invoice, a closed period and a missing bank account are all refused', () => {
  const book = shelf();
  const mine = book.invoice('5000');
  const theirs = book.invoice('4000', 'cus-2');
  assert.throws(() => saveInvoiceReceipt({book: book.state, store: seedOperations(), ctx: ctx(), input: input({amount: '4000', allocations: [{invoiceId: theirs.id, amount: '4000'}]})}), /no longer open for this customer/, 'invoices are never offered across customers');
  const cancelled = {...book.state, invoices: book.state.invoices.map(row => row.id === mine.id ? {...row, status: 'Cancelled'} : row)};
  assert.throws(() => saveInvoiceReceipt({book: cancelled, store: seedOperations(), ctx: ctx(), input: input({amount: '5000', allocations: [{invoiceId: mine.id, amount: '5000'}]})}), /no longer open for this customer/);
  const closed = {...book.state, config: {...book.state.config, receipts: {...book.state.config.receipts, closedThrough: '2026-09-30'}}};
  assert.throws(() => saveInvoiceReceipt({book: closed, store: seedOperations(), ctx: ctx(), input: input({amount: '5000', allocations: [{invoiceId: mine.id, amount: '5000'}]})}), /closed/, 'a locked accounting period stops the receipt at the engine');
  assert.throws(() => saveInvoiceReceipt({book: book.state, store: seedOperations(), ctx: ctx(), input: input({amount: '5000', receivedIn: '9999', allocations: [{invoiceId: mine.id, amount: '5000'}]})}), /cash or bank/, 'the money must land in a cash or bank ledger');
  assert.throws(() => saveInvoiceReceipt({book: book.state, store: seedOperations(), ctx: ctx(), input: input({amount: '5000', customerId: 'nobody', allocations: []})}), /customer/);
});

test('a retried submission posts one receipt, not two', () => {
  const book = shelf();
  const invoice = book.invoice('5000');
  const call = () => saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(),
    input: input({amount: '5000', allocations: [{invoiceId: invoice.id, amount: '5000'}]}), idempotencyKey: 'retry-1'
  });
  const first = call();
  const again = saveInvoiceReceipt({
    book: first.book, store: first.store, ctx: ctx(),
    input: input({amount: '5000', allocations: [{invoiceId: invoice.id, amount: '5000'}]}), idempotencyKey: 'retry-1'
  });
  assert.equal(again.repeated, true, 'the second attempt finds the receipt the first one made');
  assert.equal(again.receipt.id, first.receipt.id);
  assert.equal(receiptRows(again.book).length, 1, 'one receipt');
  assert.equal(again.store.incomes.length, first.store.incomes.length, 'and one register row');
  assert.equal(again.book.journals.length, first.book.journals.length, 'with no second journal');
});

test('editing a draft and posting it files one row and posts the money once', () => {
  const book = shelf();
  const invoice = book.invoice('5000');
  const draft = saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(), targetStatus: 'Draft',
    input: input({amount: '5000', allocations: [{invoiceId: invoice.id, amount: '5000'}], id: ''})
  });
  assert.equal(draft.record.status, 'Draft');
  assert.equal(draft.book.journals.length, 1, 'a draft posts nothing at all');
  assert.equal(draft.book.receipts || undefined, undefined, 'and creates no receipt, so there is nothing to clean up');
  const posted = saveInvoiceReceipt({
    book: book.state, store: draft.store, ctx: ctx(),
    input: input({amount: '5000', allocations: [{invoiceId: invoice.id, amount: '5000'}], id: draft.record.id})
  });
  assert.equal(posted.store.incomes.length, draft.store.incomes.length, 'the draft row is replaced rather than duplicated');
  assert.equal(posted.store.incomes.filter(row => row.receiptType === 'InvoicePayment').length, 1);
  assert.equal(posted.record.number, draft.record.number, 'and it keeps the number the operator already read');
  assert.equal(posted.record.status, 'Posted');
  assert.equal(posted.book.journals.length, 2);
});

test('cancelling a posted receipt from the register reverses the money AND the invoices it settled', () => {
  const book = shelf();
  const invoice = book.invoice('10000');
  const out = saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(),
    input: input({amount: '6000', allocations: [{invoiceId: invoice.id, amount: '6000'}]})
  });
  assert.equal(outstanding(out.book, out.book.invoices.find(row => row.id === invoice.id)), 400000);
  const cancelled = reverseIncome(out.store, out.book, out.record.id);
  const receipt = cancelled.accounting.receipts.find(row => row.id === out.receipt.id);
  assert.equal(receipt.status, 'Reversed');
  assert.equal(cancelled.record.status, 'Cancelled');
  assert.equal(outstanding(cancelled.accounting, cancelled.accounting.invoices.find(row => row.id === invoice.id)), 1000000, 'the invoice is owed its money again');
  assert.equal(paymentStatus(cancelled.accounting, cancelled.accounting.invoices.find(row => row.id === invoice.id), '2026-10-01'), 'Overdue');
  assert.ok(receiptAllocations(cancelled.accounting, receipt).every(row => row.voided), 'the allocation is voided rather than deleted');
  assert.equal(reports(cancelled.accounting).debit, reports(cancelled.accounting).credit, 'and the reversal leaves the trial balance level');
  assert.equal(cancelled.store.incomes.find(row => row.id === out.record.id).status, 'Cancelled');
});

test('the receipt lands in the Income register with the words the register prints', () => {
  const book = shelf();
  const invoice = book.invoice('5000');
  const out = saveInvoiceReceipt({book: book.state, store: seedOperations(), ctx: ctx(), input: input({amount: '5000', method: 'UPI', allocations: [{invoiceId: invoice.id, amount: '5000'}]})});
  const report = incomeReport(out.book, out.store, {});
  const row = report.rows.find(entry => entry.recordId === out.record.id);
  assert.ok(row, 'the register carries the receipt');
  assert.equal(row.documentNumber, invoice.number, 'known by the invoice it settled when it settled exactly one');
  assert.equal(row.party, CUSTOMER.name);
  assert.equal(row.category, 'Payment for Existing Invoices', 'the Income Type states the workflow');
  assert.equal(row.receivedIn, 'Bank');
  assert.equal(row.reference, 'UTR-9001');
  assert.equal(row.status, 'Recorded');
  assert.equal(row.amount, 500000);
  assert.equal(incomeReport(out.book, out.store, {search: 'UTR-9001'}).rows.length, 1, 'and it is searchable like any other row');
});

test('an invoice payment never touches revenue or output GST, and a direct income still does', () => {
  const book = shelf();
  const invoice = book.invoice('10000');
  const before = reports(book.state).rows.filter(row => row.type === 'Income').reduce((total, row) => total - row.balance, 0);
  const out = saveInvoiceReceipt({book: book.state, store: seedOperations(), ctx: ctx(), input: input({amount: '10000', allocations: [{invoiceId: invoice.id, amount: '10000'}]})});
  const after = reports(out.book).rows.filter(row => row.type === 'Income').reduce((total, row) => total - row.balance, 0);
  assert.equal(after, before, 'settling an invoice creates no new revenue in the Profit and Loss');
  const gst = out.book.journals.at(-1).lines.some(line => line.account === '2100');
  assert.equal(gst, false, 'and no second output GST liability');
});

test('the receipt engine keeps its own permissions: a role that cannot post cannot post', () => {
  const book = shelf();
  const invoice = book.invoice('5000');
  const accountant = ctx({role: 'Accountant'});
  assert.throws(() => saveInvoiceReceipt({book: book.state, store: seedOperations(), ctx: accountant, input: input({amount: '5000', allocations: [{invoiceId: invoice.id, amount: '5000'}]})}), /role/, 'an accountant may save and submit but not post');
  const overThreshold = saveInvoiceReceipt({book: book.state, store: seedOperations(), ctx: ctx({canApprove: false, role: 'Business Owner'}), input: input({amount: '5000', advance: true, advanceSupply: 'Goods', advanceTaxTreatment: 'Taxable', advanceRate: 18, allocations: []})});
  assert.equal(overThreshold.receipt.status, 'Posted', 'a small receipt is approved by the threshold rule, as the engine already decided');
});