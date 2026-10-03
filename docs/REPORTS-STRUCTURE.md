# Reports structure

**Last verified:** 2026-09-29

> **Report toolbar update — 2026-09-29:** the heading action row now carries a date-range preset dropdown (`All dates`, `Today`, `This week`, `This month`, `This year`, `Custom selection`) beside the search box and the `Filters` disclosure, and ONE `Export` button whose dropdown holds the report own exports. Where a sentence below still describes `Export Excel` and `Export PDF` as two side-by-side buttons, the dropdown supersedes it. See `docs/REPORT-TOOLBAR.md`.

The `Reports` sidebar group is a tree of seven named groups followed by the `Audit Log` leaf. The tree is declared once in `src/Navigation.jsx` and every report page is mounted through `createPortal` into the shared `.transactionPortal`; `src/App.jsx` excludes each report route name from the operational-module switch and from the welcome banner.

```text
Reports
├── Transaction Reports    Transaction Register · Day Book · Journal Report
├── Accounting Reports     General Ledger · Account Statement · Trial Balance
├── Financial Statements   Profit & Loss · Balance Sheet · Cash Flow Statement
├── Receivables & Payables Customer Outstanding · Customer Aging · Supplier Outstanding · Supplier Aging
├── Cash & Banking         Cash & Bank Book · Bank Reconciliation
├── Tax & Compliance       GST / Tax Reports · TDS Reports
├── Business Reports       Sales Report · Purchase Report · Expense Report
└── Audit Log
```

The leaf label is the sidebar text; where a leaf opens a differently named module the route name is given in brackets, and the route name - not the label - is what `src/App.jsx` matches.

| Leaf | Route name | Page |
|---|---|---|
| Transaction Register | Transaction Register | `src/TransactionRegister.jsx` |
| Day Book | Day Book | `src/DayBook.jsx` |
| Journal Report | Journal Report | `src/JournalReport.jsx` |
| General Ledger | General Ledger | `src/GeneralLedgerPro.jsx` |
| Account Statement | Account Statement | `src/AccountStatement.jsx` |
| Trial Balance | Trial Balance | `src/TrialBalance.jsx` |
| Profit & Loss | Profit & Loss | `src/ProfitLoss.jsx` |
| Balance Sheet | Balance Sheet | `src/BalanceSheet.jsx` |
| Cash Flow Statement | Cash Flow Statement | `src/CashFlowStatement.jsx` |
| Customer Outstanding | Customer Outstanding | `src/CustomerOutstanding.jsx` |
| Customer Aging | Customer Aging | `src/CustomerAging.jsx` |
| Supplier Outstanding | Supplier Outstanding | `src/SupplierOutstanding.jsx` |
| Supplier Aging | Supplier Aging | `src/SupplierAging.jsx` |
| Cash & Bank Book | Cash & Bank Book | `src/CashAndBankBook.jsx` |
| Bank Reconciliation | Bank Reconciliation Report | `src/BankReconciliationReport.jsx` |
| GST / Tax Reports | GST Reports | `src/GstTaxReports.jsx` |
| TDS Reports | TDS Reports | `src/TdsReports.jsx` |
| Sales Report | Sales Report | `src/SalesReport.jsx` |
| Purchase Report | Purchase Report | `src/PurchaseReport.jsx` |
| Expense Report | Expense Report | `src/ExpenseReport.jsx` |
| Audit Log | Audit Log | `src/AuditLog.jsx` |

## What the restructure added

Four report groups were added as explicit groups - `Transaction Reports`, `Accounting Reports`, `Financial Statements` and `Receivables & Payables` - and the pre-existing `Cash & Banking`, `Tax & Compliance` and `Business Reports` groups were kept and reordered to sit below them. Four destinations did not exist and were built:

- `Journal Report` - the line-level listing of the posted ledger.
- `Account Statement` - the statement of ONE ledger account over a date range.
- `Customer Aging` and `Supplier Aging` - the shared aging grid over the two subledgers.

The restructure is a navigation and reporting change only. No accounting engine, store, posting path or balance was touched, and no figure in any pre-existing report moved.

## Journal Report

One row per POSTED journal LINE, in date order, with its account, debit and credit, so the two sides of the ledger can be read straight from the sheet. Eight columns: Date, Journal ID, Type, Reference, Account, Particulars, Debit, Credit. `src/journal-report.js` is the pure projection.

`type` is the Day Book's own `transactionType(source)` (`src/daybook-service.js`), re-used rather than redefined, so a sales invoice is stated as `Sales Invoice` here and in the Day Book. A draft or unposted document has no journal at all and therefore contributes nothing; a REVERSED journal keeps its lines and is marked `Reversal` rather than being removed, so the debit and credit totals of the period always describe the ledger as it stands. The period's own tie is asserted (`debitsEqualCredits`, `scopeBalanced`, `everyVoucherBalanced`, `voucherTotals`, `noNegativeAmounts`) and printed, never assumed.

The projection is deliberately line-level: the voucher totals are stated BESIDE the listing rather than replacing it. When one account is picked the totals become that account's SCOPE totals, which do not have to tie; the page says so, and the four invariants that must hold whatever the scope (`everyVoucherBalanced`, `voucherTotals`, `noNegativeAmounts`) are still re-derived from the voucher's own lines.

## Account Statement

The statement of ONE account, for a bank or a customer: the opening balance immediately BEFORE the range, every movement in date order with the balance the ledger itself carries after it, and the closing balance. Eight columns: Date, Journal ID, Type, Reference, Particulars, Debit, Credit, Balance. `Account` is a REQUIRED choice rather than a filter, because a statement is only ever about one ledger; it seeds from and writes back to `sessionStorage['wayvida-open-account']`, so opening the statement from the Chart of Accounts or the General Ledger lands on the account the working context handed over.

`src/account-statement.js` is the pure projection. Balances are stated on the account's own NORMAL SIDE - Assets and Expenses are debit-normal, Liabilities, Equity and Income are credit-normal - which is the same rule `src/trial-balance.js` and `src/balance-sheet.js` apply, so a statement can never report a balance with the opposite sign to those reports. `opening + movements === closing` holds by construction.

`closing` is the balance inside the selected branch and date scope; `ledgerClosing` is the balance of the WHOLE ledger through the To date, computed with no reference to the rows, the range or the branch that produced the statement, so a closing balance can never be proved against itself. `difference = ledgerClosing - closing` is stated and never absorbed: a branch statement legitimately holds only that branch's share of the account, and the page prints that difference rather than failing the report for it. An unknown or missing account is a stated empty state (`Select an account to see its statement.` / `No ledger accounts found.`), never a silent fallback to another ledger.

## Customer Aging and Supplier Aging

ONE aging grid over the receivables and payables subledgers, rendered by the ONE component `src/AgingReport.jsx`; `src/CustomerAging.jsx` and `src/SupplierAging.jsx` are thin wrappers that pick the subledger (`kind="customer"` / `kind="supplier"`). Nine columns: the party, its open document count, the six aging buckets and the total. Six filters: As of, Branch, Aging, Party and the shared search.

Aging is a RESTATEMENT of Customer Outstanding and Supplier Outstanding, never a second subledger: `src/aging.js` reads `customerOutstanding` and `supplierOutstanding` and only turns the party list into the grid an accountant reads, so the bucket columns of a party always add up to exactly the balance the outstanding report states for it. The two subledgers must age on the same vocabulary and the keys are COMPARED once (`sameAgingVocabulary`) rather than assumed.

A bucket is a range of DAYS PAST THE DOCUMENT'S OWN DUE DATE, never a range of document age. The buckets are `Not Yet Due`, `Due Today`, `1–30 Days Overdue`, `31–60 Days Overdue`, `61–90 Days Overdue` and `90+ Days Overdue`; the ranges are contiguous and never overlap, so no day is counted twice or missed. `Not Yet Due` and `Due Today` are inside the terms and are therefore never part of the overdue figure.

## Files

| File | Role |
|---|---|
| `src/Navigation.jsx` | Declares the tree and mounts each report through `.transactionPortal` |
| `src/App.jsx` | Routes each report route name and excludes it from the module switch and welcome banner |
| `src/journal-report.js`, `src/JournalReport.jsx` | Journal Report projection and page |
| `src/account-statement.js`, `src/AccountStatement.jsx` | Account Statement projection and page |
| `src/aging.js` | The ONE shared aging projection |
| `src/AgingReport.jsx` | The ONE shared aging page |
| `src/CustomerAging.jsx`, `src/SupplierAging.jsx` | The two aging routes |
| `src/report-pages.css` | Column widths for the three new table shapes only |

`src/report-pages.css` deliberately does NOT redeclare `.cbPage` or any other shell class: the whole report shell (header, caption, summary cards, sticky equation, filters, print metadata, pager) stays owned by `src/cash-banking.css`, and the new sheet adds only the three new column-width sets plus one `max-width: 1100px` rule that returns the tables to `table-layout: auto`.

## Verification

`tests/reports-navigation.test.mjs` holds the tree, the four import-and-portal mounts and the two `src/App.jsx` guards. `tests/report-restructure.test.mjs` holds the arithmetic of the three new projections - the aging grid against the AR/AP control account, the statement identity and its normal side, the journal listing's one-row-per-posted-line and its voucher proofs - plus the empty states and the read-only guards. `tmp/reports-render.mjs` renders all four new pages in-process through `react-dom/server` and asserts 29 contracts; `tmp/nav-render.mjs` parses the rendered sidebar and asserts the seven groups and their leaves in order.

## Deliberate limitations

- The brief's tree omits the pre-existing standalone `Purchase Reports` leaf. The leaf is REMOVED from the sidebar to match the brief exactly, but the route itself is deliberately kept in `src/App.jsx` (`a==='Purchase Reports'?<PurchaseReports onNavigate={setA}/>`), so the aggregate page remains reachable by name and re-adding a leaf later costs one line. It is a different module from the `Purchase Report` leaf under Business Reports; do not merge, rename or delete either.
- The four new pages read browser storage (`wayvida-accounting-v1`, `wayvida-customers`, `wayvida-vendors-v1`) through the existing stores, as every other report does. Browser storage is prototype persistence, not a production database.
- Aging depends on each document's stored `dueDate`. A document with no due date cannot be bucketed by days past due and is stated in the not-yet-due bucket rather than guessed into an overdue one.
