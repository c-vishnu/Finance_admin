import { useState, useMemo, useRef, useEffect } from 'react';
import {
  IconArrowLeft,
  IconAlertTriangle,
  IconPaperclip,
  IconTrash,
  IconReceipt,
  IconWallet,
  IconPercentage,
  IconFileText,
  IconSearch,
  IconChevronDown
} from '@tabler/icons-react';
import { readAccounts } from './account-store.js';
import { readOperations, saveOperations, createIncome, accountingState, DEFAULT_INCOME_CATEGORIES } from './operations-store.js';
import { KEY } from './invoice-engine.js';
import { customerSeeds } from './Customers.jsx';
import './journal-entries.css';
import './journal-form.css';
import './record-transaction.css';

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

export default function CreateIncomePage({ onCancel, onSaved }) {
  const [error, setError] = useState('');

  const accounts = readAccounts();
  const allAccounts = accounts?.accounts || [];
  const cashAccounts = allAccounts.filter(a => a.type === 'Assets' && (a.code === '1000' || a.name?.toLowerCase().includes('cash')));
  const bankAccounts = allAccounts.filter(a => a.type === 'Assets' && a.code !== '1000' && (a.code?.startsWith('10') || a.name?.toLowerCase().includes('bank')));

  // Customers list
  const customers = useMemo(() => {
    try {
      const raw = localStorage.getItem('wayvida-customers');
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list) && list.length > 0) return list;
    } catch {}
    return customerSeeds;
  }, []);

  // Sales Invoices list for linking
  const salesInvoices = useMemo(() => {
    try {
      const raw = localStorage.getItem('wayvida-invoices');
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) return list.filter(i => i.status !== 'Cancelled');
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

  // Form State
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Service Income',
    account: '4100',
    receivedFrom: '',
    customerId: '',
    amount: '',
    received: true, // true = Yes money received, false = No expected later
    paidThrough: '1010', // 1010 = Bank Account
    accountReceivable: '1100', // Accounts Receivable
    method: 'Bank transfer',
    reference: '',
    expectedDate: '',
    gstTreatment: 'Registered Business - Regular',
    tax: 'GST 18%',
    taxMode: 'exclusive',
    referenceNo: '',
    salesInvoiceId: '',
    description: '',
    files: []
  });

  const setField = (key, value) => {
    setError('');
    setForm(f => ({ ...f, [key]: value }));
  };

  const handleCategoryChange = (categoryName) => {
    const matched = categories.find(c => c.name === categoryName);
    setForm(f => ({
      ...f,
      category: categoryName,
      account: matched ? matched.account : '4100'
    }));
  };

  const handleCustomerSelect = (customerObj) => {
    setError('');
    if (!customerObj) {
      setForm(f => ({ ...f, receivedFrom: '', customerId: '' }));
    } else {
      setForm(f => ({
        ...f,
        receivedFrom: customerObj.name,
        customerId: customerObj.id
      }));
    }
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
      if (!form.amount || Number(form.amount) <= 0) {
        throw new Error('Please enter a valid income amount.');
      }
      if (!form.receivedFrom?.trim()) {
        throw new Error('Please select who the income was received from.');
      }

      const store = readOperations();
      const db = accountingState();

      const input = {
        date: form.date,
        name: form.description?.trim() || `${form.category} from ${form.receivedFrom}`,
        category: form.category,
        receivedFrom: form.receivedFrom,
        payee: form.receivedFrom,
        account: form.account || '4100',
        amount: Number(form.amount),
        received: form.received,
        paidThrough: form.received ? (form.paidThrough || '1010') : null,
        accountReceivable: form.accountReceivable || '1100',
        method: form.received ? form.method : null,
        reference: form.reference,
        expectedDate: !form.received ? form.expectedDate : null,
        gstTreatment: form.gstTreatment,
        tax: form.tax,
        taxMode: form.taxMode,
        referenceNo: form.referenceNo,
        salesInvoiceId: form.salesInvoiceId,
        description: form.description,
        files: form.files,
        status: targetStatus === 'Draft' ? 'Draft' : (form.received ? 'Posted' : 'Pending')
      };

      const out = createIncome(store, db, input);
      saveOperations(out.store);
      localStorage.setItem(KEY, JSON.stringify(out.accounting));

      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message);
    }
  };

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

          {/* All Payment Inputs in a Single Row */}
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: form.received ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: '16px', alignItems: 'flex-start', width: '100%' }}>
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
                <label style={{ margin: 0 }}>
                  <div className="je-label-header">
                    <span>Deposit To (Bank / Cash) *</span>
                  </div>
                  <select
                    value={form.paidThrough}
                    onChange={e => setField('paidThrough', e.target.value)}
                  >
                    <optgroup label="Cash Account (Chart of Accounts)">
                      {cashAccounts.length > 0 ? (
                        cashAccounts.map(a => (
                          <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                        ))
                      ) : (
                        <option value="1000">1000 · Petty Cash</option>
                      )}
                    </optgroup>
                    <optgroup label="Bank Accounts (Chart of Accounts)">
                      {bankAccounts.length > 0 ? (
                        bankAccounts.map(a => (
                          <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                        ))
                      ) : (
                        <option value="1010">1010 · Bank Account</option>
                      )}
                    </optgroup>
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
                    {PAYMENT_METHODS.map(m => (
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

