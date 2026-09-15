# Banking Requirements Audit

**Document status:** Verified implementation audit  
**Last verified:** 2026-09-07  
**Sources:** `src/Banking.jsx`, `src/banking-service.js`, `src/banking.css`, `src/banking-shell.css`, `tests/banking.test.mjs`, `tests/banking-ui.test.mjs`, and the supplied Banking requirements.

## Verdict

**Overall status: Partially implemented.** The prototype has a sound accounting foundation and a usable three-page Banking interface, but it does not yet satisfy the full professional banking specification.

## Requirement matrix

| Area | Status | Verified behavior or gap |
|---|---|---|
| Navigation | Implemented | Keeps Bank Accounts, Transactions, and Reconciliation only. |
| Book versus statement separation | Implemented | Posted journals produce book transactions; statement imports create separate bank transaction records and do not post journals. |
| Bank-to-COA linkage | Implemented | Each bank account links to one active posting Assets account; book balance derives from posted journal lines. |
| Bank account master fields | Partial | Bank name, account name/number, type, IFSC, branch, currency, status, ledger, balance, and last-reconciled display exist. Unreconciled amount is not shown on account cards. |
| Bank account detail | Missing | There is no dedicated summary/details surface with all requested actions and advanced settings. |
| Transaction grid | Implemented | Compact Date, Description, Reference, Money In, Money Out, Balance/Status/Actions grids are present with responsive card reflow. |
| Transaction source | Partial | Statement and Book sources exist. Manual and future Bank Feed source contracts are not modelled as controlled values. |
| Statement import | Partial | CSV import, validation, audit, and duplicate skipping work. Native Excel import is not implemented even though the file control advertises `.xlsx`. |
| Matching | Partial | Exact amount matching and date-plus-amount suggestions work without duplicate journals. There is no confidence score, reference/name/payee logic, Ignore action, partial match, or unmatch workflow. |
| Unmatched categorization | Partial | Bank charge, interest income, and exclusion are supported. Generic Create Expense and Create Journal flows are missing. |
| Duplicate protection | Partial | A fingerprint and one-active-match guard exist. The fingerprint does not cover an external transaction ID or source transaction, and transfer idempotency depends on user-supplied reference/date/account/amount. |
| Bank rules | Missing | No rules store, settings interface, suggestion engine, or audit behavior exists. |
| Bank transfer | Implemented | Bank-to-bank transfer posts one balanced journal and respects active accounts and period locking. |
| Cash transfer | Missing | Cash-to-bank and bank-to-cash workflows are not supported. |
| Customer receipt connection | Partial | Posted receipt journals can affect the linked bank ledger and appear in its book register. Receipt bank lines/matches use a separate receipt-specific store and are not unified with Banking statement matches. |
| Vendor payment connection | Partial | Posted vendor-payment journals affect the bank ledger and appear in the book register. End-to-end vendor sub-ledger/report verification is outside the Banking tests. |
| Reconciliation calculation | Partial | Book balance, imported statement balance, difference, matched amount, and unmatched amount are calculated without overwriting the ledger. The date is fixed to today and no user-entered closing balance/period exists. |
| Reconciliation completion | Missing | There is no Reconcile command that persists a reconciliation record, prevents historical mutation, or records reconciler/date. |
| Reconciliation history | Missing | The schema contains `reconciliations`, but there is no creation service or history UI. |
| Source/journal/ledger navigation | Missing | Book rows contain a journal ID, but the Details button has no navigation or drawer. Source transaction and ledger navigation are absent. |
| Audit trail | Partial | Account create/edit, import, match, exclude, transfer, and categorized entries are audited. Reconciliation and richer relationship events are missing. |
| Roles and permissions | Missing | UI and service operations currently assume `Admin`; permissions are not enforced. |
| Responsive UI | Partial | Headers, account cards, forms, and transaction rows reflow on narrow screens. At the audited narrow viewport, two-column metric cards can clip long currency values and need one-column fallback or smaller responsive typography. |
| Acceptance scenario | Partial | Automated tests cover account linkage, transfer, non-posting import, duplicate import, matching without duplicate journals, bank charge, exclusion, reconciliation calculation, and balanced demo journals. They do not cover the full receipt/vendor/customer/report/reconciliation-history scenario. |

## Accounting assessment

The implemented foundation follows the correct source-of-truth rule:

1. Business or categorized banking action creates a journal only when accounting is required.
2. Posted journal lines update the linked Chart of Accounts bank ledger.
3. Banking derives book balance and book transactions from those journal lines.
4. Importing or matching a statement does not create a second journal.
5. Statement balance remains separate from book balance.

These invariants are covered by `tests/banking.test.mjs`. The prototype is not yet production complete because reconciliation is calculated but cannot be formally completed and persisted.

## Recommended implementation order

1. Add reconciliation period, statement closing date/balance, completion command, immutable history, and audit events.
2. Add a transaction details drawer with source document, journal, ledger, match reason, and audit navigation.
3. Implement explicit match suggestions with confidence/reasons, Ignore, Unmatch, and partial matching.
4. Implement native Excel parsing and correct the import control/copy until it is available.
5. Add generic Create Expense/Create Journal categorization and cash transfer support through the existing accounting engine.
6. Add bank rules as secondary settings, with suggestion-only behavior by default.
7. Add permission checks and unify receipt statement matching with the Banking store or a shared bank-match service.
8. Extend integration tests through receipt, vendor payment, reconciliation completion, ledgers, Trial Balance, and financial reports.

## Visual evidence limits

Bank Accounts, Bank Transactions, and Bank Reconciliation were captured and inspected in the current local preview at a narrow viewport. Static inspection confirms labels and responsive structure, but keyboard order, screen-reader announcements, contrast ratios, large zoom behavior, and desktop/tablet breakpoints require dedicated accessibility and multi-viewport testing.
