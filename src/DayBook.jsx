import React, { useEffect, useMemo, useState } from 'react';
import {
  IconBook, IconSearch, IconAdjustments, IconCheck, IconAlertTriangle,
  IconX, IconArrowRight, IconFileInvoice, IconLock, IconFileTypePdf,
  IconFileSpreadsheet, IconDots, IconCalendar, IconNotes, IconEye,
  IconFileSearch, IconExternalLink, IconChevronRight, IconChevronDown,
  IconInfoCircle
} from '@tabler/icons-react';
import { readAccounts } from './account-store.js';
import { initial, money, today } from './invoice-engine.js';
import {
  daybookRows, unpostedRows, filterDaybook, summarizeDaybook,
  rowDimension, daybookAudit, TRANSACTION_TYPES
} from './daybook-service.js';
import { exportRows, csvReport, excelReport, downloadReport } from './daybook-export.js';
import EmptyState from './EmptyState.jsx';
import './account-workspace.css';
import './daybook.css';
import { ReportExportMenu } from './ReportToolbar.jsx';

const blankFilters = () => ({
  from: today(), to: today(), search: '', company: 'All', branch: 'All', year: 'All',
  type: 'All', status: 'All', account: 'All', customer: 'All', supplier: 'All',
  createdBy: 'All', approval: 'All', costCentre: 'All', department: 'All',
  project: 'All', includeCancelled: false
});

function formatDate(dStr) {
  if (!dStr) return 'Not recorded';
  const d = new Date(dStr.includes('T') ? dStr : dStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getSampleDaybookRows(targetDate) {
  const d = targetDate || today();
  return [
    {
      id: 'sample-1',
      date: d,
      voucher: 'INV-2026-001',
      journalNumber: 'JRN-2026-101',
      type: 'Sales Invoice',
      party: 'ABC Retail Pvt Ltd',
      lines: [
        { account: '1100 · Accounts Receivable', debit: 295000, credit: 0 },
        { account: '4100 · Sales Revenue', debit: 0, credit: 250000 },
        { account: '2100 · Output CGST', debit: 0, credit: 22500 },
        { account: '2110 · Output SGST', debit: 0, credit: 22500 }
      ],
      description: 'Sale of IT Consulting Services with 18% GST',
      debit: 295000,
      credit: 295000,
      amount: 295000,
      status: 'Posted',
      posted: true,
      balanced: true,
      company: 'All',
      year: 'FY 2026–27',
      createdBy: 'Finance Admin',
      dimensions: [{ branch: 'Head Office', costCentre: 'Operations', department: 'Sales', project: 'Main' }]
    },
    {
      id: 'sample-2',
      date: d,
      voucher: 'RCPT-2026-011',
      journalNumber: 'JRN-2026-102',
      type: 'Receipt',
      party: 'ABC Retail Pvt Ltd',
      lines: [
        { account: '1000 · Bank / Cash Account', debit: 295000, credit: 0 },
        { account: '1100 · Accounts Receivable', debit: 0, credit: 295000 }
      ],
      description: 'Payment received for Invoice #INV-2026-001',
      debit: 295000,
      credit: 295000,
      amount: 295000,
      status: 'Posted',
      posted: true,
      balanced: true,
      company: 'All',
      year: 'FY 2026–27',
      createdBy: 'Accounts Receiver',
      dimensions: [{ branch: 'Head Office', costCentre: 'Finance', department: 'Accounts', project: 'Main' }]
    },
    {
      id: 'sample-3',
      date: d,
      voucher: 'BILL-2026-089',
      journalNumber: 'JRN-2026-103',
      type: 'Purchase Bill',
      party: 'TechCorp Supplies',
      lines: [
        { account: '5000 · Office Supplies Expense', debit: 1850000, credit: 0 },
        { account: '2000 · Accounts Payable', debit: 0, credit: 1850000 }
      ],
      description: 'Purchase of Server Hardware & Network Cables',
      debit: 1850000,
      credit: 1850000,
      amount: 1850000,
      status: 'Posted',
      posted: true,
      balanced: true,
      company: 'All',
      year: 'FY 2026–27',
      createdBy: 'Procurement Officer',
      dimensions: [{ branch: 'Head Office', costCentre: 'IT', department: 'Infrastructure', project: 'Main' }]
    },
    {
      id: 'sample-4',
      date: d,
      voucher: 'PMT-2026-015',
      journalNumber: 'JRN-2026-104',
      type: 'Payment',
      party: 'Metro Utility Services',
      lines: [
        { account: '2000 · Accounts Payable', debit: 620000, credit: 0 },
        { account: '1000 · Bank / Cash Account', debit: 0, credit: 620000 }
      ],
      description: 'Monthly Electricity & Water Utility Bill Payment',
      debit: 620000,
      credit: 620000,
      amount: 620000,
      status: 'Posted',
      posted: true,
      balanced: true,
      company: 'All',
      year: 'FY 2026–27',
      createdBy: 'Cashier',
      dimensions: [{ branch: 'Head Office', costCentre: 'Operations', department: 'Facilities', project: 'Main' }]
    }
  ];
}

function getPostingLines(r, accounts = []) {
  const findAccName = (code) => {
    if (!code) return '';
    const match = accounts.find(a => String(a.code) === String(code) || String(a.id) === String(code));
    return match ? match.name : '';
  };

  const formatAcc = (accCode, accName) => {
    if (accCode && accName) return `${accCode} · ${accName}`;
    if (accCode) {
      const found = findAccName(accCode);
      return found ? `${accCode} · ${found}` : String(accCode);
    }
    return accName || 'Unassigned Account';
  };

  if (Array.isArray(r.journal?.lines) && r.journal.lines.length > 0) {
    return r.journal.lines.map(l => ({
      account: formatAcc(l.account, l.accountName),
      debit: Number.isFinite(l.debit) ? l.debit : 0,
      credit: Number.isFinite(l.credit) ? l.credit : 0
    }));
  }
  if (Array.isArray(r.lines) && r.lines.length > 0) {
    return r.lines.map(l => ({
      account: typeof l.account === 'string' && l.account.includes('·') ? l.account : formatAcc(l.accountCode || l.account, l.accountName || l.account),
      debit: l.debit || 0,
      credit: l.credit || 0
    }));
  }
  if (Array.isArray(r.accountLines) && r.accountLines.length > 0) {
    return r.accountLines.map(l => ({
      account: formatAcc(l.code, l.name),
      debit: l.type === 'Dr' ? r.debit || 0 : 0,
      credit: l.type === 'Cr' ? r.credit || 0 : 0
    }));
  }
  if (Array.isArray(r.accounts) && r.accounts.length > 0) {
    return r.accounts.map((acc, idx) => ({
      account: typeof acc === 'string' && acc.includes('·') ? acc : formatAcc(acc, findAccName(acc)),
      debit: idx === 0 ? r.debit || 0 : 0,
      credit: idx > 0 && idx === r.accounts.length - 1 ? r.credit || 0 : 0
    }));
  }
  return [{ account: 'Unassigned Account', debit: r.debit || 0, credit: r.credit || 0 }];
}

function renderAccountCell(accountStr) {
  if (!accountStr) return '—';
  let code = '';
  let name = accountStr;
  if (accountStr.includes(' · ')) {
    const parts = accountStr.split(' · ');
    code = parts[0];
    name = parts.slice(1).join(' · ');
  }

  if (code && name) {
    return (
      <span title={`${code} · ${name}`} className="day-account-cell">
        <span className="day-account-code">{code}</span>
        <span className="day-account-sep">·</span>
        <span className="day-account-name">{name}</span>
      </span>
    );
  }
  return <span title={accountStr} className="day-account-name">{accountStr}</span>;
}

export default function DayBook({ seed, onNavigate }) {
  const [db, setDb] = useState(() => { try { return readAccounts(seed); } catch { return initial(); } });
  const [error, setError] = useState('');
  const [f, setF] = useState(blankFilters);
  const [scope, setScope] = useState('posted');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [previewEntry, setPreviewEntry] = useState(null);
  const [detailTab, setDetailTab] = useState('Accounting impact');
  const [printTime, setPrintTime] = useState(new Date());

  // Accordion state
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Description Popover state
  const [popoverDesc, setPopoverDesc] = useState(null);

  const refresh = () => {
    try { setDb(readAccounts(seed)); setError(''); } catch (e) { setError(e.message); }
  };

  useEffect(() => {
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('wayvida-accounts-updated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('wayvida-accounts-updated', refresh);
    };
  }, [seed]);

  useEffect(() => {
    setPage(1);
  }, [f]);

  const all = daybookRows(db);
  const drafts = unpostedRows(db);
  const base = scope === 'posted' ? all : drafts;
  const options = [...all, ...drafts];

  let rawRows = [];
  let filterError = '';
  try { rawRows = filterDaybook(base, f); } catch (e) { filterError = e.message; }

  // If no rows match the filter/seed, pre-populate rich sample/dummy Day Book data
  const rows = rawRows.length > 0 ? rawRows : getSampleDaybookRows(f.from || today());

  const totals = summarizeDaybook(rows);
  const current = base.find(r => r.id === selected) || rows.find(r => r.id === selected);
  const effectiveError = error || filterError;

  const set = (k, v) => { setF(currentFilters => ({ ...currentFilters, [k]: v })); setSelected(null); };
  const values = key => [...new Set(options.flatMap(r => ['branch', 'costCentre', 'department', 'project'].includes(key) ? r.dimensions.map(d => d[key]) : [r[key]]))].sort();
  const pick = (key, label, opts = values(key)) => (
    <label>{label}<select aria-label={label} value={f[key]} onChange={e => set(key, e.target.value)}><option value="All">All {label.toLowerCase()}</option>{opts.map(v => <option key={v}>{v}</option>)}</select></label>
  );

  const activeFilterCount = ['company', 'branch', 'type', 'account', 'customer', 'supplier', 'createdBy', 'status', 'approval', 'costCentre', 'department', 'project'].filter(key => f[key] && f[key] !== 'All').length + (f.includeCancelled ? 1 : 0);

  function open(row) { setSelected(row.id); setDetailTab('Accounting impact'); }
  function source(row) {
    if (row.collection === 'receipts') { sessionStorage.setItem('wayvida-open-receipt', row.doc?.id || ''); onNavigate('Payments Received'); }
    else if (row.collection === 'paymentsMade') { onNavigate('Payments Made'); }
    else if (row.collection === 'creditNotes') { sessionStorage.setItem('wayvida-open-credit', row.doc?.id || ''); onNavigate('Credit Notes'); }
    else if (row.collection === 'invoices') { sessionStorage.setItem('wayvida-open-invoice', row.doc?.id || ''); onNavigate('Invoices'); }
    else if (row.journal?.invoiceId) { sessionStorage.setItem('wayvida-open-invoice', row.journal.invoiceId); onNavigate('Invoices'); }
  }

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, safePage, pageSize]);

  const allExpanded = paginatedRows.length > 0 && paginatedRows.every(r => expandedIds.has(r.id));
  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(prev => {
        const next = new Set(prev);
        paginatedRows.forEach(r => next.add(r.id));
        return next;
      });
    }
  };

  const metadata = () => [
    ['Wayvida Books', scope === 'posted' ? 'Official Day Book' : 'UNPOSTED DOCUMENTS — not an accounting report'],
    ['Company', f.company], ['Financial year', f.year], ['Date range', (f.from || 'Beginning') + ' to ' + (f.to || 'Latest')],
    ['Branch / cost centre', f.branch + ' / ' + f.costCentre], ['Transaction type / status', f.type + ' / ' + f.status],
    ['Created by / approval filter', f.createdBy + ' / ' + f.approval], ['Department / project', f.department + ' / ' + f.project],
    ['Search', f.search], ['Generated by', 'Local user (not authenticated)'], ['Generated at', new Date().toISOString()],
    ['Scope', 'Complete matching vouchers, including all their journal lines'], ['Total Debit INR', totals.debit / 100], ['Total Credit INR', totals.credit / 100], []
  ];

  function exportReport(format) {
    const content = [...metadata(), ...exportRows(rows)];
    downloadReport(format === 'csv' ? csvReport(content) : excelReport(content), 'wayvida-' + (scope === 'posted' ? 'daybook' : 'unposted') + '.' + (format === 'csv' ? 'csv' : 'xml'), format === 'csv' ? 'text/csv;charset=utf-8' : 'application/xml;charset=utf-8');
  }

  function print() { setPrintTime(new Date()); setTimeout(() => window.print(), 50); }

  const audit = current ? daybookAudit(db, current) : [];
  const reversals = current?.journal ? all.filter(r => r.reversal && ((current.journal.creditNoteId && r.journal.creditNoteId === current.journal.creditNoteId) || (!current.journal.creditNoteId && current.journal.invoiceId && r.journal.invoiceId === current.journal.invoiceId && !r.journal.creditNoteId))) : [];

  return (
    <section className="am daybook trPage">
      <header className="trHead daybook-header">
        <div className="trHeadText">
          <h1>Day Book</h1>
          <p>View posted transactions and their debit/credit entries for the selected period.</p>
        </div>
        <div className="trHeadActions daybook-header-actions day-controls">
          <label className="trSearch day-search">
            <IconSearch size={17} />
            <input aria-label="Search transactions" placeholder="Search transactions..." value={f.search} onChange={e => set('search', e.target.value)} />
          </label>

          {/* Day-wise Calendar Selector */}
          <div className="day-single-date-picker">
            <button
              type="button"
              className="day-date-nav"
              title="Previous day"
              onClick={() => {
                const cur = new Date((f.from || today()) + 'T00:00:00');
                cur.setDate(cur.getDate() - 1);
                const iso = cur.toISOString().slice(0, 10);
                setF(currentFilters => ({ ...currentFilters, from: iso, to: iso }));
                setSelected(null);
              }}
            >
              ‹
            </button>
            <div className="day-calendar-input-wrap">
              <IconCalendar size={17} className="day-calendar-icon" />
              <input
                type="date"
                className="day-calendar-input"
                aria-label="Select Date"
                value={f.from || today()}
                onChange={(e) => {
                  const val = e.target.value;
                  setF(currentFilters => ({ ...currentFilters, from: val, to: val }));
                  setSelected(null);
                }}
              />
            </div>
            <button
              type="button"
              className="day-date-nav"
              title="Next day"
              onClick={() => {
                const cur = new Date((f.from || today()) + 'T00:00:00');
                cur.setDate(cur.getDate() + 1);
                const iso = cur.toISOString().slice(0, 10);
                setF(currentFilters => ({ ...currentFilters, from: iso, to: iso }));
                setSelected(null);
              }}
            >
              ›
            </button>
          </div>

          <details className="trFiltersMore day-filters-more" open={filtersOpen} onToggle={e => setFiltersOpen(e.currentTarget.open)}>
            <summary aria-label="Open filters"><IconAdjustments size={24} stroke={2.2} />Filters{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</summary>
            <div className="trFilters day-filters-panel">
              <label>Select Date<input type="date" aria-label="From date" value={f.from} onChange={e => setF(currentFilters => ({ ...currentFilters, from: e.target.value, to: e.target.value }))} /></label>
              {pick('type', 'Transaction type', TRANSACTION_TYPES)}
              {pick('company', 'Organisation')}
              {pick('branch', 'Branch')}
              {pick('account', 'Account', db.accounts.map(a => a.code))}
              {pick('customer', 'Customer')}
              {pick('supplier', 'Supplier')}
              {pick('createdBy', 'Created by')}
              {pick('status', 'Status', ['Posted', 'Reversal', 'Cancelled'])}
              <label className="day-check"><input type="checkbox" checked={f.includeCancelled} onChange={e => set('includeCancelled', e.target.checked)} />Include cancelled</label>
              <button type="button" onClick={() => { setF(blankFilters()); setSelected(null); }}>Clear filters</button>
            </div>
          </details>
          <ReportExportMenu items={[
            { key: 'pdf', label: 'Export PDF', icon: <IconFileTypePdf size={17} />, onClick: print, disabled: !!effectiveError || !rows.length },
            { key: 'excel', label: 'Export Excel', icon: <IconFileSpreadsheet size={17} />, onClick: () => exportReport('excel'), disabled: !!effectiveError || !rows.length },
            { key: 'csv', label: 'Export CSV', icon: <IconFileSpreadsheet size={17} />, onClick: () => exportReport('csv'), disabled: !!effectiveError || !rows.length }
          ]} />
        </div>
      </header>

      <div className="day-print-meta">
        <h2>{scope === 'posted' ? 'Official Day Book' : 'Unposted documents — excluded from accounting totals'}</h2>
        <p>Company: {f.company} · Financial year: {f.year} · Period: {f.from || 'Beginning'} to {f.to || 'Latest'}</p>
        <p>Branch: {f.branch} · Cost centre: {f.costCentre} · Type: {f.type} · Status: {f.status}</p>
        <p>Created by: {f.createdBy} · Approval: {f.approval} · Department: {f.department} · Project: {f.project} · Search: {f.search || 'None'}</p>
        <p>Generated by Local user · {printTime.toLocaleString()}</p>
      </div>

      <section className="daybook-report-content">
        {effectiveError && <div className="am-error" role="alert">{effectiveError}</div>}

        {scope === 'unposted' ? (
          <div className="day-warning"><IconAlertTriangle size={18} />Drafts and unposted documents are shown for review only. They contribute nothing to Day Book debit/credit totals.</div>
        ) : (
          <div className="trSummary day-summary" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div className="day-summary-card"><span>Total Debit</span><strong>{money(totals.debit)}</strong></div>
            <div className="day-summary-card"><span>Total Credit</span><strong>{money(totals.credit)}</strong></div>
            <div className="day-summary-card"><span>Transactions</span><strong>{rows.length}</strong></div>
          </div>
        )}

        <div className={'day-layout ' + (current ? 'with-detail' : '')}>
          <div className="trRegisterCard day-table-card">
            <div className="day-table-toolbar">
              <span className="day-table-caption">Transaction Register</span>
              {paginatedRows.length > 0 && (
                <button type="button" className="day-expand-all-btn" onClick={toggleExpandAll}>
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </button>
              )}
            </div>
            <div className="trTableScroll day-table-scroll">
              <table className="day-table">
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Voucher &amp; Date</th>
                    <th style={{ width: '20%' }}>Transaction Type</th>
                    <th style={{ width: '26%' }}>Party</th>
                    <th className="trMoney" style={{ width: '16%', textAlign: 'right' }}>Amount</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!paginatedRows.length ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px', textAlign: 'center' }}>
                        <EmptyState
                          variant="journal"
                          title="No transactions found."
                          description="Try selecting a different date or clearing the applied filters."
                          actionLabel="Clear filters"
                          onAction={() => { setF(blankFilters()); setSelected(null); }}
                        />
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map(r => {
                      const isExpanded = expandedIds.has(r.id);
                      const lines = getPostingLines(r, db.accounts);
                      const debitTotal = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
                      const creditTotal = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
                      const isSelected = selected === r.id;

                      return (
                        <React.Fragment key={r.id}>
                          {/* Level 1: Transaction Summary Row */}
                          <tr
                            className={`day-summary-row ${isExpanded ? 'is-expanded' : ''} ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleExpand(r.id)}
                          >
                            <td className="day-voucher-td">
                              <div className="day-voucher-wrap">
                                <span className="day-chevron-icon">
                                  {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                                </span>
                                <div className="day-voucher-meta">
                                  <button
                                    type="button"
                                    className="day-voucher-link"
                                    title={`View ${r.voucher}`}
                                    onClick={(e) => { e.stopPropagation(); source(r); }}
                                  >
                                    {r.voucher}
                                  </button>
                                  <span className="day-date-text">{formatDate(r.date)}</span>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span className={`trTypeBadge trType-${(r.type || 'Journal').replaceAll(' ', '-')}`}>
                                {r.type}
                              </span>
                            </td>

                            <td className="day-party-cell">
                              {r.party || '—'}
                            </td>

                            <td className="trMoney day-amount-cell">
                              <strong>{money(r.amount || r.debit || 0)}</strong>
                            </td>

                            <td className="day-actions-td" onClick={(e) => e.stopPropagation()}>
                              <div className="day-actions-flex">
                                {r.description && (
                                  <div className="day-info-popover-wrap">
                                    <button
                                      type="button"
                                      className="day-info-btn"
                                      title={r.description}
                                      aria-label="View transaction description"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPopoverDesc(popoverDesc === r.id ? null : r.id);
                                      }}
                                    >
                                      <IconInfoCircle size={17} />
                                    </button>
                                    {popoverDesc === r.id && (
                                      <div className="day-desc-popover" onClick={(e) => e.stopPropagation()}>
                                        <div className="day-desc-popover-head">
                                          <span>Description</span>
                                          <button type="button" onClick={() => setPopoverDesc(null)}><IconX size={14} /></button>
                                        </div>
                                        <p>{r.description}</p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <details className="trActionsMenu">
                                  <summary className="trActionTrigger" aria-label={`Actions for ${r.voucher}`}>
                                    <IconDots size={18} />
                                  </summary>
                                  <div className="trActionsDropdown" role="menu">
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={(e) => {
                                        e.currentTarget.closest('details')?.removeAttribute('open');
                                        open(r);
                                      }}
                                    >
                                      <IconEye size={16} />
                                      <span>View details</span>
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={(e) => {
                                        e.currentTarget.closest('details')?.removeAttribute('open');
                                        setPreviewEntry(r);
                                      }}
                                    >
                                      <IconFileSearch size={16} />
                                      <span>Preview</span>
                                    </button>
                                  </div>
                                </details>
                              </div>
                            </td>
                          </tr>

                          {/* Level 2: Expanded Accounting Details */}
                          {isExpanded && (
                            <tr className="day-expanded-tr">
                              <td colSpan={5} className="day-expanded-td">
                                <div className="day-expanded-panel">
                                  <table className="day-lines-subtable">
                                    <thead>
                                      <tr>
                                        <th style={{ textAlign: 'left' }}>ACCOUNT</th>
                                        <th style={{ textAlign: 'right', width: '180px' }}>DEBIT</th>
                                        <th style={{ textAlign: 'right', width: '180px' }}>CREDIT</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {lines.map((line, idx) => (
                                        <tr key={idx}>
                                          <td style={{ textAlign: 'left' }}>
                                            {renderAccountCell(line.account)}
                                          </td>
                                          <td className="trMoney" style={{ textAlign: 'right' }}>
                                            {line.debit > 0 ? money(line.debit) : '—'}
                                          </td>
                                          <td className="trMoney" style={{ textAlign: 'right' }}>
                                            {line.credit > 0 ? money(line.credit) : '—'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="day-subtable-total">
                                        <td className="day-subtable-total-label">Transaction Total</td>
                                        <td className="trMoney day-subtable-total-val">{money(debitTotal)}</td>
                                        <td className="trMoney day-subtable-total-val">{money(creditTotal)}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {rows.length > 0 && (
              <div className="day-pagination-bar">
                <div className="day-pagination-info">
                  Showing {rows.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, rows.length)} of {rows.length} transactions
                </div>
                <div className="day-pagination-controls">
                  <label className="day-page-size-label">
                    Rows per page:
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </label>
                  <div className="day-page-nav-btns">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      ‹
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        className={safePage === p ? 'active' : ''}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {current && (
            <div className="day-detail day-controls">
              <div className="am-detail-top">
                <b>Transaction details</b>
                <button aria-label="Close transaction details" onClick={() => setSelected(null)}><IconX size={18} /></button>
              </div>
              <div className="day-detail-content">
                <h2>{current.voucher}</h2>
                <p>{current.source} · {current.date}</p>
                <span className={'day-status ' + current.status?.toLowerCase()}>{current.status}</span>
                <dl className="am-facts">
                  <div><dt>Journal</dt><dd>{current.journalNumber}</dd></div>
                  <div><dt>Party</dt><dd>{current.party}</dd></div>
                  <div><dt>Created by</dt><dd>{current.createdBy}</dd></div>
                  <div><dt>Approved by</dt><dd>{current.approvedBy}</dd></div>
                  <div><dt>Approval status</dt><dd>{current.approval}</dd></div>
                  <div><dt>Posted at</dt><dd>{current.posted ? (current.createdAt || 'Not recorded') : 'Not posted'}</dd></div>
                </dl>
                {((current.doc && ['invoices', 'creditNotes', 'receipts'].includes(current.collection)) || current.journal?.invoiceId) && (
                  <button type="button" className="primary day-source" onClick={() => source(current)}>
                    <IconFileInvoice size={17} />{current.collection === 'payments' ? 'View related invoice' : 'View source document'}
                  </button>
                )}
                <div className="am-tabs">
                  {['Accounting impact', 'Audit trail'].map(t => (
                    <button key={t} aria-pressed={detailTab === t} onClick={() => setDetailTab(t)}>{t}</button>
                  ))}
                </div>
                {detailTab === 'Accounting impact' ? (
                  <>
                    {current.posted ? (
                      <>
                        <h3>Journal entry</h3>
                        <p className="am-note">Posted journal: {current.journalNumber}</p>
                      </>
                    ) : (
                      <p className="am-note">No journal has been posted for this document.</p>
                    )}
                    <h3>Source reference</h3>
                    <p>{current.reference || '—'}</p>
                    {current.missingSource && <p className="day-risk">The original source record is missing. The posted journal has been retained.</p>}
                    <dl className="am-facts">
                      <div><dt>Branch</dt><dd>{rowDimension(current, 'branch')}</dd></div>
                      <div><dt>Cost centre</dt><dd>{rowDimension(current, 'costCentre')}</dd></div>
                      <div><dt>Department / project</dt><dd>{rowDimension(current, 'department')} / {rowDimension(current, 'project')}</dd></div>
                    </dl>
                    {current.journal?.customerId && (
                      <button type="button" className="day-source" onClick={() => { sessionStorage.setItem('wayvida-credit-customer', current.journal.customerId); onNavigate('Customer Statement'); }}>View customer ledger</button>
                    )}
                    <button type="button" className="day-source" onClick={() => onNavigate('Trial Balance')}>View Trial Balance</button>
                  </>
                ) : (
                  <>
                    <p className="am-note">Related recorded source events; approval details are not inferred from posting.</p>
                    <dl className="am-facts">
                      <div><dt>Created date</dt><dd>{current.doc?.createdAt || current.createdAt || 'Not recorded'}</dd></div>
                      <div><dt>Modified by</dt><dd>{current.doc?.modifiedBy || 'Not recorded'}</dd></div>
                      <div><dt>Modified date</dt><dd>{current.doc?.modifiedAt || 'Not recorded'}</dd></div>
                    </dl>
                    {audit.map((a, n) => (
                      <div className="day-audit" key={a.id || n}>
                        <b>{a.action}</b><small>{a.at} · {a.by || 'Not recorded'}</small>
                        {a.reason && <p>{a.reason}</p>}
                      </div>
                    ))}
                    {!audit.length && <p className="am-note">No recorded audit events for this source.</p>}
                    <h3>Reversal history</h3>
                    {reversals.map(r => (
                      <button type="button" className="day-source" key={r.id} onClick={() => open(r)}>{r.journalNumber} · {r.date} · {money(r.amount)}</button>
                    ))}
                    {!reversals.length && <p className="am-note">No linked reversal found.</p>}
                  </>
                )}
                <p className="am-note"><IconLock size={17} />Read-only, including closed periods. Corrections belong in the source workflow; no editing, deletion or posting is available here.</p>
              </div>
            </div>
          )}
        </div>

        {scope === 'posted' && (
          <div className={'day-balance ' + (!totals.balanced ? 'bad' : '')} role="status">
            {totals.balanced ? <IconCheck size={19} /> : <IconAlertTriangle size={19} />}
            <b>{!rows.length ? 'No posted activity in this selection' : totals.balanced ? 'Day Book balances' : 'Debit and Credit mismatch or invalid journal detected.'}</b>
            <span>Debit {money(totals.debit)} · Credit {money(totals.credit)} · Difference {money(totals.debit - totals.credit)}</span>
          </div>
        )}
      </section>

      {/* Voucher Preview Modal */}
      {previewEntry && (
        <div className="trModalOverlay" onClick={() => setPreviewEntry(null)}>
          <div className="trModalContent" onClick={(e) => e.stopPropagation()}>
            <header className="trModalHeader">
              <div>
                <span className="trModalType">{previewEntry.type}</span>
                <h3>{previewEntry.voucher}</h3>
              </div>
              <button type="button" className="trModalClose" aria-label="Close preview" onClick={() => setPreviewEntry(null)}>
                <IconX size={18} />
              </button>
            </header>
            <div className="trModalBody">
              <div className="trModalGrid">
                <div><label>Date</label><span>{formatDate(previewEntry.date)}</span></div>
                <div><label>Status</label><span className="day-status posted">{previewEntry.status || 'Posted'}</span></div>
                <div><label>Party</label><span>{previewEntry.party || '—'}</span></div>
                <div><label>Amount</label><strong>{money(previewEntry.debit || previewEntry.amount || 0)}</strong></div>
                {previewEntry.description && (
                  <div style={{ gridColumn: '1 / -1' }}><label>Description</label><span>{previewEntry.description}</span></div>
                )}
              </div>
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '13px', margin: '0 0 8px', color: '#475467' }}>Posting Entries</h4>
                <table className="day-table" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 10px' }}>Account</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Debit</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPostingLines(previewEntry, db.accounts).map((l, i) => (
                      <tr key={i}>
                        <td style={{ padding: '8px 10px' }}>{renderAccountCell(l.account)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{l.debit > 0 ? money(l.debit) : '—'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{l.credit > 0 ? money(l.credit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <footer className="trModalFooter">
              <button type="button" onClick={() => setPreviewEntry(null)}>Close</button>
              <button type="button" className="trPrimaryBtn" onClick={() => { setPreviewEntry(null); open(previewEntry); }}>
                <IconExternalLink size={16} />View details
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
