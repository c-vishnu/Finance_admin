import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  IconAdjustments, IconAlertTriangle, IconChevronDown, IconDownload, IconEye,
  IconFileSpreadsheet, IconFileTypePdf, IconFilter, IconPlus, IconRefresh,
  IconSearch, IconUpload, IconCircleCheck, IconX, IconCashBanknote, IconDotsVertical
} from '@tabler/icons-react';
import { readAccounts } from './account-store.js';
import { money } from './invoice-engine.js';
import { ALL, DASH, DEFAULT_SORT, POSTED, SORT_OPTIONS, incomeExportSheet, incomeReport, sortTransactions } from './business-reports.js';
import { downloadReport, excelReport } from './daybook-export.js';
import { getAccessibleOrganizations, getCurrentOrganizationContext } from './organisation-context.js';
import { accountingState, createIncome, markIncomeAsReceived, reverseIncome, readOperations, saveOperations, DEFAULT_INCOME_CATEGORIES } from './operations-store.js';
import { tableExport } from './tax-compliance.js';
import CreateIncomePage from './CreateIncomePage.jsx';
import EmptyState from './EmptyState.jsx';
import OutstandingActions from './OutstandingActions.jsx';
import StatusPill from './StatusPill.jsx';
import './journal-entries.css';
import './business-reports.css';

const dateText = value => value ? new Date(value + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : DASH;

const STATUS_TONES = { Draft: 'neutral', Unpaid: 'warn', Pending: 'warn', Received: 'ok', Posted: 'ok' };

const blankFilters = () => ({ from: '', to: '', party: ALL, status: ALL, branch: ALL, account: ALL, category: ALL, payment: ALL });

export default function IncomeReport({ page = 'Income', onNavigate = () => {} }) {
  const [revision, setRevision] = useState(0);
  const [filters, setFilters] = useState(blankFilters);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [perPage, setPerPage] = useState(25);
  const [pageIndex, setPage] = useState(1);
  const [stamp, setStamp] = useState(() => new Date());
  const [mode, setMode] = useState(page === 'Record Income' ? 'create' : 'list'); // 'list' | 'create' | 'categories'
  const [activeDrawerIncome, setActiveDrawerIncome] = useState(null);
  const [markPaidModal, setMarkPaidModal] = useState(null);
  const [paidDetails, setPaidDetails] = useState({ paidThrough: '1010', method: 'Bank transfer', reference: '' });

  const deferredSearch = useDeferredValue(search);
  const busy = deferredSearch !== search;
  const organisation = getCurrentOrganizationContext().company;
  const branches = useMemo(() => getAccessibleOrganizations().find(item => item.id === organisation.id)?.branches || [], [organisation.id]);

  const refresh = () => setRevision(value => value + 1);
  useEffect(() => {
    window.addEventListener('wayvida-accounts-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('wayvida-accounts-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const { book, operations, error } = useMemo(() => {
    try {
      return { book: readAccounts(), operations: readOperations(), error: '' };
    } catch (reason) {
      return { book: null, operations: { incomes: [] }, error: reason.message };
    }
  }, [revision]);

  const report = useMemo(() => {
    try {
      return incomeReport(book || {}, operations || {}, { ...filters, search: deferredSearch, branches, organisation: organisation.id, organisationCode: organisation.code });
    } catch {
      return incomeReport({}, { incomes: [] }, { ...filters, search: deferredSearch, branches, organisation: organisation.id, organisationCode: organisation.code });
    }
  }, [book, operations, filters, deferredSearch, branches, organisation.id, organisation.code]);

  const ordered = useMemo(() => sortTransactions(report.rows, sort), [report.rows, sort]);
  const pageCount = Math.max(1, Math.ceil(ordered.length / perPage));
  const currentPage = Math.min(pageIndex, pageCount);
  const startIndex = (currentPage - 1) * perPage;
  const firstRow = ordered.length ? startIndex + 1 : 0;
  const lastRow = Math.min(startIndex + perPage, ordered.length);

  useEffect(() => { setPage(1); }, [deferredSearch, filters, sort, perPage]);

  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }));
  const clear = () => { setFilters(blankFilters()); setSearch(''); setSort(DEFAULT_SORT); setPage(1); };
  const sortLabel = (SORT_OPTIONS.find(option => option.value === sort) || {}).label || 'Newest first';
  const activeFilters = ['from', 'to'].filter(key => filters[key]).length + ['party', 'account', 'category', 'payment'].filter(key => filters[key] !== ALL).length + (filters.status !== ALL ? 1 : 0) + (filters.branch !== ALL ? 1 : 0) + (sort !== DEFAULT_SORT ? 1 : 0);

  function exportExcel() {
    const sheet = incomeExportSheet(report);
    const content = excelReport(tableExport(sheet.header, sheet.rows, {
      title: 'Wayvida Books · Income Report', subtitle: 'View and manage business income records.',
      organisation: organisation.name, branch: filters.branch, from: filters.from, to: filters.to,
      filters: { 'Income Status': filters.status, Category: filters.category, 'Received From': filters.party, Branch: filters.branch, Search: search },
      count: report.rows.length, generatedBy: 'Local user', generatedAt: stamp.toISOString()
    }));
    downloadReport(content, 'wayvida-income-report.xml', 'application/xml;charset=utf-8');
  }

  function handleMarkAsReceivedSubmit(e) {
    if (e) e.preventDefault();
    if (!markPaidModal) return;
    try {
      const store = readOperations();
      const db = accountingState();
      const out = markIncomeAsReceived(store, db, markPaidModal.recordId, paidDetails);
      saveOperations(out.store);
      localStorage.setItem('wayvida-accounting-v1', JSON.stringify(out.accounting));
      setMarkPaidModal(null);
      refresh();
    } catch (err) {
      alert('Failed to mark income as received: ' + err.message);
    }
  }

  function handleReverseIncome(recordId) {
    if (!confirm('Are you sure you want to cancel / reverse this income record?')) return;
    try {
      const store = readOperations();
      const db = accountingState();
      const out = reverseIncome(store, db, recordId);
      saveOperations(out.store);
      localStorage.setItem('wayvida-accounting-v1', JSON.stringify(out.accounting));
      refresh();
      if (activeDrawerIncome) setActiveDrawerIncome(null);
    } catch (err) {
      alert('Failed to reverse income: ' + err.message);
    }
  }

  function triggerImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv, .json';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result;
          if (!text) return;
          let importedRows = [];
          if (file.name.endsWith('.json')) {
            importedRows = JSON.parse(text);
          } else {
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
            importedRows = lines.slice(1).map(line => {
              const values = line.split(',');
              const row = {};
              headers.forEach((h, i) => row[h] = values[i]?.trim());
              return {
                date: row.date || new Date().toISOString().split('T')[0],
                name: row.description || row.name || 'Imported Income',
                category: row.category || 'Service Income',
                receivedFrom: row.receivedfrom || row.customer || 'Customer',
                amount: Number(row.amount || 0),
                account: row.account || '4100',
                paidThrough: row.paidthrough || '1010',
                received: row.received === 'true' || row.status === 'Received',
                status: row.status || 'Posted'
              };
            });
          }
          if (Array.isArray(importedRows) && importedRows.length > 0) {
            const store = readOperations();
            const db = accountingState();
            importedRows.forEach(item => {
              if (item.amount > 0) {
                createIncome(store, db, item);
              }
            });
            saveOperations(store);
            refresh();
            alert(`Successfully imported ${importedRows.length} income records.`);
          }
        } catch (err) {
          alert('Import failed: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  if (mode === 'create') {
    return <CreateIncomePage onCancel={() => setMode('list')} onSaved={() => { refresh(); setMode('list'); }} />;
  }

  return (
    <section className="je-page brExpense" aria-busy={busy}>
      {/* Header Bar */}
      <div className="je-heading registerHead je-heading-flush">
        <div className="registerHeadText">
          <h2>Income <span className="je-heading-count">({report.rows.length})</span></h2>
          <p>Track and manage your business earnings and revenue receipts.</p>
        </div>

        <div className="je-tools">
          <label>
            <IconSearch size={17} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search income #, customer, description…" />
          </label>
          <details className="je-filters" open={filtersOpen} onToggle={event => setFiltersOpen(event.currentTarget.open)}>
            <summary aria-label="Open filters"><IconFilter size={17} />Filters{activeFilters > 0 && <span>{activeFilters}</span>}</summary>
            <div>
              <label>Date From<input type="date" value={filters.from} onChange={event => set('from', event.target.value)} /></label>
              <label>Date To<input type="date" value={filters.to} onChange={event => set('to', event.target.value)} /></label>
              <label>Category
                <select value={filters.category} onChange={event => set('category', event.target.value)}>
                  <option value={ALL}>All categories</option>
                  {report.categoryOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>Received From
                <select value={filters.party} onChange={event => set('party', event.target.value)}>
                  <option value={ALL}>All customers / payers</option>
                  {report.partyOptions.map(option => <option key={option.name} value={option.name}>{option.name}</option>)}
                </select>
              </label>
              <label>Payment Status
                <select value={filters.status} onChange={event => set('status', event.target.value)}>
                  <option value={ALL}>All statuses</option>
                  <option value="Received">Received</option>
                  <option value="Unpaid">Unpaid / Receivable</option>
                  <option value="Draft">Draft</option>
                </select>
              </label>
              <label>Sort
                <select value={sort} onChange={event => setSort(event.target.value)}>
                  {SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <div className="brFilterActions">
                <button type="button" onClick={() => { refresh(); setStamp(new Date()); }}><IconRefresh size={15} />Refresh</button>
                <button type="button" onClick={clear}>Clear filters</button>
              </div>
            </div>
          </details>
        </div>

        <div className="je-create-callout">
          <div style={{ display: 'inline-flex', alignItems: 'center', background: '#3478f6', borderRadius: '8px', boxShadow: '0 2px 8px rgba(52, 120, 246, 0.22)', position: 'relative' }}>
            <button type="button" onClick={() => setMode('create')} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 16px', background: 'transparent', color: '#fff', border: 0, fontWeight: 600, cursor: 'pointer', fontSize: '13.5px' }}>
              <IconPlus size={18} /> Record Income
            </button>
            <div style={{ width: '1px', height: '22px', background: 'rgba(255, 255, 255, 0.35)' }} />
            <details style={{ position: 'relative' }}>
              <summary style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '40px', background: 'transparent', color: '#fff', border: 0, cursor: 'pointer', listStyle: 'none' }}>
                <IconChevronDown size={18} />
              </summary>
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '175px', padding: '6px', background: '#fff', border: '1px solid #eaecf0', borderRadius: '8px', boxShadow: '0 10px 30px rgba(16, 24, 40, 0.15)' }}>
                <button type="button" onClick={triggerImport} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 0, borderRadius: '6px', background: 'transparent', color: '#344054', fontSize: '13px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}>
                  <IconUpload size={16} /> Import Income
                </button>
                <button type="button" onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 0, borderRadius: '6px', background: 'transparent', color: '#344054', fontSize: '13px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}>
                  <IconFileSpreadsheet size={16} /> Export Excel
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>



      {error && <div className="brError" role="alert"><IconAlertTriangle size={18} /><span>Unable to load income records. {error}</span><button type="button" onClick={refresh}>Retry</button></div>}

      {/* Main Income Data Table */}
      <div className="je-card unified">
        <div className="je-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Income # & Date</th>
                <th>Category</th>
                <th>Received From</th>
                <th>Description</th>
                <th>Deposit Account</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ordered.slice(startIndex, startIndex + perPage).map(entry => (
                <tr key={entry.id}>
                  <td>
                    <button type="button" className="je-link" title={'Open income details ' + entry.number} onClick={() => setActiveDrawerIncome(entry)}>
                      {entry.number}
                    </button>
                    <small style={{ display: 'block', color: '#64748b', marginTop: '3px', fontSize: '0.8125rem', fontWeight: 400 }}>{dateText(entry.date)}</small>
                  </td>
                  <td>{entry.category}</td>
                  <td><strong>{entry.party}</strong></td>
                  <td>{entry.description || entry.name || '—'}</td>
                  <td>{entry.received ? (entry.paymentAccountName || '1010 Bank Account') : 'Accounts Receivable (1100)'}</td>
                  <td><StatusPill status={entry.status} tone={STATUS_TONES[entry.status] || 'neutral'} /></td>
                  <td><b>{money(entry.amount)}</b></td>
                  <td>
                    <details className="customerKebab" style={{ position: 'relative', display: 'inline-block' }}>
                      <summary
                        className="rt-btn rt-btn-sm"
                        style={{
                          padding: '4px 8px',
                          cursor: 'pointer',
                          listStyle: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px',
                          border: '1px solid #d7e0eb',
                          background: '#fff',
                          color: '#475467'
                        }}
                        title="More Actions"
                      >
                        <IconDotsVertical size={16} />
                      </summary>
                      <div
                        className="customerMoreMenu"
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 'calc(100% + 4px)',
                          zIndex: 100,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          minWidth: '155px',
                          padding: '6px',
                          background: '#fff',
                          border: '1px solid #eaecf0',
                          borderRadius: '8px',
                          boxShadow: '0 10px 30px rgba(16, 24, 40, 0.12)'
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.currentTarget.closest('details')?.removeAttribute('open');
                            setActiveDrawerIncome(entry);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '7px 10px',
                            border: 0,
                            borderRadius: '6px',
                            background: 'transparent',
                            color: '#344054',
                            fontSize: '13px',
                            fontWeight: 500,
                            textAlign: 'left',
                            cursor: 'pointer'
                          }}
                        >
                          <IconEye size={15} style={{ color: '#3478f6' }} /> View
                        </button>

                        {!entry.received && entry.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.currentTarget.closest('details')?.removeAttribute('open');
                              setMarkPaidModal(entry);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              width: '100%',
                              padding: '7px 10px',
                              border: 0,
                              borderRadius: '6px',
                              background: 'transparent',
                              color: '#059669',
                              fontSize: '13px',
                              fontWeight: 500,
                              textAlign: 'left',
                              cursor: 'pointer'
                            }}
                          >
                            <IconCircleCheck size={15} style={{ color: '#059669' }} /> Receive
                          </button>
                        )}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {!report.rows.length && (
                <tr className="emptyStateRow">
                  <td colSpan={8} className="emptyStateCell">
                    <EmptyState
                      variant="budget"
                      title={report.hasRows ? 'No income records match your filters.' : 'No income records found.'}
                      description={report.hasRows ? 'Try widening your filters or date range.' : 'Click "+ Record Income" above to add your first income entry.'}
                      actionLabel={report.hasRows ? 'Clear filters' : undefined}
                      onAction={report.hasRows ? clear : undefined}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {ordered.length > 0 && (
          <div className="pagination-footer je-pager">
            <span className="pagination-left">Showing {firstRow}&ndash;{lastRow} of {ordered.length} income entries</span>
            <div className="pagination-right">
              <label className="brPerPage">
                <select aria-label="Entries per page" value={perPage} onChange={event => setPerPage(Number(event.target.value))}>
                  {[25, 50, 100].map(size => <option key={size} value={size}>{size} per page</option>)}
                </select>
              </label>
              <div className="pagination-nav">
                <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>&lsaquo;</button>
                <span>Page {currentPage} of {pageCount}</span>
                <button type="button" aria-label="Next page" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>&rsaquo;</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Mark Unpaid Income as Received */}
      {markPaidModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Mark Income Received</h3>
              <button type="button" onClick={() => setMarkPaidModal(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><IconX size={20} /></button>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '16px' }}>
              Record payment receipt for <strong>{markPaidModal.number}</strong> ({markPaidModal.party}) of <strong>{money(markPaidModal.amount)}</strong>.
            </p>
            <form onSubmit={handleMarkAsReceivedSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                <span>Received In Account *</span>
                <select value={paidDetails.paidThrough} onChange={e => setPaidDetails({ ...paidDetails, paidThrough: e.target.value })}>
                  <option value="1010">1010 - Bank Account</option>
                  <option value="1000">1000 - Cash Account</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                <span>Payment Method</span>
                <select value={paidDetails.method} onChange={e => setPaidDetails({ ...paidDetails, method: e.target.value })}>
                  <option value="Bank transfer">Bank transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                <span>Reference / Transaction #</span>
                <input type="text" placeholder="e.g. UTR-98312" value={paidDetails.reference} onChange={e => setPaidDetails({ ...paidDetails, reference: e.target.value })} />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="rt-btn rt-btn-secondary" onClick={() => setMarkPaidModal(null)}>Cancel</button>
                <button type="submit" className="rt-btn rt-btn-primary" style={{ background: '#10b981', borderColor: '#10b981', color: '#fff' }}>Confirm Receipt</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer: Income Detail View */}
      {activeDrawerIncome && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 900, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: '#fff', width: '500px', maxWidth: '100%', height: '100%', padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '-10px 0 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', pb: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{activeDrawerIncome.number}</h3>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{dateText(activeDrawerIncome.date)}</span>
              </div>
              <button type="button" onClick={() => setActiveDrawerIncome(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><IconX size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Income Category</span>
                <strong>{activeDrawerIncome.category}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Received From</span>
                <strong>{activeDrawerIncome.party}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Amount</span>
                <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{money(activeDrawerIncome.amount)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</span>
                <StatusPill status={activeDrawerIncome.status} tone={STATUS_TONES[activeDrawerIncome.status] || 'neutral'} />
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>Accounting Posting Details:</span>
              • Income Account: {activeDrawerIncome.incomeAccountName || activeDrawerIncome.incomeAccount || '4100 Service Income'}<br />
              • Deposit Ledger: {activeDrawerIncome.received ? (activeDrawerIncome.paymentAccountName || '1010 Bank Account') : '1100 Accounts Receivable'}<br />
              • GST Tax Rate: {activeDrawerIncome.taxLabel || 'No tax'}
            </div>

            {activeDrawerIncome.description && (
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Description / Notes</span>
                <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#334155' }}>{activeDrawerIncome.description}</p>
              </div>
            )}

            <div style={{ marginTop: 'auto', display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button type="button" className="rt-btn rt-btn-secondary" onClick={() => setActiveDrawerIncome(null)}>Close</button>
              {activeDrawerIncome.status !== 'Cancelled' && (
                <button type="button" className="rt-btn" style={{ color: '#ef4444', border: '1px solid #fca5a5', background: '#fef2f2' }} onClick={() => handleReverseIncome(activeDrawerIncome.recordId)}>
                  Cancel Record
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
