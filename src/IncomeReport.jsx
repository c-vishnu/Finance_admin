import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconAlertTriangle, IconChevronDown, IconEye, IconFileSpreadsheet, IconFilter,
  IconPlus, IconRefresh, IconSearch, IconUpload, IconCircleCheck, IconX, IconDots,
  IconEdit, IconCopy, IconBan
} from '@tabler/icons-react';
import { readAccounts } from './account-store.js';
import { money } from './invoice-engine.js';
import { ALL, DASH, DEFAULT_SORT, RECEIPT_AWAITING, RECEIPT_RECEIVED, SORT_OPTIONS, incomeExportSheet, incomeReport, sortTransactions } from './business-reports.js';
import { downloadReport, excelReport } from './daybook-export.js';
import { getAccessibleOrganizations, getCurrentOrganizationContext } from './organisation-context.js';
import { getScopeVisibility } from './organisation-scope.js';
import { accountingState, createIncome, markIncomeAsReceived, reverseIncome, readOperations, saveOperations } from './operations-store.js';
import { tableExport } from './tax-compliance.js';
import CreateIncomePage from './CreateIncomePage.jsx';
import EmptyState from './EmptyState.jsx';
import StatusPill from './StatusPill.jsx';
import './journal-entries.css';
import './business-reports.css';
import './income-detail-drawer.css';

const dateText = value => value ? new Date(value + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : DASH;

/* Recorded is the settled state and Cancelled is the dead one, so the register reads the same
   three words the lifecycle does. */
const STATUS_TONES = { Draft: 'neutral', Recorded: 'ok', Cancelled: 'danger', Unpaid: 'warn', Pending: 'warn', Received: 'ok', Posted: 'ok' };

/* The receipt filter is the one the receipt switch used to be: it narrows to the incomes the money
   has arrived for, or to the ones still owed, without inventing a fourth status for either. */
const blankFilters = () => ({ from: '', to: '', party: ALL, status: ALL, receipt: ALL, branch: ALL, account: ALL, category: ALL, payment: ALL });

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
  /* Which income the Record Income surface was opened for, and whether it is an edit or a copy.
     The register owns this because the create surface is a mode of this page, not a route. */
  const [formSeed, setFormSeed] = useState(null);
  const [activeDrawerIncome, setActiveDrawerIncome] = useState(null);
  const [markPaidModal, setMarkPaidModal] = useState(null);
  const [paidDetails, setPaidDetails] = useState({ paidThrough: '1010', method: 'Bank transfer', reference: '' });

  const deferredSearch = useDeferredValue(search);
  const busy = deferredSearch !== search;

  /* The working context, resolved once per revision. getScopeVisibility is the shared rule the
     journal lines, Period Lock and the Chart of Accounts already read: the Organisation column is
     printed only when the context reaches past one organisation, and the Branch column only when it
     reaches past one branch - so a single-organisation, single-branch context shows neither. */
  const context = useMemo(() => {
    const { company, branch } = getCurrentOrganizationContext();
    const organisations = getAccessibleOrganizations();
    const visibility = getScopeVisibility({ organisations, label: 'Income' });
    return {
      organisation: company,
      branch,
      organisations,
      branches: organisations.flatMap(item => item.branches),
      showOrganisation: visibility.showOrgColumn,
      showBranch: visibility.showBranchColumn
    };
  }, [revision]);
  const { organisation, branches, showOrganisation, showBranch } = context;
  const columnCount = 9 + (showOrganisation ? 1 : 0) + (showBranch ? 1 : 0);

  const refresh = () => setRevision(value => value + 1);
  useEffect(() => {
    window.addEventListener('wayvida-accounts-updated', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('wayvida-working-context-change', refresh);
    window.addEventListener('wayvida-organization-change', refresh);
    return () => {
      window.removeEventListener('wayvida-accounts-updated', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('wayvida-working-context-change', refresh);
      window.removeEventListener('wayvida-organization-change', refresh);
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
    const scope = {
      branches,
      organisations: context.organisations,
      organisationName: organisation.name,
      workingBranch: context.branch?.name || '',
      showOrganisation,
      showBranch
    };
    try {
      return incomeReport(book || {}, operations || {}, { ...filters, ...scope, search: deferredSearch });
    } catch {
      return incomeReport({}, { incomes: [] }, { ...filters, ...scope, search: deferredSearch });
    }
  }, [book, operations, filters, deferredSearch, branches, context, organisation.name, showOrganisation, showBranch]);

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
  const activeFilters = ['from', 'to'].filter(key => filters[key]).length + ['party', 'account', 'category', 'payment'].filter(key => filters[key] !== ALL).length + ['status', 'receipt', 'branch'].filter(key => filters[key] !== ALL).length + (sort !== DEFAULT_SORT ? 1 : 0);

  function exportExcel() {
    const sheet = incomeExportSheet(report);
    const content = excelReport(tableExport(sheet.header, sheet.rows, {
      title: 'Wayvida Books · Income Report', subtitle: 'View and manage business income records.',
      organisation: organisation.name, branch: filters.branch, from: filters.from, to: filters.to,
      filters: { Status: filters.status, Receipt: filters.receipt, Category: filters.category, 'Received From': filters.party, Branch: filters.branch, Search: search },
      count: report.rows.length, generatedBy: 'Local user', generatedAt: stamp.toISOString()
    }));
    downloadReport(content, 'wayvida-income-report.xml', 'application/xml;charset=utf-8');
  }

  function handleMarkAsReceivedSubmit(e) {
    if (e) e.preventDefault();
    if (!markPaidModal) return;
    /* Which income the dialog was opened for, read before the dialog is dismissed. */
    const receivedId = markPaidModal.recordId;
    try {
      const store = readOperations();
      const db = accountingState();
      const out = markIncomeAsReceived(store, db, receivedId, paidDetails);
      saveOperations(out.store);
      localStorage.setItem('wayvida-accounting-v1', JSON.stringify(out.accounting));
      setMarkPaidModal(null);
      refresh();
      /* The detail drawer describes the income whose receipt just changed - its deposit ledger is
         the account the money was owed into a moment ago - so it closes rather than restating a stale
         record, and the refreshed register below is what the operator reads. */
      setActiveDrawerIncome(current => (current && current.recordId === receivedId ? null : current));
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

  /* One register menu, opened by the row and closed by a press anywhere else or Escape, so the
     panel can never be left open behind the next one. */
  const openMenus = () => document.querySelectorAll('.je-row-actions details[open]');
  const menuRun = handler => () => { openMenus().forEach(node => node.removeAttribute('open')); handler(); };
  const closeMenus = () => openMenus().forEach(node => node.removeAttribute('open'));
  useEffect(() => {
    const onPointerDown = event => openMenus().forEach(node => { if (!node.contains(event.target)) node.removeAttribute('open'); });
    const onKeyDown = event => { if (event.key === 'Escape') closeMenus(); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, []);

  /* Edit and Duplicate both reopen the Record Income surface: Edit only for a draft, which has not
     reached the ledger, and Duplicate for any income, saving its values as a new record. */
  const openForm = (income, copy) => { setFormSeed({ income, copy }); setMode('create'); };
  const closeForm = () => { setFormSeed(null); setMode('list'); };
  const rowActions = entry => {
    const cancelled = entry.status === 'Cancelled';
    const editable = entry.status === 'Draft';
    return [
      { key: 'view', label: 'View', icon: IconEye, run: () => setActiveDrawerIncome(entry) },
      { key: 'edit', label: 'Edit', icon: IconEdit, disabled: !editable, reason: editable ? '' : 'Only a draft income can be edited. Cancel this income and record a new one instead.', run: () => openForm(entry, false) },
      { key: 'duplicate', label: 'Duplicate', icon: IconCopy, run: () => openForm(entry, true) },
      { key: 'cancel', label: 'Cancel Income', icon: IconBan, danger: true, disabled: cancelled, reason: cancelled ? 'This income is already cancelled.' : '', run: () => handleReverseIncome(entry.recordId) }
    ];
  };

  if (mode === 'create') {
    return <CreateIncomePage income={formSeed?.income || null} copy={Boolean(formSeed?.copy)} onCancel={closeForm} onSaved={() => { refresh(); closeForm(); }} />;
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
              <label>Income Type
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
              <label>Status
                <select value={filters.status} onChange={event => set('status', event.target.value)}>
                  <option value={ALL}>All statuses</option>
                  {report.statusOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>Receipt
                <select value={filters.receipt} onChange={event => set('receipt', event.target.value)}>
                  <option value={ALL}>Received and awaiting</option>
                  <option value={RECEIPT_RECEIVED}>Received</option>
                  <option value={RECEIPT_AWAITING}>Awaiting receipt</option>
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
          <table className="incomeRegister">
            <thead>
              <tr>
                <th>Date</th>
                <th>Income No./Inv No.</th>
                <th>Income From</th>
                <th>Income Type</th>
                <th>Received In</th>
                <th>Amount</th>
                <th>Reference Number</th>
                <th>Status</th>
                {showOrganisation && <th>Organisation</th>}
                {showBranch && <th>Branch</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ordered.slice(startIndex, startIndex + perPage).map(entry => (
                <tr key={entry.id}>
                  <td>{dateText(entry.date)}</td>
                  <td>
                    <button type="button" className="je-link" title={'Open income details ' + entry.number} onClick={() => setActiveDrawerIncome(entry)}>
                      {entry.documentNumber}
                    </button>
                  </td>
                  <td><strong>{entry.party}</strong></td>
                  <td>{entry.category}</td>
                  <td>{entry.receivedIn}</td>
                  <td><b>{money(entry.amount)}</b></td>
                  <td>{entry.reference}</td>
                  <td><StatusPill status={entry.status} tone={STATUS_TONES[entry.status] || 'neutral'} /></td>
                  {showOrganisation && <td>{entry.organisationName}</td>}
                  {showBranch && <td>{entry.branchName}</td>}
                  <td>
                    <div className="je-row-actions">
                      <details>
                        <summary aria-label={'More actions for ' + entry.number}><IconDots size={17} /></summary>
                        <div>
                          {rowActions(entry).map(action => {
                            const ActionIcon = action.icon;
                            return (
                              <button key={action.key} type="button" disabled={action.disabled} title={action.reason || undefined} className={action.danger ? 'je-row-danger' : ''} onClick={action.disabled ? undefined : menuRun(action.run)}>
                                <ActionIcon size={17} />
                                <span>{action.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
              {!report.rows.length && (
                <tr className="emptyStateRow">
                  <td colSpan={columnCount} className="emptyStateCell">
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
      {markPaidModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
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
        </div>,
        document.body
      )}

      {/* Drawer: Income Detail View */}
      {activeDrawerIncome && createPortal(
        <div className="opsOverlay irOverlay" onMouseDown={event => { if (event.target === event.currentTarget) setActiveDrawerIncome(null); }}>
          <aside className="opsDrawer irDrawer" role="dialog" aria-modal="true" aria-label={'Income details ' + activeDrawerIncome.number}>
            <header>
              <div>
                <h2>{activeDrawerIncome.number}</h2>
                <p>{dateText(activeDrawerIncome.date)}</p>
              </div>
              <button type="button" className="irDrawerClose" aria-label="Close income details" onClick={() => setActiveDrawerIncome(null)}><IconX size={20} /></button>
            </header>

            <div className="opsDrawerBody irDrawerBody">
              <dl className="irFacts">
                <div>
                  <dt>Income Type</dt>
                  <dd>{activeDrawerIncome.category}</dd>
                </div>
                <div>
                  <dt>Received From</dt>
                  <dd>{activeDrawerIncome.party}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd><b>{money(activeDrawerIncome.amount)}</b></dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd><StatusPill status={activeDrawerIncome.status} tone={STATUS_TONES[activeDrawerIncome.status] || 'neutral'} /></dd>
                </div>
                {/* The register prints the reference number in its own column, so View states it too
                    rather than leaving the operator to read it off the row behind the drawer. */}
                {activeDrawerIncome.reference && activeDrawerIncome.reference !== DASH && (
                  <div>
                    <dt>Reference Number</dt>
                    <dd>{activeDrawerIncome.reference}</dd>
                  </div>
                )}
              </dl>

              <div className="irPosting">
                <h3>Accounting Posting Details:</h3>
                <ul>
                  <li>Income Account: {activeDrawerIncome.incomeAccountName || activeDrawerIncome.incomeAccount || '4100 Service Income'}</li>
                  <li>Deposit Ledger: {activeDrawerIncome.received ? (activeDrawerIncome.paymentAccountName || '1010 Bank Account') : '1100 Accounts Receivable'}</li>
                  <li>GST Tax Rate: {activeDrawerIncome.taxLabel || 'No tax'}</li>
                </ul>
              </div>

              {activeDrawerIncome.description && (
                <div className="irNotes">
                  <h3>Description / Notes</h3>
                  <p>{activeDrawerIncome.description}</p>
                </div>
              )}
            </div>

            <footer>
              <button type="button" onClick={() => setActiveDrawerIncome(null)}>Close</button>
              {/* Receipt is not one of the register's four row actions, so it lives where the operator
                  already has the record's own facts in front of them. Only a recorded income can be
                  collected: a draft has not reached the ledger, so there is nothing to collect against. */}
              {activeDrawerIncome.status === 'Recorded' && !activeDrawerIncome.received && (
                <button type="button" className="irReceive" onClick={() => setMarkPaidModal(activeDrawerIncome)}>Mark as received</button>
              )}
              {activeDrawerIncome.status !== 'Cancelled' && (
                <button type="button" className="irDanger" onClick={() => handleReverseIncome(activeDrawerIncome.recordId)}>Cancel Record</button>
              )}
            </footer>
          </aside>
        </div>,
        document.body
      )}
    </section>
  );
}
