import { useState, useMemo, useRef, useEffect } from 'react';
import { IconArrowLeft, IconAlertTriangle, IconPaperclip, IconTrash, IconPlus, IconSearch, IconChevronDown, IconReceipt, IconWallet, IconPercentage, IconInfoCircle } from '@tabler/icons-react';
import { readAccounts } from './account-store.js';
import { readOperations, saveOperations, createExpense, accountingState } from './operations-store.js';
import { readVendors } from './vendor-store.js';
import { KEY } from './invoice-engine.js';
import { customerSeeds } from './Customers.jsx';
import './journal-entries.css';
import './journal-form.css';
import './record-transaction.css';

const STATE_LIST = [
  'Kerala', 'Tamil Nadu', 'Karnataka', 'Maharashtra', 'Delhi',
  'Andhra Pradesh', 'Telangana', 'Gujarat', 'West Bengal', 'Goa', 'Uttar Pradesh', 'Other'
];

const GSTIN_STATE_MAP = {
  '32': 'Kerala',
  '29': 'Karnataka',
  '33': 'Tamil Nadu',
  '27': 'Maharashtra',
  '07': 'Delhi',
  '37': 'Andhra Pradesh',
  '36': 'Telangana',
  '24': 'Gujarat',
  '19': 'West Bengal',
  '30': 'Goa',
  '09': 'Uttar Pradesh'
};

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

function SearchableVendorSelect({ vendors, selectedVendorId, selectedVendorName, onSelect }) {
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
    if (!search.trim()) return vendors;
    const q = search.toLowerCase();
    return vendors.filter(v => 
      (v.name && v.name.toLowerCase().includes(q)) ||
      (v.code && v.code.toLowerCase().includes(q)) ||
      (v.companyName && v.companyName.toLowerCase().includes(q)) ||
      (v.gstin && v.gstin.toLowerCase().includes(q))
    );
  }, [vendors, search]);

  const selectedVendor = vendors.find(v => v.id === selectedVendorId || v.name === selectedVendorName);

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
          color: selectedVendor ? '#0f172a' : '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedVendor ? `${selectedVendor.name}${selectedVendor.code ? ` (${selectedVendor.code})` : ''}` : 'Search & Select Vendor...'}
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
              placeholder="Search vendor by name, GSTIN, code..."
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
              onClick={() => { onSelect(''); setIsOpen(false); setSearch(''); }}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                color: '#64748b',
                cursor: 'pointer',
                background: !selectedVendorId ? '#f1f5f9' : 'transparent'
              }}
            >
              -- Clear / Select Vendor --
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
                No matching vendors found
              </div>
            ) : (
              filtered.map(v => (
                <div
                  key={v.id}
                  onClick={() => { onSelect(v.id); setIsOpen(false); setSearch(''); }}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    color: '#0f172a',
                    cursor: 'pointer',
                    background: (v.id === selectedVendorId || v.name === selectedVendorName) ? '#eff6ff' : 'transparent',
                    fontWeight: (v.id === selectedVendorId || v.name === selectedVendorName) ? 600 : 400,
                    borderBottom: '1px solid #f8fafc'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{v.name} {v.code ? `(${v.code})` : ''}</span>
                    {v.gstin && <span style={{ fontSize: '11px', color: '#64748b' }}>GSTIN: {v.gstin}</span>}
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
      (c.gstin && c.gstin.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

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
          {selectedCustomer ? `${selectedCustomer.name}${selectedCustomer.code ? ` (${selectedCustomer.code})` : ''}` : 'Search & Select Customer (Optional)...'}
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
              placeholder="Search customer by name, email, code..."
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
              onClick={() => { onSelect(''); setIsOpen(false); setSearch(''); }}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                color: '#64748b',
                cursor: 'pointer',
                background: !selectedCustomerId ? '#f1f5f9' : 'transparent'
              }}
            >
              -- None / Select Customer --
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
                No matching customers found
              </div>
            ) : (
              filtered.map(c => (
                <div
                  key={c.id}
                  onClick={() => { onSelect(c.id); setIsOpen(false); setSearch(''); }}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    color: '#0f172a',
                    cursor: 'pointer',
                    background: c.id === selectedCustomerId ? '#eff6ff' : 'transparent',
                    fontWeight: c.id === selectedCustomerId ? 600 : 400,
                    borderBottom: '1px solid #f8fafc'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{c.name} {c.code ? `(${c.code})` : ''}</span>
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

export default function CreateExpensePage({ onCancel, onSaved }) {
  const [expenseMode, setExpenseMode] = useState('single'); // 'single' | 'bulk'
  const [error, setError] = useState('');

  const accounts = readAccounts();
  const expenseAccounts = (accounts?.accounts || []).filter(a => a.type === 'Expenses' || a.code?.startsWith('5'));
  const assetAccounts = (accounts?.accounts || []).filter(a => a.type === 'Assets' || a.code?.startsWith('1'));

  // Vendor list
  const vendors = useMemo(() => readVendors(), []);

  // Customers list
  const customers = useMemo(() => {
    try {
      const raw = localStorage.getItem('wayvida-customers');
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list) && list.length > 0) return list;
    } catch {}
    return customerSeeds;
  }, []);

  // Form State
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    expenseAccount: '5900',
    amount: '',
    paidThroughMode: 'Bank',
    paidThrough: '1010',
    paymentMethod: 'Bank Transfer',
    transactionRef: '',
    sac: '',
    vendorId: '',
    vendor: '',
    vendorGstin: '',
    gstTreatment: 'Registered Business - Regular',
    sourceOfSupply: 'Kerala',
    destinationOfSupply: 'Kerala',
    tax: 'GST 18%',
    invoiceNo: '',
    notes: '',
    customerId: '',
    customerName: '',
    files: [],
  });

  // Bulk lines state
  const [bulkLines, setBulkLines] = useState([
    { id: 1, expenseAccount: '5900', notes: '', tax: 'GST 18%', amount: '' },
    { id: 2, expenseAccount: '5000', notes: '', tax: 'GST 18%', amount: '' }
  ]);

  const setField = (key, value) => {
    setError('');
    setForm(f => ({ ...f, [key]: value }));
  };

  const detectStateFromVendor = (v) => {
    if (!v) return 'Kerala';
    if (v.billing?.state && STATE_LIST.includes(v.billing.state)) return v.billing.state;
    if (v.shipping?.state && STATE_LIST.includes(v.shipping.state)) return v.shipping.state;
    if (v.state && STATE_LIST.includes(v.state)) return v.state;
    if (v.gstin && v.gstin.length >= 2) {
      const code = v.gstin.substring(0, 2);
      if (GSTIN_STATE_MAP[code]) return GSTIN_STATE_MAP[code];
    }
    return 'Kerala';
  };

  const handleVendorSelect = (vendorId) => {
    setError('');
    if (!vendorId) {
      setForm(f => ({ ...f, vendorId: '', vendor: '', vendorGstin: '', sourceOfSupply: 'Kerala' }));
      return;
    }
    const v = vendors.find(x => x.id === vendorId || x.name === vendorId);
    if (v) {
      const detectedState = detectStateFromVendor(v);
      setForm(f => ({
        ...f,
        vendorId: v.id,
        vendor: v.name,
        vendorGstin: v.gstin || '',
        gstTreatment: v.gstTreatment || (v.gstin ? 'Registered Business - Regular' : 'Unregistered Business'),
        sourceOfSupply: detectedState
      }));
    } else {
      setForm(f => ({ ...f, vendorId: '', vendor: vendorId }));
    }
  };

  const handleCustomerSelect = (customerId) => {
    setError('');
    if (!customerId) {
      setForm(f => ({ ...f, customerId: '', customerName: '' }));
      return;
    }
    const found = customers.find(c => c.id === customerId);
    setForm(f => ({
      ...f,
      customerId,
      customerName: found ? found.name : ''
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

  // Bulk Line Handlers
  const addBulkLine = () => {
    setBulkLines(prev => [
      ...prev,
      { id: Date.now(), expenseAccount: '5900', notes: '', tax: 'GST 18%', amount: '' }
    ]);
  };

  const updateBulkLine = (index, field, value) => {
    setBulkLines(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeBulkLine = (index) => {
    if (bulkLines.length <= 1) return;
    setBulkLines(prev => prev.filter((_, i) => i !== index));
  };

  const bulkTotalAmount = useMemo(() => {
    return bulkLines.reduce((acc, line) => acc + (Number(line.amount) || 0), 0);
  }, [bulkLines]);

  const handleSubmit = (e, targetStatus = 'Posted') => {
    if (e) e.preventDefault();
    try {
      const store = readOperations();
      const db = accountingState();

      if (expenseMode === 'single') {
        if (!form.amount || Number(form.amount) <= 0) {
          throw new Error('Please enter a valid expense amount.');
        }

        const input = {
          date: form.date,
          name: form.notes?.trim() || form.vendor || 'Business expense',
          category: 'Expense',
          payee: form.vendor || 'Vendor',
          account: form.expenseAccount || '5900',
          paidThrough: form.paidThrough || '1010',
          amount: Number(form.amount),
          sac: form.sac,
          vendor: form.vendor,
          vendorGstin: form.vendorGstin,
          gstTreatment: form.gstTreatment,
          sourceOfSupply: form.sourceOfSupply,
          tax: form.tax,
          invoiceNo: form.invoiceNo,
          reference: form.invoiceNo,
          notes: form.notes,
          customerId: form.customerId,
          customerName: form.customerName,
          customer: form.customerName,
          files: form.files,
          status: targetStatus,
          frequency: 'single'
        };

        const out = createExpense(store, db, input);
        saveOperations(out.store);
        localStorage.setItem(KEY, JSON.stringify(out.accounting));
      } else {
        // Bulk Expense Entry
        const validLines = bulkLines.filter(l => Number(l.amount) > 0);
        if (validLines.length === 0) {
          throw new Error('Please enter amount for at least one expense line item.');
        }

        let currentStore = store;
        let currentDb = db;

        for (const line of validLines) {
          const input = {
            date: form.date,
            name: line.notes?.trim() || form.vendor || 'Bulk expense',
            category: 'Bulk Expense',
            payee: form.vendor || 'Vendor',
            account: line.expenseAccount || '5900',
            paidThrough: form.paidThrough || '1010',
            amount: Number(line.amount),
            vendor: form.vendor,
            vendorGstin: form.vendorGstin,
            gstTreatment: form.gstTreatment,
            sourceOfSupply: form.sourceOfSupply,
            destinationOfSupply: form.destinationOfSupply,
            invoiceNo: form.invoiceNo,
            reference: form.invoiceNo,
            tax: line.tax,
            notes: line.notes,
            customerId: form.customerId,
            customerName: form.customerName,
            customer: form.customerName,
            files: form.files,
            status: targetStatus,
            frequency: 'bulk'
          };

          const out = createExpense(currentStore, currentDb, input);
          currentStore = out.store;
          currentDb = out.accounting;
        }

        saveOperations(currentStore);
        localStorage.setItem(KEY, JSON.stringify(currentDb));
      }

      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="rt-page itemCreatePage je-create exp-create-page" style={{ margin: 0, paddingBottom: '32px' }}>
      {/* 1. Page Header */}
      <div className="itemDialogHead" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            className="itemBack"
            type="button"
            onClick={onCancel}
            aria-label="Back to Expenses"
            title="Back to Expenses"
          >
            <IconArrowLeft size={19} />
          </button>
          <div className="itemHeadText">
            <h2 id="expenseDialogTitle">Create Expense</h2>
          </div>
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
        <div className="je-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '18px 20px' }}>
            {/* SECTION 1: Expense Details */}
            <div className="rt-section-head" style={{ gridColumn: '1 / -1', borderBottom: '1px solid #edf1f6', paddingBottom: '8px', marginBottom: '4px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 650, color: '#172033', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconReceipt size={18} style={{ color: '#3478f6' }} />
                <span>Expense Details</span>
              </h3>
            </div>

            {/* 1. Date */}
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

            {/* 2. Expense Type */}
            <label>
              <div className="je-label-header">
                <span>Expense Type *</span>
              </div>
              <select
                value={form.expenseAccount}
                onChange={e => setField('expenseAccount', e.target.value)}
              >
                <option value="5900">5900 · Other Operating Expenses</option>
                <option value="5000">5000 · Office Supplies</option>
                <option value="5300">5300 · Rent & Utilities</option>
                <option value="5400">5400 · Travel & Conveyance</option>
                <option value="5600">5600 · Professional Fees</option>
                <option value="5700">5700 · Bank Charges</option>
                {expenseAccounts.map(a => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                ))}
              </select>
            </label>

            {/* 3. Amount */}
            <label>
              <div className="je-label-header">
                <span>Amount (₹) *</span>
              </div>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={form.amount}
                onChange={e => setField('amount', e.target.value)}
              />
            </label>

            {/* 4. Paid To (Vendor) */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="je-label-header" style={{ marginBottom: '6px' }}>
                <span>Paid To (Vendor)</span>
              </div>
              <SearchableVendorSelect
                vendors={vendors}
                selectedVendorId={form.vendorId}
                selectedVendorName={form.vendor}
                onSelect={handleVendorSelect}
              />
            </div>

            {/* SECTION 2: Payment & Tax Details */}
            <div className="rt-section-head" style={{ gridColumn: '1 / -1', borderBottom: '1px solid #edf1f6', paddingBottom: '8px', marginTop: '12px', marginBottom: '4px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 650, color: '#172033', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconWallet size={18} style={{ color: '#3478f6' }} />
                <span>Payment & Tax Details</span>
              </h3>
            </div>

            {/* Paid Through */}
            <label>
              <div className="je-label-header">
                <span>Paid Through *</span>
              </div>
              <select
                value={form.paidThroughMode || 'Bank'}
                onChange={e => {
                  const mode = e.target.value;
                  const defaultAcc = mode === 'Cash' ? '1000' : '1010';
                  setForm(f => ({ ...f, paidThroughMode: mode, paidThrough: defaultAcc }));
                }}
              >
                <option value="Bank">Bank</option>
                <option value="Cash">Cash in hand</option>
              </select>
            </label>

            {/* Payment Account */}
            <label>
              <div className="je-label-header">
                <span>Payment Account *</span>
              </div>
              <select
                value={form.paidThrough}
                onChange={e => setField('paidThrough', e.target.value)}
              >
                {form.paidThroughMode === 'Cash' ? (
                  <>
                    <option value="1000">1000 · Cash / Petty Cash</option>
                    <option value="1020">1020 · Undeposited Cash Funds</option>
                  </>
                ) : (
                  <>
                    <option value="1010">1010 · HDFC Bank Operating Account</option>
                    {assetAccounts.filter(a => a.code !== '1000').map(a => (
                      <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                    ))}
                  </>
                )}
              </select>
            </label>

            {/* Conditionally ask Payment Method and Transaction Ref if Bank */}
            {(form.paidThroughMode || 'Bank') === 'Bank' && (
              <>
                <label>
                  <div className="je-label-header">
                    <span>Payment Method</span>
                  </div>
                  <select
                    value={form.paymentMethod || 'Bank Transfer'}
                    onChange={e => setField('paymentMethod', e.target.value)}
                  >
                    <option value="Bank Transfer">Bank Transfer / NEFT / RTGS / IMPS</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit Card">Credit / Debit Card</option>
                    <option value="Online">Online Banking / Gateway</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label>
                  <div className="je-label-header">
                    <span>Transaction Reference / UTR #</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. UTR1234567890"
                    value={form.transactionRef || ''}
                    onChange={e => setField('transactionRef', e.target.value)}
                  />
                </label>
              </>
            )}

            {/* GST Treatment */}
            <label>
              <div className="je-label-header">
                <span>GST Treatment</span>
              </div>
              <select
                value={form.gstTreatment}
                onChange={e => setField('gstTreatment', e.target.value)}
              >
                {GST_TREATMENTS.map(gt => (
                  <option key={gt} value={gt}>{gt}</option>
                ))}
              </select>
            </label>

            {/* GST Rate */}
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

            {/* Vendor GSTIN */}
            <label>
              <div className="je-label-header">
                <span>Vendor GSTIN</span>
              </div>
              <input
                type="text"
                placeholder="e.g. 32ABCDE1234F1Z5"
                value={form.vendorGstin}
                onChange={e => setField('vendorGstin', e.target.value)}
              />
            </label>

            {/* Invoice / Bill / Reference No. */}
            <label>
              <div className="je-label-header">
                <span>Invoice / Bill / Reference No.</span>
              </div>
              <input
                type="text"
                placeholder="e.g. INV-2026-889"
                value={form.invoiceNo}
                onChange={e => setField('invoiceNo', e.target.value)}
              />
            </label>

            {/* SECTION 3: Additional Details */}
            <div className="rt-section-head" style={{ gridColumn: '1 / -1', borderBottom: '1px solid #edf1f6', paddingBottom: '8px', marginTop: '12px', marginBottom: '4px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 650, color: '#172033', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconInfoCircle size={18} style={{ color: '#3478f6' }} />
                <span>Additional Details</span>
              </h3>
            </div>

            {/* Notes & Attachments in a single row */}
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px 20px', alignItems: 'start' }}>
              {/* Notes */}
              <label>
                <div className="je-label-header">
                  <span>Notes</span>
                </div>
                <input
                  type="text"
                  placeholder="Add notes or description regarding this expense..."
                  value={form.notes}
                  onChange={e => setField('notes', e.target.value)}
                />
              </label>

              {/* Attachments */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="je-label-header" style={{ marginBottom: '6px' }}>
                  <span>Attachments</span>
                </div>
                <div className="je-attachments" style={{ minHeight: '38px', padding: '4px 10px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span className="je-attach-note">PDF, images, Word or Excel files</span>
                  <label className="je-attach-button" style={{ minHeight: '32px', margin: 0 }}>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                      onChange={handleFileUpload}
                    />
                    <IconPaperclip size={15} /> Attach files
                  </label>
                </div>
                {form.files.length > 0 && (
                  <div className="je-selected-files" style={{ width: '100%', marginTop: '4px' }}>
                    {form.files.map((f, i) => (
                      <span key={i}>
                        <IconPaperclip size={14} style={{ color: '#1f61c9' }} />
                        <b>{f.name}</b> ({f.size})
                        <button
                          type="button"
                          aria-label={`Remove ${f.name}`}
                          onClick={() => removeFile(i)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>

      {/* Sticky Footer Bar */}
      <footer>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={(e) => handleSubmit(e, 'Draft')}>
          Save as draft
        </button>
        <button
          type="button"
          className="primary"
          onClick={(e) => handleSubmit(e, 'Posted')}
        >
          Save & Post Expense
        </button>
      </footer>
    </section>
  );
}
