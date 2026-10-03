import { useMemo, useState } from 'react';
import {
  IconArrowLeft,
  IconCheck,
  IconDownload,
  IconEye,
  IconFilter,
  IconHelp,
  IconInfoCircle,
  IconLock,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconUpload,
  IconX
} from '@tabler/icons-react';
import { money } from './invoice-engine.js';
import {
  autoMatchReconciliation,
  bookTransactions,
  completeReconciliation,
  createReconciliation,
  createStatementEntry,
  excludeStatement,
  importStatement,
  matchStatement,
  parseStatementCsv,
  reconciliationDetails,
  suggestMatches,
  unlockReconciliation
} from './banking-service.js';
import StatusPill from './StatusPill.jsx';
import EmptyState from './EmptyState.jsx';
import { DisabledActionReason, HelpDrawer, PageGuide } from './ContextualHelp.jsx';
import './invoice-workspace.css';
import './items.css';
import './vendors.css';
import './sales-orders.css';
import './status-pill.css';
import './banking.css';
import './banking-shell.css';

const today = () => new Date().toLocaleDateString('en-CA');
const startOfMonth = () => today().slice(0, 8) + '01';

export default function BankReconciliation({
  banking,
  db,
  active,
  onSelectBank,
  persist,
  notify,
  setError,
  onNavigate
}) {
  const [editing, setEditing] = useState(null);
  const [matchRow, setMatchRow] = useState(null);
  const [query, setQuery] = useState('');
  const [unlocking, setUnlocking] = useState(null);
  const [help, setHelp] = useState(false);

  const record = editing && banking.reconciliations.find(row => row.id === editing);
  const details = record ? reconciliationDetails(banking, db, record.id) : null;
  const suggestions = useMemo(() => (record ? suggestMatches(banking, db, record.id) : []), [banking, db, record]);
  const candidates = matchRow ? suggestions.find(row => row.statement.id === matchRow.id)?.candidates || [] : [];
  const history = banking.reconciliations
    .filter(row => !editing || row.id !== editing)
    .sort((a, b) => String(b.periodTo).localeCompare(String(a.periodTo)));

  const start = () => setEditing('new');

  function create(event) {
    event.preventDefault();
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const out = createReconciliation(banking, db, data);
      persist(out.banking);
      setEditing(out.reconciliation.id);
      notify('Reconciliation draft created');
    } catch (error) {
      setError(error.message);
    }
  }

  async function upload(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw Error('Upload a CSV bank statement to proceed with reconciliation matching.');
      }
      const rows = parseStatementCsv(await file.text());
      const out = importStatement(banking, record.bankAccountId, rows, {
        fileName: file.name,
        reconciliationId: record.id
      });
      persist(out.banking);
      notify(`${out.imported} statement transactions imported`);
    } catch (error) {
      setError(error.message);
    }
    event.target.value = '';
  }

  function auto() {
    try {
      const out = autoMatchReconciliation(banking, db, record.id);
      persist(out.banking);
      notify(`${out.matched} transactions matched automatically`);
    } catch (error) {
      setError(error.message);
    }
  }

  function confirmMatch(book) {
    try {
      persist(matchStatement(banking, matchRow.id, book).banking);
      setMatchRow(null);
      notify('Transaction matched');
    } catch (error) {
      setError(error.message);
    }
  }

  function categorize(row, kind) {
    try {
      const out = createStatementEntry(banking, db, row.id, kind);
      persist(out.banking, out.accounting);
      notify(`${kind} created and categorized`);
    } catch (error) {
      setError(error.message);
    }
  }

  function exclude(row) {
    try {
      persist(excludeStatement(banking, row.id));
      notify('Statement transaction excluded');
    } catch (error) {
      setError(error.message);
    }
  }

  function finish() {
    try {
      const out = completeReconciliation(banking, db, record.id);
      persist(out.banking);
      notify('Reconciliation completed and locked');
    } catch (error) {
      setError(error.message);
    }
  }

  function unlock(event) {
    event.preventDefault();
    try {
      const reason = new FormData(event.currentTarget).get('reason');
      const out = unlockReconciliation(banking, unlocking, { canUnlock: true, reason });
      persist(out.banking);
      setUnlocking(null);
      notify('Reconciliation unlocked');
    } catch (error) {
      setError(error.message);
    }
  }

  function exportCsv(row) {
    const detail = reconciliationDetails(banking, db, row.id);
    const lines = [
      ['Company', 'Wayvida Books'],
      ['Bank Account', detail.bank.accountName],
      ['Period', `${detail.periodFrom} to ${detail.periodTo}`],
      ['Opening Balance', detail.openingBalance / 100],
      ['Statement Balance', detail.statementBalance / 100],
      ['Book Balance', detail.bookBalance / 100],
      ['Difference', detail.difference / 100],
      [],
      ['Date', 'Description', 'Reference', 'Money In', 'Money Out', 'Status'],
      ...detail.rows.map(item => [
        item.date,
        item.description,
        item.reference,
        item.credit / 100,
        item.debit / 100,
        item.status
      ])
    ];
    const csv = lines.map(line => line.map(cell => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `reconciliation-${row.periodTo}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const reconTone = status => {
    const s = String(status || '').toLowerCase();
    if (s.includes('locked') || s.includes('complete')) return 'ok';
    if (s.includes('progress')) return 'info';
    if (s.includes('partially')) return 'warn';
    return 'neutral';
  };

  // =========================================================================
  // VIEW: CREATE NEW RECONCILIATION
  // =========================================================================
  if (editing === 'new') {
    return (
      <section className="itemsPage vendorsPage">
        <form className="itemCreatePage" onSubmit={create} noValidate>
          <div className="itemDialogHead">
            <button
              type="button"
              className="itemBack"
              aria-label="Back to Reconciliation history"
              onClick={() => setEditing(null)}
            >
              <IconArrowLeft size={19} />
            </button>
            <div className="itemHeadText">
              <h2>New Bank Reconciliation</h2>
              <small className="itemHeadHint">
                Select the bank account and statement period. Opening balance comes directly from the General Ledger.
              </small>
            </div>
          </div>

          <div className="itemDialogBody">
            <section className="itemSection">
              <div className="itemSectionTitle">Reconciliation Period &amp; Account</div>
              <div className="itemFormGrid">
                <label className="itemFieldWide">
                  Bank Account *
                  <select name="bankAccountId" required defaultValue={active?.id || ''}>
                    <option value="">Select bank account</option>
                    {banking.bankAccounts
                      .filter(row => row.status === 'Active')
                      .map(row => (
                        <option key={row.id} value={row.id}>
                          {row.bankName} · {row.accountName} (•••• {String(row.accountNumber || '').slice(-4)})
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Financial Year
                  <select name="financialYear" defaultValue="FY 2026–27">
                    <option>FY 2026–27</option>
                    <option>FY 2025–26</option>
                  </select>
                </label>

                <label>
                  Period Start Date *
                  <input name="periodFrom" type="date" required defaultValue={startOfMonth()} />
                </label>

                <label>
                  Period End Date *
                  <input name="periodTo" type="date" required defaultValue={today()} />
                </label>
              </div>

              <p className="itemNotice" style={{ marginTop: '16px' }}>
                <IconInfoCircle size={16} />
                The period cannot overlap an existing reconciliation for the same account. The opening balance is derived strictly from posted ledger transactions.
              </p>
            </section>
          </div>

          <footer className="itemDialogFooter">
            <button type="button" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className="primary" type="submit">
              <IconPlus size={16} />
              Create Reconciliation
            </button>
          </footer>
        </form>
      </section>
    );
  }

  // =========================================================================
  // VIEW: ACTIVE RECONCILIATION DETAIL / MATCH WORKSPACE
  // =========================================================================
  if (details) {
    const locked = ['Completed', 'Locked'].includes(details.status);
    const ready = details.difference === 0 && details.unmatchedAmount === 0;
    const filtered = details.rows.filter(row =>
      [row.date, row.description, row.reference, row.status].join(' ').toLowerCase().includes(query.toLowerCase())
    );

    return (
      <section className="invoiceWorkspace purchaseWorkspace ivDetailOpen">
        <div className="ivDetailHead">
          <button
            type="button"
            className="ivDetailBack"
            aria-label="Back to reconciliation history"
            onClick={() => setEditing(null)}
          >
            <IconArrowLeft size={19} />
          </button>
          <div className="ivDetailHeadText">
            <h2>{details.bank.accountName}</h2>
            <small>
              {details.periodFrom} – {details.periodTo} · {details.financialYear}
            </small>
          </div>
          <div className="ivActions" style={{ marginLeft: 'auto' }}>
            <StatusPill status={details.status} tone={reconTone(details.status)} />
            {!locked && (
              <button className="primary" disabled={!ready} onClick={finish}>
                <IconLock size={16} />
                Complete &amp; Lock
              </button>
            )}
          </div>
        </div>

        <div className="ivDetailBody" style={{ padding: '20px 24px' }}>
          <div className="reconProgress" style={{ marginBottom: '16px' }}>
            {['Select account', 'Import statement', 'Match & review', 'Complete'].map((label, index) => (
              <span
                className={index <= (locked ? 3 : details.rows.length ? 2 : 1) ? 'active' : ''}
                key={label}
              >
                <b>{index + 1}</b>
                {label}
              </span>
            ))}
          </div>

          <div className="ivDetailStats" style={{ marginBottom: '16px', background: '#fff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #dfe6ef' }}>
            <span>
              <small>Opening Balance</small>
              <strong>{money(details.openingBalance)}</strong>
            </span>
            <span>
              <small>Book Balance</small>
              <strong>{money(details.bookBalance)}</strong>
            </span>
            <span>
              <small>Statement Balance</small>
              <strong>{money(details.statementBalance)}</strong>
            </span>
            <span>
              <small>Matched Amount</small>
              <strong style={{ color: '#16a34a' }}>{money(details.matchedAmount)}</strong>
            </span>
            <span>
              <small>Unmatched Amount</small>
              <strong style={{ color: details.unmatchedAmount ? '#ea580c' : '#64748b' }}>
                {money(details.unmatchedAmount)}
              </strong>
            </span>
            <span>
              <small>Difference</small>
              <strong style={{ color: details.difference === 0 ? '#16a34a' : '#dc2626' }}>
                {money(details.difference)}
              </strong>
            </span>
          </div>

          {details.difference !== 0 && (
            <div className="reconWarning" style={{ marginBottom: '10px' }}>
              <strong>Your reconciliation has an unexplained difference of {money(details.difference)}.</strong>
              <span>Review unmatched lines or record missing bank fees, interest, or transactions.</span>
            </div>
          )}

          <div className="ivCard ivRegisterCard" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="ivHeading" style={{ borderBottom: '1px solid #e2e8f0', padding: '10px 16px', background: '#fafbfc' }}>
              <div className="registerHeadText">
                <h3 style={{ fontSize: '15px', margin: 0, fontWeight: 650 }}>Statement Transactions</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  Import bank CSV, auto-match against GL ledger entries, or resolve exceptions.
                </p>
              </div>
              <div className="ivTools">
                <label className="ivToolSearch">
                  <IconSearch size={17} />
                  <input
                    aria-label="Search statement"
                    placeholder="Search statement date, description, reference..."
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                  />
                </label>
              </div>
              <div className="ivActions">
                {!locked && (
                  <>
                    <label className="bankImport button ghost" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #cbd5e1', padding: '7px 12px', borderRadius: '6px', fontWeight: 600, fontSize: '13px' }}>
                      <IconUpload size={16} />
                      Import CSV Statement
                      <input type="file" accept=".csv" onChange={upload} style={{ display: 'none' }} />
                    </label>
                    <button className="secondary" type="button" onClick={auto}>
                      <IconSparkles size={16} />
                      Auto match
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="ivScroll">
              <table className="ivInvoiceTable">
                <thead>
                  <tr>
                    <th style={{ width: '10%' }}>Date</th>
                    <th style={{ width: '32%' }}>Description &amp; Reference</th>
                    <th style={{ width: '15%', textAlign: 'right' }}>Amount (In / Out)</th>
                    <th style={{ width: '12%' }}>Category</th>
                    <th style={{ width: '12%' }}>Matched With</th>
                    <th style={{ width: '12%' }}>Status</th>
                    <th style={{ width: '7%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 500, color: '#0f172a' }}>{row.date}</td>
                      <td>
                        <div style={{ color: '#0f172a', fontWeight: 400, fontSize: '13px', lineHeight: '1.4' }}>{row.description}</div>
                        {row.reference && <small style={{ display: 'block', marginTop: '3px', color: '#64748b', fontSize: '12px' }}>Ref: {row.reference}</small>}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <strong style={{ color: row.credit ? '#16a34a' : '#ea580c', fontWeight: 650 }}>
                          {row.credit ? `+${money(row.credit)}` : `-${money(row.debit)}`}
                        </strong>
                        <small style={{ display: 'block', marginTop: '3px', color: '#64748b', fontSize: '11px' }}>
                          {row.credit ? 'Money In' : 'Money Out'}
                        </small>
                      </td>
                      <td>{row.category || '—'}</td>
                      <td>
                        <code>
                          {row.matchedWith || banking.bankMatches.find(m => m.statementId === row.id)?.journalId || '—'}
                        </code>
                      </td>
                      <td>
                        <StatusPill status={row.status} tone={row.status === 'Matched' ? 'ok' : row.status === 'Categorized' ? 'info' : 'neutral'} />
                      </td>
                      <td>
                        <div className="ivRowActions">
                          {!locked && row.status === 'Unmatched' && (
                            <>
                              <button type="button" onClick={() => setMatchRow(row)}>
                                Match
                              </button>
                              {row.credit > 0 && (
                                <button type="button" onClick={() => categorize(row, 'Customer receipt')}>
                                  Receipt
                                </button>
                              )}
                              {row.debit > 0 && (
                                <button type="button" onClick={() => categorize(row, 'Expense')}>
                                  Expense
                                </button>
                              )}
                              <button type="button" onClick={() => exclude(row)}>
                                Exclude
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtered.length && (
                <EmptyState
                  variant="adjustment"
                  title="No statement transactions imported"
                  description="Import a CSV statement file from your bank to begin reconciling."
                />
              )}
            </div>
            <div className="ivActions purchaseRegisterFoot">
              <span>{filtered.length} of {details.rows.length} lines</span>
            </div>
          </div>

          <div className="reconComplete" style={{ marginTop: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '16px' }}>
                {locked ? 'Reconciliation locked' : ready ? 'Ready to complete' : 'Review & Resolve Exceptions'}
              </h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                {locked
                  ? 'Matched entries and statement data are protected from editing.'
                  : ready
                  ? 'All statement lines are resolved and balances agree with General Ledger.'
                  : 'Resolve unmatched transactions and bring the difference to zero.'}
              </p>
            </div>
            {!locked && (
              <DisabledActionReason
                reasons={
                  details.unmatchedAmount > 0
                    ? ['Resolve unmatched statement transactions']
                    : details.difference !== 0
                    ? ['Bring the reconciliation difference to zero']
                    : []
                }
              >
                <button className="primary" disabled={!ready} onClick={finish}>
                  <IconCheck size={16} />
                  Complete reconciliation
                </button>
              </DisabledActionReason>
            )}
          </div>
        </div>

        {matchRow && (
          <div className="bankDrawerBackdrop" onClick={() => setMatchRow(null)}>
            <aside className="bankMatchDrawer" onClick={event => event.stopPropagation()}>
              <header>
                <div>
                  <span>Manual Matching</span>
                  <h2>Match Bank Transaction</h2>
                </div>
                <button type="button" aria-label="Close drawer" onClick={() => setMatchRow(null)}>
                  <IconX />
                </button>
              </header>
              <dl>
                <dt>Date</dt>
                <dd>{matchRow.date}</dd>
                <dt>Amount</dt>
                <dd style={{ fontWeight: 600 }}>{money(matchRow.credit || matchRow.debit)}</dd>
                <dt>Description</dt>
                <dd>{matchRow.description}</dd>
              </dl>
              <h3>Compatible Ledger Transactions</h3>
              {candidates.map(candidate => (
                <button className="matchCandidate" key={candidate.id} onClick={() => confirmMatch(candidate)}>
                  <span>
                    <b>{candidate.reference || candidate.journalId}</b>
                    <small>
                      {candidate.date} · {candidate.description}
                    </small>
                  </span>
                  <strong>{money(candidate.moneyIn || candidate.moneyOut)}</strong>
                </button>
              ))}
              {!candidates.length && (
                <p style={{ color: '#64748b', fontSize: '13px' }}>
                  No compatible posted receipts, payments, expenses, or transfers with exact matching amounts were found.
                </p>
              )}
            </aside>
          </div>
        )}
      </section>
    );
  }

  // =========================================================================
  // VIEW: RECONCILIATION HISTORY LIST
  // =========================================================================
  const filteredHistory = history.filter(row => {
    if (!active?.id) return true;
    return row.bankAccountId === active.id;
  });

  return (
    <section className="invoiceWorkspace purchaseWorkspace">
      <div className="ivHeading registerHead">
        <div className="registerHeadText">
          <h2>Bank Reconciliation</h2>
          <p>Import statement → match transactions → resolve differences → complete and lock.</p>
        </div>
        <div className="ivTools">
          <select
            aria-label="Filter by bank account"
            style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
            value={active?.id || ''}
            onChange={event => onSelectBank(event.target.value)}
          >
            <option value="">All bank accounts</option>
            {banking.bankAccounts.map(row => (
              <option key={row.id} value={row.id}>
                {row.accountName} ({row.bankName})
              </option>
            ))}
          </select>
        </div>
        <div className="ivActions">
          <button className="ghost" onClick={() => setHelp(true)}>
            <IconHelp size={16} />
            How it works
          </button>
          <button className="primary" onClick={start}>
            <IconPlus size={16} />
            New Reconciliation
          </button>
        </div>
      </div>

      <PageGuide page="Bank Reconciliation" onOpen={() => setHelp(true)} />

      <div className="ivCard ivRegisterCard" style={{ marginTop: '16px', padding: 0, overflow: 'hidden' }}>
        <div className="ivScroll">
          <table className="ivInvoiceTable">
            <thead>
              <tr>
                <th>Period &amp; Created By</th>
                <th>Bank Account</th>
                <th style={{ textAlign: 'right' }}>Closing / Opening</th>
                <th style={{ textAlign: 'right' }}>Difference</th>
                <th>Status</th>
                <th>Completed By &amp; Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map(row => {
                const bank = banking.bankAccounts.find(item => item.id === row.bankAccountId);
                return (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.periodFrom} to {row.periodTo}</strong>
                      <small style={{ display: 'block', marginTop: '3px', color: '#64748b' }}>{row.financialYear || 'FY 2026–27'} · By {row.createdBy || 'Admin'}</small>
                    </td>
                    <td><strong>{bank?.accountName || 'Bank Account'}</strong></td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong style={{ display: 'block', fontWeight: 650 }}>
                        {row.statementClosingBalance == null ? '—' : money(row.statementClosingBalance)}
                      </strong>
                      <small style={{ display: 'block', marginTop: '3px', color: '#64748b', fontSize: '11px' }}>
                        Op: {money(row.openingBalance)}
                      </small>
                    </td>
                    <td style={{ textAlign: 'right', color: row.difference ? '#ea580c' : '#16a34a', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
                      {row.difference == null ? '—' : money(row.difference)}
                    </td>
                    <td>
                      <StatusPill status={row.status} tone={reconTone(row.status)} />
                    </td>
                    <td>
                      <strong>{row.completedBy || row.reconciledBy || '—'}</strong>
                      {row.completedAt && (
                        <small style={{ display: 'block', marginTop: '3px', color: '#64748b' }}>
                          {new Date(row.completedAt).toLocaleDateString('en-IN')}
                        </small>
                      )}
                    </td>
                    <td>
                      <div className="ivRowActions">
                        <button
                          type="button"
                          className="ivIconButton"
                          aria-label={'View reconciliation ' + row.id}
                          title="View Reconciliation"
                          onClick={() => setEditing(row.id)}
                        >
                          <IconEye size={17} />
                        </button>
                        <button type="button" onClick={() => exportCsv(row)}>
                          <IconDownload size={15} />
                          Report
                        </button>
                        {['Completed', 'Locked'].includes(row.status) && (
                          <button type="button" onClick={() => setUnlocking(row.id)}>
                            Unlock
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredHistory.length && (
            <EmptyState
              variant="adjustment"
              title="No reconciliations yet"
              description="Create a reconciliation period to verify statement transactions against the General Ledger."
            />
          )}
        </div>
        <div className="ivActions purchaseRegisterFoot">
          <span>{filteredHistory.length} reconciliation periods</span>
        </div>
      </div>

      {help && <HelpDrawer page="Bank Reconciliation" onClose={() => setHelp(false)} onNavigate={onNavigate} />}

      {unlocking && (
        <div className="bankDrawerBackdrop" role="presentation">
          <form className="bankDialog small unlockDialog" onSubmit={unlock}>
            <header>
              <div>
                <span>Controlled Action</span>
                <h2>Unlock Reconciliation</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setUnlocking(null)}>
                <IconX />
              </button>
            </header>
            <div className="bankDialogBody">
              <label>
                <span>Reason for unlocking *</span>
                <textarea
                  name="reason"
                  required
                  placeholder="Explain why this completed reconciliation is being reopened..."
                  style={{ minHeight: '90px', width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setUnlocking(null)}>
                Cancel
              </button>
              <button className="primary" type="submit">
                Unlock
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
