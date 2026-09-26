# Day Book

**Last verified:** 2026-09-26

`src/DayBook.jsx` is a read-only chronological report whose presentation follows the existing global header role switch: Business owner is the simple Business View, while Accountant is the detailed Accounting View. There is no second page-local view switch. Business View uses simple transaction names and amounts; Accounting View exposes voucher number, accounts, debit and credit. The title, search, Filters disclosure, export action, analytic cards, table and sticky debit/credit balance check share one invoice-style white report surface; obsolete voucher-count, read-time and auto-refresh copy and the former 15-second refresh timer are removed. It still refreshes on an explicit focus or shared-store change. `src/daybook-service.js` projects only `status:'Posted'` journals from the shared accounting store; it never posts, recalculates, edits, deletes, or creates accounting data. Transaction date is the journal date, so a backdated posting appears on its accounting date.

The report resolves the source document only for presentation and drill-down. Sales invoices, purchase invoices, receipts, payments, credit/debit notes, journals and transfers all derive their debit and credit impact from the same journal lines. Every matching voucher stays whole: account, branch and other dimension filters choose a voucher when a matching line exists, then retain every line and its original debit/credit totals. This prevents an apparently unbalanced partial voucher.

Only posted journals are official Day Book activity. Drafts remain in the separate review view and do not affect totals. Cancelled source documents are excluded by default and are visible only through the explicit cancelled option. Reversals remain visible so the audit trail is not erased. The balance validation requires every included voucher to balance and total debit to equal total credit.

The header states the selected/current organisation, branch and financial year. The local Posted Transactions / Pending Review selector is deliberately absent. Search stays directly beside one Filters button, followed by Export PDF. The filter panel owns date range, transaction type, organisation, branch, account, customer, supplier, creator, status and cancelled visibility. The detail view shows source metadata, audit events and all journal lines, and hands off to the original transaction or Chart of Accounts without enabling edits. Source, audit and account details that do not exist are labelled rather than inferred.

Exports are read-only CSV/Excel reports and printing provides the PDF path. Export metadata includes report identity, company/filter scope, date range, generator, generation time and debit/credit totals. The local role selector and browser storage are prototype simulations, not permission enforcement.

Validation: `node --test tests/daybook.test.mjs`; `npm run docs:check`; `npm run build`.
