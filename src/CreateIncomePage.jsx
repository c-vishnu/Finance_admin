import { useState, useMemo, useRef, useEffect } from 'react';
import {
  IconArrowLeft,
  IconAlertTriangle,
  IconPaperclip,
  IconTrash,
  IconChevronDown,
  IconChevronUp,
  IconSearch
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

// Searchable Income Type Selector
function SearchableIncomeTypeSelect({ categories, selectedCategory, onSelect }) {
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
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter(c => c.name.toLowerCase().includes(q) || (c.account && c.account.includes(q)));
  }, [categories, search]);

  const currentCategory = categories.find(c => c.name === selectedCategory);

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
          color: selectedCategory ? '#0f172a' : '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedCategory || 'Select Income Type...'}
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
              placeholder="Search income type..."
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
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
                No matching income categories
              </div>
            ) : (
              filtered.map(c => (
                <div
                  key={c.id || c.name}
                  onClick={() => { onSelect(c.name); setIsOpen(false); setSearch(''); }}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    color: '#0f172a',
                    cursor: 'pointer',
                    background: c.name === selectedCategory ? '#eff6ff' : 'transparent',
                    fontWeight: c.name === selectedCategory ? 600 : 400,
                    borderBottom: '1px solid #f8fafc'
                  }}
                >
                  {c.name} {c.account ? `(${c.account})` : ''}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Searchable Customer / Contact Selector with custom input support
function SearchableCustomerSelect({ customers, selectedValue, onSelect }) {
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
      (c.companyName && c.companyName.toLowerCase().includes(q)) ||
      (c.code && c.code.toLowerCase().includes(q))
    );
  }, [customers, search]);

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
          color: selectedValue ? '#0f172a' : '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedValue || 'Customer or person'}
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
              placeholder="Search or enter customer/person..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                onSelect(e.target.value);
              }}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                color: '#0f172a'
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            <div
              onClick={() => { onSelect(''); setIsOpen(false); setSearch(''); }}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                color: '#64748b',
                cursor: 'pointer',
                background: !selectedValue ? '#f1f5f9' : 'transparent'
              }}
            >
              -- Clear / None --
            </div>
            {filtered.map(c => (
              <div
                key={c.id}
                onClick={() => { onSelect(c.name); setIsOpen(false); setSearch(''); }}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: '#0f172a',
                  cursor: 'pointer',
                  background: c.name === selectedValue ? '#eff6ff' : 'transparent',
                  fontWeight: c.name === selectedValue ? 600 : 400,
                  borderBottom: '1px solid #f8fafc'
                }}
              >
                {c.name} {c.companyName ? `(${c.companyName})` : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreateIncomePage({ onCancel, onSaved }) {
  const [error, setError] = useState('');
  const [showMore, setShowMore] = useState(false);

  const accounts = readAccounts();

  // Active Cash accounts from Chart of Accounts
  const cashAccounts = useMemo(() => {
    const all = accounts?.accounts || [];
    const filtered = all.filter(a => a.type === 'Assets' && (a.name?.toLowerCase().includes('cash') || a.code === '1000'));
    if (filtered.length > 0) return filtered;
    return [
      { code: '1000', name: 'Petty Cash' },
      { code: '1005', name: 'Cash in Hand' }
    ];
  }, [accounts]);

  // Active Bank accounts from Chart of Accounts
  const bankAccounts = useMemo(() => {
    const all = accounts?.accounts || [];
    const filtered = all.filter(a => a.type === 'Assets' && (a.name?.toLowerCase().includes('bank') || a.code === '1010' || a.code?.startsWith('10')) && !a.name?.toLowerCase().includes('cash') && a.code !== '1000');
    if (filtered.length > 0) return filtered;
    return [
      { code: '1010', name: 'HDFC Bank' },
      { code: '1020', name: 'SBI Bank' }
    ];
  }, [accounts]);

  // Customers list
  const customers = useMemo(() => {
    try {
      const raw = localStorage.getItem('wayvida-customers');
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list) && list.length > 0) return list;
    } catch {}
    return customerSeeds;
  }, []);

  // Income Categories list
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
  const [receivedVia, setReceivedVia] = useState('Bank / UPI'); // 'Cash' or 'Bank / UPI'
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Service Income',
    account: '4100',
    receivedFrom: '',
    customerId: '',
    amount: '',
    paidThrough: '1010', // Default bank account
    method: 'Bank transfer',
    referenceNo: '',
    gstTreatment: 'Registered Business - Regular',
    tax: 'GST 18%',
    taxMode: 'exclusive',
    description: '',
    files: []
  });

  const setField = (key, value) => {
    setError('');
    setForm(f => ({ ...f, [key]: value }));
  };

  const handleReceivedViaChange = (via) => {
    setReceivedVia(via);
    if (via === 'Cash') {
      const defaultCash = cashAccounts[0]?.code || '1000';
      setForm(f => ({ ...f, paidThrough: defaultCash, method: 'Cash' }));
    } else {
      const defaultBank = bankAccounts[0]?.code || '1010';
      setForm(f => ({ ...f, paidThrough: defaultBank, method: 'Bank transfer' }));
    }
  };

  const handleCategoryChange = (categoryName) => {
    const matched = categories.find(c => c.name === categoryName);
    setForm(f => ({
      ...f,
      category: categoryName,
      account: matched ? matched.account : '4100'
    }));
  };

  const handleCustomerSelect = (val) => {
    setError('');
    const found = customers.find(c => c.name.toLowerCase() === val.toLowerCase() || c.id === val);
    setForm(f => ({
      ...f,
      receivedFrom: val,
      customerId: found ? found.id : ''
    }));
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

      const store = readOperations();
      const db = accountingState();

      const input = {
        date: form.date,
        name: form.description?.trim() || `${form.category} ${form.receivedFrom ? `from ${form.receivedFrom}` : ''}`.trim(),
        category: form.category,
        receivedFrom: form.receivedFrom,
        payee: form.receivedFrom,
        account: form.account || '4100',
        amount: Number(form.amount),
        received: true,
        paidThrough: form.paidThrough,
        method: form.method,
        reference: form.referenceNo,
        referenceNo: form.referenceNo,
        gstTreatment: form.gstTreatment,
        tax: form.tax,
        taxMode: form.taxMode,
        description: form.description,
        files: form.files,
        status: targetStatus === 'Draft' ? 'Draft' : 'Posted'
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
      <div className="itemDialogHead" style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          <h2 id="incomeDialogTitle" style={{ margin: 0, fontSize: '18px', fontWeight: 650, color: '#0f172a' }}>Record Income</h2>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>Add money received by your business.</p>
        </div>
      </div>

      {error && (
        <div className="je-error" style={{ margin: '16px 24px 0' }}>
          <IconAlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Main Form Container */}
      <div className="je-form-card" style={{ padding: '24px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', margin: '16px 24px 0', overflow: 'visible' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px 24px', alignItems: 'start' }}>
          
          {/* Row 1: Date & Income Type */}
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="je-label-header" style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#334155' }}>Date *</span>
            </div>
            <input
              type="date"
              required
              value={form.date}
              onChange={e => setField('date', e.target.value)}
            />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="je-label-header" style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#334155' }}>Income Type *</span>
            </div>
            <SearchableIncomeTypeSelect
              categories={categories}
              selectedCategory={form.category}
              onSelect={handleCategoryChange}
            />
          </div>

          {/* Row 2: Received From & Amount */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="je-label-header" style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#334155' }}>Received From</span>
            </div>
            <SearchableCustomerSelect
              customers={customers}
              selectedValue={form.receivedFrom}
              onSelect={handleCustomerSelect}
            />
          </div>

          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="je-label-header" style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#334155' }}>Amount (₹) *</span>
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

          {/* Row 3: Received Via & Bank Account / Cash Account */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="je-label-header" style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#334155' }}>Received Via *</span>
            </div>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '4px', border: '1px solid #cbd5e1', height: '38px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => handleReceivedViaChange('Cash')}
                style={{
                  flex: 1,
                  height: '32px',
                  border: 'none',
                  borderRadius: '6px',
                  background: receivedVia === 'Cash' ? '#ffffff' : 'transparent',
                  color: receivedVia === 'Cash' ? '#0f172a' : '#64748b',
                  fontWeight: receivedVia === 'Cash' ? 600 : 500,
                  fontSize: '13px',
                  boxShadow: receivedVia === 'Cash' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => handleReceivedViaChange('Bank / UPI')}
                style={{
                  flex: 1,
                  height: '32px',
                  border: 'none',
                  borderRadius: '6px',
                  background: receivedVia === 'Bank / UPI' ? '#ffffff' : 'transparent',
                  color: receivedVia === 'Bank / UPI' ? '#0f172a' : '#64748b',
                  fontWeight: receivedVia === 'Bank / UPI' ? 600 : 500,
                  fontSize: '13px',
                  boxShadow: receivedVia === 'Bank / UPI' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Bank / UPI
              </button>
            </div>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="je-label-header" style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#334155' }}>
                {receivedVia === 'Cash' ? 'Cash Account *' : 'Bank Account *'}
              </span>
            </div>
            <select
              value={form.paidThrough}
              onChange={e => setField('paidThrough', e.target.value)}
            >
              {receivedVia === 'Cash' ? (
                cashAccounts.map(a => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                ))
              ) : (
                bankAccounts.map(a => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                ))
              )}
            </select>
          </label>

        </div>

        {/* 3. Collapsible Section: More Details (Optional) */}
        <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontSize: '14px',
              fontWeight: 600,
              color: '#3478f6',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <span>More Details (Optional)</span>
            {showMore ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </button>

          {showMore && (
            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px 20px' }}>
              {/* Payment Mode (for Bank / UPI) */}
              {receivedVia === 'Bank / UPI' && (
                <label style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="je-label-header" style={{ marginBottom: '6px' }}>
                    <span>Payment Mode</span>
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
              )}

              {/* Reference No. / UTR # */}
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="je-label-header" style={{ marginBottom: '6px' }}>
                  <span>Reference No. / UTR #</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. UTR-984321 / Ref #"
                  value={form.referenceNo}
                  onChange={e => setField('referenceNo', e.target.value)}
                />
              </label>

              {/* Description / Notes */}
              <label style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column' }}>
                <div className="je-label-header" style={{ marginBottom: '6px' }}>
                  <span>Description / Notes</span>
                </div>
                <textarea
                  rows={2}
                  placeholder="Add details or purpose of this income record..."
                  value={form.description}
                  onChange={e => setField('description', e.target.value)}
                />
              </label>

              {/* GST Details */}
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '4px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>GST Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="je-label-header" style={{ marginBottom: '6px' }}>
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

                  <label style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="je-label-header" style={{ marginBottom: '6px' }}>
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

                  <label style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="je-label-header" style={{ marginBottom: '6px' }}>
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
                </div>
              </div>

              {/* Attachments Section */}
              <div style={{ gridColumn: 'span 2', marginTop: '8px' }}>
                <div className="je-label-header" style={{ marginBottom: '6px' }}>
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
          )}
        </div>
      </div>

      {/* 4. Footer Buttons */}
      <footer style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 24px',
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        marginTop: '24px'
      }}>
        <button type="button" onClick={onCancel} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>
          Cancel
        </button>
        <button type="button" onClick={(e) => handleSubmit(e, 'Draft')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
          Save Draft
        </button>
        <button
          type="button"
          onClick={(e) => handleSubmit(e, 'Posted')}
          style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#3478f6', color: '#ffffff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
        >
          Save Income
        </button>
      </footer>
    </section>
  );
}
