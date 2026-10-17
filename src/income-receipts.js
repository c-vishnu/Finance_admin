/* The one bridge between the Record Income surface and the receipt engine.

   Record Income asks for two different things under one form, and the difference is accounting, not
   layout: money received AGAINST existing sales invoices settles a receivable that was already
   recognised as revenue and GST when the invoice was raised, and money received as DIRECT income
   recognises new revenue. The first workflow is the Payment Received module's job, so this module
   drives the receipt engine that already exists - draft, submit, approve, post, allocate - and the
   second is left to the income store's own posting path. Nothing here writes a journal of its own,
   which is what keeps an invoice payment from crediting sales or output GST a second time.

   The allocation the browser calculated is only a preview: every row is revalidated here against the
   invoices the book currently holds, and the receipt engine validates them again against the
   balances it locks at posting time. A stale allocation is refused with an error rather than
   silently rewritten, and the receipt carries the idempotency key it was saved with so a retried
   submission finds the receipt it already created instead of posting a second one. */
import { receiptAdvanceAccount, receiptCommand, receiptRows } from './receipt-engine.js';
import { INVOICE_PAYMENT_CATEGORY, allocationSummary, money, outstandingInvoices, paise, rupeeString, validateAllocation } from './income-allocation.js';
import { advanceTax, placeOfSupply } from './income-tax.js';
import { createReceiptIncome } from './operations-store.js';

/* MODES is the receipt engine's own vocabulary; this is the page's, mapped onto it so the picker can
   keep the words the operator asked it to offer without inventing a second set of modes. */
const MODE_BY_METHOD = {
  'Bank transfer': 'Bank Transfer', 'Bank Transfer': 'Bank Transfer',
  UPI: 'UPI',
  'Credit / Debit Card': 'Card', Card: 'Card',
  Cheque: 'Cheque', 'Demand Draft': 'Other', Cash: 'Cash', Other: 'Other'
};
export const receiptMode = method => MODE_BY_METHOD[method] || 'Bank Transfer';

/* Whether this book can hold a customer advance at all: the settings' liability account, or the one
   the chart already carries. The surface asks this before it offers the choice, so a book with no
   advance ledger is never offered a way to record money it cannot file. */
export const advanceLedger = book => receiptAdvanceAccount(book || {});

const rupees = value => rupeeString(value);
const message = list => list.join(' ');

/* The number the receipt engine will give the next receipt. It reads the receipt register the same
   way the engine does and only asks the question - the engine still decides the number when the
   receipt is saved - so the header can state what the operator is about to file. */
export function receiptNumberPreview(book) {
  const used = new Set(receiptRows(book).map(row => String(row.number || '')));
  let count = 1;
  while (used.has('RCPT-' + String(count).padStart(5, '0'))) count += 1;
  return 'RCPT-' + String(count).padStart(5, '0');
}

/* The invoices the selected customer may be offered. Exported so the surface and this module read
   the eligible set from the same rule. */
export const eligibleInvoices = (book, input) => outstandingInvoices(book, {
  customerId: input?.customerId,
  branchId: input?.branchId || '',
  organisationId: input?.organisationId || '',
  currency: input?.currency || ''
});

/* A draft receipt exists only in the income store: nothing has posted, so there is no journal, no
   allocation and nothing for the receipt engine to hold. Filing it here means a draft is always
   safe to reopen, which is the same promise a draft direct income makes. */
function saveDraft(store, input, existingId) {
  const row = { ...input, id: existingId || '', amount: rupees(input.amount), status: 'Draft', allocations: input.allocations, advanceAmount: 0 };
  const out = createReceiptIncome(store, row);
  return { store: out.store, record: out.record, receipt: null };
}

/* Record the money received against a customer's invoices.

   The order is the atomic posting workflow: validate the receipt and its allocations against the
   book as it is now, create the receipt, post its balanced journal, apply the allocations to the
   invoices, hold any remainder the operator claimed as a customer advance (a liability, never
   income), and only then file the register row that points at the posted journal. */
export function saveInvoiceReceipt({ book, store, input, ctx = {}, idempotencyKey = '', targetStatus = 'Posted' }) {
  if (targetStatus === 'Draft') return { ...saveDraft(store, input, input.id || ''), book, allocations: input.allocations || [] };

  const received = paise(input.amount);
  if (!(received > 0)) throw Error('Enter the amount received.');
  const customer = (ctx.customers || []).find(row => row.id === input.customerId);
  if (!customer) throw Error('Select the customer this payment came from.');
  if (input.advance === true && !advanceLedger(book)) throw Error('This book has no customer-advance liability account, so the remainder cannot be held. Allocate it to an invoice instead.');

  /* Already saved under this key: a retried submission reuses the receipt it created rather than
     posting a second one. */
  const existingReceipt = idempotencyKey ? receiptRows(book).find(row => row.idempotencyKey === idempotencyKey && row.status !== 'Cancelled') : null;
  if (existingReceipt) {
    const filed = (store.incomes || []).find(row => row.receiptId === existingReceipt.id);
    if (filed) return { book, store, receipt: existingReceipt, record: filed, allocations: filed.allocations || [], repeated: true };
  }

  const offered = eligibleInvoices(book, input);
  const checked = validateAllocation({ amount: input.amount, rows: input.allocations, invoices: offered });
  if (checked.errors.length) throw Error(message(checked.errors));
  const summary = allocationSummary({ amount: input.amount, allocations: checked.allocations, advance: input.advance === true ? checked.unallocated : 0 });
  if (!summary.balanced) {
    if (summary.unallocated > 0) throw Error(`${money(summary.unallocated)} of the money received is not accounted for. Allocate it to an invoice, or hold it as a customer advance.`);
    throw Error('The allocations do not add up to the amount received.');
  }

  /* A remainder held for a supply nobody has classified is never assumed to be free of tax: whether
     the money is chargeable when it arrives depends on what it is for, so the question is put back to
     the operator rather than answered for them. The tax itself is computed here, from the book's own
     registered state and the facts the receipt states, rather than taken from the caller - the same
     pure function the page previewed with and the engine posts with, so none of the three can
     disagree. */
  const held = summary.advance > 0
    ? advanceTax({
        amount: rupeeString(summary.advance),
        treatment: input.advanceTaxTreatment,
        rate: input.advanceRate || 0,
        supply: input.advanceSupply,
        intra: placeOfSupply({ buyerState: input.advancePlaceOfSupply || input.placeOfSupply, registeredState: book.config?.state }).intra
      })
    : null;
  if (held?.errors.length) throw Error(held.errors[0]);

  const payload = {
    date: input.date,
    customerId: input.customerId,
    amount: rupees(received),
    bank: input.receivedIn,
    mode: receiptMode(input.method),
    kind: 'Normal',
    /* The remainder the operator claimed. The engine credits exactly this much to the advance
       liability and credits the rest to the receivable, so the two halves add back to the money. */
    acceptAdvance: summary.advance > 0,
    reference: input.reference || '',
    notes: input.notes || '',
    allocations: checked.allocations.map(row => ({ invoiceId: row.invoiceId, amount: rupeeString(row.amount) })),
    idempotencyKey,
    branchId: input.branchId || '',
    branchName: input.branchName || '',
    organizationId: input.organisationId || '',
    organizationName: input.organisationName || '',
    /* The supply the held remainder is for, and the tax it carries at receipt. The engine needs these
       to credit the advance liability net of the tax it charges now, so a services advance is taxed
       when the money arrives and a goods advance is not assumed to be either. */
    placeOfSupply: input.placeOfSupply || '',
    advanceSupply: input.advanceSupply || '',
    advanceTaxTreatment: input.advanceTaxTreatment || '',
    advanceRate: input.advanceRate === '' || input.advanceRate == null ? 0 : Number(input.advanceRate),
    advancePlaceOfSupply: input.advancePlaceOfSupply || input.placeOfSupply || ''
  };

  let out;
  try {
    out = receiptCommand(book, 'save', payload, ctx);
    out = receiptCommand(out.state, 'submit', { id: out.result.id }, ctx);
    if (out.result.status === 'Submitted') {
      if (!ctx.canApprove) throw Error(`Receipt ${out.result.number} is above this book's approval threshold. A manager must approve it in Receipts before it can be posted.`);
      out = receiptCommand(out.state, 'approve', { id: out.result.id }, ctx);
    }
    out = receiptCommand(out.state, 'post', { id: out.result.id }, ctx);
  } catch (reason) {
    /* A balance that moved while the form was open is the one failure an operator can act on, so it
       is stated as what changed and what to do, and the stale allocation is never quietly rewritten. */
    if (/outstanding balance|posted invoices belonging|receivable mapping differs|exceeds the available/.test(reason.message)) {
      throw Error(`The invoices changed while this form was open and the allocation no longer fits them. Refresh the allocation and check the distribution again. (${reason.message})`);
    }
    throw reason;
  }

  const receipt = out.result;
  const settled = checked.allocations.map(row => ({ invoiceId: row.invoiceId, amount: row.amount }));
  const document = settled.length === 1 ? settled[0].invoiceId : '';
  const filed = createReceiptIncome(store, {
    id: input.id || '',
    date: input.date,
    name: input.name || `${INVOICE_PAYMENT_CATEGORY} · ${customer.name}`,
    category: INVOICE_PAYMENT_CATEGORY,
    receivedFrom: customer.name,
    payee: customer.name,
    customerId: customer.id,
    amount: rupees(received),
    received: true,
    paidThrough: receipt.bank,
    accountReceivable: receipt.arAccount,
    account: receipt.arAccount,
    method: input.method,
    reference: input.reference || '',
    referenceNo: input.referenceNo || '',
    gstTreatment: input.gstTreatment || '',
    tax: input.tax || 'No tax',
    taxMode: input.taxMode || 'exclusive',
    description: input.description || '',
    files: input.files || [],
    receiptId: receipt.id,
    receiptNumber: receipt.number,
    journalId: receipt.journalId,
    salesInvoiceId: document,
    allocations: settled,
    advanceAmount: summary.advance,
    /* What the remainder is for and the tax it carried when it was received, so the advance can be
       applied against a later invoice without charging the same tax twice. */
    advanceSupply: input.advanceSupply || '',
    /* The tax this module computed for the remainder, never the number the browser sent. */
    advanceGst: held ? held.gst : 0,
    taxTreatment: input.taxTreatment || '',
    gstRate: input.gstRate === '' || input.gstRate == null ? 0 : Number(input.gstRate),
    taxMode: input.taxMode || '',
    placeOfSupply: input.placeOfSupply || '',
    plannedAllocations: settled,
    status: 'Posted'
  });
  return { book: out.state, store: filed.store, receipt, record: filed.record, allocations: settled, summary };
}