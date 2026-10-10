import { useState, useMemo, useRef, useEffect } from 'react';
import { IconArrowLeft, IconAlertTriangle, IconPaperclip, IconTrash, IconPlus, IconSearch, IconChevronDown } from '@tabler/icons-react';
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
    paidThrough: '1010',
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
        {/* Mode Selection Radio Buttons above Date input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: expenseMode === 'single' ? '#1f61c9' : '#475569' }}>
            <input
              type="radio"
              name="expenseEntryMode"
              value="single"
              checked={expenseMode === 'single'}
              onChange={() => setExpenseMode('single')}
              style={{ accentColor: '#1f61c9', width: '17px', height: '17px' }}
            />
            <span>Single Expense</span>
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: expenseMode === 'bulk' ? '#1f61c9' : '#475569' }}>
            <input
              type="radio"
              name="expenseEntryMode"
              value="bulk"
              checked={expenseMode === 'bulk'}
              onChange={() => setExpenseMode('bulk')}
              style={{ accentColor: '#1f61c9', width: '17px', height: '17px' }}
            />
            <span>Bulk Expense Entry</span>
          </label>
        </div>

        {expenseMode === 'single' ? (
          /* ================= SINGLE EXPENSE MODE ================= */
          <div className="je-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px 20px' }}>
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

            {/* 2. Expense Account */}
            <label>
              <div className="je-label-header">
                <span>Expense Account *</span>
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

            {/* 4. Paid Through */}
            <label>
              <div className="je-label-header">
                <span>Paid Through *</span>
              </div>
              <select
                value={form.paidThrough}
                onChange={e => setField('paidThrough', e.target.value)}
              >
                <option value="1010">1010 · HDFC Bank Operating Account</option>
                <option value="1000">1000 · Petty Cash</option>
                <option value="1020">1020 · Undeposited Cash Funds</option>
                {assetAccounts.map(a => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                ))}
              </select>
            </label>


            {/* 6. Vendor (Searchable Dropdown with Source of Supply auto-detect) */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="je-label-header" style={{ marginBottom: '6px' }}>
                <span>Vendor (Search & Select)</span>
              </div>
              <SearchableVendorSelect
                vendors={vendors}
                selectedVendorId={form.vendorId}
                selectedVendorName={form.vendor}
                onSelect={handleVendorSelect}
              />
            </div>

            {/* 7. GST Treatment */}
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

            {/* 8. Vendor GSTIN */}
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

            {/* 9. Customer Name (Searchable Dropdown) */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="je-label-header" style={{ marginBottom: '6px' }}>
                <span>Customer Name</span>
              </div>
              <SearchableCustomerSelect
                customers={customers}
                selectedCustomerId={form.customerId}
                onSelect={handleCustomerSelect}
              />
            </div>

            {/* 10. Tax Rate */}
            <label>
              <div className="je-label-header">
                <span>Tax Rate</span>
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

            {/* 11. Invoice# */}
            <label>
              <div className="je-label-header">
                <span>Invoice# / Bill Ref</span>
              </div>
              <input
                type="text"
                placeholder="e.g. INV-2026-889"
                value={form.invoiceNo}
                onChange={e => setField('invoiceNo', e.target.value)}
              />
            </label>

            {/* 12. Notes */}
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

            {/* Attachments Control */}
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
        ) : (
          /* ================= BULK EXPENSE ENTRY MODE ================= */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Common Headers Grid */}
            <div className="je-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px 20px' }}>
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

              {/* 2. Paid Through */}
              <label>
                <div className="je-label-header">
                  <span>Paid Through *</span>
                </div>
                <select
                  value={form.paidThrough}
                  onChange={e => setField('paidThrough', e.target.value)}
                >
                  <option value="1010">1010 · HDFC Bank Operating Account</option>
                  <option value="1000">1000 · Petty Cash</option>
                  <option value="1020">1020 · Undeposited Cash Funds</option>
                  {assetAccounts.map(a => (
                    <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                  ))}
                </select>
              </label>

              {/* 3. Vendor (Searchable Dropdown + auto-detect Source of Supply) */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="je-label-header" style={{ marginBottom: '6px' }}>
                  <span>Vendor (Search & Select)</span>
                </div>
                <SearchableVendorSelect
                  vendors={vendors}
                  selectedVendorId={form.vendorId}
                  selectedVendorName={form.vendor}
                  onSelect={handleVendorSelect}
                />
              </div>

              {/* 4. GST Treatment */}
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

              {/* 5. Vendor GSTIN */}
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

              {/* 6. Customer Name (Searchable Dropdown) */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="je-label-header" style={{ marginBottom: '6px' }}>
                  <span>Customer Name</span>
                </div>
                <SearchableCustomerSelect
                  customers={customers}
                  selectedCustomerId={form.customerId}
                  onSelect={handleCustomerSelect}
                />
              </div>


              {/* 8. Invoice# / Bill Ref */}
              <label>
                <div className="je-label-header">
                  <span>Invoice# / Bill Ref</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-889"
                  value={form.invoiceNo}
                  onChange={e => setField('invoiceNo', e.target.value)}
                />
              </label>

              {/* 9. Attachments Control */}
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

            {/* Multiple Expense Lines Table */}
            <div style={{ marginTop: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                Expense Line Items
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', width: '30%' }}>Expense Account *</th>
                    <th style={{ padding: '10px 12px', width: '30%' }}>Notes / Description</th>
                    <th style={{ padding: '10px 12px', width: '20%' }}>Tax</th>
                    <th style={{ padding: '10px 12px', width: '15%', textAlign: 'right' }}>Amount (₹) *</th>
                    <th style={{ padding: '10px 12px', width: '5%', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkLines.map((line, idx) => (
                    <tr key={line.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <select
                          value={line.expenseAccount}
                          onChange={e => updateBulkLine(idx, 'expenseAccount', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
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
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          placeholder="Line notes..."
                          value={line.notes}
                          onChange={e => updateBulkLine(idx, 'notes', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <select
                          value={line.tax}
                          onChange={e => updateBulkLine(idx, 'tax', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        >
                          {TAX_OPTIONS.map(tax => (
                            <option key={tax} value={tax}>{tax}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={line.amount}
                          onChange={e => updateBulkLine(idx, 'amount', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => removeBulkLine(idx)}
                          disabled={bulkLines.length <= 1}
                          style={{ border: 'none', background: 'transparent', color: bulkLines.length <= 1 ? '#cbd5e1' : '#ef4444', cursor: bulkLines.length <= 1 ? 'not-allowed' : 'pointer', padding: '4px' }}
                          title="Delete Line"
                        >
                          <IconTrash size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={addBulkLine}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#eff6ff', color: '#1f61c9', border: '1px solid #bfdbfe', borderRadius: '6px', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}
                >
                  <IconPlus size={16} /> Add line item
                </button>

                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                  Total Expense Amount: ₹{bulkTotalAmount.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}
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
