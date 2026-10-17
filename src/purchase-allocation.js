/* FIFO allocation of a payment against a vendor's outstanding purchase bills.

   This is the payables mirror of src/income-allocation.js. The arithmetic is not
   duplicated: bills are projected into the same row shape the income allocation
   functions already consume (id, number, date, dueDate, total, outstanding), so
   FIFO order, manual rebalancing and validation stay one implementation. What
   this module owns is eligibility: which purchase bills may be paid, and what
   each one still owes after money already applied and debit notes.

   Amounts are integer paise, the same unit src/purchase-service.js stores. The
   module is pure - no storage read, no clock, no React - so the page can call it
   during render and the save path can revalidate the same rows. */
import { effectiveDueDate, fifoOrder, isPaise } from './income-allocation.js';

/* The Expense Type option that turns Create Expense into a payables settlement
   instead of a new expense. It is not an account code and must never be posted as
   one. */
export const PURCHASE_PAYMENT_TYPE = 'unpaid-purchases';

/* What one bill still owes: its own total less money already paid against it and
   less debit notes actually applied to it, floored at zero. The same arithmetic
   src/purchase-service.js vendorOutstanding() and src/supplier-outstanding.js use. */
export function purchaseBillBalance(bill) {
  const total = Number.isSafeInteger(bill?.total) ? bill.total : 0;
  const paid = Number.isSafeInteger(bill?.paidAmount) ? bill.paidAmount : 0;
  const credited = Number.isSafeInteger(bill?.creditApplied) ? bill.creditApplied : 0;
  return Math.max(0, total - paid - credited);
}

/* The bills a payment may be allocated against, in FIFO order - due date first,
   then bill date, then id. Eligibility is one predicate: the same vendor, posted,
   not cancelled, voided or deleted, inside the branch and organisation the working
   context permits, and still carrying a balance above zero. A bill that names no
   branch or organisation is read as the working one, the same reading the income
   allocation applies to its own rows. */
export function outstandingPurchaseBills(state, { vendorId, branchId = '', organisationId = '' } = {}) {
  const rows = [];
  if (!vendorId) return rows;
  for (const bill of state?.purchaseBills || []) {
    if (bill?.vendorId !== vendorId) continue;
    if (bill.posted !== true) continue;
    if (bill.status === 'Cancelled') continue;
    if (bill.voided === true || bill.deleted === true) continue;
    const branch = bill.branchId || bill.branch || '';
    if (branchId && branch && branch !== branchId) continue;
    const organisation = bill.organisationId || bill.organizationId || bill.organisation || bill.organization || bill.companyId || '';
    if (organisationId && organisation && organisation !== organisationId) continue;
    const outstanding = purchaseBillBalance(bill);
    if (!isPaise(outstanding) || outstanding <= 0) continue;
    rows.push({
      id: bill.id,
      number: String(bill.number || bill.vendorInvoice || ''),
      vendorId: bill.vendorId,
      vendorName: String(bill.vendorName || ''),
      date: String(bill.date || ''),
      dueDate: effectiveDueDate(bill),
      total: Number.isSafeInteger(bill.total) ? bill.total : 0,
      outstanding,
      payableAccount: bill.payableAccount || '2000'
    });
  }
  return fifoOrder(rows);
}
