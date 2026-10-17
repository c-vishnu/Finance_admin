import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/* Create Expense now offers the payables mirror of Record Income's allocation table: a payment can
   be spread FIFO over the vendor's unpaid, posted purchase bills and posted through the purchase
   engine instead of debiting an expense account a second time. These are source-level assertions
   because the page is a prototype React surface with no DOM test runner in this repository. */
const page = readFileSync(new URL('../src/CreateExpensePage.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = readFileSync(new URL('../src/journal-form.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('Create Expense reads the purchase allocation module and the vendor payment engine', () => {
  assert.ok(page.includes("import { outstandingPurchaseBills, PURCHASE_PAYMENT_TYPE } from './purchase-allocation.js';"));
  assert.ok(page.includes("import { recordPurchasePayment } from './purchase-service.js';"));
  assert.ok(page.includes("createPurchasePaymentExpense"));
  assert.ok(page.includes("import { fifoAllocation, rebalanceAllocation, validateAllocation, money, paise, rupeeString } from './income-allocation.js';"));
});

test('the Payment For picker names the payables workflow', () => {
  assert.ok(page.includes('<select aria-label="Payment For" value={settlement ? \'bills\' : form.expenseAccount} onChange={e => handlePaymentForChange(e.target.value)}>'));
  assert.ok(page.includes('<option value="bills">Existing Purchase Bills</option>'));
  assert.ok(page.includes('<optgroup label="Other Expense">'));
  assert.ok(page.includes('const handlePaymentForChange = (mode) =>'));
  assert.ok(page.includes("const settlement = form.expenseAccount === PURCHASE_PAYMENT_TYPE;"));
  assert.ok(page.includes('expenseTypeChosen'), 'a choice the operator made is not overwritten by the vendor');
});

test('the page renders the unpaid purchases allocation table', () => {
  assert.ok(page.includes('<section className="exp-allocation exp-unpaid exp-field-wide">'), 'the allocation sheet spans the full width of the three-track form');
  assert.ok(page.includes('<h3>Outstanding Bills'));
  assert.ok(page.includes('<th>Date</th><th>Bill number</th><th>Bill amount</th><th>Amount due</th><th>Payment</th>'));
  assert.ok(page.includes('Auto Allocate'));
  assert.ok(page.includes("Allocated: {money(checkedAllocation.allocated)} · Amount: {money(paidPaise)}"));
  assert.ok(page.includes('No unpaid purchase bills for this vendor.'));
});

test('FIFO fills the table and a typed bill is rebalanced, not rewritten', () => {
  assert.ok(page.includes('const fifo = fifoAllocation({ amount: form.amount, invoices: openBills });'));
  assert.ok(page.includes('rebalanceAllocation({ amount: form.amount, invoices: openBills, pinned: form.allocationManual ? form.allocations : {} })'));
  assert.ok(page.includes('const handleAllocateChange = (billId, value) =>'));
  assert.ok(page.includes('const resetToFifo = () =>'));
  assert.ok(page.includes('labels: { object: \'bill\', party: \'vendor\' }'));
});

test('posting a purchase payment settles the bills and records the expense register row', () => {
  const payment = page.indexOf('recordPurchasePayment(currentDb, bill');
  const regular = page.indexOf('const out = createExpense(store, db, input);');
  assert.ok(payment > 0, 'the payables branch calls the purchase engine');
  assert.ok(regular > payment, 'and the ordinary expense path follows it, so the settlement never falls through');
  assert.ok(page.includes("category: 'Purchase Bill Payment'"));
  assert.ok(page.includes("number: `Payment for ${bill.number}`") || page.includes('name: `Payment for ${bill.number}`'));
  assert.ok(page.includes("localStorage.setItem(KEY, JSON.stringify(currentDb));"));
  assert.ok(page.includes('{settlement ? \'Post Payment\' : \'Save Expense\'}'));
  assert.ok(page.includes('disabled={settlement}'), 'a vendor payment has no draft state');
  assert.ok(page.includes('paymentMethod,'), 'the purchase payment receives the method derived from Paid From');
});

test('the allocation sheet carries its own expense-scoped styles', () => {
  assert.ok(css.includes('.exp-reference-page .exp-allocation{display:grid;'));
  assert.ok(css.includes('.exp-reference-page .exp-allocation-table th{'));
  assert.ok(css.includes('.exp-reference-page .exp-unpaid .exp-allocation-table td:nth-child(5)'));
});
