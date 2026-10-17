/* FIFO allocation of a money receipt against a customer's outstanding sales invoices.

   Every amount this module reads or returns is an integer number of paise. Nothing here treats a
   frontend outstanding total as truth: the caller hands in the outstanding balance the invoice
   engine resolved from the invoice, its approved credit notes and its previous allocations - the
   same number `outstanding()` in src/invoice-engine.js computes - and these functions only order,
   cap and sum what they were given. The arithmetic is integer addition and `Math.min` on paise, so
   no rupee value ever passes through a floating-point multiply or divide.

   The module is pure: same inputs, same outputs, no storage read, no clock, no React. The Record
   Income surface calls `fifoAllocation` for its automatic suggestion, `validateAllocation` for the
   numbers a user typed by hand, and `allocationSummary` for the footer totals; the posting path in
   src/income-receipts.js revalidates the same rows through `validateAllocation` against freshly
   read balances, so a client-calculated split is only ever a preview. */
import { minor, outstanding } from './invoice-engine.js';

/* The one Income For choice that is a payment-settlement workflow rather than an income account: it
   is not a category in the Chart of Accounts and never credits revenue of its own. */
export const INVOICE_PAYMENT_CATEGORY = 'Payment for Existing Invoices';

/* The two answers the Record Income surface offers for money that settles nothing. */
export const ALLOCATION_RESIDUE = { ADVANCE: 'advance', INVOICE: 'invoice' };

export const isPaise = value => Number.isSafeInteger(value) && value >= 0;

/* Rupees - from an input, a record or a previous total - read as paise. An empty control is zero
   rather than an error, because a blank amount is a form waiting to be filled, not bad money; a
   negative or malformed one is rejected by `minor`, whose message this module does not restate. */
export function paise(value) {
  if (value === '' || value === null || value === undefined) return 0;
  return minor(value);
}

/* A pinned value read for arithmetic while the operator is still typing: anything the parser refuses
   - an empty box, a half-typed number, a negative one - counts as nothing here, and the save gate is
   what names the problem, because a split must never throw inside a render. */
const readablePaise = value => { try { return paise(value); } catch { return 0; } };

/* The effective due date of an invoice, used for ordering only. An invoice that names no due date
   is due on its own date - the policy this book already applies wherever a missing due date is
   read - so the FIFO order never depends on a due date the invoice does not have. */
export function effectiveDueDate(invoice) {
  const due = String(invoice?.dueDate || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : String(invoice?.date || '').trim();
}

/* FIFO order: due date ascending, then invoice date ascending, then invoice id ascending. Ties are
   broken by id so the order of two invoices written the same day is stable across renders, reloads
   and the server's own re-sort. */
export function fifoOrder(invoices) {
  return [...(invoices || [])].sort((a, b) =>
    effectiveDueDate(a).localeCompare(effectiveDueDate(b))
    || String(a?.date || '').localeCompare(String(b?.date || ''))
    || String(a?.id || '').localeCompare(String(b?.id || '')));
}

/* The invoices a receipt may be allocated against, in FIFO order.

   Eligibility is one predicate, stated once: the same customer, issued and posted, not cancelled,
   voided or deleted, not blocked from payment, inside the branch and organisation the working
   context permits, in the same currency, and still carrying a balance the invoice engine resolves
   to more than zero from the invoice, its approved credit notes and its previous allocations. An
   invoice that names no branch, organisation or currency is read as the working one rather than as
   a foreign document, which is the same reading the income register applies to its own rows. */
export function outstandingInvoices(book, { customerId, branchId = '', organisationId = '', currency = '' } = {}) {
  const rows = [];
  if (!customerId) return rows;
  for (const invoice of book?.invoices || []) {
    if (invoice?.customerId !== customerId) continue;
    if (invoice.posted !== true || invoice.status === 'Cancelled') continue;
    if (invoice.voided === true || invoice.deleted === true || invoice.blockedFromPayment === true) continue;
    if (!Number.isSafeInteger(invoice?.totals?.total)) continue;
    const branch = invoice.branchId || invoice.branch || '';
    if (branchId && branch && branch !== branchId) continue;
    const organisation = invoice.organisationId || invoice.organizationId || invoice.organisation || invoice.organization || invoice.companyId || '';
    if (organisationId && organisation && organisation !== organisationId) continue;
    if (currency && invoice.currency && invoice.currency !== currency) continue;
    const due = outstanding(book, invoice);
    if (!isPaise(due) || due <= 0) continue;
    rows.push({
      id: invoice.id,
      number: String(invoice.number || ''),
      customerId: invoice.customerId,
      customerName: String(invoice.customerName || ''),
      date: String(invoice.date || ''),
      dueDate: effectiveDueDate(invoice),
      currency: invoice.currency || currency || '',
      total: invoice.totals.total,
      outstanding: due
    });
  }
  return fifoOrder(rows);
}

/* The rows the allocation table falls back to when the payer it is pointed at owes nothing in this
   book. Record Income exists to spread money over invoices, so a payer with none leaves the table
   empty: there is nothing to distribute over and nothing to show what the table does. These three
   rows are shaped exactly like the book's own - the same fields, the same integer paise, the same
   order - so FIFO, a typed amount, the balance left after each payment and the totals all read them
   the same way. They are stamped, and the surface refuses to file them: a distribution shown for the
   walkthrough is not a receivable the book holds, and nothing here may invent one. */
const SAMPLE_INVOICE_ROWS = [
  { suffix: '001', date: '2026-09-05', dueDate: '2026-09-20', total: 590000 },
  { suffix: '002', date: '2026-09-12', dueDate: '2026-09-27', total: 1180000 },
  { suffix: '003', date: '2026-09-19', dueDate: '2026-10-04', total: 944000 }
];

/* What marks a row as a sample, so the one thing that must never happen to one - being filed - can
   be decided from the row itself rather than from where it was drawn. */
export const SAMPLE_INVOICE = 'sample';

export function isSampleInvoice(invoice) {
  return invoice?.source === SAMPLE_INVOICE;
}

/* The samples are bound to the payer the operator named, so one can never stand for somebody else's
   invoice, and they are numbered apart from the book's own series. The three amounts are the ones
   the project's own worked example uses, so the walkthrough and the documentation agree. */
export function sampleOutstandingInvoices(customerId = '', customerName = '') {
  if (!customerId) return [];
  return fifoOrder(SAMPLE_INVOICE_ROWS.map(row => ({
    id: 'sample-' + customerId + '-' + row.suffix,
    number: 'INV-S' + row.suffix,
    customerId,
    customerName,
    date: row.date,
    dueDate: row.dueDate,
    currency: '',
    total: row.total,
    outstanding: row.total,
    source: SAMPLE_INVOICE
  })));
}

/* The exact FIFO allocation the spec describes, as a pure function: walk the eligible invoices in
   FIFO order and give each one the smaller of what is left and what it is owed, until the money
   runs out or the invoices do. No invoice is ever given more than it is owed, the remainder is
   returned rather than absorbed, and every invoice offered is reported - including the ones that
   received nothing - so the allocation table can keep them on screen for a user who wants to pay a
   newer invoice first. */
export function fifoAllocation({ amount, invoices } = {}) {
  let remaining = paise(amount);
  const orders = fifoOrder(invoices);
  const rows = orders.map(invoice => {
    const owed = isPaise(invoice?.outstanding) ? invoice.outstanding : 0;
    const allocated = remaining > 0 && owed > 0 ? Math.min(remaining, owed) : 0;
    remaining -= allocated;
    return { invoiceId: invoice.id, amount: allocated, outstanding: owed };
  });
  return {
    invoices: orders,
    rows,
    allocations: rows.filter(row => row.amount > 0).map(({ invoiceId, amount }) => ({ invoiceId, amount })),
    allocated: rows.reduce((total, row) => total + row.amount, 0),
    unallocated: remaining
  };
}

/* The split a keystroke must leave behind, so a hand-typed amount can never leave the table
   over-allocated.

   `pinned` holds the rows the operator typed themselves, keyed by invoice id, in the rupee-string
   form the form stores. A pinned row keeps EXACTLY what was typed - the one thing a keystroke may
   never silently rewrite - and every other row is re-spread FIFO over the money that is left, oldest
   first and each capped at what that invoice is still owed. Typing Rs 1,500 onto a newer invoice
   therefore takes that Rs 1,500 off the older invoices that were carrying it, and typing less than
   FIFO hands the money back to the queue ahead of it.

   The amounts come back as the rupee strings the form stores, under the same keys and in the same
   FIFO row order `fifoAllocation` reports, so the table, the footer and the save gate keep reading
   one answer. `unallocated` goes negative when the typed rows alone exceed the money received, which
   is the state `validateAllocation` already turns into its own message rather than a silent clamp. */
export function rebalanceAllocation({ amount, invoices, pinned = {} } = {}) {
  const received = paise(amount);
  const orders = fifoOrder(invoices);
  const held = new Map();
  for (const invoice of orders) {
    const typed = pinned ? pinned[invoice.id] : undefined;
    if (typed !== undefined) held.set(invoice.id, readablePaise(typed));
  }
  let remaining = received - [...held.values()].reduce((total, value) => total + value, 0);
  if (remaining < 0) remaining = 0;
  const amounts = {};
  const rows = orders.map(invoice => {
    const owed = isPaise(invoice?.outstanding) ? invoice.outstanding : 0;
    if (held.has(invoice.id)) {
      amounts[invoice.id] = pinned[invoice.id];
      return { invoiceId: invoice.id, amount: held.get(invoice.id), outstanding: owed };
    }
    const given = remaining > 0 && owed > 0 ? Math.min(remaining, owed) : 0;
    remaining -= given;
    amounts[invoice.id] = rupeeString(given);
    return { invoiceId: invoice.id, amount: given, outstanding: owed };
  });
  const allocated = rows.reduce((total, row) => total + row.amount, 0);
  return {
    invoices: orders,
    rows,
    amounts,
    pinned: [...held.keys()],
    allocated,
    unallocated: received - allocated,
    overAllocated: Math.max(0, allocated - received)
  };
}

/* What a set of allocations typed by hand must satisfy before it may be stored or posted.

   The rules are the ones the posting path enforces again against freshly read balances: every
   invoice is one the customer actually owes money on and is in the eligible set it was drawn from,
   no invoice appears twice, no amount is negative or fractional, no allocation exceeds that
   invoice's own outstanding balance, and the allocations together do not exceed the money received.
   A row of zero is not an error - it is how a user skips an invoice - so it is dropped from the
   result rather than refused. Errors are returned as a list so the surface can show them together;
   the caller decides whether an empty list means "save" or "post". */
export function validateAllocation({ amount, rows, invoices, labels = {} } = {}) {
  const received = paise(amount);
  const noun = labels.object || 'invoice';
  const party = labels.party || 'customer';
  const nounTitle = noun.charAt(0).toUpperCase() + noun.slice(1);
  const article = /^[aeiou]/i.test(noun) ? 'an' : 'a';
  const eligible = new Map(fifoOrder(invoices).map(invoice => [String(invoice.id), invoice]));
  const errors = [];
  const allocations = [];
  const seen = new Set();
  let allocated = 0;
  for (const row of rows || []) {
    const invoiceId = String(row?.invoiceId ?? '');
    if (!invoiceId) { errors.push(`Every allocation needs ${article} ${noun}.`); continue; }
    const invoice = eligible.get(invoiceId);
    if (!invoice) { errors.push(`That ${noun} is no longer open for this ${party}. Refresh the allocation.`); continue; }
    if (seen.has(invoiceId)) { errors.push(`${nounTitle} ${invoice.number || invoiceId} is listed twice.`); continue; }
    seen.add(invoiceId);
    let value;
    try { value = paise(row?.amount); } catch { errors.push(`Enter a valid amount for ${invoice.number || invoiceId}.`); continue; }
    if (!isPaise(value)) { errors.push(`Enter a valid amount for ${invoice.number || invoiceId}.`); continue; }
    if (value > invoice.outstanding) {
      errors.push(`${invoice.number || invoiceId} is owed ${money(invoice.outstanding)}; the allocation cannot be larger than that.`);
      continue;
    }
    allocated += value;
    if (value > 0) allocations.push({ invoiceId, amount: value });
  }
  const unallocated = received - allocated;
  if (unallocated < 0) {
    errors.push(`Allocations are ${money(-unallocated)} more than the amount received. Reduce an allocation or raise the amount.`);
  }
  return { allocations, allocated, unallocated, errors };
}

/* The totals the compact bottom summary prints, plus the customer advance, and the one question the
   surface asks of them: is every paisa received accounted for, either against an invoice or held as
   an advance the customer can be credited with later? */
export function allocationSummary({ amount, allocations = [], advance = 0 } = {}) {
  const received = paise(amount);
  const allocated = (allocations || []).reduce((total, row) => total + (isPaise(row?.amount) ? row.amount : 0), 0);
  const advanceValue = isPaise(advance) ? advance : 0;
  const accountedFor = allocated + advanceValue;
  return {
    received,
    allocated,
    advance: advanceValue,
    unallocated: received - accountedFor,
    accountedFor,
    balanced: accountedFor === received
  };
}

/* The amount a row is still owed after a payment, for the allocation table's last column. */
export function balanceAfter(outstandingBalance, allocated) {
  const owed = isPaise(outstandingBalance) ? outstandingBalance : 0;
  const paid = isPaise(allocated) ? allocated : 0;
  return Math.max(0, owed - paid);
}

/* Paise as a plain rupee string - the form every amount control and every stored record uses.
   Written by splitting the integer, so a rupee value is never produced by a float division. */
export function rupeeString(value) {
  const amount = isPaise(value) ? value : paise(value);
  return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, '0')}`;
}
/* Paise as the surface writes them. Kept beside the arithmetic so a rupee string is only ever
   produced for display, never fed back into a calculation. */
export function money(value) {
  const amount = isPaise(value) ? value : 0;
  return `\u20b9${(amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

