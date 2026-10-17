import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PURCHASE_PAYMENT_TYPE, outstandingPurchaseBills, purchaseBillBalance
} from '../src/purchase-allocation.js';
import { fifoAllocation, rebalanceAllocation, validateAllocation } from '../src/income-allocation.js';

/* Purchase bills are the payables mirror of sales invoices. The module only decides which bills
   may be paid and what each still owes; the FIFO arithmetic is the income allocation's own, so
   these tests pin the projection and then exercise that shared arithmetic on the projected rows. */

const bill = (id, date, dueDate, total, extra = {}) => ({
  id, number: 'BILL-' + id, vendorId: 'ven-1', vendorName: 'Kerala Office Supplies',
  date, dueDate, total, posted: true, status: 'Unpaid', paidAmount: 0, creditApplied: 0,
  branchId: 'abc-kochi', organizationId: 'abc', payableAccount: '2000', ...extra
});

const stateWith = bills => ({ purchaseBills: bills });

test('a bill owes its total less payments and applied debit notes, never below zero', () => {
  assert.equal(purchaseBillBalance(bill('a', '2026-09-01', '2026-09-10', 100000)), 100000);
  assert.equal(purchaseBillBalance(bill('a', '2026-09-01', '2026-09-10', 100000, { paidAmount: 40000 })), 60000);
  assert.equal(purchaseBillBalance(bill('a', '2026-09-01', '2026-09-10', 100000, { paidAmount: 40000, creditApplied: 60000 })), 0);
  assert.equal(purchaseBillBalance(bill('a', '2026-09-01', '2026-09-10', 100000, { paidAmount: 90000, creditApplied: 30000 })), 0, 'an over-applied bill is never negative debt');
});

test('only the vendor posted, open bills inside the working scope are offered', () => {
  const rows = outstandingPurchaseBills(stateWith([
    bill('a', '2026-09-01', '2026-09-20', 100000),
    bill('draft', '2026-09-02', '2026-09-21', 100000, { posted: false }),
    bill('cancelled', '2026-09-03', '2026-09-22', 100000, { status: 'Cancelled' }),
    bill('paid', '2026-09-04', '2026-09-23', 100000, { paidAmount: 100000 }),
    bill('credit', '2026-09-05', '2026-09-24', 100000, { creditApplied: 100000 }),
    bill('voided', '2026-09-06', '2026-09-25', 100000, { voided: true }),
    bill('deleted', '2026-09-07', '2026-09-26', 100000, { deleted: true }),
    bill('other-vendor', '2026-09-08', '2026-09-27', 100000, { vendorId: 'ven-2' }),
    bill('other-branch', '2026-09-09', '2026-09-28', 100000, { branchId: 'abc-mumbai' }),
    bill('other-org', '2026-09-10', '2026-09-29', 100000, { organizationId: 'other' })
  ]), { vendorId: 'ven-1', branchId: 'abc-kochi', organisationId: 'abc' });
  assert.deepEqual(rows.map(row => row.id), ['a']);
  assert.equal(rows[0].outstanding, 100000);
  assert.equal(rows[0].payableAccount, '2000');
});

test('a missing due date falls back to the bill date and the FIFO order is stable', () => {
  const rows = outstandingPurchaseBills(stateWith([
    bill('b', '2026-09-05', '2026-09-08', 100000),
    bill('a', '2026-09-01', '', 100000),
    bill('c', '2026-09-02', '2026-09-08', 100000)
  ]), { vendorId: 'ven-1' });
  assert.deepEqual(rows.map(row => row.id), ['a', 'c', 'b']);
  assert.equal(rows[0].dueDate, '2026-09-01');
});

test('the shared FIFO split settles the oldest bills first and caps each at what it owes', () => {
  const rows = outstandingPurchaseBills(stateWith([
    bill('a', '2026-09-01', '2026-09-10', 500000),
    bill('b', '2026-09-02', '2026-09-12', 1000000),
    bill('c', '2026-09-03', '2026-09-14', 800000)
  ]), { vendorId: 'ven-1' });
  const split = fifoAllocation({ amount: '13000', invoices: rows });
  assert.deepEqual(split.allocations, [{ invoiceId: 'a', amount: 500000 }, { invoiceId: 'b', amount: 800000 }]);
  assert.equal(split.allocated, 1300000);
  assert.equal(split.unallocated, 0);
  assert.equal(split.rows[2].amount, 0, 'a newer bill is left untouched');
});

test('a manual split is rebalanced through the same rows and validated with payable wording', () => {
  const rows = outstandingPurchaseBills(stateWith([
    bill('a', '2026-09-01', '2026-09-10', 500000),
    bill('b', '2026-09-02', '2026-09-12', 1000000)
  ]), { vendorId: 'ven-1' });
  const spread = rebalanceAllocation({ amount: '13000', invoices: rows, pinned: { b: '10000' } });
  assert.equal(spread.amounts.b, '10000');
  assert.equal(spread.amounts.a, '3000.00');
  const checked = validateAllocation({
    amount: '13000',
    rows: [{ invoiceId: 'a', amount: spread.amounts.a }, { invoiceId: 'b', amount: spread.amounts.b }],
    invoices: rows,
    labels: { object: 'bill', party: 'vendor' }
  });
  assert.deepEqual(checked.errors, []);
  assert.equal(checked.allocated, 1300000);
  assert.equal(checked.unallocated, 0);
  const over = validateAllocation({ amount: '1000', rows: [{ invoiceId: 'a', amount: '6000' }], invoices: rows, labels: { object: 'bill', party: 'vendor' } });
  assert.match(over.errors.join(' '), /cannot be larger than that/);
  const foreign = validateAllocation({ amount: '1000', rows: [{ invoiceId: 'not-mine', amount: '100' }], invoices: rows, labels: { object: 'bill', party: 'vendor' } });
  assert.match(foreign.errors.join(' '), /That bill is no longer open for this vendor/);
});

test('the payable workflow is named apart from every expense account', () => {
  assert.equal(PURCHASE_PAYMENT_TYPE, 'unpaid-purchases');
  assert.notEqual(PURCHASE_PAYMENT_TYPE, '5900');
});
