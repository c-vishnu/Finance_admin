import { useState, useMemo, useRef, useEffect } from 'react';
import { IconArrowLeft, IconAlertTriangle, IconPaperclip, IconTrash, IconPlus, IconSearch, IconChevronDown, IconReceipt, IconWallet, IconPercentage, IconInfoCircle, IconFileText, IconRefresh } from '@tabler/icons-react';
import { readAccounts } from './account-store.js';
import { readOperations, saveOperations, createExpense, createPurchasePaymentExpense, accountingState } from './operations-store.js';
import { fifoAllocation, rebalanceAllocation, validateAllocation, money, paise, rupeeString } from './income-allocation.js';
import { outstandingPurchaseBills, PURCHASE_PAYMENT_TYPE } from './purchase-allocation.js';
import { recordPurchasePayment } from './purchase-service.js';
import { getCurrentOrganizationContext } from './organisation-context.js';
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

/* The date under a bill number reads the way every other date in the book reads. */
const shortDate = value => value ? new Date(value + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

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
  /* Paid From is one account picker. Cash and bank are the two groups the operator
     thinks in, while the chart stores the ledgers themselves; grouping the chart
     here keeps the form from offering receivables or fixed assets as money sources. */
  const cashPaymentAccounts = [];
  const bankPaymentAccounts = [];
  const paymentAccountCodes = new Set();
  /* The saved chart often inherits the group "Cash and Bank", so accountNature can
     say Cash for a current account. The ledger's own name and code are the reliable
     distinction: 1000 and cash-named ledgers are cash, every other bank ledger is Bank. */
  const isCashPaymentAccount = account => {
    const code = String(account.code || '');
    const name = String(account.name || '').toLowerCase();
    return code === '1000' || /cash/.test(name) || account.accountPurpose === 'Cash';
  };
  for (const account of assetAccounts) {
    const code = String(account.code || '');
    if (!code || account.active === false || account.isGroup || paymentAccountCodes.has(code)) continue;
    const name = String(account.name || '').toLowerCase();
    const isCash = isCashPaymentAccount(account);
    const isBank = !isCash && (
      account.accountNature === 'Bank'
      || account.accountPurpose === 'Bank Account'
      || /bank|current account|savings|overdraft/.test(name)
      || account.group === 'Cash and Bank'
    );
    if (!isCash && !isBank) continue;
    paymentAccountCodes.add(code);
    (isCash ? cashPaymentAccounts : bankPaymentAccounts).push({ ...account, code });
  }
  if (!cashPaymentAccounts.length) cashPaymentAccounts.push({ code: '1000', name: 'Cash / Petty Cash' });
  if (!bankPaymentAccounts.length) bankPaymentAccounts.push({ code: '1010', name: 'Bank Account' });
  const paymentAccountOptions = [...cashPaymentAccounts, ...bankPaymentAccounts];
  const expenseAccountOptions = (() => {
    const seen = new Set();
    const rows = [];
    for (const [code, name] of [['5900', 'Other Operating Expenses'], ['5000', 'Office Supplies'], ['5300', 'Rent & Utilities'], ['5400', 'Travel & Conveyance'], ['5600', 'Professional Fees']]) {
      if (!seen.has(code)) { seen.add(code); rows.push({ code, name }); }
    }
    for (const account of expenseAccounts) {
      const code = String(account.code || '');
      if (code && !seen.has(code)) { seen.add(code); rows.push({ code, name: account.name || code }); }
    }
    return rows;
  })();

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
    expenseTypeChosen: false,
    directExpenseAccount: '5900',
    allocations: {},
    allocationManual: false,
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

  /* Create Expense now holds two workflows behind the one Expense Type picker,
     the same way Record Income holds new income and invoice settlement. The
     payables book is read once as the form opens; a vendor who still owes on
     posted purchase bills opens the allocation table, and any other vendor
     records a new expense. */
  const book = useMemo(() => accountingState(), []);
  const { company, branch } = getCurrentOrganizationContext();
  const settlement = form.expenseAccount === PURCHASE_PAYMENT_TYPE;
  const openBills = settlement && form.vendorId
    ? outstandingPurchaseBills(book, { vendorId: form.vendorId, branchId: branch?.id || '', organisationId: company?.id || '' })
    : [];
  /* FIFO is the default recommendation and a typed row is the one thing a
     keystroke may not rewrite; the arithmetic is the income allocation's own. */
  const fifo = fifoAllocation({ amount: form.amount, invoices: openBills });
  const fifoAmounts = Object.fromEntries(fifo.rows.map(row => [row.invoiceId, row.amount]));
  const spread = rebalanceAllocation({ amount: form.amount, invoices: openBills, pinned: form.allocationManual ? form.allocations : {} });
  const allocationAmounts = spread.amounts;
  const pinnedBill = form.allocationManual
    ? openBills.find(bill => form.allocations[bill.id] !== undefined) || null
    : null;
  const pinnedAmount = pinnedBill ? spread.rows.find(row => row.invoiceId === pinnedBill.id)?.amount || 0 : 0;
  const amountError = (() => { try { paise(form.amount); return ''; } catch (reason) { return reason.message; } })();
  const paidPaise = amountError ? 0 : paise(form.amount);
  const paidFromAccount = paymentAccountOptions.find(a => String(a.code) === String(form.paidThrough));
  const paymentMethod = paidFromAccount && isCashPaymentAccount(paidFromAccount) ? 'Cash' : 'Bank Transfer';
  const checkedAllocation = amountError
    ? { allocations: [], allocated: 0, unallocated: 0, errors: [] }
    : validateAllocation({
        amount: form.amount,
        rows: openBills.map(bill => ({ invoiceId: bill.id, amount: allocationAmounts[bill.id] })),
        invoices: openBills,
        labels: { object: 'bill', party: 'vendor' }
      });

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

  /* Who is being paid decides which bills the money may settle. An untouched
     Expense Type follows the vendor - somebody who still owes on a purchase
     opens the payables workflow, anybody else a new expense - while a type the
     operator chose is never overwritten. Either way the previous vendor's split
     leaves with the vendor it belonged to. */
  const handleVendorSelect = (vendorId) => {
    setError('');
    if (!vendorId) {
      setForm(f => ({
        ...f,
        vendorId: '',
        vendor: '',
        vendorGstin: '',
        sourceOfSupply: 'Kerala',
        expenseAccount: f.expenseTypeChosen ? f.expenseAccount : (f.directExpenseAccount || '5900'),
        allocations: {},
        allocationManual: false
      }));
      return;
    }
    const v = vendors.find(x => x.id === vendorId || x.name === vendorId);
    if (v) {
      const detectedState = detectStateFromVendor(v);
      const owes = outstandingPurchaseBills(book, {
        vendorId: v.id,
        branchId: branch?.id || '',
        organisationId: company?.id || ''
      }).length > 0;
      setForm(f => ({
        ...f,
        vendorId: v.id,
        vendor: v.name,
        vendorGstin: v.gstin || '',
        gstTreatment: v.gstTreatment || (v.gstin ? 'Registered Business - Regular' : 'Unregistered Business'),
        sourceOfSupply: detectedState,
        expenseAccount: f.expenseTypeChosen ? f.expenseAccount : (owes ? PURCHASE_PAYMENT_TYPE : (f.directExpenseAccount || '5900')),
        allocations: {},
        allocationManual: false
      }));
    } else {
      setForm(f => ({ ...f, vendorId: '', vendor: vendorId, allocations: {}, allocationManual: false }));
    }
  };

  /* Payment For is the operator answering the workflow question, so the vendor
     stops answering it. The Other Expense group carries the account choices in
     the same dropdown, and leaving or entering the payables side clears the
     previous split rather than carrying it across. */
  const handlePaymentForChange = (mode) => {
    setError('');
    setForm(f => {
      const wasSettlement = f.expenseAccount === PURCHASE_PAYMENT_TYPE;
      const isSettlement = mode === 'bills';
      const directAccount = isSettlement ? (f.directExpenseAccount || '5900') : (mode || f.directExpenseAccount || '5900');
      return {
        ...f,
        expenseAccount: isSettlement ? PURCHASE_PAYMENT_TYPE : directAccount,
        directExpenseAccount: directAccount,
        expenseTypeChosen: true,
        ...(wasSettlement === isSettlement ? {} : { allocations: {}, allocationManual: false })
      };
    });
  };

  /* The account answers which ledger is credited; the saved payment method is
     derived from that ledger, so the form does not ask the same question twice. */
  const handlePaidFromChange = (code) => {
    setError('');
    const account = paymentAccountOptions.find(a => String(a.code) === String(code));
    const isCash = Boolean(account && isCashPaymentAccount(account));
    setForm(f => ({
      ...f,
      paidThroughMode: isCash ? 'Cash' : 'Bank',
      paidThrough: code
    }));
  };

  const handleAllocateChange = (billId, value) => {
    setError('');
    setForm(f => ({ ...f, allocationManual: true, allocations: { [billId]: value } }));
  };

  const resetToFifo = () => {
    setError('');
    setForm(f => ({ ...f, allocationManual: false, allocations: {} }));
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
      if (amountError) throw new Error(amountError);
      const store = readOperations();
      const db = accountingState();

      if (expenseMode === 'single') {
        if (!form.amount || Number(form.amount) <= 0) {
          throw new Error('Please enter a valid expense amount.');
        }

        /* A payment on the payables side settles purchase bills the book already posted, so it
           posts vendor payment journals through the purchase engine and never debits an expense
           account a second time. FIFO is only a preview: the rows are validated here against the
           same open bills the table read, and each bill engine call re-reads the bill it is paying. */
        if (settlement) {
          if (targetStatus === 'Draft') {
            throw new Error('A purchase bill payment is posted immediately; there is no draft. Use Post Payment to record it.');
          }
          if (!form.vendorId) {
            throw new Error('Select the vendor whose unpaid purchase bills this payment settles.');
          }
          if (!openBills.length) {
            throw new Error('This vendor has no unpaid purchase bills in this book. Choose Other Expense to record a new expense instead.');
          }
          if (checkedAllocation.errors.length) {
            throw new Error(checkedAllocation.errors.join(' '));
          }
          if (checkedAllocation.unallocated > 0) {
            throw new Error(`${money(checkedAllocation.unallocated)} of the amount paid is not accounted for. Allocate the whole amount across the bills above.`);
          }

          let currentDb = db;
          const payments = [];
          for (const row of checkedAllocation.allocations) {
            const bill = (currentDb.purchaseBills || []).find(entry => entry.id === row.invoiceId);
            if (!bill) throw new Error('That purchase bill is no longer available. Refresh the page and try again.');
            const out = recordPurchasePayment(currentDb, bill, {
              amount: rupeeString(row.amount),
              date: form.date,
              bankAccount: form.paidThrough || '1010',
              paymentMethod,
              reference: form.invoiceNo || '',
              notes: form.notes || '',
              attachment: form.files?.[0] || null,
              role: 'Admin'
            });
            currentDb = out.state;
            payments.push({ bill: out.bill, payment: out.payment });
          }
          localStorage.setItem(KEY, JSON.stringify(currentDb));

          /* One register row per settled bill, each pointing at the vendor payment journal that
             paid it, so the Expense Report can state what left the bank without reposting it. */
          let nextStore = store;
          for (const { bill, payment } of payments) {
            nextStore = createPurchasePaymentExpense(nextStore, {
              date: form.date,
              name: `Payment for ${bill.number}`,
              category: 'Purchase Bill Payment',
              payee: bill.vendorName || form.vendor || 'Vendor',
              account: bill.payableAccount || '2000',
              paidThrough: form.paidThrough || '1010',
              paymentMethod,
              amount: rupeeString(payment.amount),
              tax: '',
              reference: bill.vendorInvoice?.trim() || bill.referenceOrder || bill.number,
              vendor: bill.vendorName || form.vendor,
              vendorId: bill.vendorId,
              vendorGstin: form.vendorGstin,
              purchaseBillId: bill.id,
              vendorPaymentId: payment.id,
              journalId: payment.journalId,
              notes: form.notes,
              customerId: form.customerId,
              customerName: form.customerName,
              customer: form.customerName,
              files: form.files,
              frequency: 'single'
            }).store;
          }
          saveOperations(nextStore);
          if (onSaved) onSaved();
          return;
        }

        const input = {
          date: form.date,
          name: form.notes?.trim() || form.vendor || 'Business expense',
          category: 'Expense',
          payee: form.vendor || 'Vendor',
          account: form.expenseAccount || '5900',
          paidThrough: form.paidThrough || '1010',
          paymentMethod,
          transactionRef: form.invoiceNo,
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
            paymentMethod,
            transactionRef: form.invoiceNo,
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
    <section className="rt-page itemCreatePage je-create exp-create-page exp-reference-page">
      <div className="itemDialogHead"><button className="itemBack" type="button" onClick={onCancel} aria-label="Back to Expenses"><IconArrowLeft size={19} /></button><div className="itemHeadText"><h2 id="expenseDialogTitle">Create Expense</h2></div></div>
      {error && <div className="je-error exp-error"><IconAlertTriangle size={18} /><span>{error}</span></div>}
      <main className="exp-reference-content">
        <section className="exp-reference-card">
          <div className="exp-form-grid">
            <label className="exp-field">
              <span>Date Paid <b>*</b></span>
              <input type="date" required value={form.date} onChange={e => setField('date', e.target.value)} />
            </label>
            <label className="exp-field">
              <span>Paid To</span>
              <SearchableVendorSelect vendors={vendors} selectedVendorId={form.vendorId} selectedVendorName={form.vendor} onSelect={handleVendorSelect} />
            </label>
            <div className="exp-field exp-payment-for">
              <span>Payment For <b>*</b></span>
              <select aria-label="Payment For" value={settlement ? 'bills' : form.expenseAccount} onChange={e => handlePaymentForChange(e.target.value)}>
                <option value="bills">Existing Purchase Bills</option>
                <optgroup label="Other Expense">
                  {expenseAccountOptions.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                </optgroup>
              </select>
            </div>
            <label className="exp-field exp-amount">
              <span>Amount Paid (₹) <b>*</b></span>
              <input type="number" step="0.01" required placeholder="0.00" value={form.amount} onChange={e => setField('amount', e.target.value)} />
            </label>
            <div className="exp-field exp-paid-from">
              <span>Paid From <b>*</b></span>
              <select aria-label="Paid From" value={form.paidThrough} onChange={e => handlePaidFromChange(e.target.value)}>
                <optgroup label="Cash">
                  {cashPaymentAccounts.map(a => <option key={a.code} value={a.code}>{a.code === '1000' ? '1000 · Cash / Petty Cash' : `${a.code} · ${a.name}`}</option>)}
                </optgroup>
                <optgroup label="Bank">
                  {bankPaymentAccounts.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                </optgroup>
                {form.paidThrough && !paymentAccountOptions.some(a => String(a.code) === String(form.paidThrough)) && (
                  <option value={form.paidThrough}>{form.paidThrough} · Selected account</option>
                )}
              </select>
            </div>
            <div className="exp-field exp-reference-no" role="group" aria-label="Reference No.">
              <span>Reference No.</span>
              <div className="exp-reference-input">
                <input type="text" placeholder="e.g. UTR or cheque no." value={form.invoiceNo} onChange={e => setField('invoiceNo', e.target.value)} />
                <label className="exp-reference-attach" title="Attach the document the reference number comes from"><IconPaperclip size={15} /><span>Attach</span><input type="file" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} /></label>
              </div>
            </div>
          {settlement && (
            <section className="exp-allocation exp-unpaid exp-field-wide">
              <div className="exp-allocation-head">
                <h3>Outstanding Bills <small>{form.vendorId ? 'Oldest bill first · the whole amount paid must be allocated' : 'Select a vendor to see their bills'}</small></h3>
                {openBills.length > 0 && <button type="button" className="exp-allocation-reset" onClick={resetToFifo} title="Spread the amount paid over the oldest bills again"><IconRefresh size={15} />Auto Allocate</button>}
              </div>
              {form.vendorId ? (
                <>
                  <div className="ivScroll">
                    <table className="exp-allocation-table">
                      <thead>
                        <tr><th>Date</th><th>Bill number</th><th>Bill amount</th><th>Amount due</th><th>Payment</th></tr>
                      </thead>
                      <tbody>
                        {openBills.map(bill => {
                          const typed = allocationAmounts[bill.id];
                          const changed = form.allocationManual && form.allocations[bill.id] !== undefined;
                          return (
                            <tr key={bill.id} className={changed ? 'is-manual' : ''}>
                              <td>{shortDate(bill.date)}</td>
                              <td className="exp-allocation-bill" title={`Bill total ${money(bill.total)} · due ${shortDate(bill.dueDate || bill.date)}`}>{bill.number}</td>
                              <td>{money(bill.total)}</td>
                              <td>{money(bill.outstanding)}</td>
                              <td><input className="receiptAmount" type="number" step="0.01" min="0" inputMode="decimal" aria-label={`Payment for ${bill.number}`} value={typed} onChange={e => handleAllocateChange(bill.id, e.target.value)} />{changed && <em className="exp-allocation-manual">manual</em>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!openBills.length && <p>No unpaid purchase bills for this vendor.</p>}
                  </div>
                  {pinnedBill && (
                    <p className="exp-allocation-note">{pinnedBill.number} keeps your {money(pinnedAmount)}. {pinnedAmount >= (fifoAmounts[pinnedBill.id] || 0) ? 'The difference comes off the other bills' : 'The money you freed goes to the other bills'}, oldest first, so the whole amount paid stays allocated.</p>
                  )}
                  <p className="exp-allocation-line">Allocated: {money(checkedAllocation.allocated)} · Amount: {money(paidPaise)}</p>
                  {checkedAllocation.unallocated > 0 && (
                    <p className="exp-allocation-empty">Allocate the remaining {money(checkedAllocation.unallocated)} across the bills above: the whole amount paid has to be accounted for before this payment is posted.</p>
                  )}
                </>
              ) : (
                <p className="exp-allocation-empty">Select the vendor being paid to see their unpaid purchase bills.</p>
              )}
            </section>
          )}
          {!settlement && (
            <>
              <label className="exp-field">
                <span>Tax / GST</span>
                <select value={form.gstTreatment} onChange={e => setField('gstTreatment', e.target.value)}>{GST_TREATMENTS.map(x => <option key={x}>{x}</option>)}</select>
              </label>
              <label className="exp-field">
                <span>GST Rate</span>
                <select value={form.tax} onChange={e => setField('tax', e.target.value)}>{TAX_OPTIONS.map(x => <option key={x}>{x}</option>)}</select>
              </label>
            </>
          )}
            <div className="exp-field-wide exp-notes-attachment">
              <label className="exp-field exp-notes">
                <span>Notes</span>
                <textarea rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)} />
              </label>
              <div className="exp-field exp-attachments">
                <span>Attachment</span>
                <label className="exp-dropzone"><IconPaperclip size={24} /><span><b>Choose files</b> or drag and drop<small>PDF, JPG, PNG (Max 5 MB)</small></span><input type="file" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} /></label>
                {form.files.length > 0 && <div className="exp-file-list">{form.files.map((file, index) => <span key={index}>{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeFile(index)}><IconTrash size={14} /></button></span>)}</div>}
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="exp-footer"><button type="button" onClick={onCancel}>Cancel</button><button type="button" disabled={settlement} title={settlement ? 'A purchase bill payment is posted immediately; there is no draft.' : undefined} onClick={e=>handleSubmit(e,'Draft')}>Save Draft</button><button type="button" className="primary" onClick={e=>handleSubmit(e,'Posted')}>{settlement ? 'Post Payment' : 'Save Expense'}</button></footer>
    </section>
  );

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

            {/* Conditionally ask Transaction Reference if Bank */}
            {(form.paidThroughMode || 'Bank') === 'Bank' && (
              <>
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
