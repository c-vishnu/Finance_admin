import { useState } from 'react';
import { IconX, IconPlus, IconUpload, IconCalendar, IconFileText, IconPaperclip, IconTrash, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { readAccounts } from './account-store.js';
import { readOperations, saveOperations, createExpense, accountingState } from './operations-store.js';
import { KEY } from './invoice-engine.js';
import './journal-entries.css';
import './journal-form.css';

const STATE_LIST = [
  'Kerala', 'Tamil Nadu', 'Karnataka', 'Maharashtra', 'Delhi',
  'Andhra Pradesh', 'Telangana', 'Gujarat', 'West Bengal', 'Goa', 'Uttar Pradesh', 'Other'
];

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

const EXPENSE_TYPES = [
  'Services', 'Goods', 'Capital Asset'
];

const REPEAT_EVERY_OPTIONS = [
  'Week', '2 Weeks', 'Month', '2 Months', '3 Months', '6 Months', 'Year'
];

export default function CreateExpenseModal({ isOpen, onClose, onSaved }) {
  const [frequency, setFrequency] = useState('single'); // 'single' | 'recurring'
  const [error, setError] = useState('');

  const accounts = readAccounts();
  const expenseAccounts = (accounts?.accounts || []).filter(a => a.type === 'Expenses' || a.code.startsWith('5'));
  const assetAccounts = (accounts?.accounts || []).filter(a => a.type === 'Assets' || a.code.startsWith('1'));

  // Form State
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    expenseAccount: '5900',
    amount: '',
    paidThrough: '1010',
    expenseType: 'Services',
    sac: '',
    vendor: '',
    gstTreatment: 'Registered Business - Regular',
    sourceOfSupply: 'Kerala',
    destinationOfSupply: 'Kerala',
    tax: 'GST 18%',
    invoiceNo: '',
    notes: '',
    customerName: '',
    files: [],

    // Recurring specific
    profileName: '',
    repeatEvery: 'Month',
    startDate: new Date().toISOString().split('T')[0],
    endsOn: '',
    neverExpires: true,
  });

  if (!isOpen) return null;

  const setField = (key, value) => {
    setError('');
    setForm(f => ({ ...f, [key]: value }));
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
        throw new Error('Please enter a valid expense amount.');
      }
      if (frequency === 'recurring' && !form.profileName?.trim()) {
        throw new Error('Please enter a Profile Name for the recurring expense.');
      }

      const store = readOperations();
      const db = accountingState();

      const input = {
        date: frequency === 'single' ? form.date : form.startDate,
        name: frequency === 'recurring' ? form.profileName : (form.notes?.trim() || form.vendor || 'Business expense'),
        category: form.expenseType === 'Goods' ? 'Office supplies' : 'Professional fees',
        payee: form.vendor || 'Vendor',
        account: form.expenseAccount || '5900',
        paidThrough: form.paidThrough || '1010',
        amount: Number(form.amount),
        sac: form.sac,
        expenseType: form.expenseType,
        gstTreatment: form.gstTreatment,
        sourceOfSupply: form.sourceOfSupply,
        destinationOfSupply: form.destinationOfSupply,
        tax: form.tax,
        invoiceNo: form.invoiceNo,
        reference: form.invoiceNo,
        notes: form.notes,
        customerName: form.customerName,
        customer: form.customerName,
        frequency,
        profileName: form.profileName,
        repeatEvery: form.repeatEvery,
        startDate: form.startDate,
        endsOn: form.neverExpires ? null : form.endsOn,
        neverExpires: form.neverExpires,
        files: form.files,
        status: targetStatus,
      };

      const out = createExpense(store, db, input);
      saveOperations(out.store);
      localStorage.setItem(KEY, JSON.stringify(out.accounting));

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="je-reverse-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div
        className="je-reverse-dialog exp-dialog-wrap"
        style={{
          maxWidth: '860px',
          width: '94vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 20px 60px rgba(16, 24, 40, 0.25)'
        }}
      >
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid #eaecf0',
            background: '#f8fafc'
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 650, color: '#101828' }}>Create Expense</h2>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#667085' }}>
              Record single or recurring business expenses directly into the general ledger.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              border: '1px solid #d0d5dd',
              borderRadius: '8px',
              background: '#fff',
              color: '#667085',
              cursor: 'pointer'
            }}
          >
            <IconX size={18} />
          </button>
        </header>

        {/* Frequency Tab Switcher */}
        <div style={{ padding: '16px 24px 0', background: '#fff' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#f2f4f7',
              padding: '4px',
              borderRadius: '8px',
              gap: '4px'
            }}
          >
            <button
              type="button"
              onClick={() => setFrequency('single')}
              style={{
                padding: '8px 18px',
                border: 0,
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                background: frequency === 'single' ? '#fff' : 'transparent',
                color: frequency === 'single' ? '#1f61c9' : '#475467',
                boxShadow: frequency === 'single' ? '0 2px 6px rgba(16, 24, 40, 0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Single Expense
            </button>
            <button
              type="button"
              onClick={() => setFrequency('recurring')}
              style={{
                padding: '8px 18px',
                border: 0,
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                background: frequency === 'recurring' ? '#fff' : 'transparent',
                color: frequency === 'recurring' ? '#1f61c9' : '#475467',
                boxShadow: frequency === 'recurring' ? '0 2px 6px rgba(16, 24, 40, 0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Recurring Expense
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                marginBottom: '16px',
                borderRadius: '8px',
                background: '#fef3f2',
                border: '1px solid #fecdca',
                color: '#b42318',
                fontSize: '13px'
              }}
            >
              <IconAlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '16px 20px'
            }}
          >
            {/* RECURRING FIELDS */}
            {frequency === 'recurring' && (
              <>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                    Profile Name <span style={{ color: '#d92d20' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Monthly Office Internet & Broadband"
                    value={form.profileName}
                    onChange={e => setField('profileName', e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      border: '1px solid #d0d5dd',
                      borderRadius: '8px',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                    Repeat Every
                  </label>
                  <select
                    value={form.repeatEvery}
                    onChange={e => setField('repeatEvery', e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      border: '1px solid #d0d5dd',
                      borderRadius: '8px',
                      fontSize: '13px',
                      background: '#fff'
                    }}
                  >
                    {REPEAT_EVERY_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                    Start Date <span style={{ color: '#d92d20' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={e => setField('startDate', e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      border: '1px solid #d0d5dd',
                      borderRadius: '8px',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                    Ends On
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <input
                      type="date"
                      disabled={form.neverExpires}
                      value={form.endsOn}
                      onChange={e => setField('endsOn', e.target.value)}
                      style={{
                        width: '220px',
                        height: '40px',
                        padding: '0 12px',
                        border: '1px solid #d0d5dd',
                        borderRadius: '8px',
                        fontSize: '13px',
                        opacity: form.neverExpires ? 0.5 : 1
                      }}
                    />
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#344054', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.neverExpires}
                        onChange={e => setField('neverExpires', e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: '#1f61c9' }}
                      />
                      Never Expires
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* SINGLE EXPENSE DATE */}
            {frequency === 'single' && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                  Date <span style={{ color: '#d92d20' }}>*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={e => setField('date', e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    border: '1px solid #d0d5dd',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                />
              </div>
            )}

            {/* EXPENSE ACCOUNT */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                Expense Account <span style={{ color: '#d92d20' }}>*</span>
              </label>
              <select
                value={form.expenseAccount}
                onChange={e => setField('expenseAccount', e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid #d0d5dd',
                  borderRadius: '8px',
                  fontSize: '13px',
                  background: '#fff'
                }}
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
            </div>

            {/* AMOUNT */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                Amount (₹) <span style={{ color: '#d92d20' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={form.amount}
                onChange={e => setField('amount', e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid #d0d5dd',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}
              />
            </div>

            {/* PAID THROUGH */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                Paid Through <span style={{ color: '#d92d20' }}>*</span>
              </label>
              <select
                value={form.paidThrough}
                onChange={e => setField('paidThrough', e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid #d0d5dd',
                  borderRadius: '8px',
                  fontSize: '13px',
                  background: '#fff'
                }}
              >
                <option value="1010">1010 · HDFC Bank Operating Account</option>
                <option value="1000">1000 · Petty Cash</option>
                <option value="1020">1020 · Undeposited Cash Funds</option>
                {assetAccounts.map(a => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                ))}
              </select>
            </div>

            {/* EXPENSE TYPE */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                Expense Type
              </label>
              <select
                value={form.expenseType}
                onChange={e => setField('expenseType', e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid #d0d5dd',
                  borderRadius: '8px',
                  fontSize: '13px',
                  background: '#fff'
                }}
              >
                {EXPENSE_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* SAC */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                SAC / HSN Code
              </label>
              <input
                type="text"
                placeholder="e.g. 998313"
                value={form.sac}
                onChange={e => setField('sac', e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid #d0d5dd',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}
              />
            </div>

            {/* VENDOR */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                Vendor
              </label>
              <input
                type="text"
                placeholder="e.g. FiberNet India / Cloudstack"
                value={form.vendor}
                onChange={e => setField('vendor', e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid #d0d5dd',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}
              />
            </div>

            {/* GST TREATMENT */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                GST Treatment
              </label>
              <select
                value={form.gstTreatment}
                onChange={e => setField('gstTreatment', e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid #d0d5dd',
                  borderRadius: '8px',
                  fontSize: '13px',
                  background: '#fff'
                }}
              >
                {GST_TREATMENTS.map(gt => (
                  <option key={gt} value={gt}>{gt}</option>
                ))}
              </select>
            </div>

            {/* SOURCE OF SUPPLY */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                Source Of Supply
              </label>
              <select
                value={form.sourceOfSupply}
                onChange={e => setField('sourceOfSupply', e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid #d0d5dd',
                  borderRadius: '8px',
                  fontSize: '13px',
                  background: '#fff'
                }}
              >
                {STATE_LIST.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* DESTINATION OF SUPPLY */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                Destination Of Supply
              </label>
              <select
                value={form.destinationOfSupply}
                onChange={e => setField('destinationOfSupply', e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid #d0d5dd',
                  borderRadius: '8px',
                  fontSize: '13px',
                  background: '#fff'
                }}
              >
                {STATE_LIST.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* TAX */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                Tax Rate
              </label>
              <select
                value={form.tax}
                onChange={e => setField('tax', e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid #d0d5dd',
                  borderRadius: '8px',
                  fontSize: '13px',
                  background: '#fff'
                }}
              >
                {TAX_OPTIONS.map(tax => (
                  <option key={tax} value={tax}>{tax}</option>
                ))}
              </select>
            </div>

            {/* INVOICE# (Single Expense only) */}
            {frequency === 'single' && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                  Invoice# / Bill Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-889"
                  value={form.invoiceNo}
                  onChange={e => setField('invoiceNo', e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    border: '1px solid #d0d5dd',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                />
              </div>
            )}

            {/* CUSTOMER NAME */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                Customer Name
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Corp (Optional)"
                value={form.customerName}
                onChange={e => setField('customerName', e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid #d0d5dd',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}
              />
            </div>

            {/* NOTES */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                Notes / Description
              </label>
              <textarea
                rows={2}
                placeholder="Add notes or memo regarding this expense..."
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d0d5dd',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* UPLOAD FILES */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                Upload Files
              </label>
              <div
                style={{
                  border: '1.5px dashed #d0d5dd',
                  borderRadius: '10px',
                  padding: '20px',
                  textAlign: 'center',
                  background: '#fafafa',
                  position: 'relative'
                }}
              >
                <IconUpload size={24} style={{ color: '#667085', marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#344054' }}>
                  Click or drag files here to upload receipt or invoice
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#667085' }}>
                  Supports PDF, PNG, JPG, CSV (up to 10MB)
                </p>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%'
                  }}
                />
              </div>

              {/* Uploaded File List */}
              {form.files.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {form.files.map((f, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#f8fafc',
                        border: '1px solid #eaecf0',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <IconPaperclip size={16} style={{ color: '#1f61c9' }} />
                        <span style={{ fontWeight: 600, color: '#344054' }}>{f.name}</span>
                        <span style={{ color: '#667085' }}>({f.size})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        style={{ border: 0, background: 'transparent', color: '#b42318', cursor: 'pointer', padding: '2px' }}
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            padding: '16px 24px',
            borderTop: '1px solid #eaecf0',
            background: '#f8fafc'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: '40px',
              padding: '0 16px',
              border: '1px solid #d0d5dd',
              borderRadius: '8px',
              background: '#fff',
              color: '#344054',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={(e) => handleSubmit(e, 'Draft')}
            style={{
              height: '40px',
              padding: '0 16px',
              border: '1px solid #d0d5dd',
              borderRadius: '8px',
              background: '#fff',
              color: '#344054',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Save as Draft
          </button>

          <button
            type="button"
            onClick={(e) => handleSubmit(e, 'Posted')}
            style={{
              height: '40px',
              padding: '0 20px',
              border: 0,
              borderRadius: '8px',
              background: '#1f61c9',
              color: '#fff',
              fontWeight: 650,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(31, 97, 201, 0.25)'
            }}
          >
            Save & Post Expense
          </button>
        </footer>
      </div>
    </div>
  );
}
