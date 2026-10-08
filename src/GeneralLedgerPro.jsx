import {useMemo, useState} from 'react';
import {
  IconAdjustments,
  IconArrowLeft,
  IconBook,
  IconBuildingBank,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconEye,
  IconFileInvoice,
  IconFilter,
  IconHistory,
  IconMail,
  IconPrinter,
  IconRefresh,
  IconSearch,
  IconX
} from '@tabler/icons-react';
import {KEY, ledger as postedLedger} from './invoice-engine.js';
import {formatMinor, formatRupees} from './number-format.js';
import {useExperienceMode} from './ExperienceModeContext.jsx';
import './general-ledger.css';

const money = n => formatRupees(Math.abs(Number(n) || 0));

const dateText = v => {
  if (!v) return '—';
  try {
    return new Date(v + 'T00:00:00').toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return v;
  }
};

const sourcePage = source =>
  ({
    'Sales Invoice': 'Invoices',
    'Customer Payment': 'Payments Received',
    'Customer Receipt': 'Payments Received',
    'Purchase Bill': 'Purchase Bills',
    'Vendor Payment': 'Payments Made',
    'Credit Note': 'Credit Notes',
    'Debit Note': 'Debit Notes',
    'Journal Entry': 'Journal Entries',
    'Manual Journal': 'Journal Entries',
    'Invoice Reversal': 'Invoices',
    'Receipt Reversal': 'Payments Received'
  }[source] ||
  source ||
  'Journal Entries');

export default function GeneralLedgerPro({accounts = [], notify, onNavigate}) {
  const { isEasy } = useExperienceMode();
  // Load all posted transactions from localStorage
  const transactionRows = useMemo(() => {
    try {
      const state = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!state?.journals?.length) return [];
      return postedLedger(state).map((line, index) => {
        const vNum = line.reference || line.number;
        const rawParty = line.partyName || line.customerName || line.vendorName;
        // Clean party name so it doesn't repeat voucher number
        const party = rawParty && rawParty !== vNum ? rawParty : '';
        const desc = line.description && line.description !== vNum ? line.description : '';

        return {
          id: line.id || `ledger-${index}`,
          date: line.date,
          createdAt: line.createdAt,
          type: line.source || 'Journal Transaction',
          voucher: vNum,
          reference: line.reference || '—',
          description: desc || (party ? '' : `${line.source || 'Journal'} posting`),
          party: party || desc || '—',
          account: line.account,
          debit: (line.debit || 0) / 100,
          credit: (line.credit || 0) / 100,
          branch: line.branch || 'Unassigned',
          cost: line.costCentre || 'Unassigned',
          status: line.status || 'Posted',
          journal: line.number,
          source: sourcePage(line.source),
          reconciled: Boolean(line.reconciled)
        };
      });
    } catch {
      return [];
    }
  }, []);

  // Format Chart of Accounts list
  const accountList = useMemo(() => {
    const raw = Array.isArray(accounts)
      ? accounts
      : Object.entries(accounts || {}).flatMap(([type, rows]) =>
          (rows || []).map(row => (Array.isArray(row) ? {code: row[0], name: row[1], type} : row))
        );
    const mapped = raw
      .filter(a => !a.isGroup)
      .map(a => ({
        code: a.code,
        name: a.name,
        type: a.type || 'Assets',
        group: a.parentName || a.group || a.type || 'Assets',
        opening: Number(a.openingBalance) || 0,
        normal: a.normalBalance || (['Assets', 'Expenses'].includes(a.type) ? 'Debit' : 'Credit'),
        created: '01 Apr 2026'
      }));
    return [...new Map(mapped.map(a => [a.code, a])).values()];
  }, [accounts]);

  // Preferred account handoff or default to ALL
  const preferred = sessionStorage.getItem('wayvida-open-account');

  // Control bar state
  const [selectedAccount, setSelectedAccount] = useState(() =>
    preferred && accountList.some(a => a.code === preferred) ? preferred : 'ALL'
  );
  const [query, setQuery] = useState('');
  const [range, setRange] = useState('This Financial Year');
  const [branch, setBranch] = useState('All Branches');
  const [cost, setCost] = useState('All Cost Centres');
  const [voucher, setVoucher] = useState('All Voucher Types');
  const [showZero, setShowZero] = useState(false);
  const [filters, setFilters] = useState(false);
  const [detail, setDetail] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Unique dropdown options
  const branchOptions = ['All Branches', ...new Set(transactionRows.map(row => row.branch).filter(Boolean))];
  const costOptions = ['All Cost Centres', ...new Set(transactionRows.map(row => row.cost).filter(Boolean))];

  // Active filter count for badge
  const appliedFilters = [
    branch !== 'All Branches' && branch,
    cost !== 'All Cost Centres' && cost,
    voucher !== 'All Voucher Types' && voucher,
    showZero && 'Zero Balance Accounts'
  ].filter(Boolean);

  function resetFilters() {
    setBranch('All Branches');
    setCost('All Cost Centres');
    setVoucher('All Voucher Types');
    setShowZero(false);
    setQuery('');
    setRange('This Financial Year');
    notify('Ledger filters reset');
  }

  // Account Group Calculation
  const accountGroups = useMemo(() => {
    let list = accountList;

    // Single account filter
    if (selectedAccount !== 'ALL') {
      list = list.filter(a => a.code === selectedAccount);
    }

    const q = query.trim().toLowerCase();

    return list
      .map(acc => {
        // Find movements for this account matching active non-account filters
        const movements = transactionRows.filter(
          x =>
            x.account === acc.code &&
            (branch === 'All Branches' || x.branch === branch) &&
            (cost === 'All Cost Centres' || x.cost === cost) &&
            (voucher === 'All Voucher Types' || x.type === voucher)
        );

        // Account-level search query matching
        const matchesAccName =
          acc.code.toLowerCase().includes(q) ||
          acc.name.toLowerCase().includes(q) ||
          acc.type.toLowerCase().includes(q);

        // Filter movements by query if user typed something
        const filteredMovements = q
          ? movements.filter(
              x =>
                matchesAccName ||
                [x.voucher, x.party, x.description, x.journal, x.reference].some(v =>
                  String(v || '').toLowerCase().includes(q)
                )
            )
          : movements;

        const opening = acc.opening;
        const isCreditNormal = acc.normal === 'Credit';

        // Calculate running balance per movement row
        let running = opening;
        const calculatedRows = filteredMovements.map(x => {
          const signed = isCreditNormal ? x.credit - x.debit : x.debit - x.credit;
          running += signed;
          const sign = running >= 0 ? (isCreditNormal ? 'Cr' : 'Dr') : isCreditNormal ? 'Dr' : 'Cr';
          return {
            ...x,
            running,
            runningSign: sign
          };
        });

        const debitTotal = filteredMovements.reduce((sum, x) => sum + x.debit, 0);
        const creditTotal = filteredMovements.reduce((sum, x) => sum + x.credit, 0);

        const netSigned = isCreditNormal ? creditTotal - debitTotal : debitTotal - creditTotal;
        const closing = opening + netSigned;
        const closingSign = closing >= 0 ? (isCreditNormal ? 'Cr' : 'Dr') : isCreditNormal ? 'Dr' : 'Cr';

        const hasActivity = filteredMovements.length > 0 || opening !== 0 || closing !== 0;

        return {
          account: acc,
          opening,
          openingSign: opening >= 0 ? (isCreditNormal ? 'Cr' : 'Dr') : isCreditNormal ? 'Dr' : 'Cr',
          movements: calculatedRows,
          debitTotal,
          creditTotal,
          closing,
          closingSign,
          hasActivity,
          matchesAccName
        };
      })
      .filter(g => {
        if (selectedAccount !== 'ALL') return true;
        if (q) return g.matchesAccName || g.movements.length > 0;
        if (!showZero) return g.hasActivity;
        return true;
      });
  }, [accountList, transactionRows, selectedAccount, query, branch, cost, voucher, showZero]);

  // Reset pagination on filter changes
  useMemo(() => {
    setCurrentPage(1);
  }, [selectedAccount, query, range, branch, cost, voucher, showZero, pageSize]);

  // Paginated account groups
  const totalAccountGroups = accountGroups.length;
  const totalPages = Math.max(1, Math.ceil(totalAccountGroups / pageSize));
  const paginatedGroups = useMemo(() => {
    if (selectedAccount !== 'ALL') return accountGroups;
    const start = (currentPage - 1) * pageSize;
    return accountGroups.slice(start, start + pageSize);
  }, [accountGroups, selectedAccount, currentPage, pageSize]);

  // Single Account Mode statistics
  const singleGroup = selectedAccount !== 'ALL' ? accountGroups[0] : null;

  return (
    <section className="gl">
      {/* 1. PAGE HEADER */}
      <header className="gl-heading">
        <div>
          <h1>{isEasy ? 'Account Activity' : 'General Ledger'}</h1>
          <p>{isEasy ? 'See all changes that increased or decreased a selected account.' : 'View account movements and running balances.'}</p>
        </div>
        <div className="gl-heading-actions">
          <label className="gl-account-picker">
            <select
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              aria-label="Select ledger account"
            >
              <option value="ALL">All Accounts</option>
              {accountList.map(a => (
                <option key={a.code} value={a.code}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </label>

          <button
            className={filters ? 'active' : ''}
            onClick={() => setFilters(!filters)}
            aria-expanded={filters}
          >
            <IconFilter size={17} />
            Filters
            {appliedFilters.length > 0 && (
              <span className="gl-filter-count">{appliedFilters.length}</span>
            )}
          </button>

          <details>
            <summary>
              <IconDownload size={17} />
              Export
              <IconChevronDown size={15} />
            </summary>
            <div>
              <button onClick={() => notify('Excel export prepared')}>
                <IconDownload size={16} />
                Export Excel
              </button>
              <button onClick={() => notify('PDF export prepared')}>
                <IconFileInvoice size={16} />
                Export PDF
              </button>
              <button onClick={() => window.print()}>
                <IconPrinter size={16} />
                Print ledger
              </button>
              <button onClick={() => notify('Ledger report email prepared')}>
                <IconMail size={16} />
                Email report
              </button>
            </div>
          </details>
        </div>
      </header>

      {/* EXPANDABLE FILTERS POPOVER */}
      {filters && (
        <div className="gl-filters-more">
          <div className="gl-filter-panel">
            <div>
              <IconAdjustments size={18} />
              <span>
                <b>Filter {isEasy ? 'Account Activity' : 'General Ledger'}</b>
                <small>Refine financial year, branch, cost centre and voucher types.</small>
              </span>
              <button onClick={() => setFilters(false)} aria-label="Close filters">
                <IconX size={18} />
              </button>
            </div>
            <section>
              <label>
                Financial year / Date range
                <select value={range} onChange={e => setRange(e.target.value)}>
                  <option>This Financial Year</option>
                  <option>This Month</option>
                  <option>This Quarter</option>
                  <option>Custom Range</option>
                </select>
              </label>
              <label>
                Branch
                <select value={branch} onChange={e => setBranch(e.target.value)}>
                  {branchOptions.map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Cost centre
                <select value={cost} onChange={e => setCost(e.target.value)}>
                  {costOptions.map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Voucher type
                <select value={voucher} onChange={e => setVoucher(e.target.value)}>
                  {[
                    'All Voucher Types',
                    'Sales Invoice',
                    'Purchase Bill',
                    'Receipt',
                    'Payment',
                    'Vendor Payment',
                    'Journal Entry',
                    'Credit Note',
                    'Debit Note'
                  ].map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="checkfield" style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px'}}>
                <input
                  type="checkbox"
                  checked={showZero}
                  onChange={e => setShowZero(e.target.checked)}
                />
                Include zero-movement accounts
              </label>
            </section>
            <footer>
              <button onClick={resetFilters} className="gl-filter-reset">
                <IconRefresh size={15} /> Reset filters
              </button>
              <button className="primary" onClick={() => setFilters(false)}>
                <IconCheck size={16} /> Apply filters
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* 3. COMBINED REPORT CARD (ACCOUNT CONTEXT, SUMMARY & LEDGER TABLE IN ONE SURFACE) */}
      <section className="gl-card gl-report-card">
        {selectedAccount !== 'ALL' && singleGroup ? (
          <div className="gl-report-header">
            <div className="gl-account-context-header">
              <div className="gl-account-context-left">
                <strong className="gl-account-title">
                  {singleGroup.account.code} · {singleGroup.account.name}
                </strong>
                <span className="gl-account-meta">
                  {singleGroup.account.group || singleGroup.account.type} · Normal {singleGroup.account.normal}
                </span>
              </div>
              <span className="gl-entry-count">
                {singleGroup.movements.length} {singleGroup.movements.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            <div className="gl-summary-container">
              <div className="gl-summary-item">
                <span className="gl-summary-label">{isEasy ? 'STARTING BALANCE' : 'OPENING BALANCE'}</span>
                <strong className="gl-summary-value">
                  {money(singleGroup.opening)} {singleGroup.openingSign}
                </strong>
              </div>
              <div className="gl-summary-item">
                <span className="gl-summary-label">{isEasy ? 'TOTAL INCREASE' : 'TOTAL DEBITS'}</span>
                <strong className="gl-summary-value">{money(singleGroup.debitTotal)}</strong>
              </div>
              <div className="gl-summary-item">
                <span className="gl-summary-label">{isEasy ? 'TOTAL DECREASE' : 'TOTAL CREDITS'}</span>
                <strong className="gl-summary-value">{money(singleGroup.creditTotal)}</strong>
              </div>
              <div className="gl-summary-item gl-summary-closing">
                <span className="gl-summary-label">{isEasy ? 'ENDING BALANCE' : 'CLOSING BALANCE'}</span>
                <strong className="gl-summary-value">
                  {money(singleGroup.closing)} {singleGroup.closingSign}
                </strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="gl-report-header">
            <div className="gl-account-context-header">
              <div className="gl-account-context-left">
                <strong className="gl-account-title">All Accounts</strong>
                <span className="gl-account-meta">Viewing posted movements across accounts</span>
              </div>
              <span className="gl-entry-count">
                {totalAccountGroups} {totalAccountGroups === 1 ? 'account' : 'accounts'}
              </span>
            </div>
          </div>
        )}

        <div className="gl-table-scroll" aria-label="General Ledger Table">
          <table className="gl-ledger-table gl-ledger-all-accounts">
            {/* STICKY COLUMN HEADER */}
            <thead>
              <tr>
                <th scope="col" style={{width: '12%', minWidth: '110px'}}>DATE</th>
                <th scope="col" style={{width: '15%', minWidth: '140px'}}>{isEasy ? 'DOCUMENT' : 'VOUCHER'}</th>
                <th scope="col" style={{width: '37%', minWidth: '240px'}}>{isEasy ? 'PARTY / DETAILS' : 'DETAILS'}</th>
                <th scope="col" style={{width: '12%', minWidth: '120px', textAlign: 'right'}}>{isEasy ? 'INCREASE (+)' : 'DEBIT'}</th>
                <th scope="col" style={{width: '12%', minWidth: '120px', textAlign: 'right'}}>{isEasy ? 'DECREASE (−)' : 'CREDIT'}</th>
                <th scope="col" style={{width: '12%', minWidth: '150px', textAlign: 'right', paddingRight: '24px'}}>BALANCE</th>
              </tr>
            </thead>
            <tbody>
              {paginatedGroups.map(group => {
                const {account, movements} = group;

                return (
                  <FragmentGroup key={account.code}>
                    {/* ACCOUNT GROUP HEADER ROW — RENDERED ONLY IN ALL ACCOUNTS MODE */}
                    {selectedAccount === 'ALL' && (
                      <tr className="gl-group-header-row">
                        <td colSpan={6}>
                          <div className="gl-group-header-content">
                            <span className="gl-group-code">{account.code}</span>
                            <span className="gl-group-name">{account.name}</span>
                            <span className="gl-group-meta">
                              {account.group || account.type} · Normal {account.normal}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* LEDGER MOVEMENTS */}
                    {movements.map(row => (
                      <tr key={row.id} className="gl-movement-row">
                        <td>
                          <div className="gl-date-cell">
                            <b>{dateText(row.date)}</b>
                          </div>
                        </td>
                        <td>
                          <div className="gl-voucher-cell">
                            <button
                              className="gl-voucher-link"
                              onClick={() => setDetail(row)}
                              title={`View ${row.voucher} source details`}
                            >
                              {row.voucher}
                            </button>
                            <small className="gl-voucher-type">{row.type}</small>
                          </div>
                        </td>
                        <td>
                          <div className="gl-details-cell">
                            {row.party && row.party !== '—' ? (
                              <>
                                <span className="gl-party-title">{row.party}</span>
                                {row.description && row.description !== row.party && (
                                  <small className="gl-narrative">{row.description}</small>
                                )}
                              </>
                            ) : (
                              <span className="gl-party-title">{row.description || `${row.type} posting`}</span>
                            )}
                          </div>
                        </td>
                        <td className="gl-money" title={isEasy && row.debit ? `Accounting entry: Debit ${money(row.debit)}` : undefined}>
                          {row.debit ? money(row.debit) : <span className="gl-empty-val">—</span>}
                        </td>
                        <td className="gl-money" title={isEasy && row.credit ? `Accounting entry: Credit ${money(row.credit)}` : undefined}>
                          {row.credit ? money(row.credit) : <span className="gl-empty-val">—</span>}
                        </td>
                        <td className="gl-money balance" style={{paddingRight: '24px'}}>
                          {money(row.running)} {row.runningSign}
                        </td>
                      </tr>
                    ))}
                  </FragmentGroup>
                );
              })}
            </tbody>
          </table>

          {/* EMPTY STATE */}
          {!accountGroups.length && (
            <div className="gl-empty">
              <IconBook size={32} />
              <h3>No posted ledger accounts found</h3>
              <p>Try resetting filters or searching for another account name or voucher.</p>
              <button onClick={resetFilters}>Reset filters</button>
            </div>
          )}
        </div>

        {/* 5. ACCOUNT GROUP PAGINATION FOOTER (Only in All Accounts Mode) */}
        {selectedAccount === 'ALL' && totalAccountGroups > 0 && (
          <footer className="gl-pagination">
            <div>
              <span>
                Showing accounts{' '}
                <b>
                  {(currentPage - 1) * pageSize + 1}–
                  {Math.min(currentPage * pageSize, totalAccountGroups)}
                </b>{' '}
                of <b>{totalAccountGroups}</b>
              </span>
            </div>
            <div style={{gap: '16px'}}>
              <label style={{display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px'}}>
                Accounts per page:
                <select
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  style={{
                    height: '28px',
                    padding: '0 8px',
                    borderRadius: '5px',
                    border: '1px solid #d9e1ec'
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
              <div style={{display: 'flex', gap: '4px'}}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <IconChevronLeft size={16} />
                </button>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    fontWeight: 600,
                    fontSize: '12px'
                  }}
                >
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <IconChevronRight size={16} />
                </button>
              </div>
            </div>
          </footer>
        )}
      </section>

      {/* SOURCE TRANSACTION DRAWER */}
      {detail && (
        <SourceDrawer
          row={detail}
          onClose={() => setDetail(null)}
          onJournal={() => {
            onNavigate('Journal Entries');
            notify('Opening ' + detail.journal);
          }}
          onSource={() => {
            onNavigate(detail.source);
            notify('Opening ' + detail.voucher);
          }}
        />
      )}
    </section>
  );
}

// React fragment wrapper for group rows
function FragmentGroup({children}) {
  return <>{children}</>;
}

// Source drawer
function SourceDrawer({row, onClose, onJournal, onSource}) {
  return (
    <>
      <button className="gl-scrim" onClick={onClose} aria-label="Close transaction details" />
      <aside className="gl-drawer">
        <header>
          <div>
            <small>Ledger transaction</small>
            <h2>{row.voucher}</h2>
          </div>
          <button onClick={onClose} aria-label="Close transaction details">
            <IconX size={18} />
          </button>
        </header>

        <span className="gl-posted">
          <IconCheck size={14} />
          Posted
        </span>

        <div className="gl-trace">
          <span>Source document</span>
          <i>→</i>
          <span>{row.journal}</span>
          <i>→</i>
          <span>Ledger entry</span>
        </div>

        <dl>
          {[
            ['Date', dateText(row.date)],
            ['Journal entry', row.journal],
            ['Voucher type', row.type],
            ['Party', row.party],
            ['Description', row.description],
            ['Branch', row.branch],
            ['Cost centre', row.cost],
            ['Reconciliation', row.reconciled ? 'Reconciled' : 'Unreconciled']
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <section>
          <p>Accounting impact</p>
          <strong>
            {row.debit ? 'Debit ' + money(row.debit) : 'Credit ' + money(row.credit)}
          </strong>
        </section>

        <footer>
          <button onClick={onJournal}>
            <IconBook size={16} />
            View journal
          </button>
          <button onClick={() => window.print()}>
            <IconDownload size={16} />
            Download PDF
          </button>
          <button className="primary" onClick={onSource}>
            <IconEye size={16} />
            View source
          </button>
        </footer>
      </aside>
    </>
  );
}
