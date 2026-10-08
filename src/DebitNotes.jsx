import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconFileInvoice,
  IconFilter,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconTrash,
  IconX,
  IconBuildingStore
} from '@tabler/icons-react';
import {KEY,initial,money} from './invoice-engine.js';
import {
  DEBIT_NOTE_KEY,
  PURCHASE_BILL_KEY,
  applyDebitNote,
  approveDebitNote,
  calculatePurchase,
  cancelDebitNote,
  issueDebitNote,
  saveDebitNote,
  submitDebitNote,
  vendorOutstanding,
  voidDebitNote
} from './purchase-service.js';
import {QUICK_CREATE_KEY} from './quick-create.js';
import DocumentPreview from './DocumentPreview.jsx';
import StatusPill from './StatusPill.jsx';
import DebitNoteRowActions from './DebitNoteRowActions.jsx';
import {readVendors} from './vendor-store.js';
import {VendorSearch,vendorInitials} from './PurchaseDocumentFields.jsx';
import {ItemSearch,TaxSelection} from './InvoiceLineControls.jsx';
import {getCurrentOrganizationContext} from './organisation-context.js';
import './purchases.css';
import './debit-notes.css';
import './items.css';
import './sales-orders.css';

const read = (key, fallback = []) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value.filter(Boolean) : fallback;
  } catch {
    return fallback;
  }
};

const today = () => new Date().toLocaleDateString('en-CA');
const fmtDate = value =>
  value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : 'Not recorded';

const DEBIT_REASONS = [
  'Purchase Return',
  'Price Correction',
  'Quantity / Short Supply',
  'Discount / Rebate',
  'Tax Correction',
  'Other'
];

const DEBIT_TONES = s => {
  const map = {
    Draft: 'neutral',
    'Pending Approval': 'warn',
    Approved: 'info',
    Posted: 'ok',
    Adjusted: 'ok',
    Cancelled: 'danger',
    Reversed: 'danger',
    Voided: 'danger'
  };
  return map[s] || 'neutral';
};

const accountLine = () => ({
  id: crypto.randomUUID(),
  itemId: 'account-adjustment',
  description: 'Purchase adjustment',
  qty: '1',
  unit: 'service',
  rate: '0',
  discount: '0',
  taxRate: '18',
  cessRate: '0',
  priceTaxMode: 'exclusive',
  purchaseAccount: '5000',
  taxes: { cgst: 9, sgst: 9, igst: 0, cess: 0 }
});

const itemLine = (item = null) => ({
  id: crypto.randomUUID(),
  itemId: item?.id || '',
  description: item?.name || '',
  qty: '1',
  unit: item?.unit || 'pcs',
  rate: String(item?.cost || item?.price || '0'),
  discount: '0',
  taxRate: String(item?.taxRate || '18'),
  cessRate: '0',
  priceTaxMode: 'exclusive',
  purchaseAccount: item?.purchaseAccount || '5000',
  taxes: { cgst: 9, sgst: 9, igst: 0, cess: 0 }
});

const NOTE_HANDOFF = 'wayvida-open-debit-note';
const handoffNote = () => {
  try {
    const id = sessionStorage.getItem(NOTE_HANDOFF);
    if (!id) return null;
    sessionStorage.removeItem(NOTE_HANDOFF);
    return read(DEBIT_NOTE_KEY).find(row => row.id === id) || null;
  } catch {
    return null;
  }
};

export default function DebitNotes({ onNavigate = () => {} }) {
  const [rows, setRows] = useState(() => read(DEBIT_NOTE_KEY));
  const [bills, setBills] = useState(() => read(PURCHASE_BILL_KEY));
  const [form, setForm] = useState(null);
  const [view, setView] = useState(handoffNote);
  const [preview, setPreview] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All statuses');
  const [error, setError] = useState('');
  const [stab, setStab] = useState('Overview');
  const [vendorFilter, setVendorFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [billFactsOpen, setBillFactsOpen] = useState(false);

  const vendors = readVendors().filter(v => v?.status === 'Active');
  const items = read('finance-erp-items', []);
  const dbState = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || initial();
    } catch {
      return initial();
    }
  }, [rows, bills]);

  const orgContext = useMemo(() => getCurrentOrganizationContext(), []);

  // Eligible posted, active bills matching active org/branch
  const eligibleBills = useMemo(() => {
    return (bills || []).filter(b => {
      if (!b) return false;
      const isPosted = b.posted && b.status !== 'Cancelled';
      const notFullyPaid = b.total - (b.paidAmount || 0) - (b.creditApplied || 0) > 0;
      return isPosted && notFullyPaid;
    });
  }, [bills]);

  const selectedVendor = useMemo(() => {
    return vendors.find(v => v.id === form?.vendorId) || null;
  }, [vendors, form?.vendorId]);

  const selectedBill = useMemo(() => {
    if (!form?.billId) return null;
    return bills.find(b => b.id === form.billId) || null;
  }, [bills, form?.billId]);

  const visible = useMemo(() => {
    const list = (rows || []).filter(
      row =>
        row &&
        [row.number, row.billNumber, row.vendorName, row.reason]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === 'All statuses' || row.status === filter) &&
        (!vendorFilter || row.vendorId === vendorFilter) &&
        (!reasonFilter || row.reason === reasonFilter) &&
        (!from || (row.date || '') >= from) &&
        (!to || (row.date || '') <= to)
    );
    return [...list].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [rows, query, filter, vendorFilter, reasonFilter, from, to]);

  const activeFilters = [filter !== 'All statuses', vendorFilter, reasonFilter, from, to].filter(Boolean).length;
  const clearFilters = () => {
    setFilter('All statuses');
    setVendorFilter('');
    setReasonFilter('');
    setFrom('');
    setTo('');
    setQuery('');
  };

  const totals = useMemo(() => {
    try {
      if (!form || !form.lines?.length) return null;
      return calculatePurchase(form.lines, { placeOfSupply: form.placeOfSupply || 'Kerala' });
    } catch {
      return null;
    }
  }, [form]);

  function openNew() {
    setError('');
    const ctx = getCurrentOrganizationContext();
    setForm({
      id: null,
      number: '',
      type: 'Against Purchase Bill',
      billId: '',
      billNumber: '',
      vendorId: '',
      vendorName: '',
      vendorGstin: '',
      vendorInvoiceReference: '',
      placeOfSupply: 'Kerala',
      date: today(),
      companyId: ctx.company?.id || ctx.company?.code || '',
      companyName: ctx.company?.name || 'Wayvida Learning',
      branchId: ctx.branch?.id || '',
      branchName: ctx.branch?.name || 'Kochi Branch',
      costCentre: 'Operations',
      currency: 'INR',
      reason: 'Purchase Return',
      reasonDescription: '',
      adjustmentMethod: 'Item Based',
      notes: '',
      internalNote: '',
      attachments: [],
      lines: [accountLine()],
      status: 'Draft',
      payableAccount: '2000'
    });
  }

  function selectVendor(id) {
    const vendor = vendors.find(r => r.id === id);
    setForm(current => {
      if (!current) return null;
      const nextBillId = current.billId && bills.find(b => b.id === current.billId)?.vendorId !== id ? '' : current.billId;
      return {
        ...current,
        vendorId: id || '',
        vendorName: vendor?.displayName || vendor?.name || '',
        vendorGstin: vendor?.gstin || '',
        billId: nextBillId,
        placeOfSupply: vendor?.billing?.state || vendor?.state || 'Kerala',
        payableAccount: vendor?.payableAccountId || '2000'
      };
    });
  }

  function selectBill(id) {
    const bill = eligibleBills.find(row => row.id === id);
    if (!bill) {
      setForm(f => ({ ...f, billId: '', billNumber: '', lines: [accountLine()] }));
      return;
    }
    const vendor = vendors.find(r => r.id === bill.vendorId);
    setForm(f => ({
      ...f,
      billId: bill.id,
      billNumber: bill.number,
      vendorId: bill.vendorId,
      vendorName: bill.vendorName,
      vendorGstin: bill.vendorGstin || vendor?.gstin || '',
      vendorInvoiceReference: bill.vendorInvoice || f.vendorInvoiceReference || '',
      placeOfSupply: bill.placeOfSupply || vendor?.billing?.state || 'Kerala',
      payableAccount: bill.payableAccount || '2000',
      lines: bill.lines.map(line => ({
        ...structuredClone(line),
        id: crypto.randomUUID(),
        maxQty: line.qty,
        qty: String(line.qty)
      }))
    }));
  }

  useEffect(() => {
    if (sessionStorage.getItem(QUICK_CREATE_KEY) === 'debit-note') {
      sessionStorage.removeItem(QUICK_CREATE_KEY);
      openNew();
    }
  }, []);

  const persist = (next, note) => {
    setRows(next);
    localStorage.setItem(DEBIT_NOTE_KEY, JSON.stringify(next));
    if (note) setView(note);
  };

  function save(event, status = 'Draft') {
    if (event) event.preventDefault();
    try {
      const out = saveDebitNote(rows, bills, form, status);
      persist(out.rows);
      setForm(null);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  function transition(note, action) {
    try {
      const out = action === 'submit' ? submitDebitNote(rows, note) : approveDebitNote(rows, note);
      persist(out.rows, out.note);
    } catch (e) {
      setError(e.message);
    }
  }

  function post(note) {
    try {
      const state = JSON.parse(localStorage.getItem(KEY) || 'null') || initial();
      const out = issueDebitNote({ ...state, debitNotes: rows, purchaseBills: bills }, note);
      const next = rows.map(row => (row.id === note.id ? out.note : row));
      localStorage.setItem(KEY, JSON.stringify(out.state));
      persist(next, out.note);
    } catch (e) {
      setError(e.message);
    }
  }

  function apply(note) {
    try {
      const state = JSON.parse(localStorage.getItem(KEY) || 'null') || initial();
      const out = applyDebitNote({ ...state, debitNotes: rows, purchaseBills: bills }, note);
      const next = rows.map(row => (row.id === note.id ? out.note : row));
      const nextBills = bills.map(row => (row.id === out.bill.id ? out.bill : row));
      localStorage.setItem(KEY, JSON.stringify(out.state));
      localStorage.setItem(PURCHASE_BILL_KEY, JSON.stringify(nextBills));
      setBills(nextBills);
      persist(next, out.note);
    } catch (e) {
      setError(e.message);
    }
  }

  function cancel(note) {
    try {
      const out = cancelDebitNote(rows, note);
      persist(out.rows, out.note);
    } catch (e) {
      setError(e.message);
    }
  }

  function reverse(note) {
    try {
      const state = JSON.parse(localStorage.getItem(KEY) || 'null') || initial();
      const out = voidDebitNote({ ...state, debitNotes: rows, purchaseBills: bills }, note, {
        reason: 'Debit note reversed by authorized user',
        date: today()
      });
      const updated = { ...out.note, status: 'Reversed' };
      const next = rows.map(row => (row.id === note.id ? updated : row));
      const nextBills = out.bill ? bills.map(row => (row.id === out.bill.id ? out.bill : row)) : bills;
      localStorage.setItem(KEY, JSON.stringify(out.state));
      localStorage.setItem(PURCHASE_BILL_KEY, JSON.stringify(nextBills));
      setBills(nextBills);
      persist(next, updated);
    } catch (e) {
      setError(e.message);
    }
  }

  const set = (key, value) => setForm(x => ({ ...x, [key]: value }));
  const lineUpdate = (i, key, value) =>
    setForm(x => ({
      ...x,
      lines: x.lines.map((row, index) => (index === i ? { ...row, [key]: value } : row))
    }));

  // Calculations for bill drawer / summary
  const billAdjusted = selectedBill
    ? (rows || [])
        .filter(r => r && r.billId === selectedBill.id && r.status !== 'Cancelled' && r.id !== form?.id)
        .reduce((sum, r) => sum + (r.total || 0), 0)
    : 0;

  const billRemaining = selectedBill ? Math.max(0, selectedBill.total - billAdjusted) : 0;

  if (view) {
    return (
      <section className="invoiceWorkspace purchaseWorkspace ivDetailOpen">
        {preview && <DocumentPreview kind="Purchase Debit Note" doc={view} onClose={() => setPreview(false)} />}
        <div className="ivDetailHead">
          <button type="button" className="ivDetailBack" aria-label="Back to Debit Notes" onClick={() => setView(null)}>
            <IconArrowLeft size={19} />
          </button>
          <div className="ivDetailHeadText">
            <h2>Debit note details</h2>
            <small>
              {view.number} · {view.vendorName}
            </small>
          </div>
        </div>
        <div className="ivDetailBody">
          <section className="ivDetailSheet">
            {error && <Error text={error} close={() => setError('')} />}
            <div className="ivDetailIdentityRow">
              <div className="ivDetailIdentity">
                <div className="ivDetailNumber">
                  <h3>{view.number}</h3>
                  <StatusPill status={view.status} tone={DEBIT_TONES(view.status)} />
                </div>
                <p>
                  {view.vendorName}
                  {view.billNumber ? ' · Against ' + view.billNumber : ''} · {view.date}
                </p>
              </div>
              <div className="ivDocumentActions">
                <button onClick={() => setPreview(true)}>
                  <IconPrinter size={16} /> Preview
                </button>
                {view.status === 'Draft' && (
                  <button className="primary" onClick={() => transition(view, 'submit')}>
                    <IconCheck size={16} /> Submit
                  </button>
                )}
                {view.status === 'Pending Approval' && (
                  <button className="primary" onClick={() => transition(view, 'approve')}>
                    <IconCheck size={16} /> Approve
                  </button>
                )}
                {view.status === 'Approved' && (
                  <button className="primary" onClick={() => post(view)}>
                    <IconCheck size={16} /> Post
                  </button>
                )}
                {view.status === 'Posted' && view.billId && (
                  <button className="primary" onClick={() => apply(view)}>
                    <IconCheck size={16} /> Apply to bill
                  </button>
                )}
                {!view.posted && view.status !== 'Cancelled' && (
                  <button onClick={() => cancel(view)}>Cancel</button>
                )}
                {view.posted && !['Reversed', 'Voided'].includes(view.status) && (
                  <button onClick={() => reverse(view)}>Reverse</button>
                )}
              </div>
            </div>
            <div className="ivDetailStats">
              {[
                ['Status', view.status],
                ['Vendor', view.vendorName],
                ['Reference bill', view.billNumber || 'No linked bill'],
                ['Debit note date', view.date],
                ['Total', money(view.total)],
                ['Applied to bill', money(view.appliedAmount || 0)]
              ].map(([k, v]) => (
                <span key={k}>
                  <small>{k}</small>
                  <strong>{v}</strong>
                </span>
              ))}
            </div>
            <nav className="itemDetailTabs ivDetailTabs" aria-label="Debit note sections">
              {['Overview', 'Accounting', 'Activity'].map(t => (
                <button
                  key={t}
                  type="button"
                  className={stab === t ? 'active' : ''}
                  aria-current={stab === t ? 'page' : undefined}
                  onClick={() => setStab(t)}
                >
                  {t}
                </button>
              ))}
            </nav>
            {stab === 'Overview' ? (
              <div className="ivOverviewPage">
                <div className="ivOverviewGrid">
                  <section className="itemDetailCard">
                    <div className="itemDetailSectionTitle">
                      <IconFileInvoice size={18} />
                      <h2>Vendor and reference</h2>
                    </div>
                    <dl className="itemDetailFacts">
                      {[
                        ['Vendor', view.vendorName],
                        ['Purchase bill', view.billNumber],
                        ['Vendor invoice ref.', view.vendorInvoiceReference],
                        ['Date', view.date],
                        ['Reason', view.reason],
                        ['Reason detail', view.reasonDescription],
                        ['Adjustment method', view.adjustmentMethod || view.entryMode],
                        ['Branch', view.branchName || view.branch],
                        ['Cost centre', view.costCentre]
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v || 'Not recorded'}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section className="itemDetailCard">
                    <div className="itemDetailSectionTitle">
                      <IconFileInvoice size={18} />
                      <h2>Accounting impact</h2>
                    </div>
                    <dl className="itemDetailFacts">
                      {[
                        ['Debit · Accounts Payable', money(view.total)],
                        ['Credit · Purchase Adjustment', money(view.totals?.taxable)],
                        ['Credit · Input GST', money((view.totals?.tax || 0) + (view.totals?.cess || 0))],
                        ['Journal', view.journalId || 'Created only after posting'],
                        ['Applied to bill', money(view.appliedAmount || 0)]
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v || 'Not recorded'}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </div>
                <section className="itemDetailCard">
                  <div className="itemDetailSectionTitle">
                    <IconFileInvoice size={18} />
                    <h2>Adjustment lines</h2>
                  </div>
                  <div className="ivScroll">
                    <table className="ivInvoiceTable purchaseDetailLines">
                      <thead>
                        <tr>
                          {['Item / account', 'Description', 'Quantity', 'Rate', 'Tax', 'Total'].map(h => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(view.totals?.lines || []).map(row => (
                          <tr key={row.id}>
                            <td>{row.purchaseAccount || row.itemId}</td>
                            <td>{row.description}</td>
                            <td>
                              {row.qty} {row.unit}
                            </td>
                            <td>{money(Number(row.rate) * 100)}</td>
                            <td>{money(row.tax + row.cess)}</td>
                            <td>{money(row.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : stab === 'Accounting' ? (
              <div className="purchaseTabBody">
                <p className="ivMutedNote">
                  {view.posted
                    ? 'Posting created the journal below from the accounts mapped on the debit note.'
                    : 'No journal exists until this debit note is posted.'}
                </p>
                <dl className="itemDetailFacts">
                  {[
                    ['Journal', view.journalId || 'Not posted'],
                    ['Posted at', view.postedAt || 'Not recorded'],
                    ['Posted by', view.postedBy || 'Not recorded'],
                    ['Applied to bill', money(view.appliedAmount || 0)],
                    ['Payable account', view.payableAccount || '2000'],
                    ['Place of supply', view.placeOfSupply || 'Kerala']
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v || 'Not recorded'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <div className="purchaseTabBody">
                <dl className="itemDetailFacts">
                  {[
                    ['Created', view.createdAt || 'Not recorded'],
                    ['Created by', view.createdBy || 'Not recorded'],
                    ['Last modified', view.updatedAt || 'Not recorded'],
                    ['Status', view.status]
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </section>
        </div>
      </section>
    );
  }

  if (form) {
    const isAgainstBill = form.type === 'Against Purchase Bill';
    const isAccountBased = form.adjustmentMethod === 'Account Based';
    const vendorPayable = form.vendorId ? vendorOutstanding(dbState, form.vendorId) : 0;

    return (
      <section className="invoiceWorkspace purchaseWorkspace creditNotes soCreatePage ivCreatePage">
        {/* 1. PAGE HEADER */}
        <div className="soCreateHead">
          <div className="soHeadIdentity">
            <button type="button" className="soBack" aria-label="Back to debit notes" onClick={() => setForm(null)}>
              <IconArrowLeft size={19} />
            </button>
            <div className="soHeadText">
              <h2 id="dnCreateTitle">{form.id ? 'Edit debit note' : 'New debit note'}</h2>
              {form.id && <small className="soHeadHint">Editing {form.number}</small>}
            </div>
          </div>
          <span className="soHeadStatus">
            <StatusPill status={form.status || 'Draft'} tone={DEBIT_TONES(form.status || 'Draft')} />
          </span>
        </div>

        <form className="ivCreateForm" onSubmit={e => save(e, 'Draft')}>
          {error && <Error text={error} close={() => setError('')} />}

          {/* 2. VENDOR SELECTOR */}
          <div className="ivCard soFormSection">
            <div className="soSectionHead">
              <h3>Vendor *</h3>
            </div>
            <div className="soCustomerRow">
              <div className="soField soFieldSearch">
                <VendorSearch vendors={vendors} value={form.vendorId} onSelect={id => selectVendor(id)} />
              </div>
            </div>
            <div className="soCustomerRef">
              {selectedVendor ? (
                <div className="soCustomerProfile">
                  <span className="soCustomerAvatar" aria-hidden="true">
                    {vendorInitials(selectedVendor.name)}
                  </span>
                  <div className="soCustomerLines">
                    <span className="soCustomerHead">
                      <strong className="soCustomerName">{selectedVendor.displayName || selectedVendor.name}</strong>
                      <span className="soCustomerType">Vendor</span>
                    </span>
                    <span className="soCustomerAddress">
                      <b>Billing Address:</b>{' '}
                      {[selectedVendor.billing?.city || selectedVendor.billing?.state, selectedVendor.phone]
                        .filter(Boolean)
                        .join(' · ') || 'Not provided'}
                    </span>
                  </div>
                  <div className="soCustomerMeta">
                    <div>
                      <span>Outstanding payable</span>
                      <strong>{money(vendorPayable)}</strong>
                    </div>
                    <div>
                      <span>Available vendor credit</span>
                      <strong>{money(0)}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="cnSectionHint">
                  Search or select the vendor whose purchase bill or account this debit note adjusts.
                </p>
              )}
            </div>
          </div>

          {/* 3. DEBIT NOTE DETAILS */}
          <div className="ivCard soFormSection">
            <div className="soSectionHead">
              <h3>Debit note details</h3>
            </div>
            <div className="ivFields soFieldRow">
              <label>
                Debit note type
                <select
                  aria-label="Debit note type"
                  value={form.type}
                  onChange={e => {
                    const val = e.target.value;
                    setForm(f => ({
                      ...f,
                      type: val,
                      billId: val === 'Standalone' ? '' : f.billId,
                      lines: val === 'Standalone' && !isAccountBased ? [itemLine()] : f.lines
                    }));
                  }}
                >
                  <option value="Against Purchase Bill">Against Purchase Bill</option>
                  <option value="Standalone">Standalone</option>
                </select>
              </label>

              {isAgainstBill && (
                <label>
                  Original purchase bill *
                  <select
                    required
                    aria-label="Original purchase bill"
                    value={form.billId}
                    onChange={e => selectBill(e.target.value)}
                  >
                    <option value="">Select posted bill</option>
                    {eligibleBills
                      .filter(b => !form.vendorId || b.vendorId === form.vendorId)
                      .map(b => (
                        <option key={b.id} value={b.id}>
                          {b.number} · {money(b.total)}
                        </option>
                      ))}
                  </select>
                </label>
              )}

              <label>
                Reason *
                <select
                  required
                  aria-label="Debit reason"
                  value={form.reason}
                  onChange={e => set('reason', e.target.value)}
                >
                  {DEBIT_REASONS.map(r => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>

              {form.reason === 'Other' && (
                <label>
                  Reason detail *
                  <input
                    required
                    value={form.reasonDescription || ''}
                    onChange={e => set('reasonDescription', e.target.value)}
                    placeholder="Describe the reason for this debit note"
                  />
                </label>
              )}

              <label>
                Adjustment method
                <select
                  aria-label="Adjustment method"
                  value={form.adjustmentMethod}
                  onChange={e => {
                    const mode = e.target.value;
                    setForm(f => ({
                      ...f,
                      adjustmentMethod: mode,
                      lines: mode === 'Account Based' ? [accountLine()] : [itemLine()]
                    }));
                  }}
                >
                  <option value="Item Based">Item Based</option>
                  <option value="Account Based">Account Based</option>
                </select>
              </label>

              <label>
                Debit note date *
                <input required type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </label>

              <label>
                Reference number
                <input
                  value={form.vendorInvoiceReference || ''}
                  onChange={e => set('vendorInvoiceReference', e.target.value)}
                  placeholder="Vendor quotation / reference number"
                />
              </label>

              <label>
                Debit note number
                <input
                  readOnly
                  aria-label="Debit note number"
                  placeholder="Generated automatically · DN-2026-0001"
                  value={form.number || ''}
                />
              </label>
            </div>

            {/* 4. ORGANISATION / BRANCH CONTEXT STRIP */}
            <div className="cnContextRow">
              <span>
                <small>Organisation</small>
                <strong>{form.companyName || orgContext.company?.name || 'Viskool'}</strong>
              </span>
              <span>
                <small>Branch</small>
                <strong>{form.branchName || orgContext.branch?.name || 'Thrissur'}</strong>
              </span>
              <span className="cnContextHint">This note posts to this organisation and branch.</span>
            </div>
          </div>

          {/* 5. ORIGINAL PURCHASE BILL DETAILS */}
          {isAgainstBill && selectedBill && (
            <div className="ivCard soFormSection">
              <div className="soSectionHead">
                <h3>Original purchase bill details</h3>
              </div>
              <dl className="cnInvoiceSummary">
                <div>
                  <dt>Bill number</dt>
                  <dd>{selectedBill.number}</dd>
                </div>
                <div>
                  <dt>Bill date</dt>
                  <dd>{selectedBill.date}</dd>
                </div>
                <div>
                  <dt>Vendor reference</dt>
                  <dd>{selectedBill.vendorInvoice || 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Original bill total</dt>
                  <dd>{money(selectedBill.total)}</dd>
                </div>
                <div>
                  <dt>Previously adjusted</dt>
                  <dd>{money(billAdjusted)}</dd>
                </div>
                <div>
                  <dt>Remaining eligible amount</dt>
                  <dd>{money(billRemaining)}</dd>
                </div>
                <div>
                  <dt>Place of supply</dt>
                  <dd>{selectedBill.placeOfSupply || form.placeOfSupply || 'Kerala'}</dd>
                </div>
              </dl>
              <span className="cnInvoiceFacts">
                <button
                  type="button"
                  className="cnInvoiceLink"
                  title="Show the bill this note adjusts"
                  aria-haspopup="dialog"
                  onClick={() => setBillFactsOpen(true)}
                >
                  View bill facts for {selectedBill.number}
                </button>
              </span>

              {billFactsOpen &&
                createPortal(
                  <div className="cnInvoiceLayer">
                    <button
                      type="button"
                      className="cnInvoiceBackdrop"
                      aria-label="Close bill details"
                      onClick={() => setBillFactsOpen(false)}
                    />
                    <div className="cnInvoiceDrawer" role="dialog" aria-modal="true" aria-label="Original bill details">
                      <header className="cnInvoiceDrawerHead">
                        <div>
                          <span className="cnInvoiceDrawerKicker">Original bill details</span>
                          <strong>{selectedBill.number}</strong>
                        </div>
                        <button
                          type="button"
                          className="cnInvoiceDrawerClose"
                          aria-label="Close bill details"
                          onClick={() => setBillFactsOpen(false)}
                        >
                          <IconX size={18} />
                        </button>
                      </header>
                      <div className="cnInvoiceDrawerBody">
                        <dl className="soFactList">
                          <div className="soFactItem">
                            <dt>Bill number</dt>
                            <dd>{selectedBill.number}</dd>
                          </div>
                          <div className="soFactItem">
                            <dt>Vendor</dt>
                            <dd>{selectedBill.vendorName}</dd>
                          </div>
                          <div className="soFactItem">
                            <dt>Bill date</dt>
                            <dd>{selectedBill.date}</dd>
                          </div>
                          <div className="soFactItem">
                            <dt>Vendor invoice</dt>
                            <dd>{selectedBill.vendorInvoice || '—'}</dd>
                          </div>
                          <div className="soFactItem">
                            <dt>Original total</dt>
                            <dd>{money(selectedBill.total)}</dd>
                          </div>
                          <div className="soFactItem">
                            <dt>Previously adjusted</dt>
                            <dd>{money(billAdjusted)}</dd>
                          </div>
                          <div className="soFactItem">
                            <dt>Remaining balance</dt>
                            <dd>{money(billRemaining)}</dd>
                          </div>
                          <div className="soFactItem">
                            <dt>Place of supply</dt>
                            <dd>{selectedBill.placeOfSupply || 'Kerala'}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          )}

          {/* 6. DYNAMIC ADJUSTMENT UI */}
          <div className="ivCard soFormSection">
            <div className="soSectionHead">
              <h3>{form.adjustmentMethod} lines</h3>
              <button
                type="button"
                className="cnAddItem"
                onClick={() =>
                  set(
                    'lines',
                    isAccountBased ? [...form.lines, accountLine()] : [...form.lines, itemLine()]
                  )
                }
              >
                <IconPlus size={16} /> Add line
              </button>
            </div>

            <div className="ivScroll">
              {isAccountBased ? (
                /* ACCOUNT BASED: Account, Description, Amount, Tax, Total, Delete */
                <table className="ivLineTable">
                  <thead>
                    <tr>
                      <th style={{ width: '25%' }}>Account</th>
                      <th style={{ width: '30%' }}>Description</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Amount ₹</th>
                      <th style={{ width: '15%' }}>Tax</th>
                      <th style={{ width: '10%', textAlign: 'right' }}>Total</th>
                      <th style={{ width: '5%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.lines.map((l, i) => {
                      const lineCalculated = totals?.lines?.[i];
                      return (
                        <tr key={l.id || i}>
                          <td>
                            <select
                              aria-label={'Account ' + (i + 1)}
                              value={l.purchaseAccount || '5000'}
                              onChange={e => lineUpdate(i, 'purchaseAccount', e.target.value)}
                            >
                              <option value="5000">5000 - Purchase Adjustment</option>
                              <option value="5600">5600 - Professional Fees</option>
                              <option value="5100">5100 - Freight & Carriage</option>
                              <option value="5700">5700 - Office Expenses</option>
                            </select>
                          </td>
                          <td>
                            <input
                              aria-label={'Description ' + (i + 1)}
                              value={l.description || ''}
                              placeholder="Reason / adjustment details"
                              onChange={e => lineUpdate(i, 'description', e.target.value)}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              aria-label={'Amount ' + (i + 1)}
                              value={l.rate || ''}
                              placeholder="0.00"
                              onChange={e => lineUpdate(i, 'rate', e.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              aria-label={'Tax ' + (i + 1)}
                              value={l.taxRate || '18'}
                              onChange={e => lineUpdate(i, 'taxRate', e.target.value)}
                            >
                              {['0', '5', '12', '18', '28'].map(rate => (
                                <option key={rate} value={rate}>
                                  GST {rate}%
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <strong>{lineCalculated ? money(lineCalculated.total) : '—'}</strong>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              aria-label="Remove line"
                              disabled={form.lines.length === 1}
                              onClick={() => set('lines', form.lines.filter((_, k) => k !== i))}
                            >
                              <IconTrash size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                /* ITEM BASED: Item / Service, Quantity, Unit, Rate, Discount, Tax, Amount, Delete */
                <table className="ivLineTable">
                  <thead>
                    <tr>
                      <th style={{ width: '25%' }}>Item / Service</th>
                      <th style={{ width: '10%' }}>Quantity</th>
                      <th style={{ width: '8%' }}>Unit</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Rate ₹</th>
                      <th style={{ width: '10%' }}>Discount</th>
                      <th style={{ width: '15%' }}>Tax</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Amount</th>
                      <th style={{ width: '5%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.lines.map((l, i) => {
                      const lineCalculated = totals?.lines?.[i];
                      return (
                        <tr key={l.id || i}>
                          <td>
                            <ItemSearch
                              items={items}
                              value={l.itemId}
                              onSelect={item => {
                                setForm(f => ({
                                  ...f,
                                  lines: f.lines.map((row, idx) =>
                                    idx === i
                                      ? {
                                          ...row,
                                          itemId: item.id,
                                          description: item.name,
                                          unit: item.unit || 'pcs',
                                          rate: String(item.cost || item.price || '0'),
                                          taxRate: String(item.taxRate || '18')
                                        }
                                      : row
                                  )
                                }));
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              max={l.maxQty}
                              aria-label={'Quantity ' + (i + 1)}
                              value={l.qty || ''}
                              onChange={e => lineUpdate(i, 'qty', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              aria-label={'Unit ' + (i + 1)}
                              value={l.unit || 'pcs'}
                              onChange={e => lineUpdate(i, 'unit', e.target.value)}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              aria-label={'Rate ' + (i + 1)}
                              value={l.rate || ''}
                              onChange={e => lineUpdate(i, 'rate', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              aria-label={'Discount ' + (i + 1)}
                              value={l.discount || '0'}
                              onChange={e => lineUpdate(i, 'discount', e.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              aria-label={'Tax ' + (i + 1)}
                              value={l.taxRate || '18'}
                              onChange={e => lineUpdate(i, 'taxRate', e.target.value)}
                            >
                              {['0', '5', '12', '18', '28'].map(rate => (
                                <option key={rate} value={rate}>
                                  GST {rate}%
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <strong>{lineCalculated ? money(lineCalculated.total) : '—'}</strong>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              aria-label="Remove line"
                              disabled={form.lines.length === 1}
                              onClick={() => set('lines', form.lines.filter((_, k) => k !== i))}
                            >
                              <IconTrash size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 7. SUMMARY */}
          <section className="ivCard soBillingSummary">
            <div className="soSummaryGrid">
              <div className="soSummaryLeft">
                <p className="cnSectionHint">
                  Reversed at original bill tax rates for bill-backed adjustments, or configured rates for standalone entries.
                </p>
              </div>
              <div className="soSummaryRight">
                <div className="soSummaryHead">
                  <h3>Debit note summary</h3>
                  <span className="soCurrencyChip" title="Every amount on this document is in Indian rupees">
                    INR ₹
                  </span>
                </div>
                <div className="soSummaryMoney">
                  {totals ? (
                    <dl className="ivTotals">
                      {[
                        ['Subtotal', totals.subtotal],
                        ['Discount', totals.discount],
                        ['Taxable amount', totals.taxable],
                        ...(totals.intra
                          ? [
                              ['CGST reversal', totals.cgst],
                              ['SGST reversal', totals.sgst]
                            ]
                          : [['IGST reversal', totals.igst]]),
                        ['CESS reversal', totals.cess],
                        ['Total tax', totals.cgst + totals.sgst + totals.igst + totals.cess],
                        ['Total debit note amount', totals.total]
                      ]
                        .filter(([_, v]) => v !== 0 || _ === 'Subtotal' || _ === 'Taxable amount' || _ === 'Total debit note amount')
                        .map(([k, v]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{money(v)}</dd>
                          </div>
                        ))}
                    </dl>
                  ) : (
                    <p role="status">Select vendor and add items/accounts to calculate total.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 8. ACCOUNTING IMPACT (Collapsible Accordion) */}
          <details className="ivCard soFormSection cnAdditional">
            <summary aria-label="Open accounting impact">
              <span>Accounting impact</span>
              <IconChevronDown size={16} />
            </summary>
            <div className="soMoreBody" style={{ paddingTop: '12px' }}>
              <p className="cnSectionHint" style={{ marginBottom: '10px' }}>
                This debit note reduces the amount you owe the vendor when it is posted. No journal entry is created until the debit note is posted.
              </p>
              <div className="debitJournalPreview">
                <p>
                  <b>Debit</b>
                  <span>Accounts Payable (2000)</span>
                  <strong>{money(totals?.total)}</strong>
                </p>
                <p>
                  <b>Credit</b>
                  <span>Purchase Adjustment (5000)</span>
                  <strong>{money(totals?.taxable)}</strong>
                </p>
                {totals?.tax ? (
                  <p>
                    <b>Credit</b>
                    <span>Input GST Reversal</span>
                    <strong>{money((totals.tax || 0) + (totals.cess || 0))}</strong>
                  </p>
                ) : null}
              </div>
            </div>
          </details>

          {/* 9. ADDITIONAL DETAILS (Collapsible Accordion) */}
          <details className="ivCard soFormSection cnAdditional">
            <summary aria-label="Open additional details">
              <span>Additional details</span>
              <IconChevronDown size={16} />
            </summary>
            <div className="ivFields">
              <label>
                Vendor note
                <textarea
                  value={form.notes || ''}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Anything to communicate to the vendor about this adjustment"
                />
              </label>
              <label>
                Internal note
                <input
                  value={form.internalNote || ''}
                  onChange={e => set('internalNote', e.target.value)}
                  placeholder="Internal note (not visible to vendor)"
                />
              </label>
              <label>
                Cost centre
                <select value={form.costCentre} onChange={e => set('costCentre', e.target.value)}>
                  <option value="Operations">Operations</option>
                  <option value="Administration">Administration</option>
                </select>
              </label>
              <label className="cnAttachField">
                Attachments
                <input
                  type="file"
                  multiple
                  aria-label="Attach vendor documents, debit notes or supporting files"
                  onChange={e =>
                    set('attachments', [
                      ...(form.attachments || []),
                      ...Array.from(e.target.files || []).map(f => ({ name: f.name, size: f.size }))
                    ])
                  }
                />
              </label>
              {(form.attachments || []).length > 0 && (
                <ul className="cnAttachments">
                  {(form.attachments || []).map((f, i) => (
                    <li key={i}>
                      <span>{f.name}</span>
                      <button
                        type="button"
                        aria-label={'Remove attachment ' + (i + 1)}
                        onClick={() =>
                          set(
                            'attachments',
                            (form.attachments || []).filter((_, k) => k !== i)
                          )
                        }
                      >
                        <IconTrash size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>

          {/* 10. FOOTER */}
          <div className="ivFooter soActionBar">
            <dl className="soBarTotals">
              <div>
                <dt>Total debit note amount</dt>
                <dd>{money(totals?.total)}</dd>
              </div>
            </dl>
            <div className="soBarActions">
              <button type="button" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button type="button" onClick={e => save(e, 'Draft')}>
                Save draft
              </button>
              <button type="submit" className="primary" onClick={e => save(e, 'Approved')}>
                <IconCheck size={16} /> Post debit note
              </button>
            </div>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="itemsPage salesOrdersPage purchaseWorkspace">
      {error && <Error text={error} close={() => setError('')} />}
      <div className="itemsHeading soPageHeading registerHead">
        <div className="registerHeadText">
          <h2>
            Debit Notes <span className="registerHeadCount">({rows.length})</span>
          </h2>
          <p>Create and manage vendor adjustments and purchase corrections.</p>
        </div>
        <div className="itemsTools soFilterBar">
          <label>
            <IconSearch size={18} />
            <input
              aria-label="Search debit notes"
              placeholder="Search number, vendor, bill or reason…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </label>
          <details className="soFiltersMore">
            <summary aria-label="Open filters">
              <IconFilter size={17} />
              Filters{activeFilters > 0 && <i>{activeFilters}</i>}
            </summary>
            <div className="soFiltersPanel">
              <label>
                Status
                <select aria-label="Filter status" value={filter} onChange={e => setFilter(e.target.value)}>
                  {[
                    'All statuses',
                    'Draft',
                    'Pending Approval',
                    'Approved',
                    'Posted',
                    'Adjusted',
                    'Closed',
                    'Cancelled',
                    'Reversed'
                  ].map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Vendor
                <select aria-label="Filter vendor" value={vendorFilter} onChange={e => setVendorFilter(e.target.value)}>
                  <option value="">All vendors</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.displayName || v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reason
                <select aria-label="Filter reason" value={reasonFilter} onChange={e => setReasonFilter(e.target.value)}>
                  <option value="">All reasons</option>
                  {DEBIT_REASONS.map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                From
                <input type="date" aria-label="Filter from" value={from} onChange={e => setFrom(e.target.value)} />
              </label>
              <label>
                To
                <input type="date" aria-label="Filter to" value={to} onChange={e => setTo(e.target.value)} />
              </label>
              <button type="button" className="soClearFilters" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          </details>
        </div>
        <div className="itemsActions">
          <button className="primary soCreateButton" onClick={openNew}>
            <IconPlus size={18} />
            New Debit Note
          </button>
        </div>
      </div>

      <div className="itemsCard soListCard ivRegisterCard">
        <div className="ivScroll">
          <table className="ivInvoiceTable debitNotesTable">
            <thead>
              <tr>
                <th style={{ width: '16%', textAlign: 'left' }}>Debit note & date</th>
                <th style={{ width: '20%', textAlign: 'left' }}>Vendor</th>
                <th style={{ width: '15%', textAlign: 'left' }}>Reference bill</th>
                <th style={{ width: '18%', textAlign: 'left' }}>Reason</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Amount</th>
                <th style={{ width: '14%', textAlign: 'left' }}>Status</th>
                <th style={{ width: '5%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(row => (
                <tr key={row.id}>
                  <td style={{ textAlign: 'left' }}>
                    <b className="soOrderNumber" style={{ cursor: 'pointer' }} onClick={() => setView(row)}>
                      {row.number}
                    </b>
                    <small style={{ display: 'block', marginTop: '3px', color: '#64748b' }}>{fmtDate(row.date)}</small>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    {row.vendorName}
                    <small style={{ display: 'block', marginTop: '3px', color: '#64748b' }}>
                      {row.createdBy || 'Admin'}
                    </small>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    {row.billNumber ? (
                      <span className="soRefChip">{row.billNumber}</span>
                    ) : (
                      <small style={{ color: '#94a3b8' }}>Standalone</small>
                    )}
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    {row.reason}
                    {row.reasonDescription && (
                      <small style={{ display: 'block', marginTop: '2px', color: '#64748b' }}>
                        {row.reasonDescription}
                      </small>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong>{money(row.total)}</strong>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <StatusPill status={row.status} tone={DEBIT_TONES(row.status)} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <DebitNoteRowActions
                      row={row}
                      onView={() => setView(row)}
                      onDuplicate={() => {
                        setForm({
                          ...structuredClone(row),
                          id: null,
                          number: '',
                          status: 'Draft',
                          posted: false,
                          journalId: null,
                          appliedAmount: 0,
                          date: today(),
                          lines: row.lines.map(l => ({ ...l, id: crypto.randomUUID() }))
                        });
                      }}
                      onPost={() => post(row)}
                      onCancel={() => cancel(row)}
                      onReverse={() => reverse(row)}
                    />
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px 12px', color: '#64748b' }}>
                    No debit notes found matching the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Error({ text, close }) {
  return (
    <div className="ivError" role="alert">
      <span>{text}</span>
      <button type="button" onClick={close}>
        Dismiss
      </button>
    </div>
  );
}
