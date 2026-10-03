# Cash & Banking: Cash & Bank Book and Bank Reconciliation

**Last verified:** 2026-09-29

> **Report toolbar update — 2026-09-29:** the heading action row now carries a date-range preset dropdown (`All dates`, `Today`, `This week`, `This month`, `This year`, `Custom selection`) beside the search box and the `Filters` disclosure, and ONE `Export` button whose dropdown holds the report own exports. Where a sentence below still describes `Export Excel` and `Export PDF` as two side-by-side buttons, the dropdown supersedes it. See `docs/REPORT-TOOLBAR.md`.

The Cash & Banking section is the sidebar group `Cash & Banking` inside `Reports` and holds exactly two leaves: `Cash & Bank Book` and `Bank Reconciliation` (route name `Bank Reconciliation Report`). The group sits immediately before the `Audit Log` leaf, after the `Business Reports` group. `src/Navigation.jsx` imports `src/CashAndBankBook.jsx` and `src/BankReconciliationReport.jsx` and mounts each through `createPortal` into the shared `.transactionPortal`; `src/App.jsx` excludes both route names from the operational-module switch and from the welcome banner. `src/cash-banking.js` is the ONE pure projection behind both pages and `src/cash-banking.css` is the ONE sheet they share.

Every figure is read back from the record that already owns it, so this section is a projection and never a second set of books. There is no Cash & Banking store: the two pages read `readAccounts()` (`src/account-store.js`) for the chart and the posted journal, `readBanking()` (`src/banking-service.js`) for the bank accounts, the imported statement rows and the matches, and nothing else.

## Cash & Bank Book

The Cash & Bank Book answers one question: what money moved through my cash and bank accounts, and what do those accounts hold. It is a transaction-level book, not a statement - one row per POSTED journal line that touched an eligible account, in date order, with the running balance the ledger itself carries. The Cash Flow Statement classifies the same movements into operating, investing and financing activity; the Cash & Bank Book never does, so the two can never become each other.

The eligible accounts are the ones the Chart of Accounts already classifies as money, through `isMoneyAccount` (`src/simple-journal-transaction.js`, matching `cash|bank|wallet` in the account name, group, nature or purpose) narrowed to ACTIVE, non-group `Assets` accounts. No account code is ever named in the module, so a configured UPI, wallet or payment-gateway ledger is stated under its own account and is never folded into `Cash`. A ledger merely named after a bank with no cash-or-bank wording and no group is not eligible; a ledger named `Bank Charges` but typed `Expenses` is not a money account either. `cashBankAccounts(state)` is the single exported rule; the page offers exactly those accounts in its Account filter.

Date From, Date To, Account and Branch decide which movements are in the book at all, so they move the opening balance, the closing balance, every account total and the row pool. Transaction Type, Reconciliation Status and Search narrow which of those movements are LISTED, so they move the receipts and payments of the rows shown and leave the account's ledger balance on the reconciliation strip instead of silently unbalancing the report. The accounts total is always the ledger's own:

    opening + receipts - payments === closing === ledgerClosing

`opening` is the balance the ledger holds immediately before Date From (read through `bookBalance`, `src/banking-service.js`, so the ledger rule has one definition), not the sum of the rows inside the range. `ledgerClosing` is the balance through Date To. `difference` is `ledgerClosing - closing` and is reported, never forced to zero. Six `checks` re-derive each figure from the rows that claim to summarise it and `valid` is `checks.every(check => check.ok)`.

A row is identified by `cb:<journalId>:<accountCode>:<lineIndex>`. The bank account code belongs in the key because a transfer between two of the business's own money accounts puts a line on each side of one journal, so no two lines of one journal can share an id. A journal whose every leg is one of those accounts is marked `internal` on both sides: it is stated once on each account, and `internalTransfers` is the movement it contributes to the combined position - which is zero by construction - so a transfer is never counted as income or expense.

The running balance is stated only when exactly one account is selected, because a combined running balance across unrelated accounts would be meaningless. Across every account the Balance column is left blank and each account's own opening, receipts, payments and closing balance is stated in the `Account balances` block above the register, with `groups[]` supplying those rows. The page states a grand-total `<tfoot>` row, pages 25 rows by default with 25 / 50 / 100 through the shared `.pagination-footer` pager, and prints `Showing N of M transactions`. Row actions hand an account off through `sessionStorage['wayvida-open-account']` to the General Ledger.

A reconciliation word is never guessed from a date or an amount. `Reconciled` is read from the `bankMatches` row the Banking module's own matching workflow wrote, `Excluded` from a statement line carrying the same reference on the same account that was excluded, and `Unreconciled` from an eligible account with no match. A cash account has no statement to be checked against, so it stays `Posted`. The four words and their tones are stated on the shared `StatusPill`.

## Bank Reconciliation

The Bank Reconciliation report answers one question: do the transactions in Wayvida match the transactions the bank shows. It is a control report. Matching a statement line records a match; it never creates revenue or expense and never moves a ledger balance.

The bank account is required and is offered only from the bank accounts the Banking module already holds, each linked to a cash-and-bank ledger, so an ordinary expense or revenue account is never selectable. The summary is the Banking module's own `reconciliationSummary(banking, accounting, bankId, {from, to})`, so the book balance, the statement balance, the reconciled amount, the unreconciled amount and the difference are the figures the reconciliation workspace states for the same period. `bookBalance` is re-derived through `bookBalance(books, bank.accountCode, upto)` by the `balancesFromLedger` check rather than restated.

The table merges the two sides: a matched pair is stated once with both amounts and a zero difference, a statement-only line is stated with its bank amount and a blank book amount, and a book-only line is stated with its book amount and a blank bank amount. An amount that does not exist is left blank rather than shown as zero, because a zero would claim the transaction was seen and agreed. Amounts carry the direction of the movement: a receipt or deposit is positive, a payment or withdrawal negative. Six `checks` re-derive the summary and the rows.

A period with no imported statement line has no statement balance, so `statementAvailable` is false and the report says `Not available` on the Bank Statement Balance and Difference cards and `No bank statement has been imported for this period` on the strip, instead of inventing a figure. When the selected account has no imported statement and no book line either, the table states `No bank statement has been imported for this account and period.` with an `Import Statement` action. With no bank account at all the report states `No bank reconciliation data found.` with an `Open Banking` handoff.

The row menu is the shared `OutstandingActions`. `Match` is offered only on an unmatched statement line, `View Statement Line` on any matched statement line, and `View Transaction` on any row with a book side; every one of them opens the workflow that owns the record - the Banking workspace through `sessionStorage['wayvida-open-bank']` and `onNavigate('Bank Reconciliation')`, or the ledger through `sessionStorage['wayvida-open-account']`. This report never creates, changes or removes a match, so it holds no second match control and prints no second transaction page.

## Exports

`cashBankBookExportRows(report, ctx)` and `bankReconciliationExportRows(report, ctx)` build the sheets the pages hand to the shared `excelReport` / `downloadReport` from `src/daybook-export.js`. Both state an identity block (organisation, branch, account, date range and every active filter), the summary figures, then one row per transaction with the same columns the page shows. Money leaves the engine in integer paise and is stated in rupees in the sheet; a value that does not exist is the report's own dash (`\u2014`), never a zero. Export PDF prints the same page through `window.print()`, and the stylesheet's `@media print` block hides the shell chrome (`body:has(.cbPage)`) and neutralises the shared portal (`.transactionPortal:has(.cbPage)`), prints every page of rows rather than the one on screen, and hides the pager.

## Deliberate limits

- Statement import is CSV-only and is reused from the existing Banking flow; this section imports nothing itself.
- Matching is a presentation and control surface only. `bookBalance` is untouched by a match, and the report never posts, edits, reverses, matches or adjusts anything.
- Reconciled / Unreconciled / Excluded come only from the Banking module's own records. There is no tolerance-based or rule-based auto-suggestion on these pages.
- No combined running balance is stated across accounts, because it would be meaningless; per-account opening and closing balances are stated instead.
- The projections read only. The module never calls the tax engines, never calls a journal or posting command, and never writes a store.

## Source and tests

- `src/cash-banking.js` - the pure projection: `cashBankAccounts`, `cashBankBook`, `cashBankBookExportRows`, `bankReconciliation`, `bankReconciliationExportRows`, plus `ALL`, `financialYearStart`, `DASH`, `POSTED`, `RECONCILIATION_STATUSES` and `CASH_BANK_STATUSES`.
- `src/CashAndBankBook.jsx`, `src/BankReconciliationReport.jsx` - the two portal-mounted pages.
- `src/cash-banking.css` - the shared sheet; it deliberately does not redeclare `.transactionPortal`, which stays owned by `src/transaction-register.css`.
- `tests/cash-banking.test.mjs` - 18 tests over the eligibility rule, the filters, the balances, the reconciliation summary, the empty states and the exports.
- `tmp/cash-banking-render.mjs` - renders both real pages through `react-dom/server` when the browser is unavailable.
