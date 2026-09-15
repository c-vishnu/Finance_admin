# Day Book implementation

## 1. Current status and gaps
Implemented a read-only Day Book over the existing persisted journal ledger. No sample transactions are invented. Modules that do not yet post into that ledger will not appear. This remains a local prototype, not a production accounting backend.

## 2. Navigation and experience
Reports → Day Book; direct route `?view=daybook`. One report heading, compact summary cards, filters, complete voucher grid and a details panel. Simple view is the default; accounting details reveal dimensions and audit filters. All text remains at least 12px.

## 3. Filters
Inclusive dates with Today, This Month, Financial Year and All Time presets; search, transaction type, company, branch, financial year, status, creator, approval, cost centre, department and project. Missing stored metadata is Unassigned or Not recorded, never inferred from the decorative application header. Dimension filters match on one journal line but retain the whole voucher and its balancing lines.

## 4. Accounting and summaries
Official rows come only from Posted journals. Debit and credit use stored integer paise. Count and turnover cards derive from the filtered report. Reversals offset source-type activity cards; both original and reversal remain in debit/credit turnover. Sales/purchase cards are gross voucher activity, not P&L revenue; credit/debit notes remain separate types. Any malformed or individually unbalanced voucher raises a warning, even when aggregate totals happen to balance.

## 5. Source documents and drill-down
Journal lines link to the existing account ledger view. Invoice and credit-note links open existing source views; receipts link to their related invoice. Customer ledger and Trial Balance are available. Missing source records do not erase journal history. Sources without an existing detail screen retain their recorded reference rather than presenting a fake editor.

## 6. Lifecycle and audit
Unposted documents are a separate, explicitly non-accounting tab and never contribute to official totals. Cancelled posted originals and reversal entries are retained. The panel displays recorded source events, approval metadata and related reversals. It cannot reconstruct historical metadata that was never saved. There are no create, edit, delete, approve or reverse commands in Day Book.

## 7. Data dependencies and production boundary
Projection reads journals, accounts and available source collections from the existing shared store without posting or rewriting data. Refresh runs on demand, storage/focus changes and every 15 seconds. Production requires a server query API, authenticated RBAC, company isolation, immutable audit retention and server-enforced period locks; local filters and view toggles are not security controls.

## 8. Exports
CSV and Excel-compatible SpreadsheetML (.xml) contain all filtered vouchers plus filters, generation metadata and debit/credit totals. Print / Save PDF uses the browser print dialog with landscape report styling. It is not a server-generated PDF or native .xlsx file. CSV formula-leading input is escaped; XML strings are encoded.

## 9. Product comparison
[Tally Day Book](https://help.tallysolutions.com/day-book-tally/) provides a voucher-oriented daily overview. This implementation deliberately excludes its transaction-entry/edit actions to honor the read-only requirement. [Zoho Books journals](https://www.zoho.com/uk/books/help/accountant/manual-journal.html) distinguish journal lifecycle and reporting; Day Book consumes posted records rather than duplicating entry. [SAP Business One journal overview](https://learning.sap.com/courses/utilizing-sap-business-one-web-client-accounting/exploring-journal-entries) emphasizes source-linked journal visibility. QuickBooks-style transaction drill-down is a design comparison only; feature parity with QuickBooks or these products is not asserted.

## 10. Acceptance and follow-up
Automated coverage verifies posted-only scope, reversals, balanced whole-voucher filters, malformed records, missing sources, audit isolation and export escaping. Existing accounting tests must remain green. Future backend work should add paginated report queries, streaming exports, source APIs for remaining modules and permission-aware audit access without altering invoice data collection.
