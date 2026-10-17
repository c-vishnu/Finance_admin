import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  IconArrowLeft,
  IconAlertTriangle,
  IconPaperclip,
  IconTrash,
  IconReceipt,
  IconWallet,
  IconPercentage,
  IconRefresh,
  IconFileText,
  IconSearch,
  IconChevronDown,
  IconCalendar,
  IconUser,
  IconBuildingBank,
  IconCashBanknote,
  IconPaperclip as IconAttachment
} from '@tabler/icons-react';
import { readAccounts } from './account-store.js';
import { readOperations, saveOperations, createIncome, updateIncome, accountingState, DEFAULT_INCOME_CATEGORIES } from './operations-store.js';
import { KEY } from './invoice-engine.js';
import { customerSeeds } from './Customers.jsx';
import './journal-entries.css';
import './journal-form.css';
import './record-transaction.css';
import { getCurrentOrganizationContext } from './organisation-context.js';
import {
  INVOICE_PAYMENT_CATEGORY, allocationSummary, fifoAllocation, isSampleInvoice, money, paise,
  rebalanceAllocation, rupeeString, sampleOutstandingInvoices, validateAllocation
} from './income-allocation.js';
import { eligibleInvoices, saveInvoiceReceipt } from './income-receipts.js';
import { readSettings } from './settings-store.js';
import {
  ADVANCE_SUPPLIES, GST_TREATMENTS as GST_TREATMENT_OPTIONS, TAXABLE_TREATMENT, UNKNOWN_SUPPLY, UNTAXED_TREATMENTS,
  advanceTax, configuredRates, directIncomeTax, gstSummary, placeOfSupply, taxLabelOf, taxModeFromSettings, TAX_MODES
} from './income-tax.js';

const GST_TREATMENTS = [
  'Registered Business - Regular',
  'Registered Business - Composition',
  'Unregistered Business',
  'Consumer',
  'Overseas',
  'SEZ'
];

const TAX_OPTIONS = [
  'GST 18%', 'GST 12%', 'GST 5%', 'GST 28%', 'GST 0%', 'Non-GST / Exempt'
];

const PAYMENT_METHODS = [
  'Bank transfer', 'UPI', 'Credit / Debit Card', 'Cheque', 'Cash', 'Demand Draft', 'Other'
];

function SearchableCustomerSelect({ customers, selectedCustomerId, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c => 
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.companyName && c.companyName.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId || c.name === selectedCustomerId);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          minHeight: '38px',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          background: '#fff',
          textAlign: 'left',
          fontSize: '14px',
          color: selectedCustomer ? '#0f172a' : '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedCustomer ? `${selectedCustomer.name}${selectedCustomer.companyName ? ` (${selectedCustomer.companyName})` : ''}` : 'Search & Select Customer *'}
        </span>
        <IconChevronDown size={16} style={{ color: '#64748b', marginLeft: '6px', flexShrink: 0 }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          zIndex: 999,
          background: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
          maxHeight: '260px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconSearch size={15} style={{ color: '#64748b', flexShrink: 0 }} />
            <input
              type="text"
              autoFocus
              placeholder="Search customer by name, company, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                color: '#0f172a'
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: 0 }}
              >
                ×
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            <div
              onClick={() => { onSelect(null); setIsOpen(false); setSearch(''); }}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                color: '#64748b',
                cursor: 'pointer',
                background: !selectedCustomer ? '#f1f5f9' : 'transparent'
              }}
            >
              -- Select Customer --
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
                No matching customers found
              </div>
            ) : (
              filtered.map(c => (
                <div
                  key={c.id}
                  onClick={() => { onSelect(c); setIsOpen(false); setSearch(''); }}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    color: '#0f172a',
                    cursor: 'pointer',
                    background: (c.id === selectedCustomerId || c.name === selectedCustomer?.name) ? '#eff6ff' : 'transparent',
                    fontWeight: (c.id === selectedCustomerId || c.name === selectedCustomer?.name) ? 600 : 400,
                    borderBottom: '1px solid #f8fafc'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{c.name} {c.companyName ? `(${c.companyName})` : ''}</span>
                    {c.email && <span style={{ fontSize: '11px', color: '#64748b' }}>{c.email}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* The workflow an untouched Income For picker starts on, and the account that answers for it: plain
   income the book recognises. Record Income holds two workflows behind that one picker, and on a fresh
   form the payer is the other thing that answers the question - money from somebody who still owes on
   an invoice settles revenue the book has already recognised, money from anybody else is income the
   book has not recognised yet. So the picker follows the payer until the operator answers it
   themselves; see handleCustomerSelect. Both states are named once, here, and read from here. */
const DEFAULT_INCOME_CATEGORY = 'Service Income';
const DEFAULT_INCOME_ACCOUNT = '4100';

/* The blank Record Income form, and the same form seeded from an income the register already
   holds. Edit and Duplicate both reopen this surface: the values are the record's own, so the
   operator reviews what they are about to write instead of trusting a silent copy, and the
   amount is stated in rupees the way the field asks for it (the record stores paise). Only a
   draft carries an identity into the save, which is why `editing` is decided from the record
   rather than from the prop alone. */
const blankIncomeForm = () => ({
  date: new Date().toISOString().split('T')[0],
  category: DEFAULT_INCOME_CATEGORY,
  account: DEFAULT_INCOME_ACCOUNT,
  categoryChosen: false, /* true once the Income For picker is used, so a payer cannot rewrite an answer the operator gave */
  receivedFrom: '',
  customerId: '',
  amount: '',
  received: true, // true = Yes money received, false = No expected later
  paymentType: 'Bank', // 'Bank' or 'Cash'
  paidThrough: '1010', // 1010 = Bank Account
  accountReceivable: '1100', // Accounts Receivable
  method: 'Bank transfer',
  reference: '',
  expectedDate: '',
  gstTreatment: 'Registered Business - Regular',
  tax: 'GST 18%', /* the label the register reads back, written from the rate the operator chose */
  taxTreatment: TAXABLE_TREATMENT, /* what the GST block asks: taxable, exempt, zero rated, outside GST */
  gstRate: '', /* a rate the book's own configuration names, chosen on the page and never assumed */
  taxMode: 'exclusive', /* inclusive or exclusive, defaulted from the settings record as the form opens */
  advanceSupply: '', /* what a held remainder is for, because that decides whether GST is due now */
  referenceNo: '',
  salesInvoiceId: '',
  allocations: {}, // what the operator typed per invoice, keyed by invoice id and held in rupees
  allocationManual: false, // true once any amount has been typed by hand, so FIFO stops deciding
  advance: false, // the remainder the operator chose to hold rather than allocate
  description: '',
  files: []
});

const formFromIncome = income => {
  const received = income.received === true || income.received === 'true' || income.received === 'Yes';
  return {
    ...blankIncomeForm(),
    date: income.date || blankIncomeForm().date,
    category: income.category || DEFAULT_INCOME_CATEGORY,
    account: income.account || DEFAULT_INCOME_ACCOUNT,
    categoryChosen: true, /* a saved record already holds the answer the picker was given, and the payer is not asked for it again */
    receivedFrom: income.receivedFrom || income.payee || '',
    customerId: income.customerId || '',
    amount: Number.isFinite(Number(income.amount)) ? String(Number(income.amount) / 100) : '',
    received,
    paymentType: income.paidThrough === '1000' ? 'Cash' : 'Bank',
    paidThrough: income.paidThrough || '1010',
    accountReceivable: income.accountReceivable || '1100',
    method: income.method || 'Bank transfer',
    reference: income.reference || '',
    expectedDate: income.expectedDate || '',
    gstTreatment: income.gstTreatment || 'Registered Business - Regular',
    tax: income.tax || 'GST 18%',
    taxTreatment: GST_TREATMENT_OPTIONS.includes(income.taxTreatment) ? income.taxTreatment : TAXABLE_TREATMENT,
    gstRate: income.gstRate === undefined || income.gstRate === null ? '' : String(income.gstRate),
    taxMode: income.taxMode || 'exclusive',
    advanceSupply: ADVANCE_SUPPLIES.includes(income.advanceSupply) ? income.advanceSupply : '',
    referenceNo: income.referenceNo || '',
    salesInvoiceId: income.salesInvoiceId || '',
    /* A receipt reopens with the split it was filed with, not with a fresh FIFO run: the customer's
       invoices may have moved since, and the draft's own distribution is what was agreed. */
    allocations: Object.fromEntries((Array.isArray(income.allocations) ? income.allocations : []).map(row => [row.invoiceId, rupeeString(row.amount)])),
    allocationManual: income.allocationManual === true,
    advance: income.advanceRequested === true,
    description: income.description || '',
    files: Array.isArray(income.files) ? income.files : []
  };
};

/* The rows the allocation is read from: every eligible invoice, in the order the table shows them,
   with the amount the operator is looking at. Rows of zero are kept here because validateAllocation
   is what drops them, so the table and the validation can never describe different rows. */
const allocationRowsFor = (invoices, amounts) => invoices.map(invoice => ({ invoiceId: invoice.id, amount: amounts[invoice.id] }));

/* The date under an invoice number reads the way every other date in the book reads. */
const shortDate = value => value ? new Date(value + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function CreateIncomePage({ onCancel, onSaved, income = null, copy = false }) {
  const [error, setError] = useState('');
  /* Edit replaces the draft the register opened; Duplicate only borrows its values, so the copy
     is saved as a new income through createIncome. */
  const editing = Boolean(income && !copy && income.status === 'Draft');

  const accounts = readAccounts();
  const allAccounts = accounts?.accounts || [];
  const cashAccounts = allAccounts.filter(a => a.type === 'Assets' && (a.code === '1000' || a.name?.toLowerCase().includes('cash')));
  const bankAccounts = allAccounts.filter(a => a.type === 'Assets' && a.code !== '1000' && (a.code?.startsWith('10') || a.name?.toLowerCase().includes('bank')));

  /* What the Received In picker offers: every account the money could have landed in, cash first,
     with the one control carrying the three states the record keeps - no account chosen means the
     money has not arrived yet, 1000 is the cash box, anything else is the bank account it reached. */
  const receivedInOptions = [];
  for (const account of [...cashAccounts, ...bankAccounts]) {
    if (!receivedInOptions.some(a => a.code === account.code)) receivedInOptions.push(account);
  }
  if (receivedInOptions.length === 0) receivedInOptions.push({ code: '1010', name: 'Bank' });

  /* The same list split into the two answers the operator asked the picker to offer: the cash box,
     and the banks the money could have reached. Cash is the one account the book names as cash
     (1000); every other account in the list belongs under Bank, so that group can offer more than
     one bank without adding a second control to the card. */
  const cashInOptions = receivedInOptions.filter(a => a.code === '1000');
  const bankInOptions = receivedInOptions.filter(a => a.code !== '1000');

  // Customers list
  const customers = useMemo(() => {
    try {
      const raw = localStorage.getItem('wayvida-customers');
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list) && list.length > 0) return list;
    } catch {}
    return customerSeeds;
  }, []);

  /* Sales Invoices list for linking. The book the income is posted into is the one place an invoice
     is filed, and it is the same book the register reads the linked number back out of, so the link
     offers those invoices first; the legacy key is read only for a store an older build wrote. */
  const salesInvoices = useMemo(() => {
    try {
      const filed = readAccounts()?.invoices;
      if (Array.isArray(filed) && filed.length) return filed.filter(inv => inv.status !== 'Cancelled');
      const raw = localStorage.getItem('wayvida-invoices');
      const legacy = raw ? JSON.parse(raw) : [];
      if (Array.isArray(legacy)) return legacy.filter(inv => inv.status !== 'Cancelled');
    } catch {}
    return [];
  }, []);

  // Categories list
  const categories = useMemo(() => {
    try {
      const store = readOperations();
      if (store.incomeCategories && store.incomeCategories.length > 0) {
        return store.incomeCategories;
      }
    } catch {}
    return DEFAULT_INCOME_CATEGORIES;
  }, []);

  /* What the book's own tax configuration states, read as the facts it is: the organisation default
     and the rates its active income categories name, which is the rate a fresh form starts from, and
     the registered state, which is the fact applyAccountingSettings writes into the book and which
     decides the place of supply. The page keeps no slab list of its own. */
  const settings = useMemo(() => readSettings(), []);
  const registeredState = settings?.tax?.registeredState || '';
  const gstRates = useMemo(
    () => configuredRates({ categories, settings, accounts: allAccounts }),
    [categories, settings, allAccounts]
  );

  // Form State
  const [form, setForm] = useState(() => {
    const base = income ? formFromIncome(income) : blankIncomeForm();
    return {
      ...base,
      /* A fresh form is never asked a question the book has already answered: the calculation comes
         from the settings record, and the rate from the configuration the book actually carries. */
      taxMode: income ? base.taxMode : taxModeFromSettings(settings),
      gstRate: base.gstRate !== '' ? base.gstRate : (gstRates[0] === undefined ? '' : String(gstRates[0]))
    };
  });
  /* One key per form, so a submission retried by a double click or a flaky connection finds the
     receipt it already created instead of posting a second one. */
  const idempotencyKey = useRef('');

  /* Record Income holds two workflows behind one form, and the difference is accounting rather than
     layout: Payment for Existing Invoices settles money the book has already recognised as revenue
     and GST, while every other choice recognises new income. */
  const { company, branch } = getCurrentOrganizationContext();
  const isInvoicePayment = form.category === INVOICE_PAYMENT_CATEGORY;
  /* The invoices one payer owes on. The allocation table and the Invoice link ask the SAME
     question - what does this person still owe? - so they read the same list, exactly as the
     Payment Received surface's Unpaid invoices section reads it: that customer's own outstanding
     sales invoices out of the book this income posts into. The link is never offered the whole
     book, so an invoice can only ever be linked to the person who owes it. */
  const payerInvoices = form.customerId
    ? eligibleInvoices(accounts, { customerId: form.customerId, branchId: branch?.id || '', organisationId: company?.id || '' })
    : [];
  /* A payer who owes nothing in this book leaves the table empty, which is the truth and a poor thing
     to demonstrate the page with: spreading money needs invoices to spread it over, and the walkthrough
     this page exists for has nothing to show without them. Three sample rows stand in while the payer
     has none - shaped exactly like the book's own rows, stamped as samples, and never fileable, because
     a demonstration of a distribution is not a receivable the book holds. */
  const samplePayee = isInvoicePayment && Boolean(form.customerId) && payerInvoices.length === 0;
  const openInvoices = !isInvoicePayment
    ? []
    : samplePayee
      ? sampleOutstandingInvoices(form.customerId, form.receivedFrom)
      : payerInvoices;
  /* The invoice an existing record already names, so editing one can still read - and keep - the
     link it was saved with even after that invoice has been settled and left the unpaid list. */
  const linkedInvoice = form.salesInvoiceId ? salesInvoices.find(invoice => invoice.id === form.salesInvoiceId) : null;
  /* The field is drawn only when it has an invoice to offer, so the empty answer it reads
     back is only ever one of two: the allocation table is choosing the invoices, or this
     money is not settling anything and the link is an optional one. Both answers are kept
     short on purpose: the field is one track of the card, and a select states its text on
     one line, so an answer longer than the box is simply cut off mid-sentence and the
     operator reads a broken sentence where the workflow was meant to be named. */
  const invoiceFieldPlaceholder = isInvoicePayment
    ? '-- Settled by the table below --'
    : '-- Not linked to an invoice --';
  const invoiceFieldTitle = isInvoicePayment
    ? 'The allocation below decides which invoices this money settles.'
    : 'Link this income to one of the invoices this customer still owes on (optional).';
  /* FIFO is the default recommendation and the row the operator types is the one thing a keystroke
     may not rewrite: that row keeps exactly what they entered and every OTHER row is re-spread over
     the money that is left, oldest first, so changing one invoice moves the difference off the other
     invoices instead of stacking it on top of them. The arithmetic is `rebalanceAllocation`'s and the
     numbers stay integers of paise throughout. */
  const fifo = fifoAllocation({ amount: form.amount, invoices: openInvoices });
  const fifoAmounts = Object.fromEntries(fifo.rows.map(row => [row.invoiceId, row.amount]));
  const spread = rebalanceAllocation({ amount: form.amount, invoices: openInvoices, pinned: form.allocationManual ? form.allocations : {} });
  const allocationAmounts = spread.amounts;
  /* The one row a keystroke kept, and what it holds, so the line under the table can name it and say
     which way the difference went. */
  const pinnedRow = form.allocationManual
    ? openInvoices.find(invoice => form.allocations[invoice.id] !== undefined) || null
    : null;
  const pinnedAmount = pinnedRow ? spread.rows.find(row => row.invoiceId === pinnedRow.id)?.amount || 0 : 0;
  /* A typed amount is only ever read through the shared parser, so an unfinished entry is a message
     rather than a crash, and nothing downstream sees a rupee value it cannot parse. */
  const amountError = (() => { try { paise(form.amount); return ''; } catch (reason) { return reason.message; } })();
  const receivedPaise = amountError ? 0 : paise(form.amount);
  const checkedAllocation = amountError
    ? { allocations: [], allocated: 0, unallocated: 0, errors: [] }
    : validateAllocation({ amount: form.amount, rows: allocationRowsFor(openInvoices, allocationAmounts), invoices: openInvoices });
  const allocation = allocationSummary({ amount: amountError ? 0 : form.amount, allocations: checkedAllocation.allocations, advance: form.advance ? checkedAllocation.unallocated : 0 });
  const requestedAdvance = form.advance && checkedAllocation.unallocated > 0;

  /* The GST facts this receipt states, read the same way the store reads them when it posts: the
     payer's state against the book's registered state decides CGST/SGST against IGST, a taxable
     income needs the rate the book names, and a remainder held as a customer advance is taxed on the
     supply it is for - never on the assumption that it carries no tax. An invoice settlement adds no
     tax of its own: what the invoice already recorded is the whole answer. */
  const payer = customers.find(c => c.id === form.customerId) || null;
  const place = placeOfSupply({ buyerState: payer?.state || '', registeredState });
  /* The GST card the operator answered these two questions in is not drawn on this page any more, so
     the page states the answers instead of asking for them: a taxable income the book names no rate
     for is a supply it has not taxed, and a remainder nobody has classified is an unknown future
     supply - the one state the tax module already offers for exactly that, and the one that holds the
     money as a liability without assuming a tax. A record being edited keeps whatever treatment it was
     saved with. Both answers are written onto the record below, and the footer states the figures that
     were posted, so nothing about the tax is left implicit. */
  const taxTreatmentForTheBook = form.taxTreatment === TAXABLE_TREATMENT && !(Number(form.gstRate) > 0)
    ? (UNTAXED_TREATMENTS.find(value => /non-gst|out of scope/i.test(value)) || UNTAXED_TREATMENTS[0] || form.taxTreatment)
    : form.taxTreatment;
  const advanceSupplyForTheBook = form.advanceSupply || UNKNOWN_SUPPLY;
  const directTax = directIncomeTax({ amount: form.amount, treatment: taxTreatmentForTheBook, rate: form.gstRate, mode: form.taxMode, intra: place.intra, received: form.received });
  const advanceHeld = requestedAdvance ? checkedAllocation.unallocated : 0;
  const advanceFacts = advanceTax({ amount: rupeeString(advanceHeld), treatment: taxTreatmentForTheBook, rate: form.gstRate, supply: advanceSupplyForTheBook, intra: place.intra });
  const tax = gstSummary({ workflow: advanceHeld > 0 ? 'advance' : isInvoicePayment ? 'invoice' : 'direct', direct: directTax, advance: advanceFacts });
  const advanceGst = requestedAdvance ? advanceFacts.gst : 0;
  /* What the record stores as its tax label, written from the rate so one number never has two
     spellings: the register, the GST registers and the older readers all read this string back. */
  const taxLabel = taxTreatmentForTheBook === TAXABLE_TREATMENT && Number(form.gstRate) > 0 ? taxLabelOf(form.gstRate) : taxLabelOf(0);
  /* What the tax row above the reference asks, read the way the module computes it: whether the
     treatment the operator picked is the one that carries a rate, and the one sentence that says
     what the figures in the bar are about to do with the money - taken out of a receipt that has
     already arrived, charged on top of income still awaited, or never charged at all because the
     operator called the supply an untaxed one. A taxable income this book names no rate for is
     stated as the unanswered question it is rather than quietly filed as Non-GST, which is what
     the page would otherwise do with a question it never got a usable answer to. */
  const incomeIsTaxable = form.taxTreatment === TAXABLE_TREATMENT;
  const taxRateStated = incomeIsTaxable && Number(form.gstRate) > 0;
  const taxNote = !incomeIsTaxable
    ? 'This income is not a taxable supply, so no GST is split out of the amount received.'
    : !taxRateStated
      ? 'A taxable income needs the rate this book charges, and its tax configuration names none yet: name one there, or record this income as Non-GST / Exempt.'
      : form.received
        ? 'The money has arrived, so the amount received is the gross: its GST is taken out of it, because a receipt is never enlarged to carry the tax.'
        : form.taxMode === 'exclusive'
          ? 'The money is still awaited, so the GST is charged on top of the income and the customer owes the two together.'
          : 'The money is still awaited and the stated income is the gross: its GST is part of it rather than added on top.';

  const setField = (key, value) => {
    setError('');
    setForm(f => ({ ...f, [key]: value }));
  };

  /* What a payer who owes nothing in this book leaves behind: the settlement workflow has no
     invoice to settle, so the money belongs to the income workflow - the same workflow an
     unanswered Income For picker already opens for such a payer. The account follows the
     category out of the chart of accounts, with the page own default only for a book whose
     category list has never been seeded, and the split the settlement workflow held is dropped
     with it because it allocated against rows this book does not hold. */
  const switchToIncome = () => {
    const matched = categories.find(c => c.name === DEFAULT_INCOME_CATEGORY);
    const account = matched ? matched.account : DEFAULT_INCOME_ACCOUNT;
    setError('');
    setForm(f => ({
      ...f,
      category: DEFAULT_INCOME_CATEGORY,
      categoryChosen: true,
      account,
      allocations: {},
      allocationManual: false,
      advance: false
    }));
    return { category: DEFAULT_INCOME_CATEGORY, account };
  };

  /* Choosing the settlement workflow, or leaving it, changes what the allocation means, so any split
     the previous workflow had is dropped with it rather than carried into accounting it does not fit. */
  const handleCategoryChange = (categoryName) => {
    const matched = categories.find(c => c.name === categoryName);
    const wasSettlement = form.category === INVOICE_PAYMENT_CATEGORY;
    const isSettlement = categoryName === INVOICE_PAYMENT_CATEGORY;
    setError('');
    setForm(f => ({
      ...f,
      category: categoryName,
      categoryChosen: true,
      account: matched ? matched.account : (isSettlement ? '1100' : f.account),
      ...(wasSettlement === isSettlement ? {} : { allocations: {}, allocationManual: false, advance: false })
    }));
  };

  /* Who paid decides which invoices the money may settle or be linked to, so the previous
     customer's allocations and the invoice they were linked to are both cleared with them and the
     FIFO suggestion is recalculated for the new one - nothing from one customer’s invoices is
     ever offered, linked or allocated, against another customer's money. */
  const handleCustomerSelect = (customerObj) => {
    setError('');
    /* What this payer still owes, read the way the allocation table reads it, so naming a payer who
       owes money brings the invoices they owe it on with them: the operator said who paid, and this is
       the list the money is then distributed over. */
    const owes = customerObj
      ? eligibleInvoices(accounts, { customerId: customerObj.id, branchId: branch?.id || '', organisationId: company?.id || '' }).length > 0
      : false;
    setForm(f => {
      /* An untouched picker follows the payer, because on a fresh form the payer is what answers the
         question: somebody who owes on an invoice opens the settlement workflow, and the table of what
         they owe opens with it; anybody else opens the plain income workflow. A picker the operator has
         answered - Interest Income, say, for a customer who happens to owe money for something else -
         is never overwritten by the payer they choose after it. Either way the previous payer's split,
         and the invoice it was linked to, leave with that payer. */
      const chosen = f.categoryChosen;
      const category = chosen ? f.category : (owes ? INVOICE_PAYMENT_CATEGORY : DEFAULT_INCOME_CATEGORY);
      const matched = categories.find(c => c.name === category);
      const settlement = category === INVOICE_PAYMENT_CATEGORY;
      return {
        ...f,
        receivedFrom: customerObj?.name || '',
        customerId: customerObj?.id || '',
        category,
        account: matched ? matched.account : settlement ? '1100' : chosen ? f.account : DEFAULT_INCOME_ACCOUNT,
        salesInvoiceId: '',
        allocations: {},
        allocationManual: false,
        advance: false
      };
    });
  };

  /* Editing a row is what reorganises the split: the row the operator typed keeps exactly what they
     entered, and every other row is re-spread over the money that is left, oldest first - so a larger
     entry has its difference taken off the invoices after it, a smaller one hands the money back to
     the queue, and the table can never be left over-allocated by a keystroke. The row the operator
     typed is therefore the only pinned row, and Auto Allocate is the one way to hand the whole split
     back to FIFO. */
  const handleAllocateChange = (invoiceId, value) => {
    setError('');
    setForm(f => ({ ...f, allocationManual: true, allocations: { [invoiceId]: value } }));
  };

  const resetToFifo = () => {
    setError('');
    setForm(f => ({ ...f, allocationManual: false, allocations: {}, advance: false }));
  };

  /* Received In is one control holding the three states the record keeps: the account the money
     reached, or no account at all while it is still owed. A cash account states the cash method, a
     bank account pulls the method off Cash, and the Payment Method picker beside it is only offered
     once the money has arrived - the store writes no method for an income that is still awaited. */
  const handleReceivedIn = (code) => {
    setError('');
    if (!code) {
      setForm(f => ({ ...f, received: false, paidThrough: '', method: '' }));
      return;
    }
    const cash = code === '1000';
    setForm(f => {
      const kept = PAYMENT_METHODS.includes(f.method) ? f.method : 'Bank transfer';
      return {
        ...f,
        received: true,
        paidThrough: code,
        paymentType: cash ? 'Cash' : 'Bank',
        method: cash ? 'Cash' : (kept === 'Cash' ? 'Bank transfer' : kept)
      };
    });
  };

  const handleFileUpload = (e) => {
    const uploaded = Array.from(e.target.files || []);
    setForm(f => ({
      ...f,
      files: [...f.files, ...uploaded.map(file => ({ name: file.name, size: (file.size / 1024).toFixed(1) + ' KB' }))]
    }));
  };

  const removeFile = (index) => {
    setForm(f => ({ ...f, files: f.files.filter((_, i) => i !== index) }));
  };

  const handleSubmit = (e, targetStatus = 'Posted') => {
    if (e) e.preventDefault();
    try {
      if (amountError) throw new Error(amountError);
      if (!form.amount || Number(form.amount) <= 0) {
        throw new Error('Please enter a valid income amount.');
      }
      if (!form.receivedFrom?.trim()) {
        throw new Error('Please select who the income was received from.');
      }
      /* A payer who owes nothing in this book has no settlement to file: the rows the table above is
         showing are samples, and a demonstration is not a receivable. The money that arrived is real
         all the same, so it is recognised as income - the workflow the payer would have opened had
         they owed nothing when they were chosen - and the page asks before it changes the answer the
         operator gave, rather than filing money the operator never classified. */
      let settlement = isInvoicePayment;
      let category = form.category;
      let account = form.account;
      if (settlement && samplePayee && targetStatus !== 'Draft') {
        const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
          && window.confirm(`${form.receivedFrom} has no unpaid invoices in this book, so there is nothing to settle with this money. Record ${money(receivedPaise)} as ${DEFAULT_INCOME_CATEGORY} instead?`);
        if (!confirmed) {
          setError(`${form.receivedFrom} has no unpaid invoices in this book, so the rows above are samples and cannot be filed. Choose a payer who owes money, or use Record as ${DEFAULT_INCOME_CATEGORY} above.`);
          return;
        }
        const switched = switchToIncome();
        settlement = false;
        category = switched.category;
        account = switched.account;
      }
      /* The GST block is asked before anything is written. A taxable income with no rate is an
         unstated supply; a remainder held as a customer advance that nobody has classified may not be
         filed as though it carried no tax. An invoice settlement raises neither question, because the
         tax it settles was already recorded on the invoice. */
      const taxGate = settlement ? tax.errors : gstSummary({ workflow: 'direct', direct: directTax }).errors;
      if (taxGate.length) throw new Error(taxGate[0]);

      /* The method is no longer a question of its own: the account the money reached states it -
         the cash box is a cash receipt, and every bank account is a bank transfer. */
      const receivedMethod = form.received ? (form.paidThrough === '1000' ? 'Cash' : 'Bank transfer') : null;

      const store = readOperations();
      const db = accountingState();

      /* A payment against invoices is money that settled revenue the book already recognised, so it
         posts through the Payment Received engine and never writes an income entry of its own. */
      if (settlement) {
        if (!form.customerId) throw new Error('Select the customer this payment came from so it can be allocated to their invoices.');
        if (targetStatus !== 'Draft') {
          if (checkedAllocation.errors.length) throw new Error(checkedAllocation.errors.join(' '));
          if (checkedAllocation.unallocated > 0 && !form.advance) {
            throw new Error(`${money(checkedAllocation.unallocated)} of the money received is not accounted for. Allocate the whole amount received across the invoices above.`);
          }
        }
        if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
        const out = saveInvoiceReceipt({
          book: db, store, ctx: { actor: 'Local user', canApprove: true, customers }, idempotencyKey: idempotencyKey.current, targetStatus,
          input: {
            id: editing ? income.id : '',
            date: form.date,
            name: form.description?.trim() || '',
            category,
            receivedFrom: form.receivedFrom,
            customerId: form.customerId,
            amount: form.amount,
            receivedIn: form.received ? (form.paidThrough || '1010') : '',
            accountReceivable: form.accountReceivable || '1100',
            method: receivedMethod,
            reference: form.reference,
            referenceNo: form.referenceNo,
            gstTreatment: form.gstTreatment,
            tax: taxLabel,
            taxTreatment: taxTreatmentForTheBook,
            gstRate: form.gstRate === '' ? '' : Number(form.gstRate),
            taxMode: form.taxMode,
            placeOfSupply: place.supply,
            /* The remainder is taxed on the supply it is for, with the same treatment and rate the
               page computed the advance figures from, so the engine posts the tax the operator saw. */
            advanceSupply: advanceSupplyForTheBook,
            advanceTaxTreatment: taxTreatmentForTheBook,
            advanceRate: form.gstRate === '' ? 0 : Number(form.gstRate),
            advancePlaceOfSupply: place.supply,
            advanceGst,
            description: form.description,
            files: form.files,
            allocations: samplePayee ? [] : allocationRowsFor(openInvoices, allocationAmounts),
            allocationManual: form.allocationManual,
            advance: requestedAdvance,
            branchId: branch?.id || '',
            branchName: branch?.name || '',
            organisationId: company?.id || '',
            organisationName: company?.name || ''
          }
        });
        saveOperations(out.store);
        localStorage.setItem(KEY, JSON.stringify(out.book));
        if (onSaved) onSaved();
        return;
      }

      const input = {
        date: form.date,
        name: form.description?.trim() || `${category} from ${form.receivedFrom}`,
        category,
        receivedFrom: form.receivedFrom,
        payee: form.receivedFrom,
        customerId: form.customerId,
        account: account || DEFAULT_INCOME_ACCOUNT,
        amount: Number(form.amount),
        received: form.received,
        paidThrough: form.received ? (form.paidThrough || '1010') : null,
        accountReceivable: form.accountReceivable || '1100',
        method: receivedMethod,
        reference: form.reference,
        expectedDate: !form.received ? form.expectedDate : null,
        gstTreatment: form.gstTreatment,
        tax: taxLabel,
        taxTreatment: taxTreatmentForTheBook,
        gstRate: form.gstRate === '' ? '' : Number(form.gstRate),
        taxMode: form.taxMode,
        placeOfSupply: place.supply,
        advanceSupply: advanceSupplyForTheBook,
        referenceNo: form.referenceNo,
        salesInvoiceId: form.salesInvoiceId,
        description: form.description,
        files: form.files,
        status: targetStatus === 'Draft' ? 'Draft' : (form.received ? 'Posted' : 'Pending')
      };

      const out = editing ? updateIncome(store, db, income.id, input) : createIncome(store, db, input);
      saveOperations(out.store);
      localStorage.setItem(KEY, JSON.stringify(out.accounting));

      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  /* The action bar is pinned to the foot of the window and it carries the money summary, so it
     stands taller whenever one of those figures wraps onto a second row - which is every width at
     which the summary and the three buttons no longer fit side by side, and again when the advance
     tiles join the row. The content box therefore takes a tail measured off the bar itself rather
     than a guessed constant, so the last field on the page - the Attachment dropzone - is never
     left behind it. The stylesheet keeps a fallback tail for the first paint and for a browser
     without ResizeObserver. */
  const contentRef = useRef(null);
  /* A failed save used to be silent for anybody standing at the foot of the page. The
     message is drawn above the card and the actions are pinned to the foot of the
     window, so pressing Save Income on a short window scrolled to the end left the
     reason 90px above the viewport with nothing on screen to say the press had done
     anything at all. The banner is announced as an alert and the page brings it back
     into view on every failure, so the press always answers. */
  const errorRef = useRef(null);
  useEffect(() => {
    const banner = errorRef.current;
    if (!error || !banner) return;
    if (typeof banner.scrollIntoView === 'function') banner.scrollIntoView({ block: 'center' });
    if (typeof banner.focus === 'function') banner.focus({ preventScroll: true });
  }, [error]);
  useLayoutEffect(() => {
    const content = contentRef.current;
    const bar = content?.parentElement?.querySelector('.inc-footer');
    if (!content || !bar) return undefined;
    const sync = () => content.style.setProperty('--inc-bar-tail', `${bar.offsetHeight + 24}px`);
    sync();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(sync);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="rt-page itemCreatePage je-create inc-create-page inc-reference-page">
      <div className="itemDialogHead">
        <button className="itemBack" type="button" onClick={onCancel} aria-label="Back to Income" title="Back to Income"><IconArrowLeft size={19} /></button>
        <div className="itemHeadText"><h2 id="incomeDialogTitle">{editing ? 'Edit Income' : 'Record Income'}</h2></div>
      </div>

      {error && <div className="je-error inc-error" role="alert" tabIndex={-1} ref={errorRef}><IconAlertTriangle size={18} /><span>{error}</span></div>}

      <main className="inc-reference-content" ref={contentRef}>
        <section className="inc-reference-card" aria-label="Income details">
          <div className="inc-reference-grid">
            <label><span>Date Received <b>*</b></span><input type="date" required value={form.date} onChange={e => setField('date', e.target.value)} /></label>
            {/* Not a <label>: a label forwards every click inside it to its own labelled control, and
                the control here is the picker's own button - so choosing a payer re-fired the button's
                toggle and left the panel open over the invoices the money is being spread across. The
                field names itself with role="group" instead, which associates without activating. */}
            <div className="inc-customer-field" role="group" aria-label="Received From"><span>Received From <b>*</b></span><SearchableCustomerSelect customers={customers} selectedCustomerId={form.customerId || form.receivedFrom} onSelect={handleCustomerSelect} /></div>
            <label><span>Income For <b>*</b></span><select value={form.category} onChange={e => handleCategoryChange(e.target.value)}>{[INVOICE_PAYMENT_CATEGORY, ...categories.map(c => c.name)].map(name => <option key={name} value={name}>{name}</option>)}</select></label>
            <label className="inc-amount-input"><span>Amount Received (₹) <b>*</b></span><input type="number" step="0.01" min="0" required placeholder="0.00" value={form.amount} onChange={e => setField('amount', e.target.value)} /></label>
            {/* The account the money landed in stands beside the amount that landed, because the
                two are one fact: what arrived, and where it went. It is one picker holding every
                account the money could have reached - cash box and each bank - so the operator
                answers both halves of that fact in one line of the card. */}
            <label className="inc-account-field"><span>Received In <b>*</b></span><select value={form.received ? (form.paidThrough || '') : ''} onChange={e => handleReceivedIn(e.target.value)}><option value="">-- Not yet received --</option><optgroup label="Cash">{cashInOptions.map(a => <option key={a.code} value={a.code}>{a.code === '1000' ? 'Cash' : `${a.code} · ${a.name}`}</option>)}</optgroup><optgroup label="Bank">{bankInOptions.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</optgroup>{form.received && form.paidThrough && !receivedInOptions.some(a => a.code === form.paidThrough) && <option value={form.paidThrough}>{form.paidThrough} · Account</option>}</select></label>
            {/* The reference number and the document that proves it are one field, and it stands
                directly beside Received In: the number is the bank's or the cheque's own, so it
                belongs with the account the money reached rather than at the foot of the card. */}
            <div className="inc-reference-field" role="group" aria-label="Reference No."><span>Reference No.</span>
              <div className="inc-reference-input">
                <input type="text" placeholder="e.g. UTR or cheque no." value={form.reference} onChange={e => setField('reference', e.target.value)} />
                <label className="inc-reference-attach" title="Attach the document the reference number comes from - a cheque scan, a UTR screenshot or a bank slip"><IconPaperclip size={15} /><span>Attach</span><input type="file" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} /></label>
              </div>
            </div>
            {/* The link the register's Income No./Inv No. column reads back, kept and renamed, sitting
                beside the amount. It steps aside while the allocation table below is choosing the
                invoices this money settles, because then that table is the invoice choice. It is
                drawn only when it has an invoice to offer: before a payer is named, and for a payer
                who owes nothing, it held one empty option and a sentence far too long for the field,
                so the first fold carried a control that could not be used. */}
            {(payerInvoices.length > 0 || linkedInvoice) && (
              <label className="inc-invoice-field"><span>Invoice</span><select value={form.salesInvoiceId} disabled={isInvoicePayment} title={invoiceFieldTitle} onChange={e => setField('salesInvoiceId', e.target.value)}><option value="">{invoiceFieldPlaceholder}</option>{payerInvoices.map(inv => <option key={inv.id} value={inv.id}>{inv.number} · {money(inv.outstanding)} due</option>)}{linkedInvoice && !payerInvoices.some(inv => inv.id === linkedInvoice.id) && <option value={linkedInvoice.id}>{linkedInvoice.number} · already settled</option>}</select></label>
            )}
            {/* The invoices this money settles, drawn the way the Payment Received page draws its own
                Unpaid invoices section: one heading, the same six columns and the same Allocated /
                Received line, because allocating money to an invoice is one concept and it should read
                the same on both pages. FIFO fills it in as the amount is typed, a row typed by hand
                keeps its figure, Auto Allocate is the only way back to the automatic split, and it never
                redistributes a remainder the operator did not ask it to. */}
            {isInvoicePayment && (
              <div className="inc-allocation inc-unpaid inc-wide-field">
                <div className="inc-unpaid-head">
                  <h3>Unpaid invoices <small>{samplePayee ? 'Sample rows · nothing can be filed against them' : 'Optional · leave blank to allocate later'}</small></h3>
                  {openInvoices.length > 0 && <button type="button" className="inc-allocation-reset" onClick={resetToFifo} title="Spread the amount received over the oldest invoices again"><IconRefresh size={15} />Auto Allocate</button>}
                </div>
                <div className="ivScroll">
                  <table className="inc-allocation-table">
                    <thead>
                      <tr><th>Date</th><th>Invoice number</th><th>Invoice amount</th><th>Amount due</th><th>Withholding tax</th><th>Payment</th></tr>
                    </thead>
                    <tbody>
                      {openInvoices.map(invoice => {
                        const typed = allocationAmounts[invoice.id];
                        /* The row the operator typed is the row this keystroke is keeping, so the
                           mark says where the split came from rather than which figure moved. */
                        const changed = form.allocationManual && form.allocations[invoice.id] !== undefined;
                        return (
                          <tr key={invoice.id} className={changed ? 'is-manual' : ''}>
                            <td>{shortDate(invoice.date)}</td>
                            <td className="inc-allocation-invoice" title={`Invoice total ${money(invoice.total)} · due ${shortDate(invoice.dueDate || invoice.date)}`}>{invoice.number}{isSampleInvoice(invoice) && <em className="inc-allocation-sample">Sample</em>}</td>
                            <td>{money(invoice.total)}</td>
                            <td>{money(invoice.outstanding)}</td>
                            <td>{Number(invoice.withholdingTax) > 0 ? money(Math.round(Number(invoice.withholdingTax) * 100)) : '—'}</td>
                            <td><input className="receiptAmount" type="number" step="0.01" min="0" inputMode="decimal" aria-label={`Payment for ${invoice.number}`} value={typed} onChange={e => handleAllocateChange(invoice.id, e.target.value)} />{changed && <em className="inc-allocation-manual">manual</em>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!openInvoices.length && <p>No outstanding invoices for this customer.</p>}
                </div>
                {/* A keystroke keeps the row the operator typed and moves the difference through
                    every other row, so the line under the table says whose figure was held and which
                    way the money went - the one thing the table cannot show by itself. */}
                {pinnedRow && (
                  <p className="inc-allocation-note">{pinnedRow.number} keeps your {money(pinnedAmount)}. {pinnedAmount >= (fifoAmounts[pinnedRow.id] || 0) ? 'The difference comes off the other invoices' : 'The money you freed goes to the other invoices'}, oldest first, so the whole amount received stays allocated.</p>
                )}
                <p className="inc-allocation-line">Allocated: {money(allocation.allocated)} · Received: {money(allocation.received)}</p>
                {/* Unallocated money is never posted silently, and the operator asked for no second
                    answer here: the money received is spread over the invoices above, so what is
                    left over is stated with the one thing that clears it. */}
                {checkedAllocation.unallocated > 0 && !form.advance && (
                  <p className="inc-allocation-empty">Allocate the remaining {money(checkedAllocation.unallocated)} across the invoices above: the whole amount received has to be accounted for before this income is saved.</p>
                )}
              </div>
            )}
            {/* A payer who owes money is stated wherever the operator is. On a settlement the
                table above settles it; on a direct income - which posts to an income account and
                settles nothing - the page offers the one click that switches the workflow rather
                than mixing the two treatments behind the operator's back. */}
            {/* A payer who owes nothing in this book leaves the table above holding the samples that
                demonstrate a distribution, and a demonstration is not a receivable - which is what the
                save path refuses to file. The money is real all the same, so the one thing left to do
                with it is to recognise it as income, and the page says so where the samples are and
                offers the single click that switches the form to the workflow that can file it. */}
            {samplePayee && (
              <p className="inc-sample-note inc-wide-field">
                <IconFileText size={16} />
                <span><strong>{form.receivedFrom}</strong> has no unpaid invoices in this book, so nothing above can be filed against this money. </span>
                <button type="button" onClick={() => switchToIncome()}>Record as {DEFAULT_INCOME_CATEGORY}</button>
              </p>
            )}
            {!isInvoicePayment && form.customerId && payerInvoices.length > 0 && (
              <p className="inc-owed-note inc-wide-field">
                <IconFileText size={16} />
                <span><strong>{form.receivedFrom}</strong> still owes {money(payerInvoices.reduce((total, invoice) => total + (invoice.outstanding || 0), 0))} across {payerInvoices.length} {payerInvoices.length === 1 ? 'invoice' : 'invoices'}. </span>
                <button type="button" onClick={() => handleCategoryChange(INVOICE_PAYMENT_CATEGORY)}>Settle these invoices</button>
              </p>
            )}
            {!form.received && (
              <label className="inc-expected-date"><span>Expected date for receiving income <b>*</b></span><input type="date" value={form.expectedDate} onChange={e => setField('expectedDate', e.target.value)} /></label>
            )}
            {/* The tax this income carries is asked on a row of its own below the money and the
                reference that proves it rather than in a card of its own, so the money, the tax
                split out of it and the document that proves it read as one run of the card. Three questions, and only where
                an answer can change the posting: a settlement adds no tax of its own, because the
                invoice it settles already recorded its own - so this row is drawn for the workflows
                that recognise new income and never for the one that recognises none. The rate is the
                book's own, never a slab list belonging to this page, and the calculation is asked
                only while the money is still awaited: a receipt that has already arrived is its own
                gross, so inclusive is the only reading left and the row states it rather than
                offering a choice the engine would ignore. */}
            {!isInvoicePayment && (
              <div className="inc-tax inc-wide-field" role="group" aria-label="Tax">
                <label><span>GST Treatment</span><select value={form.taxTreatment} onChange={e => setField('taxTreatment', e.target.value)}>{GST_TREATMENT_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
                {incomeIsTaxable && (
                  <label><span>GST Rate</span><select value={form.gstRate} onChange={e => setField('gstRate', e.target.value)}>{gstRates.map(rate => <option key={rate} value={String(rate)}>GST {rate}%</option>)}{form.gstRate !== '' && !gstRates.includes(Number(form.gstRate)) && <option value={form.gstRate}>GST {form.gstRate}%</option>}</select></label>
                )}
                {form.received
                  ? <div className="inc-tax-fixed"><span>GST Calculation</span><em>Inclusive - the money received already includes its GST</em></div>
                  : <label><span>GST Calculation</span><select value={form.taxMode} onChange={e => setField('taxMode', e.target.value)}>{TAX_MODES.map(mode => <option key={mode} value={mode}>{mode === 'inclusive' ? 'Inclusive - the income already includes its GST' : 'Exclusive - the GST is charged on top of the income'}</option>)}</select></label>}
                {/* The sentence states what the answer does to the money rather than leaving the
                    operator to infer it from the bar below: a receipt that has arrived is always
                    split out of the gross, an awaited income charges the tax on top only while the
                    calculation is exclusive, and a taxable income this book names no rate for is
                    said out loud as the unanswered question it is. */}
                <small className="inc-tax-note">{taxNote}</small>
              </div>
            )}
            {/* The note the operator writes and the file they attach share the card's last row,
                so neither takes a row of its own and the evidence for the income sits beside the
                sentence explaining it. */}
            <div className="inc-notes-attachment inc-wide-field">
              <label className="inc-notes-field"><span>Notes</span><textarea rows={2} placeholder="Add any notes (optional)" value={form.description} onChange={e => setField('description', e.target.value)} /></label>
              <div className="inc-attachments"><span>Attachment</span><label className="inc-dropzone"><IconPaperclip size={24} /><span><b>Choose files</b> or drag and drop<small>PDF, JPG, PNG (Max 5 MB)</small></span><input type="file" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} /></label>{form.files.length > 0 && <div className="inc-file-list">{form.files.map((file,index) => <span key={index}><IconPaperclip size={14} />{file.name} <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeFile(index)}><IconTrash size={14} /></button></span>)}</div>}</div>
            </div>
          </div>
        </section>
      </main>

      <footer className="inc-footer">
        <div className="inc-footer-summary" aria-live="polite">
              {isInvoicePayment ? (
                <>
                  <span>Amount received<strong>{money(allocation.received)}</strong></span>
                  {/* The bar states the money that arrived and nothing else. What the money
                      settled and what those invoices had already taxed are the table's and the
                      invoice's own facts, and printing them again here turned one receipt into four
                      figures the operator could not act on. Only a held remainder - a liability
                      rather than a settlement - still gets a figure of its own. */}
                  {allocation.advance > 0 && <span>Customer advance<strong>{money(allocation.advance)}</strong></span>}
                  {advanceGst > 0 && <span>Advance GST at receipt<strong>{money(advanceGst)}</strong></span>}
                  {advanceGst > 0 && <span>Net advance liability<strong>{money(advanceFacts.net)}</strong></span>}
                </>
              ) : form.received ? (
                <>
                  <span>Amount received<strong>{money(directTax.received)}</strong></span>
                  <span>Taxable income amount<strong>{money(directTax.taxable)}</strong></span>
                  <span title={directTax.igst > 0 ? 'Inter-state supply: the tax is IGST' : 'Intra-state supply: the tax splits into CGST and SGST'}>{directTax.igst > 0 ? 'IGST' : 'CGST + SGST'}<strong>{money(directTax.gst)}</strong></span>
                  <span>Total received<strong>{money(directTax.received)}</strong></span>
                  <small>{form.category} · {form.received ? form.paymentType : 'Awaiting receipt'}</small>
                </>
              ) : (
                <>
                  <span>Income stated<strong>{money(directTax.taxable)}</strong></span>
                  <span title={directTax.igst > 0 ? 'Inter-state supply: the tax is IGST' : 'Intra-state supply: the tax splits into CGST and SGST'}>{directTax.igst > 0 ? 'IGST' : 'CGST + SGST'}<strong>{money(directTax.gst)}</strong></span>
                  <span>Receivable from customer<strong>{money(directTax.receivable)}</strong></span>
                  <small>{form.category} - waiting to be received</small>
                </>
              )}        </div>
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" onClick={e => handleSubmit(e,'Draft')}>Save Draft</button>
        <button type="button" className="primary" onClick={e => handleSubmit(e,'Posted')}>Save Income</button>
      </footer>
    </section>
  );

  return (
    <section className="rt-page itemCreatePage je-create inc-create-page" style={{ margin: 0, paddingBottom: '32px' }}>
      {/* 1. Page Header */}
      <div className="itemDialogHead">
        <button
          className="itemBack"
          type="button"
          onClick={onCancel}
          aria-label="Back to Income"
          title="Back to Income"
        >
          <IconArrowLeft size={19} />
        </button>
        <div className="itemHeadText">
          <h2 id="incomeDialogTitle">Record Income</h2>
        </div>
      </div>

      {error && (
        <div className="je-error" style={{ margin: '16px 24px 0' }}>
          <IconAlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Main Form Container */}
      <div className="je-form-card" style={{ padding: '24px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', margin: '16px 24px 0' }}>
        <div className="je-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '18px 20px' }}>
          
          {/* SECTION 1: Income Details */}
          <div className="rt-section-head" style={{ gridColumn: '1 / -1', borderBottom: '1px solid #edf1f6', paddingBottom: '8px', marginBottom: '4px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 650, color: '#172033', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconReceipt size={18} style={{ color: '#3478f6' }} />
              <span>Income Details</span>
            </h3>
          </div>

          {/* Income Date */}
          <label>
            <div className="je-label-header">
              <span>Date *</span>
            </div>
            <input
              type="date"
              required
              value={form.date}
              onChange={e => setField('date', e.target.value)}
            />
          </label>

          {/* Income Type */}
          <label>
            <div className="je-label-header">
              <span>Income Type *</span>
            </div>
            <select
              value={form.category}
              onChange={e => handleCategoryChange(e.target.value)}
            >
              {categories.map(c => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>

          {/* Received From (Customer Dropdown) */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="je-label-header" style={{ marginBottom: '6px' }}>
              <span>Received From (Customer) *</span>
            </div>
            <SearchableCustomerSelect
              customers={customers}
              selectedCustomerId={form.customerId || form.receivedFrom}
              onSelect={handleCustomerSelect}
            />
          </div>

          {/* Amount */}
          <label>
            <div className="je-label-header">
              <span>Amount (₹) *</span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={form.amount}
              onChange={e => setField('amount', e.target.value)}
            />
          </label>

          {/* SECTION 2: Payment Details */}
          <div className="rt-section-head" style={{ gridColumn: '1 / -1', borderBottom: '1px solid #edf1f6', paddingBottom: '8px', marginTop: '12px', marginBottom: '4px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 650, color: '#172033', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconWallet size={18} style={{ color: '#3478f6' }} />
              <span>Payment Details</span>
            </h3>
          </div>

          {/* All Payment Inputs in Grid Row */}
          <div style={{
            gridColumn: '1 / -1',
            display: 'grid',
            gridTemplateColumns: !form.received ? 'repeat(2, minmax(0, 1fr))' : (form.paymentType === 'Cash' ? 'repeat(3, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))'),
            gap: '16px',
            alignItems: 'flex-start',
            width: '100%'
          }}>
            {/* Payment Received? Toggle */}
            <label style={{ margin: 0 }}>
              <div className="je-label-header">
                <span>Have you received the money?</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '38px' }}>
                <button
                  type="button"
                  onClick={() => setField('received', !form.received)}
                  style={{
                    position: 'relative',
                    width: '46px',
                    height: '24px',
                    borderRadius: '12px',
                    background: form.received ? '#3478f6' : '#cbd5e1',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                    padding: '2px',
                    display: 'inline-block',
                    flexShrink: 0
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      transform: form.received ? 'translateX(22px)' : 'translateX(0px)',
                      transition: 'transform 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }}
                  />
                </button>
                <span style={{ fontWeight: 600, color: form.received ? '#10b981' : '#f59e0b', fontSize: '13px' }}>
                  {form.received ? 'Yes, Received' : 'Not Yet'}
                </span>
              </div>
            </label>

            {form.received ? (
              <>
                {/* Which type: Bank or Cash payment */}
                <label style={{ margin: 0 }}>
                  <div className="je-label-header">
                    <span>Payment Received Via *</span>
                  </div>
                  <select
                    value={form.paymentType}
                    onChange={e => {
                      const mode = e.target.value;
                      if (mode === 'Cash') {
                        setForm(f => ({
                          ...f,
                          paymentType: 'Cash',
                          paidThrough: '1000',
                          method: 'Cash',
                          reference: ''
                        }));
                      } else {
                        const defaultBank = bankAccounts[0]?.code || '1010';
                        setForm(f => ({
                          ...f,
                          paymentType: 'Bank',
                          paidThrough: defaultBank,
                          method: 'Bank transfer'
                        }));
                      }
                    }}
                  >
                    <option value="Bank">Bank Payment</option>
                    <option value="Cash">Cash Payment</option>
                  </select>
                </label>

                {form.paymentType === 'Cash' ? (
                  <label style={{ margin: 0 }}>
                    <div className="je-label-header">
                      <span>Deposit Account</span>
                    </div>
                    <select value="1000" disabled style={{ background: '#f8fafc', color: '#475569', cursor: 'not-allowed' }}>
                      <option value="1000">1000 · Cash / Petty Cash (Chart of Accounts)</option>
                    </select>
                  </label>
                ) : (
                  <>
                    <label style={{ margin: 0 }}>
                      <div className="je-label-header">
                        <span>Bank Account *</span>
                      </div>
                      <select
                        value={form.paidThrough}
                        onChange={e => setField('paidThrough', e.target.value)}
                      >
                        {bankAccounts.length > 0 ? (
                          bankAccounts.map(a => (
                            <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                          ))
                        ) : (
                          <option value="1010">1010 · Bank Account</option>
                        )}
                      </select>
                    </label>

                    <label style={{ margin: 0 }}>
                      <div className="je-label-header">
                        <span>Payment Method</span>
                      </div>
                      <select
                        value={form.method}
                        onChange={e => setField('method', e.target.value)}
                      >
                        {PAYMENT_METHODS.filter(m => m !== 'Cash').map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </label>

                    <label style={{ margin: 0 }}>
                      <div className="je-label-header">
                        <span>Transaction Reference / UTR #</span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. TXN-984321 / UTR #"
                        value={form.reference}
                        onChange={e => setField('reference', e.target.value)}
                      />
                    </label>
                  </>
                )}
              </>
            ) : (
              <label style={{ margin: 0 }}>
                <div className="je-label-header">
                  <span>Expected Payment Date</span>
                </div>
                <input
                  type="date"
                  value={form.expectedDate}
                  onChange={e => setField('expectedDate', e.target.value)}
                />
              </label>
            )}
          </div>

          {/* SECTION 3: Tax Details */}
          <div className="rt-section-head" style={{ gridColumn: '1 / -1', borderBottom: '1px solid #edf1f6', paddingBottom: '8px', marginTop: '12px', marginBottom: '4px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 650, color: '#172033', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconPercentage size={18} style={{ color: '#3478f6' }} />
              <span>Tax Details</span>
            </h3>
          </div>

          <label>
            <div className="je-label-header">
              <span>GST Treatment</span>
            </div>
            <select
              value={form.gstTreatment}
              onChange={e => setField('gstTreatment', e.target.value)}
            >
              {GST_TREATMENTS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label>
            <div className="je-label-header">
              <span>GST Rate</span>
            </div>
            <select
              value={form.tax}
              onChange={e => setField('tax', e.target.value)}
            >
              {TAX_OPTIONS.map(tax => (
                <option key={tax} value={tax}>{tax}</option>
              ))}
            </select>
          </label>

          <label>
            <div className="je-label-header">
              <span>Tax Mode</span>
            </div>
            <select
              value={form.taxMode}
              onChange={e => setField('taxMode', e.target.value)}
            >
              <option value="exclusive">Tax Exclusive (Amount + Tax)</option>
              <option value="inclusive">Tax Inclusive (Amount includes Tax)</option>
            </select>
          </label>

          <label>
            <div className="je-label-header">
              <span>Ref / Agreement Number</span>
            </div>
            <input
              type="text"
              placeholder="e.g. AGR-2026-09"
              value={form.referenceNo}
              onChange={e => setField('referenceNo', e.target.value)}
            />
          </label>

          {/* SECTION 4: Additional Details */}
          <div className="rt-section-head" style={{ gridColumn: '1 / -1', borderBottom: '1px solid #edf1f6', paddingBottom: '8px', marginTop: '12px', marginBottom: '4px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 650, color: '#172033', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconFileText size={18} style={{ color: '#3478f6' }} />
              <span>Additional Details</span>
            </h3>
          </div>

          {/* Linked Sales Invoice */}
          {salesInvoices.length > 0 && (
            <label style={{ gridColumn: '1 / -1' }}>
              <div className="je-label-header">
                <span>Link to Existing Sales Invoice (Optional)</span>
              </div>
              <select
                value={form.salesInvoiceId}
                onChange={e => setField('salesInvoiceId', e.target.value)}
              >
                <option value="">-- Direct Income Entry (Not linked to invoice) --</option>
                {salesInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} - {inv.customerName} (₹{(inv.totals?.total / 100 || 0).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Description / Notes (Moved to Additional Details) */}
          <label style={{ gridColumn: 'span 2' }}>
            <div className="je-label-header">
              <span>Description / Notes</span>
            </div>
            <textarea
              rows={2}
              placeholder="Add details or purpose of this income record..."
              value={form.description}
              onChange={e => setField('description', e.target.value)}
            />
          </label>

          {/* Attachments Section */}
          <div style={{ gridColumn: 'span 2' }}>
            <div className="je-label-header">
              <span>Attach Receipts / Documents</span>
            </div>
            <div className="je-attachments" style={{ minHeight: '38px', padding: '8px 12px', border: '1px dashed #bcd0f5', borderRadius: '8px', background: '#fafcff' }}>
              <span className="je-attach-note">PDF, images, Word or Excel files</span>
              <label className="je-attach-button" style={{ minHeight: '32px', margin: '4px 0 0' }}>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileUpload}
                />
                <IconPaperclip size={15} /> Attach files
              </label>
              {form.files.length > 0 && (
                <div className="je-selected-files" style={{ width: '100%', marginTop: '6px' }}>
                  {form.files.map((f, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#fff', border: '1px solid #d0d5dd', borderRadius: '6px', fontSize: '12px', margin: '4px 6px 0 0' }}>
                      <IconPaperclip size={14} style={{ color: '#1f61c9' }} />
                      <b>{f.name}</b> ({f.size})
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => removeFile(i)}
                        style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#667085' }}
                      >
                        <IconTrash size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 7. Sticky Footer Bar */}
      <footer>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={(e) => handleSubmit(e, 'Draft')}>
          Save Draft
        </button>
        <button
          type="button"
          className="primary"
          onClick={(e) => handleSubmit(e, 'Posted')}
        >
          Save & Record Income
        </button>
      </footer>
    </section>
  );
}

