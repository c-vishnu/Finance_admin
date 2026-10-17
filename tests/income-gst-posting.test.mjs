import test from 'node:test';
import assert from 'node:assert/strict';
import {command, initial, outstanding, paymentStatus} from '../src/invoice-engine.js';
import {saveInvoiceReceipt} from '../src/income-receipts.js';
import {createIncome, seedOperations} from '../src/operations-store.js';
import {money} from '../src/income-allocation.js';

/* GST on what the Record Income page actually posts, read off the ledger rather than off the call:
   "no duplicate revenue or GST" is only true if the journals say so, and the three workflows the page
   offers have to be told apart by the entries they write. Every invoice below carries GST of its own,
   so the outstanding balances these tests allocate against are GST-inclusive - which is exactly the
   money a customer pays and the number the operator sees in the allocation table. */

const ACCOUNTS = [
  ['1000', 'Cash', 'Assets'], ['1010', 'Bank', 'Assets'], ['1100', 'Accounts Receivable', 'Assets'],
  ['2100', 'GST Payable', 'Liabilities'], ['2200', 'Customer Advances', 'Liabilities'],
  ['4000', 'Sales', 'Income'], ['4100', 'Service Income', 'Income']
];
const CUSTOMER = {id: 'cus-1', name: 'ABC Retail Pvt Ltd', account: '1100', status: 'Active'};
const ctx = extra => ({actor: 'Test operator', canApprove: true, customers: [CUSTOMER], ...extra});

/* One posted invoice whose total INCLUDES 18% GST, so Rs 5,000 of service is Rs 5,900 of money owed. */
function addInvoice(state, rate, customerId = 'cus-1', date = '2026-09-01', dueDate = '2026-09-30') {
  const saved = command(state, 'save', {customerId, customerName: CUSTOMER.name, date, dueDate, place: 'Kerala', lines: [{description: 'Service', qty: 1, unit: 'service', rate, discount: 0, tax: '18', cess: 0}]});
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
  reference: 'UTR-9001', description: '', files: [], placeOfSupply: 'Kerala', ...extra
});

const lines = book => book.journals.at(-1).lines.map(line => [line.account, line.debit, line.credit]);
const balanced = book => book.journals.at(-1).lines.reduce((total, line) => total + line.debit - line.credit, 0) === 0;

/* The operator's own example: Rs 13,000 against Rs 5,900, Rs 11,800 and Rs 9,440 of GST-inclusive
   outstanding money, oldest due first. */
function threeInvoices() {
  const book = shelf();
  const first = book.invoice('5000', 'cus-1', '2026-09-01', '2026-09-10');
  const second = book.invoice('10000', 'cus-1', '2026-09-02', '2026-09-20');
  const third = book.invoice('8000', 'cus-1', '2026-09-03', '2026-10-05');
  return {book, first, second, third};
}

test('Rs 13,000 against GST-inclusive invoices settles the oldest first and adds no tax of its own', () => {
  const {book, first, second, third} = threeInvoices();
  const out = saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(), idempotencyKey: 'key-gst-1',
    input: input({amount: '13000', allocations: [{invoiceId: first.id, amount: '5900'}, {invoiceId: second.id, amount: '7100'}, {invoiceId: third.id, amount: '0'}]})
  });
  const entry = out.book.journals.at(-1);
  assert.deepEqual(lines(out.book), [['1010', 1300000, 0], ['1100', 0, 1300000]], 'Dr Bank Rs 13,000, Cr Accounts Receivable Rs 13,000 - and nothing else');
  assert.ok(balanced(out.book), 'and the entry balances');
  assert.ok(!entry.lines.some(line => ['4000', '4100', '2100'].includes(line.account)), 'the invoice GST and the invoice revenue are NOT recognised a second time');
  const after = id => out.book.invoices.find(row => row.id === id);
  assert.deepEqual([outstanding(out.book, after(first.id)), outstanding(out.book, after(second.id)), outstanding(out.book, after(third.id))], [0, 470000, 944000], 'Rs 0, Rs 4,700 and Rs 9,440 of outstanding remain - the tax-inclusive balances the operator saw, less what was allocated');
  assert.equal(outstanding(out.book, after(first.id)) + outstanding(out.book, after(second.id)) + outstanding(out.book, after(third.id)), 1414000, 'so the customer owes Rs 14,140 of the original Rs 27,140');
  assert.equal(paymentStatus(out.book, after(first.id), '2026-09-11'), 'Paid');
  assert.equal(paymentStatus(out.book, after(second.id), '2026-09-11'), 'Partially Paid');
  assert.equal(out.receipt.status, 'Posted');
  assert.equal(out.record.receiptType, 'InvoicePayment', 'and the register row states why it writes no journal of its own');
});

test('the allocation the operator typed by hand is the allocation that is stored', () => {
  const {book, first, second, third} = threeInvoices();
  const out = saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(), idempotencyKey: 'key-gst-2',
    input: input({amount: '13000', allocations: [{invoiceId: first.id, amount: '3000'}, {invoiceId: second.id, amount: '10000'}, {invoiceId: third.id, amount: '0'}]})
  });
  assert.deepEqual(out.allocations, [{invoiceId: first.id, amount: 300000}, {invoiceId: second.id, amount: 1000000}, {invoiceId: third.id, amount: 0}].filter(row => row.amount > 0), 'the manual distribution is stored exactly as typed, not redistributed to FIFO');
  const after = id => out.book.invoices.find(row => row.id === id);
  assert.equal(outstanding(out.book, after(first.id)), 290000, 'Rs 2,900 of the oldest invoice is still owed');
  assert.equal(outstanding(out.book, after(second.id)), 180000, 'Rs 1,800 of the second');
  assert.equal(outstanding(out.book, after(third.id)), 944000, 'and the third is untouched');
  assert.deepEqual(lines(out.book), [['1010', 1300000, 0], ['1100', 0, 1300000]], 'the money still only moves between the bank and the receivable');
});

test('money smaller than the oldest invoice part-pays it and touches nothing else', () => {
  const {book, first, second} = threeInvoices();
  const out = saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(), idempotencyKey: 'key-gst-3',
    input: input({amount: '2000', allocations: [{invoiceId: first.id, amount: '2000'}]})
  });
  const after = id => out.book.invoices.find(row => row.id === id);
  assert.equal(outstanding(out.book, after(first.id)), 390000);
  assert.equal(paymentStatus(out.book, after(first.id), '2026-09-10'), 'Partially Paid');
  assert.equal(paymentStatus(out.book, after(first.id), '2026-09-11'), 'Overdue', 'and once its due date passes the engine reads it as overdue while it still carries a balance');
  assert.equal(outstanding(out.book, after(second.id)), 1180000, 'the newer invoice is not touched');
  assert.deepEqual(lines(out.book), [['1010', 200000, 0], ['1100', 0, 200000]]);
});

test('money that is more than the whole book is owed cannot be posted without saying what the rest is for', () => {
  const {book, first, second, third} = threeInvoices();
  assert.throws(() => saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(),
    input: input({amount: '30000', allocations: [{invoiceId: first.id, amount: '5900'}, {invoiceId: second.id, amount: '11800'}, {invoiceId: third.id, amount: '9440'}]})
  }), /₹2,860\.00 of the money received is not accounted for/, 'the remainder is stated rather than quietly dropped or turned into income');
});

test('a remainder held for goods is a liability in full, with no tax charged when the money arrives', () => {
  const {book, first} = threeInvoices();
  const out = saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(), idempotencyKey: 'key-gst-4',
    input: input({amount: '10000', advance: true, advanceSupply: 'Goods', advanceTaxTreatment: 'Taxable', advanceRate: 18, allocations: [{invoiceId: first.id, amount: '5900'}]})
  });
  assert.deepEqual(lines(out.book), [['1010', 1000000, 0], ['1100', 0, 590000], ['2200', 0, 410000]], 'Dr Bank Rs 10,000, Cr Receivable Rs 5,900, Cr Customer Advances Rs 4,100 - the whole remainder, because a goods advance is outside the charge at receipt');
  assert.ok(balanced(out.book));
  assert.ok(!out.book.journals.at(-1).lines.some(line => line.account === '2100'), 'and no output tax is invented for it');
  assert.equal(out.record.advanceAmount, 410000);
  assert.equal(out.record.advanceSupply, 'Goods');
  assert.equal(out.record.advanceGst, 0);
});

test('a remainder held for a taxable service is chargeable at receipt, and only the net is held', () => {
  const {book, first} = threeInvoices();
  const out = saveInvoiceReceipt({
    book: book.state, store: seedOperations(), ctx: ctx(), idempotencyKey: 'key-gst-5',
    input: input({amount: '10000', advance: true, advanceSupply: 'Services', advanceTaxTreatment: 'Taxable', advanceRate: 18, allocations: [{invoiceId: first.id, amount: '5900'}]})
  });
  assert.deepEqual(lines(out.book), [['1010', 1000000, 0], ['1100', 0, 590000], ['2200', 0, 347458], ['2100', 0, 31271], ['2100', 0, 31271]], 'Dr Bank Rs 10,000; Cr Receivable Rs 5,900; Cr Customer Advances Rs 3,474.58 net of the Rs 625.42 of tax the same money carries, split into CGST and SGST');
  assert.ok(balanced(out.book), 'and it balances by construction');
  assert.equal(out.book.journals.at(-1).lines.filter(line => line.account === '2100').reduce((total, line) => total + line.credit, 0), 62542, 'Rs 625.42 of output tax on the advance');
  assert.equal(out.record.advanceGst, 62542, 'and the register row states it, so it can be adjusted against the invoice that follows');
  assert.equal(out.record.advanceAmount - 0 - 62542, 347458, 'the liability holds the money less the tax it carries, never the gross');
});

test('a services advance and a goods advance of the same amount leave different liabilities and only one of them a tax', () => {
  const goods = threeInvoices();
  const services = threeInvoices();
  const held = (also, supply) => saveInvoiceReceipt({
    book: also.book.state, store: seedOperations(), ctx: ctx(),
    input: input({amount: '10000', advance: true, advanceSupply: supply, advanceTaxTreatment: 'Taxable', advanceRate: 18, allocations: [{invoiceId: also.first.id, amount: '5900'}]})
  });
  const goodsOut = held(goods, 'Goods');
  const servicesOut = held(services, 'Services');
  const liability = out => out.book.journals.at(-1).lines.filter(line => line.account === '2200').reduce((total, line) => total + line.credit, 0);
  assert.equal(liability(goodsOut), 410000);
  assert.equal(liability(servicesOut), 347458, 'a taxable service advance is smaller because the tax came out of the same money');
  assert.equal(liability(goodsOut) - liability(servicesOut), 62542, 'and the difference is exactly the tax the service advance carries');
});

/* ---------------------------------------------------------------- direct income */

const store = () => seedOperations();
const book = () => {
  const state = initial();
  state.accounts = ACCOUNTS.map(([code, name, type]) => ({code, name, type, active: true}));
  state.config = {...state.config, state: 'Kerala', sales: '4100', ar: '1100', cgst: '2110', sgst: '2120', igst: '2130'};
  return state;
};
const direct = extra => ({
  date: '2026-10-01', name: 'Interest from HDFC', category: 'Interest Income', receivedFrom: 'HDFC Bank',
  account: '4100', amount: '11800', received: true, paidThrough: '1010', taxMode: 'inclusive', placeOfSupply: 'Kerala', ...extra
});

test('a GST-inclusive direct income credits the income its taxable value and the tax the same money carries', () => {
  const out = createIncome(store(), book(), direct({taxTreatment: 'Taxable', gstRate: 18, tax: 'GST 18%'}));
  assert.deepEqual(lines(out.accounting), [['1010', 1180000, 0], ['4100', 0, 1000000], ['2110', 0, 90000], ['2120', 0, 90000]], 'Dr Bank Rs 11,800; Cr Income Rs 10,000; Cr CGST Rs 900; Cr SGST Rs 900 - the bank is never debited more than the money received');
  assert.ok(balanced(out.accounting));
});

test('the same receipt across a state line carries IGST instead of the two halves', () => {
  const out = createIncome(store(), book(), direct({taxTreatment: 'Taxable', gstRate: 18, placeOfSupply: 'Karnataka'}));
  assert.deepEqual(lines(out.accounting), [['1010', 1180000, 0], ['4100', 0, 1000000], ['2130', 0, 180000]]);
  assert.ok(balanced(out.accounting));
});

test('an exempt direct income credits the whole receipt to income and posts no tax', () => {
  const out = createIncome(store(), book(), direct({taxTreatment: 'Non-GST / Out of Scope', gstRate: ''}));
  assert.deepEqual(lines(out.accounting), [['1010', 1180000, 0], ['4100', 0, 1180000]]);
  assert.ok(balanced(out.accounting));
});

test('income still awaited carries the tax on top of the stated income and is owed from the customer', () => {
  const out = createIncome(store(), book(), direct({amount: '10000', received: false, accountReceivable: '1100', taxTreatment: 'Taxable', gstRate: 18, taxMode: 'exclusive'}));
  assert.deepEqual(lines(out.accounting), [['1100', 1180000, 0], ['4100', 0, 1000000], ['2110', 0, 90000], ['2120', 0, 90000]], 'Dr Receivable Rs 11,800 and the same credits: the tax is charged on top of income nobody has paid yet');
  assert.ok(balanced(out.accounting));
});

test('a draft direct income reaches no ledger at all, which is what makes it safe to reopen', () => {
  const out = createIncome(store(), book(), direct({taxTreatment: 'Taxable', gstRate: 18, status: 'Draft'}));
  assert.equal(out.accounting.journals.length, initial().journals.length, 'a draft posts nothing');
  assert.equal(out.record.status, 'Draft');
});

test('every entry these workflows write balances, whichever way the money moved', () => {
  const books = [
    createIncome(store(), book(), direct({taxTreatment: 'Taxable', gstRate: 18})).accounting,
    createIncome(store(), book(), direct({taxTreatment: 'Taxable', gstRate: 5, amount: '10500'})).accounting,
    createIncome(store(), book(), direct({taxTreatment: 'Tax Exempt', gstRate: ''})).accounting
  ];
  const receipt = threeInvoices();
  books.push(saveInvoiceReceipt({
    book: receipt.book.state, store: store(), ctx: ctx(),
    input: input({amount: '10000', advance: true, advanceSupply: 'Services', advanceTaxTreatment: 'Taxable', advanceRate: 18, allocations: [{invoiceId: receipt.first.id, amount: '5900'}]})
  }).book);
  for (const state of books) {
    for (const entry of state.journals) {
      const debit = entry.lines.reduce((total, line) => total + line.debit, 0);
      const credit = entry.lines.reduce((total, line) => total + line.credit, 0);
      assert.equal(money(debit), money(credit), 'entry ' + entry.id + ' debits ' + money(debit) + ' against ' + money(credit));
    }
  }
});
