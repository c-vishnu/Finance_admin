import { useEffect, useMemo, useState } from 'react';
import {
  IconArrowLeft,
  IconArrowsExchange,
  IconBook2,
  IconBuildingBank,
  IconCheck,
  IconClock,
  IconDownload,
  IconEdit,
  IconEye,
  IconFileText,
  IconFilter,
  IconInfoCircle,
  IconLock,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX
} from '@tabler/icons-react';
import { initial, KEY } from './invoice-engine.js';
import {
  allBankTransactions,
  allBankTransfers,
  BANKING_DEMO_VERSION,
  bookBalance,
  createBankingDemo,
  readBanking,
  reconciliationDetails,
  reconciliationSummary,
  recordManualTransaction,
  saveBankAccount,
  saveBanking,
  transferMoney
} from './banking-service.js';
import { formatRupees } from './number-format.js';
import StatusPill from './StatusPill.jsx';
import EmptyState from './EmptyState.jsx';
import BankReconciliation from './BankReconciliation.jsx';
import BankingSettings from './BankingSettings.jsx';
import BankAccountRowActions from './BankAccountRowActions.jsx';
import './invoice-workspace.css';
import './items.css';
import './vendors.css';
import './sales-orders.css';
import './sales-order-actions.css';
import './status-pill.css';
import './banking.css';
import './banking-shell.css';

const accountingState = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null') || initial();
  } catch {
    return initial();
  }
};

const mask = value => (value ? `•••• ${String(value).slice(-4)}` : 'Not recorded');
const today = () => new Date().toLocaleDateString('en-CA');
const money = n => formatRupees(n);

const ACCOUNT_TYPES = ['Current Account', 'Savings Account', 'Overdraft', 'Cash Credit', 'Other'];
const CURRENCIES = ['INR', 'USD', 'AED', 'EUR', 'GBP'];
const BRANCHES = ['Kochi Branch', 'Trivandrum Branch', 'Bengaluru Branch', 'Chennai Branch', 'Mumbai Branch'];
const ORGANISATIONS = ['ABC Technologies Pvt Ltd', 'Wayvida Learning', 'Northstar Retail LLP'];

const blankAccount = () => ({
  bankName: '',
  accountName: '',
  accountNumber: '',
  accountType: 'Current Account',
  branch: 'Kochi Branch',
  organisation: 'ABC Technologies Pvt Ltd',
  ifsc: '',
  currency: 'INR',
  status: 'Active',
  accountCode: '',
  openingBalance: '',
  openingBalanceDate: today()
});

export default function Banking({ page = 'Bank Accounts', onNavigate = () => {}, notify = () => {} }) {
  const [banking, setBanking] = useState(readBanking);
  const [db, setDb] = useState(accountingState);
  const [error, setError] = useState('');

  // Bank Accounts state
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountTab, setAccountTab] = useState('Overview');
  const [accountForm, setAccountForm] = useState(null);
  const [accountQuery, setAccountQuery] = useState('');
  const [accountStatusFilter, setAccountStatusFilter] = useState('All statuses');
  const [accountTypeFilter, setAccountTypeFilter] = useState('');
  const [accountBranchFilter, setAccountBranchFilter] = useState('');
  const [accountOrgFilter, setAccountOrgFilter] = useState('');

  // Bank Transactions state
  const [txQuery, setTxQuery] = useState('');
  const [txBankFilter, setTxBankFilter] = useState(() => sessionStorage.getItem('wayvida-open-bank') || 'all');
  const [txTypeFilter, setTxTypeFilter] = useState('All types');
  const [txDateFilter, setTxDateFilter] = useState('All dates');

  // Bank Transfers state
  const [trfQuery, setTrfQuery] = useState('');
  const [trfFromFilter, setTrfFromFilter] = useState('');
  const [trfToFilter, setTrfToFilter] = useState('');

  // Modals
  const [transferModal, setTransferModal] = useState(null);
  const [recordTxModal, setRecordTxModal] = useState(null);
  const [journalModal, setJournalModal] = useState(null);

  const persist = (nextBanking, nextDb = db) => {
    saveBanking(nextBanking);
    localStorage.setItem(KEY, JSON.stringify(nextDb));
    setBanking(nextBanking);
    setDb(nextDb);
  };

  useEffect(() => {
    if (Number(banking.demoVersion || 0) < BANKING_DEMO_VERSION) {
      try {
        const out = createBankingDemo(banking, db);
        persist(out.banking, out.accounting);
      } catch (err) {
        console.error(err);
      }
    }
  }, []);

  // Sync open-bank from sessionStorage if navigating from another view
  useEffect(() => {
    const handoff = sessionStorage.getItem('wayvida-open-bank');
    if (handoff) {
      sessionStorage.removeItem('wayvida-open-bank');
      if (page === 'Bank Accounts') {
        const found = banking.bankAccounts.find(a => a.id === handoff);
        if (found) {
          setSelectedAccount(found);
          setAccountTab('Overview');
        }
      } else if (page === 'Bank Transactions') {
        setTxBankFilter(handoff);
      }
    }
  }, [page, banking.bankAccounts]);

  const coaAssetAccounts = useMemo(() => {
    return (db.accounts || []).filter(a => a.type === 'Assets' && a.active && !a.isGroup);
  }, [db.accounts]);

  const coaAllPostingAccounts = useMemo(() => {
    return (db.accounts || []).filter(a => a.active && !a.isGroup);
  }, [db.accounts]);

  // Handle Save Bank Account
  const handleSaveAccount = e => {
    e.preventDefault();
    try {
      const out = saveBankAccount(banking, db, accountForm);
      persist(out.banking, out.accounting);
      setAccountForm(null);
      setError('');
      notify(accountForm.id ? 'Bank account updated' : 'Bank account created and linked to General Ledger');
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle Transfer Money
  const handleTransfer = e => {
    e.preventDefault();
    try {
      const out = transferMoney(banking, db, transferModal);
      persist(out.banking, out.accounting);
      setTransferModal(null);
      setError('');
      notify('Bank transfer posted successfully');
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle Record Manual Transaction
  const handleRecordTx = e => {
    e.preventDefault();
    try {
      const out = recordManualTransaction(banking, db, recordTxModal);
      persist(out.banking, out.accounting);
      setRecordTxModal(null);
      setError('');
      notify('Transaction recorded and posted to General Ledger');
    } catch (err) {
      setError(err.message);
    }
  };

  // Open Journal details modal
  const viewJournal = voucherOrJournalId => {
    if (!voucherOrJournalId) return;
    const found = (db.journals || []).find(
      j => j.id === voucherOrJournalId || j.number === voucherOrJournalId || j.reference === voucherOrJournalId
    );
    if (found) {
      setJournalModal(found);
    } else {
      notify('Journal entry not found');
    }
  };

  // =========================================================================
  // SUB-VIEW: BANK RECONCILIATION
  // =========================================================================
  if (page === 'Bank Reconciliation') {
    const activeBank = banking.bankAccounts.find(row => row.id === txBankFilter) || banking.bankAccounts[0];
    return (
      <BankReconciliation
        banking={banking}
        db={db}
        active={activeBank}
        onSelectBank={id => setTxBankFilter(id)}
        persist={persist}
        notify={notify}
        setError={setError}
        onNavigate={onNavigate}
      />
    );
  }

  // =========================================================================
  // SUB-VIEW: BANKING SETTINGS
  // =========================================================================
  if (page === 'Banking Settings') {
    return <BankingSettings banking={banking} persist={persist} notify={notify} setError={setError} />;
  }

  // =========================================================================
  // SUB-VIEW: BANK TRANSFERS
  // =========================================================================
  if (page === 'Bank Transfers') {
    const transfers = allBankTransfers(banking, db);
    const visibleTransfers = transfers.filter(row => {
      const q = trfQuery.toLowerCase();
      const matchQ =
        !q ||
        [row.number, row.fromAccountName, row.toAccountName, row.reference, row.notes]
          .join(' ')
          .toLowerCase()
          .includes(q);
      const matchFrom = !trfFromFilter || row.fromAccountId === trfFromFilter;
      const matchTo = !trfToFilter || row.toAccountId === trfToFilter;
      return matchQ && matchFrom && matchTo;
    });

    const activeFilterCount = [trfFromFilter, trfToFilter].filter(Boolean).length;
    const clearTransferFilters = () => {
      setTrfFromFilter('');
      setTrfToFilter('');
      setTrfQuery('');
    };

    return (
      <section className="invoiceWorkspace purchaseWorkspace">
        <div className="ivHeading registerHead">
          <div className="registerHeadText">
            <h2>Bank Transfers</h2>
            <p>Move money between internal company bank accounts without Profit &amp; Loss impact.</p>
          </div>
          <div className="ivTools">
            <label className="ivToolSearch">
              <IconSearch size={17} />
              <input
                aria-label="Search bank transfers"
                placeholder="Search transfer number, reference, or accounts..."
                value={trfQuery}
                onChange={e => setTrfQuery(e.target.value)}
              />
            </label>
            <details className="soFiltersMore">
              <summary aria-label="Open filters">
                <IconFilter size={17} />
                Filters
                {activeFilterCount > 0 && <i>{activeFilterCount}</i>}
              </summary>
              <div className="soFiltersPanel">
                <label>
                  From Account
                  <select value={trfFromFilter} onChange={e => setTrfFromFilter(e.target.value)}>
                    <option value="">All source accounts</option>
                    {banking.bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.accountName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  To Account
                  <select value={trfToFilter} onChange={e => setTrfToFilter(e.target.value)}>
                    <option value="">All destination accounts</option>
                    {banking.bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.accountName}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="soClearFilters" onClick={clearTransferFilters}>
                  Clear filters
                </button>
              </div>
            </details>
          </div>
          <div className="ivActions">
            <button
              className="primary"
              onClick={() =>
                setTransferModal({
                  fromAccountId: banking.bankAccounts[0]?.id || '',
                  toAccountId: banking.bankAccounts[1]?.id || '',
                  date: today(),
                  amount: '',
                  reference: '',
                  notes: ''
                })
              }
              disabled={banking.bankAccounts.filter(a => a.status === 'Active').length < 2}
            >
              <IconPlus size={16} />
              Transfer Money
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="ivError" style={{ margin: '0 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <IconX size={16} />
            </button>
          </div>
        )}

        <div className="ivCard ivRegisterCard" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ivScroll">
            <table className="ivInvoiceTable">
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>Transfer # &amp; Date</th>
                  <th style={{ width: '28%' }}>Transfer Path</th>
                  <th style={{ width: '16%', textAlign: 'right' }}>Amount</th>
                  <th style={{ width: '24%' }}>Reference &amp; Notes</th>
                  <th style={{ width: '8%' }}>Status</th>
                  <th style={{ width: '6%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTransfers.map(row => (
                  <tr key={row.id}>
                    <td>
                      <strong style={{ color: '#1849a9', fontWeight: 650 }}>{row.number}</strong>
                      <small style={{ display: 'block', marginTop: '3px', color: '#64748b', fontSize: '12px' }}>{row.date}</small>
                    </td>
                    <td>
                      <span style={{ display: 'block', color: '#0f172a', fontWeight: 500, fontSize: '13px' }}>From: {row.fromAccountName}</span>
                      <small style={{ display: 'block', marginTop: '3px', color: '#64748b', fontSize: '12px' }}>To: {row.toAccountName}</small>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
                      {money(row.amount)}
                    </td>
                    <td>
                      <div style={{ color: '#0f172a', fontWeight: 400, fontSize: '13px' }}>{row.reference || '—'}</div>
                      {row.notes && <small style={{ display: 'block', marginTop: '3px', color: '#64748b', fontSize: '12px' }}>{row.notes}</small>}
                    </td>
                    <td>
                      <StatusPill status={row.status || 'Posted'} tone="ok" />
                    </td>
                    <td>
                      <div className="ivRowActions">
                        <button
                          type="button"
                          className="ivIconButton"
                          aria-label={'View journal for ' + (row.journalId || row.number)}
                          title="View Journal"
                          onClick={() => viewJournal(row.journalId || row.number)}
                        >
                          <IconEye size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleTransfers.length && (
              <EmptyState
                variant="adjustment"
                title="No bank transfers found"
                description={transfers.length ? 'Adjust search or filters to locate transfers.' : 'Move money between internal company bank accounts.'}
              />
            )}
          </div>
          <div className="ivActions purchaseRegisterFoot">
            <span>{visibleTransfers.length} of {transfers.length} transfers</span>
          </div>
        </div>

        {transferModal && (
          <TransferDialog
            data={transferModal}
            set={setTransferModal}
            accounts={banking.bankAccounts.filter(a => a.status === 'Active')}
            onSubmit={handleTransfer}
            onClose={() => setTransferModal(null)}
            error={error}
          />
        )}

        {journalModal && <JournalModal entry={journalModal} accounts={db.accounts} onClose={() => setJournalModal(null)} />}
      </section>
    );
  }

  // =========================================================================
  // SUB-VIEW: BANK TRANSACTIONS
  // =========================================================================
  if (page === 'Bank Transactions') {
    const transactions = allBankTransactions(db, banking, {
      bankAccountId: txBankFilter === 'all' ? undefined : txBankFilter
    });

    const visibleTx = transactions.filter(row => {
      const q = txQuery.toLowerCase();
      const matchQ =
        !q ||
        [row.description, row.voucher, row.reference, row.bankAccountName, row.type]
          .join(' ')
          .toLowerCase()
          .includes(q);
      const matchType = txTypeFilter === 'All types' || row.type === txTypeFilter;
      let matchDate = true;
      if (txDateFilter === 'This Month') {
        const prefix = today().slice(0, 7);
        matchDate = (row.date || '').startsWith(prefix);
      } else if (txDateFilter === 'Last Month') {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        const prefix = d.toISOString().slice(0, 7);
        matchDate = (row.date || '').startsWith(prefix);
      }
      return matchQ && matchType && matchDate;
    });

    const activeFilterCount = [txBankFilter !== 'all', txTypeFilter !== 'All types', txDateFilter !== 'All dates'].filter(Boolean).length;
    const clearTxFilters = () => {
      setTxBankFilter('all');
      setTxTypeFilter('All types');
      setTxDateFilter('All dates');
      setTxQuery('');
    };

    const totalInflow = visibleTx.reduce((s, r) => s + (r.moneyIn || 0), 0);
    const totalOutflow = visibleTx.reduce((s, r) => s + (r.moneyOut || 0), 0);
    const netFlow = totalInflow - totalOutflow;

    const txTypes = ['All types', 'Customer Receipt', 'Vendor Payment', 'Bank Transfer', 'Bank Charge', 'Interest Income', 'Manual Adjustment', 'Opening Balance'];

    return (
      <section className="invoiceWorkspace purchaseWorkspace">
        <div className="ivHeading registerHead">
          <div className="registerHeadText">
            <h2>Bank Transactions</h2>
            <p>Real-time General Ledger bank activity, running balances, and audit history.</p>
          </div>
          <div className="ivTools">
            <label className="ivToolSearch">
              <IconSearch size={17} />
              <input
                aria-label="Search bank transactions"
                placeholder="Search description, voucher, reference..."
                value={txQuery}
                onChange={e => setTxQuery(e.target.value)}
              />
            </label>
            <details className="soFiltersMore">
              <summary aria-label="Open filters">
                <IconFilter size={17} />
                Filters
                {activeFilterCount > 0 && <i>{activeFilterCount}</i>}
              </summary>
              <div className="soFiltersPanel">
                <label>
                  Bank Account
                  <select value={txBankFilter} onChange={e => setTxBankFilter(e.target.value)}>
                    <option value="all">All bank accounts</option>
                    {banking.bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.accountName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Transaction Type
                  <select value={txTypeFilter} onChange={e => setTxTypeFilter(e.target.value)}>
                    {txTypes.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Period
                  <select value={txDateFilter} onChange={e => setTxDateFilter(e.target.value)}>
                    <option value="All dates">All dates</option>
                    <option value="This Month">This Month</option>
                    <option value="Last Month">Last Month</option>
                  </select>
                </label>
                <button type="button" className="soClearFilters" onClick={clearTxFilters}>
                  Clear filters
                </button>
              </div>
            </details>
          </div>
          <div className="ivActions">
            <button
              className="ghost"
              onClick={() =>
                setTransferModal({
                  fromAccountId: banking.bankAccounts[0]?.id || '',
                  toAccountId: banking.bankAccounts[1]?.id || '',
                  date: today(),
                  amount: '',
                  reference: '',
                  notes: ''
                })
              }
              disabled={banking.bankAccounts.filter(a => a.status === 'Active').length < 2}
            >
              <IconArrowsExchange size={16} />
              Transfer Money
            </button>
            <button
              className="primary"
              onClick={() =>
                setRecordTxModal({
                  bankAccountId: txBankFilter !== 'all' ? txBankFilter : banking.bankAccounts[0]?.id || '',
                  date: today(),
                  type: 'Bank Charge',
                  amount: '',
                  counterAccount: '6100',
                  reference: '',
                  description: ''
                })
              }
            >
              <IconPlus size={16} />
              Record Transaction
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="ivError" style={{ margin: '0 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <IconX size={16} />
            </button>
          </div>
        )}

        <div className="ivDetailStats" style={{ marginBottom: '10px', background: '#fff', padding: '12px 18px', borderRadius: '10px', border: '1px solid #dfe6ef' }}>
          <span>
            <small>Total Inflow (Dr)</small>
            <strong style={{ color: '#16a34a' }}>{money(totalInflow)}</strong>
          </span>
          <span>
            <small>Total Outflow (Cr)</small>
            <strong style={{ color: '#ea580c' }}>{money(totalOutflow)}</strong>
          </span>
          <span>
            <small>Net Bank Movement</small>
            <strong style={{ color: netFlow >= 0 ? '#16a34a' : '#dc2626' }}>{money(netFlow)}</strong>
          </span>
          <span>
            <small>Transactions</small>
            <strong>{visibleTx.length} posted</strong>
          </span>
        </div>

        <div className="ivCard ivRegisterCard" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ivScroll">
            <table className="ivInvoiceTable">
              <thead>
                <tr>
                  <th style={{ width: '11%' }}>Date &amp; Type</th>
                  <th style={{ width: '13%' }}>Bank Account</th>
                  <th style={{ width: '32%' }}>Description &amp; Reference</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Amount (In / Out)</th>
                  <th style={{ width: '14%', textAlign: 'right' }}>Running Balance</th>
                  <th style={{ width: '10%' }}>Status</th>
                  <th style={{ width: '5%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTx.map(row => (
                  <tr key={row.id}>
                    <td>
                      <span style={{ display: 'block', color: '#0f172a', fontWeight: 500, fontSize: '13px' }}>{row.date}</span>
                      <small style={{ display: 'block', marginTop: '3px', color: '#64748b', fontSize: '12px' }}>{row.type}</small>
                    </td>
                    <td>
                      <span style={{ display: 'block', color: '#0f172a', fontWeight: 500, fontSize: '13px' }}>{row.bankAccountName}</span>
                      <small style={{ display: 'block', marginTop: '3px', color: '#64748b', fontSize: '12px' }}>{row.bankName}</small>
                    </td>
                    <td>
                      <div style={{ color: '#0f172a', fontWeight: 400, fontSize: '13px', lineHeight: '1.4' }}>{row.description}</div>
                      <small style={{ display: 'block', marginTop: '3px', color: '#64748b', fontSize: '12px' }}>
                        {row.reference ? `Ref: ${row.reference} · ` : ''}<code>{row.voucher}</code>
                      </small>
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong style={{ color: row.moneyIn ? '#16a34a' : '#ea580c', fontWeight: 650 }}>
                        {row.moneyIn ? `+${money(row.moneyIn)}` : `-${money(row.moneyOut)}`}
                      </strong>
                      <small style={{ display: 'block', marginTop: '3px', color: '#64748b', fontSize: '11px' }}>
                        {row.moneyIn ? 'Deposit (Dr)' : 'Withdrawal (Cr)'}
                      </small>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 650, fontVariantNumeric: 'tabular-nums', color: row.balance < 0 ? '#dc2626' : '#1e293b' }}>
                      {money(row.balance)}
                    </td>
                    <td>
                      <StatusPill status="Posted" tone="ok" />
                    </td>
                    <td>
                      <div className="ivRowActions">
                        <button
                          type="button"
                          className="ivIconButton"
                          aria-label={'View journal for ' + (row.journalId || row.voucher)}
                          title="View Journal"
                          onClick={() => viewJournal(row.journalId || row.voucher)}
                        >
                          <IconEye size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleTx.length && (
              <EmptyState
                variant="adjustment"
                title="No bank transactions found"
                description={transactions.length ? 'Adjust search or filters to view transactions.' : 'Posted bank entries from receipts, payments, and transfers appear here.'}
              />
            )}
          </div>
          <div className="ivActions purchaseRegisterFoot" style={{ padding: '12px 16px' }}>
            <span>{visibleTx.length} of {transactions.length} transactions</span>
          </div>
        </div>

        {transferModal && (
          <TransferDialog
            data={transferModal}
            set={setTransferModal}
            accounts={banking.bankAccounts.filter(a => a.status === 'Active')}
            onSubmit={handleTransfer}
            onClose={() => setTransferModal(null)}
            error={error}
          />
        )}

        {recordTxModal && (
          <RecordTransactionDialog
            data={recordTxModal}
            set={setRecordTxModal}
            accounts={banking.bankAccounts.filter(a => a.status === 'Active')}
            coaAccounts={coaAllPostingAccounts}
            onSubmit={handleRecordTx}
            onClose={() => setRecordTxModal(null)}
            error={error}
          />
        )}

        {journalModal && <JournalModal entry={journalModal} accounts={db.accounts} onClose={() => setJournalModal(null)} />}
      </section>
    );
  }

  // =========================================================================
  // SUB-VIEW: BANK ACCOUNTS - CREATE / EDIT FORM
  // =========================================================================
  if (accountForm) {
    const isEdit = !!accountForm.id;
    return (
      <section className="itemsPage vendorsPage">
        <form className="itemCreatePage" onSubmit={handleSaveAccount} noValidate>
          <div className="itemDialogHead">
            <button type="button" className="itemBack" aria-label="Back to Bank Accounts" onClick={() => setAccountForm(null)}>
              <IconArrowLeft size={19} />
            </button>
            <div className="itemHeadText">
              <h2>{isEdit ? 'Edit Bank Account' : 'Create Bank Account'}</h2>
              <small className="itemHeadHint">
                {isEdit ? `Editing ${accountForm.accountName}` : 'Add a new company bank account linked to the General Ledger'}
              </small>
            </div>
          </div>

          <div className="itemDialogBody">
            <section className="itemSection">
              <div className="itemSectionTitle">Account details</div>
              <div className="itemFormGrid">
                <label>
                  Bank name *
                  <input
                    required
                    placeholder="e.g. HDFC Bank, ICICI Bank"
                    value={accountForm.bankName}
                    onChange={e => setAccountForm({ ...accountForm, bankName: e.target.value })}
                  />
                </label>
                <label>
                  Account name *
                  <input
                    required
                    placeholder="e.g. HDFC Main Operating Account"
                    value={accountForm.accountName}
                    onChange={e => setAccountForm({ ...accountForm, accountName: e.target.value })}
                  />
                </label>
                <label>
                  Account number *
                  <input
                    required
                    placeholder="e.g. 50200012345678"
                    value={accountForm.accountNumber}
                    onChange={e => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                  />
                </label>
                <label>
                  Account type *
                  <select
                    value={accountForm.accountType}
                    onChange={e => setAccountForm({ ...accountForm, accountType: e.target.value })}
                  >
                    {ACCOUNT_TYPES.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Branch *
                  <select
                    value={accountForm.branch}
                    onChange={e => setAccountForm({ ...accountForm, branch: e.target.value })}
                  >
                    {BRANCHES.map(b => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Organisation *
                  <select
                    value={accountForm.organisation}
                    onChange={e => setAccountForm({ ...accountForm, organisation: e.target.value })}
                  >
                    {ORGANISATIONS.map(o => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  IFSC code
                  <input
                    placeholder="e.g. HDFC0000123"
                    value={accountForm.ifsc}
                    onChange={e => setAccountForm({ ...accountForm, ifsc: e.target.value.toUpperCase() })}
                  />
                </label>
                <label>
                  Currency *
                  <select
                    value={accountForm.currency}
                    onChange={e => setAccountForm({ ...accountForm, currency: e.target.value })}
                  >
                    {CURRENCIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status *
                  <select
                    value={accountForm.status}
                    onChange={e => setAccountForm({ ...accountForm, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="itemSection">
              <div className="itemSectionTitle">Chart of Accounts connection</div>
              <div className="itemFormGrid">
                <label className="itemFieldWide">
                  Linked General Ledger account
                  <select
                    value={accountForm.accountCode}
                    onChange={e => setAccountForm({ ...accountForm, accountCode: e.target.value })}
                  >
                    <option value="">Auto-create and link a new Bank account ledger</option>
                    {coaAssetAccounts.map(a => (
                      <option key={a.code} value={a.code}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                  <small className="itemHint">
                    The linked Assets ledger in the Chart of Accounts is the single source of truth for the book balance.
                  </small>
                </label>
              </div>
            </section>

            {!isEdit && (
              <section className="itemSection">
                <div className="itemSectionTitle">Opening balance</div>
                <div className="itemFormGrid">
                  <label>
                    Opening balance (₹)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={accountForm.openingBalance}
                      onChange={e => setAccountForm({ ...accountForm, openingBalance: e.target.value })}
                    />
                    <small className="itemHint">Leave empty or 0 if starting fresh.</small>
                  </label>
                  <label>
                    Opening balance date
                    <input
                      type="date"
                      value={accountForm.openingBalanceDate}
                      onChange={e => setAccountForm({ ...accountForm, openingBalanceDate: e.target.value })}
                    />
                  </label>
                </div>
                <p className="itemNotice" style={{ marginTop: '12px' }}>
                  <IconInfoCircle size={16} />
                  Entering an opening balance will automatically post a balanced double-entry journal entry to the General Ledger (Debit Bank Account, Credit 3000 Opening Balance Equity).
                </p>
              </section>
            )}

            {error && <p className="itemError itemSaveError" role="alert">{error}</p>}
          </div>

          <footer className="itemDialogFooter">
            <button type="button" onClick={() => setAccountForm(null)}>
              Cancel
            </button>
            <button type="submit" className="primary">
              {isEdit ? 'Save Changes' : 'Create Bank Account'}
            </button>
          </footer>
        </form>
      </section>
    );
  }

  // =========================================================================
  // SUB-VIEW: BANK ACCOUNTS - DETAIL VIEW
  // =========================================================================
  if (selectedAccount) {
    const balance = bookBalance(db, selectedAccount.accountCode);
    const summary = reconciliationSummary(banking, db, selectedAccount.id, { to: today() });
    const lastRecon = [...banking.reconciliations]
      .filter(x => x.bankAccountId === selectedAccount.id)
      .sort((a, b) => String(b.statementClosingDate || b.periodTo).localeCompare(String(a.statementClosingDate || a.periodTo)))[0];

    const accountTransactions = allBankTransactions(db, banking, { bankAccountId: selectedAccount.id });
    const accountReconciliations = banking.reconciliations
      .filter(x => x.bankAccountId === selectedAccount.id)
      .sort((a, b) => String(b.periodTo).localeCompare(String(a.periodTo)));

    return (
      <section className="invoiceWorkspace purchaseWorkspace ivDetailOpen">
        <div className="ivDetailHead">
          <button
            type="button"
            className="ivDetailBack"
            aria-label="Back to Bank Accounts"
            onClick={() => setSelectedAccount(null)}
          >
            <IconArrowLeft size={19} />
          </button>
          <div className="ivDetailHeadText">
            <h2>{selectedAccount.accountName}</h2>
            <small>
              {selectedAccount.bankName} · {mask(selectedAccount.accountNumber)} · {selectedAccount.branch}
            </small>
          </div>
        </div>

        <div className="ivDetailBody">
          <section className="ivDetailSheet">
            <div className="ivDetailIdentityRow">
              <div className="ivDetailIdentity">
                <div className="ivDetailNumber">
                  <h3>{selectedAccount.accountName}</h3>
                  <StatusPill status={selectedAccount.status} tone={selectedAccount.status === 'Active' ? 'ok' : 'neutral'} />
                </div>
                <p>
                  {selectedAccount.bankName} · {selectedAccount.accountType} · {selectedAccount.currency}
                </p>
              </div>
              <div className="ivDocumentActions">
                <button
                  type="button"
                  onClick={() => {
                    setAccountForm({ ...selectedAccount });
                    setSelectedAccount(null);
                  }}
                >
                  <IconEdit size={16} />
                  Edit account
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTransferModal({
                      fromAccountId: selectedAccount.id,
                      toAccountId: '',
                      date: today(),
                      amount: '',
                      reference: '',
                      notes: ''
                    })
                  }
                  disabled={banking.bankAccounts.filter(a => a.status === 'Active').length < 2}
                >
                  <IconArrowsExchange size={16} />
                  Transfer
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRecordTxModal({
                      bankAccountId: selectedAccount.id,
                      date: today(),
                      type: 'Bank Charge',
                      amount: '',
                      counterAccount: '6100',
                      reference: '',
                      description: ''
                    })
                  }
                >
                  <IconPlus size={16} />
                  Record entry
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    sessionStorage.setItem('wayvida-open-bank', selectedAccount.id);
                    onNavigate('Bank Reconciliation');
                  }}
                >
                  <IconCheck size={16} />
                  Reconcile
                </button>
              </div>
            </div>

            <div className="ivDetailStats">
              <span>
                <small>Book Balance</small>
                <strong>{money(balance)}</strong>
              </span>
              <span>
                <small>Account Type</small>
                <strong>{selectedAccount.accountType}</strong>
              </span>
              <span>
                <small>GL Ledger</small>
                <strong>{selectedAccount.accountCode}</strong>
              </span>
              <span>
                <small>Branch</small>
                <strong>{selectedAccount.branch}</strong>
              </span>
              <span>
                <small>Organisation</small>
                <strong>{selectedAccount.organisation}</strong>
              </span>
              <span>
                <small>Last Reconciled</small>
                <strong>{lastRecon?.statementClosingDate || lastRecon?.periodTo || 'Not reconciled'}</strong>
              </span>
            </div>

            <nav className="itemDetailTabs ivDetailTabs" aria-label="Account details tabs">
              {['Overview', 'Transactions', 'Reconciliations'].map(t => (
                <button
                  key={t}
                  type="button"
                  className={accountTab === t ? 'active' : ''}
                  onClick={() => setAccountTab(t)}
                >
                  {t}
                </button>
              ))}
            </nav>

            {accountTab === 'Overview' && (
              <div className="ivOverviewPage">
                <div className="ivOverviewGrid">
                  <section className="itemDetailCard">
                    <div className="itemDetailSectionTitle">
                      <IconBuildingBank size={18} />
                      <h2>Account information</h2>
                    </div>
                    <dl className="itemDetailFacts">
                      {[
                        ['Bank name', selectedAccount.bankName],
                        ['Account name', selectedAccount.accountName],
                        ['Account number', mask(selectedAccount.accountNumber)],
                        ['Account type', selectedAccount.accountType],
                        ['IFSC code', selectedAccount.ifsc || 'Not recorded'],
                        ['Currency', selectedAccount.currency],
                        ['Branch', selectedAccount.branch],
                        ['Organisation', selectedAccount.organisation],
                        ['Status', selectedAccount.status]
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  <section className="itemDetailCard">
                    <div className="itemDetailSectionTitle">
                      <IconReceipt size={18} />
                      <h2>Accounting &amp; Ledger</h2>
                    </div>
                    <dl className="itemDetailFacts">
                      {[
                        ['Book balance', money(balance)],
                        ['General Ledger account', `${selectedAccount.accountCode} · ${selectedAccount.accountName}`],
                        ['Opening balance', money(selectedAccount.openingBalance || 0)],
                        ['Opening balance date', selectedAccount.openingBalanceDate || 'Not recorded'],
                        ['Created date', selectedAccount.createdAt ? new Date(selectedAccount.createdAt).toLocaleDateString('en-IN') : 'Initial setup']
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="ivMutedNote" style={{ marginTop: '16px' }}>
                      All debits and credits post directly to General Ledger code {selectedAccount.accountCode}.
                    </p>
                  </section>
                </div>
              </div>
            )}

            {accountTab === 'Transactions' && (
              <div className="purchaseTabBody">
                <div className="ivScroll">
                  <table className="ivInvoiceTable">
                    <thead>
                      <tr>
                        <th>Date &amp; Type</th>
                        <th>Description &amp; Reference</th>
                        <th style={{ textAlign: 'right' }}>Amount (In / Out)</th>
                        <th style={{ textAlign: 'right' }}>Running Balance</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountTransactions.map(row => (
                        <tr key={row.id}>
                          <td>
                            <strong style={{ display: 'block', color: '#0f172a', fontWeight: 600 }}>{row.date}</strong>
                            <small style={{ display: 'block', marginTop: '3px', color: '#64748b', fontSize: '12px' }}>{row.type}</small>
                          </td>
                          <td>
                            <div><strong>{row.description}</strong></div>
                            <small style={{ display: 'block', marginTop: '3px', color: '#64748b' }}>
                              {row.reference ? `Ref: ${row.reference} · ` : ''}<code>{row.voucher}</code>
                            </small>
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <strong style={{ color: row.moneyIn ? '#16a34a' : '#ea580c', fontWeight: 650 }}>
                              {row.moneyIn ? `+${money(row.moneyIn)}` : `-${money(row.moneyOut)}`}
                            </strong>
                            <small style={{ display: 'block', marginTop: '3px', color: '#64748b', fontSize: '11px' }}>
                              {row.moneyIn ? 'Deposit (Dr)' : 'Withdrawal (Cr)'}
                            </small>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 650, fontVariantNumeric: 'tabular-nums', color: row.balance < 0 ? '#dc2626' : '#1e293b' }}>
                            {money(row.balance)}
                          </td>
                          <td>
                            <StatusPill status="Posted" tone="ok" />
                          </td>
                          <td>
                            <div className="ivRowActions">
                              <button
                                type="button"
                                className="ivIconButton"
                                aria-label={'View journal for ' + (row.journalId || row.voucher)}
                                title="View Journal"
                                onClick={() => viewJournal(row.journalId || row.voucher)}
                              >
                                <IconEye size={17} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!accountTransactions.length && (
                    <EmptyState
                      variant="adjustment"
                      title="No transactions for this account"
                      description="Posted transactions from customer receipts, vendor payments, or transfers will appear here."
                    />
                  )}
                </div>
              </div>
            )}

            {accountTab === 'Reconciliations' && (
              <div className="purchaseTabBody">
                <div className="ivScroll">
                  <table className="ivInvoiceTable">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th style={{ textAlign: 'right' }}>Statement Balance</th>
                        <th style={{ textAlign: 'right' }}>Book Balance</th>
                        <th style={{ textAlign: 'right' }}>Difference</th>
                        <th>Status</th>
                        <th>Reconciled By</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountReconciliations.map(recon => (
                        <tr key={recon.id}>
                          <td>
                            <strong>{recon.periodFrom} – {recon.periodTo}</strong>
                            <small>{recon.financialYear || 'FY 2026–27'}</small>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {recon.statementClosingBalance != null ? money(recon.statementClosingBalance) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {recon.bookBalance != null ? money(recon.bookBalance) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', color: recon.difference ? '#ea580c' : '#16a34a', fontWeight: 600 }}>
                            {recon.difference != null ? money(recon.difference) : '—'}
                          </td>
                          <td>
                            <StatusPill status={recon.status} tone={recon.status === 'Completed' || recon.status === 'Locked' ? 'ok' : 'info'} />
                          </td>
                          <td>
                            {recon.completedBy || recon.reconciledBy || '—'}
                            <small>{recon.completedAt ? new Date(recon.completedAt).toLocaleDateString('en-IN') : ''}</small>
                          </td>
                          <td>
                            <div className="ivRowActions">
                              <button
                                type="button"
                                onClick={() => {
                                  sessionStorage.setItem('wayvida-open-bank', selectedAccount.id);
                                  onNavigate('Bank Reconciliation');
                                }}
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!accountReconciliations.length && (
                    <EmptyState
                      variant="adjustment"
                      title="No completed reconciliations"
                      description="Start a reconciliation to verify ledger transactions against bank statements."
                    />
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {transferModal && (
          <TransferDialog
            data={transferModal}
            set={setTransferModal}
            accounts={banking.bankAccounts.filter(a => a.status === 'Active')}
            onSubmit={handleTransfer}
            onClose={() => setTransferModal(null)}
            error={error}
          />
        )}

        {recordTxModal && (
          <RecordTransactionDialog
            data={recordTxModal}
            set={setRecordTxModal}
            accounts={banking.bankAccounts.filter(a => a.status === 'Active')}
            coaAccounts={coaAllPostingAccounts}
            onSubmit={handleRecordTx}
            onClose={() => setRecordTxModal(null)}
            error={error}
          />
        )}

        {journalModal && <JournalModal entry={journalModal} accounts={db.accounts} onClose={() => setJournalModal(null)} />}
      </section>
    );
  }

  // =========================================================================
  // SUB-VIEW: BANK ACCOUNTS - REGISTER LIST
  // =========================================================================
  const bankAccounts = banking.bankAccounts || [];
  const visibleAccounts = bankAccounts.filter(row => {
    const q = accountQuery.toLowerCase();
    const matchQ =
      !q ||
      [row.bankName, row.accountName, row.accountNumber, row.ifsc, row.branch, row.organisation]
        .join(' ')
        .toLowerCase()
        .includes(q);
    const matchStatus = accountStatusFilter === 'All statuses' || row.status === accountStatusFilter;
    const matchType = !accountTypeFilter || row.accountType === accountTypeFilter;
    const matchBranch = !accountBranchFilter || row.branch === accountBranchFilter;
    const matchOrg = !accountOrgFilter || row.organisation === accountOrgFilter;
    return matchQ && matchStatus && matchType && matchBranch && matchOrg;
  });

  const activeAccountFilterCount = [
    accountStatusFilter !== 'All statuses',
    accountTypeFilter,
    accountBranchFilter,
    accountOrgFilter
  ].filter(Boolean).length;

  const clearAccountFilters = () => {
    setAccountStatusFilter('All statuses');
    setAccountTypeFilter('');
    setAccountBranchFilter('');
    setAccountOrgFilter('');
    setAccountQuery('');
  };

  const totalBankBalance = bankAccounts.reduce((sum, b) => {
    return b.status === 'Active' ? sum + bookBalance(db, b.accountCode) : sum;
  }, 0);

  const activeAccountsCount = bankAccounts.filter(b => b.status === 'Active').length;

  return (
    <section className="invoiceWorkspace purchaseWorkspace">
      <div className="ivHeading registerHead">
        <div className="registerHeadText">
          <h2>Bank Accounts</h2>
          <p>Company bank accounts linked directly to Chart of Accounts ledgers and live balances.</p>
        </div>
        <div className="ivTools">
          <label className="ivToolSearch">
            <IconSearch size={17} />
            <input
              aria-label="Search bank accounts"
              placeholder="Search bank name, account number, IFSC..."
              value={accountQuery}
              onChange={e => setAccountQuery(e.target.value)}
            />
          </label>
          <details className="soFiltersMore">
            <summary aria-label="Open filters">
              <IconFilter size={17} />
              Filters
              {activeAccountFilterCount > 0 && <i>{activeAccountFilterCount}</i>}
            </summary>
            <div className="soFiltersPanel">
              <label>
                Status
                <select value={accountStatusFilter} onChange={e => setAccountStatusFilter(e.target.value)}>
                  <option value="All statuses">All statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
              <label>
                Account Type
                <select value={accountTypeFilter} onChange={e => setAccountTypeFilter(e.target.value)}>
                  <option value="">All account types</option>
                  {ACCOUNT_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Branch
                <select value={accountBranchFilter} onChange={e => setAccountBranchFilter(e.target.value)}>
                  <option value="">All branches</option>
                  {BRANCHES.map(b => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Organisation
                <select value={accountOrgFilter} onChange={e => setAccountOrgFilter(e.target.value)}>
                  <option value="">All organisations</option>
                  {ORGANISATIONS.map(o => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="soClearFilters" onClick={clearAccountFilters}>
                Clear filters
              </button>
            </div>
          </details>
        </div>
        <div className="ivActions">
          <button className="primary" onClick={() => setAccountForm(blankAccount())}>
            <IconPlus size={16} />
            Create Bank Account
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="ivError" style={{ margin: '0 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <IconX size={16} />
          </button>
        </div>
      )}

      <div className="ivDetailStats" style={{ marginBottom: '10px', background: '#fff', padding: '12px 18px', borderRadius: '10px', border: '1px solid #dfe6ef' }}>
        <span>
          <small>Total Book Balance</small>
          <strong style={{ color: '#16a34a' }}>{money(totalBankBalance)}</strong>
        </span>
        <span>
          <small>Active Bank Accounts</small>
          <strong>{activeAccountsCount} accounts</strong>
        </span>
        <span>
          <small>Reporting Currency</small>
          <strong>INR (₹)</strong>
        </span>
        <span>
          <small>Accounting Source</small>
          <strong>General Ledger</strong>
        </span>
      </div>

      <div className="ivCard ivRegisterCard" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="ivScroll">
          <table className="ivInvoiceTable">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Bank &amp; Account</th>
                <th style={{ width: '26%' }}>Type &amp; Ledger Account</th>
                <th style={{ width: '18%', textAlign: 'right' }}>Book Balance</th>
                <th style={{ width: '22%' }}>Status &amp; Reconciliation</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleAccounts.map(row => {
                const bal = bookBalance(db, row.accountCode);
                const last = [...banking.reconciliations]
                  .filter(x => x.bankAccountId === row.id)
                  .sort((a, b) => String(b.statementClosingDate || b.periodTo).localeCompare(String(a.statementClosingDate || a.periodTo)))[0];
                const ledgerName = db.accounts.find(a => a.code === row.accountCode)?.name || 'Bank Ledger';

                return (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="ivLink"
                        style={{ fontWeight: 600 }}
                        onClick={() => {
                          setSelectedAccount(row);
                          setAccountTab('Overview');
                        }}
                      >
                        {row.accountName}
                      </button>
                      <small>
                        {row.bankName} · {mask(row.accountNumber)}
                      </small>
                    </td>
                    <td>
                      <span style={{ display: 'block', color: '#0f172a', fontWeight: 500, fontSize: '13px' }}>{row.accountType} · {row.branch}</span>
                      <small><code>{row.accountCode}</code> · {ledgerName}</small>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {money(bal)}
                    </td>
                    <td>
                      <StatusPill status={row.status} tone={row.status === 'Active' ? 'ok' : 'neutral'} />
                      <small style={{ display: 'block', marginTop: '3px' }}>
                        Reconciled: {last?.statementClosingDate || last?.periodTo || 'Never'}
                      </small>
                    </td>
                    <td>
                      <div className="ivRowActions">
                        <button
                          type="button"
                          className="ivIconButton"
                          aria-label={'View ' + row.accountName}
                          title={'View ' + row.accountName}
                          onClick={() => {
                            setSelectedAccount(row);
                            setAccountTab('Overview');
                          }}
                        >
                          <IconEye size={17} />
                        </button>
                        <BankAccountRowActions
                          account={row}
                          onEdit={() => setAccountForm({ ...row })}
                          onTransactions={() => {
                            sessionStorage.setItem('wayvida-open-bank', row.id);
                            onNavigate('Bank Transactions');
                          }}
                          onReconcile={() => {
                            sessionStorage.setItem('wayvida-open-bank', row.id);
                            onNavigate('Bank Reconciliation');
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleAccounts.length && (
            <EmptyState
              variant="adjustment"
              title="No bank accounts found"
              description={bankAccounts.length ? 'Adjust search or filters to locate bank accounts.' : 'Add your first company bank account to begin tracking cash flow.'}
            />
          )}
        </div>
        <div className="ivActions purchaseRegisterFoot">
          <span>{visibleAccounts.length} of {bankAccounts.length} bank accounts</span>
        </div>
      </div>

      {transferModal && (
        <TransferDialog
          data={transferModal}
          set={setTransferModal}
          accounts={banking.bankAccounts.filter(a => a.status === 'Active')}
          onSubmit={handleTransfer}
          onClose={() => setTransferModal(null)}
          error={error}
        />
      )}

      {journalModal && <JournalModal entry={journalModal} accounts={db.accounts} onClose={() => setJournalModal(null)} />}
    </section>
  );
}

// =========================================================================
// MODALS & DIALOGS
// =========================================================================

function TransferDialog({ data, set, accounts, onSubmit, onClose, error }) {
  return (
    <div className="bankOverlay" role="presentation">
      <form
        className="bankDialog small"
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bank-transfer-title"
      >
        <header>
          <div>
            <span>Internal Transfer</span>
            <h2 id="bank-transfer-title">Transfer Money</h2>
            <p>Move money between internal company bank accounts without Profit &amp; Loss impact.</p>
          </div>
          <button className="bankClose" type="button" aria-label="Close transfer form" onClick={onClose}>
            <IconX />
          </button>
        </header>

        <div className="bankDialogBody">
          <div className="bankFormGrid">
            <label>
              <span>From Account *</span>
              <select
                required
                value={data.fromAccountId}
                onChange={e => set({ ...data, fromAccountId: e.target.value })}
              >
                <option value="">Select source account</option>
                {accounts.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.accountName} ({x.bankName})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>To Account *</span>
              <select
                required
                value={data.toAccountId}
                onChange={e => set({ ...data, toAccountId: e.target.value })}
              >
                <option value="">Select destination account</option>
                {accounts.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.accountName} ({x.bankName})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Transfer Date *</span>
              <input
                required
                type="date"
                value={data.date}
                onChange={e => set({ ...data, date: e.target.value })}
              />
            </label>

            <label>
              <span>Amount (₹) *</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={data.amount}
                onChange={e => set({ ...data, amount: e.target.value })}
              />
            </label>

            <label>
              <span>Reference / UTR</span>
              <input
                placeholder="e.g. UTR-98234123"
                value={data.reference}
                onChange={e => set({ ...data, reference: e.target.value })}
              />
            </label>

            <label>
              <span>Notes</span>
              <input
                placeholder="e.g. Funding operating expenses"
                value={data.notes}
                onChange={e => set({ ...data, notes: e.target.value })}
              />
            </label>
          </div>

          <p className="itemNotice" style={{ marginTop: '16px' }}>
            <IconInfoCircle size={16} />
            Internal transfers only move money between balance sheet asset accounts. No Revenue, Expense, or GST accounts are altered.
          </p>

          {error && <p className="bankFormError" role="alert">{error}</p>}
        </div>

        <footer>
          <button className="bankSecondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            <IconCheck size={16} />
            Post Transfer
          </button>
        </footer>
      </form>
    </div>
  );
}

function RecordTransactionDialog({ data, set, accounts, coaAccounts, onSubmit, onClose, error }) {
  const types = [
    { value: 'Bank Charge', label: 'Bank Charge (Expense)' },
    { value: 'Interest', label: 'Interest Income (Revenue)' },
    { value: 'Deposit', label: 'Deposit (Manual Inflow)' },
    { value: 'Withdrawal', label: 'Withdrawal (Manual Outflow)' },
    { value: 'Adjustment', label: 'Bank Adjustment' }
  ];

  return (
    <div className="bankOverlay" role="presentation">
      <form
        className="bankDialog"
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-tx-title"
      >
        <header>
          <div>
            <span>Manual Entry</span>
            <h2 id="record-tx-title">Record Bank Transaction</h2>
            <p>Post a direct bank charge, interest, or manual transaction to the General Ledger.</p>
          </div>
          <button className="bankClose" type="button" aria-label="Close transaction form" onClick={onClose}>
            <IconX />
          </button>
        </header>

        <div className="bankDialogBody">
          <div className="bankFormGrid">
            <label>
              <span>Bank Account *</span>
              <select
                required
                value={data.bankAccountId}
                onChange={e => set({ ...data, bankAccountId: e.target.value })}
              >
                <option value="">Select bank account</option>
                {accounts.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.accountName} ({x.bankName})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Transaction Type *</span>
              <select
                required
                value={data.type}
                onChange={e => {
                  const val = e.target.value;
                  let defaultCounter = data.counterAccount;
                  if (val === 'Bank Charge') defaultCounter = '6100';
                  if (val === 'Interest') defaultCounter = '4200';
                  set({ ...data, type: val, counterAccount: defaultCounter });
                }}
              >
                {types.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Transaction Date *</span>
              <input
                required
                type="date"
                value={data.date}
                onChange={e => set({ ...data, date: e.target.value })}
              />
            </label>

            <label>
              <span>Amount (₹) *</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={data.amount}
                onChange={e => set({ ...data, amount: e.target.value })}
              />
            </label>

            <label className="itemFieldWide">
              <span>Counter Account (Chart of Accounts) *</span>
              <select
                required
                value={data.counterAccount}
                onChange={e => set({ ...data, counterAccount: e.target.value })}
              >
                <option value="">Select offsetting account</option>
                {coaAccounts.map(a => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Reference Number</span>
              <input
                placeholder="e.g. CHG-2026-0881"
                value={data.reference}
                onChange={e => set({ ...data, reference: e.target.value })}
              />
            </label>

            <label className="itemFieldWide">
              <span>Description / Narration *</span>
              <input
                required
                placeholder="e.g. Monthly bank ledger maintenance charges"
                value={data.description}
                onChange={e => set({ ...data, description: e.target.value })}
              />
            </label>
          </div>

          <p className="itemNotice" style={{ marginTop: '16px' }}>
            <IconInfoCircle size={16} />
            This action creates a balanced double-entry journal entry in the General Ledger. Debit and Credit amounts will stay equal.
          </p>

          {error && <p className="bankFormError" role="alert">{error}</p>}
        </div>

        <footer>
          <button className="bankSecondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            <IconCheck size={16} />
            Post Transaction
          </button>
        </footer>
      </form>
    </div>
  );
}

function JournalModal({ entry, accounts = [], onClose }) {
  if (!entry) return null;
  const lines = entry.lines || [];
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

  const getAccountName = code => {
    const found = accounts.find(a => a.code === code);
    return found ? `${code} · ${found.name}` : code;
  };

  return (
    <div className="bankOverlay" role="presentation">
      <div className="bankDialog" role="dialog" aria-modal="true" style={{ maxWidth: '640px' }}>
        <header>
          <div>
            <span>General Ledger Journal Entry</span>
            <h2>{entry.number || entry.id}</h2>
            <p>
              Posted on {entry.date} · Source: {entry.source}
            </p>
          </div>
          <button className="bankClose" type="button" onClick={onClose}>
            <IconX />
          </button>
        </header>

        <div className="bankDialogBody">
          <div className="ivScroll">
            <table className="ivInvoiceTable">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Debit (₹)</th>
                  <th style={{ textAlign: 'right' }}>Credit (₹)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{getAccountName(line.account)}</strong>
                    </td>
                    <td>{line.description || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: line.debit ? 600 : 400 }}>
                      {line.debit ? money(line.debit) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: line.credit ? 600 : 400 }}>
                      {line.credit ? money(line.credit) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td colSpan={2}>Total</td>
                  <td style={{ textAlign: 'right', color: '#16a34a' }}>{money(totalDebit)}</td>
                  <td style={{ textAlign: 'right', color: '#16a34a' }}>{money(totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ marginTop: '14px', fontSize: '12px', color: '#64748b' }}>
            Reference: {entry.reference || 'None'} · Journal ID: {entry.id}
          </div>
        </div>

        <footer>
          <button className="primary" type="button" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
