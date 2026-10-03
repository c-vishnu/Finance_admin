# Known Gaps and Roadmap

**Last verified:** 2026-09-29  
**Primary sources:** repository inspection and existing root reviews.

## Report toolbar limitations - 2026-09-29

- The report pages were verified by rendering every page through `react-dom/server` and by fetching every changed module from the preview server, NOT by clicking the controls in a live browser: the in-app browser automation refuses to run in this session. The dropdown open, preset pick and export-menu behaviour therefore rest on the pure arithmetic in `tests/report-toolbar.test.mjs` and the rendered markup, not on a live interaction.
- `src/GeneralLedgerPro.jsx` renders a `Date range` select that filters nothing, and always has: the ledger rows come from the whole posted journal and the select only feeds the filter count badge and the card head. It now offers the shared vocabulary (`Today`, `This week`, `This month`, `This year`, `All dates`, `Custom selection`) but is still display-only. A real ledger range would have to filter the posted ledger and is not part of this change.
- The preset dropdowns are browser-local UI over dates the reports already held. Scheduled reports, server-side date filtering and a generated PDF (Export PDF is the application print path) remain planned, like the rest of the report family.

## Business Reports limitations - 2026-09-29

- The Expense Report cannot state a rupee tax figure, and this is a data-model limitation rather than a missing feature. `src/operations-store.js` stores one `amount` and a `tax` LABEL (`No tax`, `GST 5%`, `GST 12%`, `GST 18%`, `GST 28%`) per expense, and the expense posting debits the expense account and credits the payment account for the whole amount with no separate input tax line, so how much of the expense was tax is not recorded anywhere. The report prints the recorded rate label and no rupee tax figure, and states `Recorded as a rate` on its Tax card. Stating a rupee tax total would require the operations store to persist a tax component (or a tax-inclusive/exclusive flag) at recording time; until then nothing in the report may derive one.
- The optional Salesperson, Item and Item Category filters are absent from the Sales Report and the Purchase Report, and the optional Item Category filter from Purchase. No invoice, purchase bill or line record carries a salesperson, an item id or an item category that a projection could filter on, so offering those controls would mean inventing a value the documents do not have.
- The Expense Report's Branch filter is rendered only when an expense actually carries a branch (read from the journal it posted), because an expense recorded with no branch context would otherwise offer a control that could only ever empty the table. Making the Expense Report scoped by branch in every case requires the operations store to record the branch on the expense itself.
- The Business Reports are browser-local projections read at view time. Server-side report queries, scheduled report delivery and a generated PDF (Export PDF is the application's print path) remain planned, like the other reports in the family.
## Prototype UI gaps - 2026-09-16

- The Inventory Adjustments confirmation dialog header is still caught by the legacy global app-bar element rule. `src/inventory-adjustments.css` styles the title block as `.iaModal>header` but never resets `position`, and `src/styles.css` declares an unscoped `header{position:fixed;z-index:10;top:0;left:206px;right:0;height:58px;...}`, so that title block is pulled out of `.iaModal` and printed as a 58px fixed bar instead of sitting inside the dialog. The Create Item section cards, the Period Lock cards and the budget and account drawers already carry a scoped `header` reset; this dialog does not. Reported, not fixed - the change that found it touched only the Create Item page.

## COA production gaps after the enterprise prototype upgrade

- Organisation and branch selectors are locally simulated; production isolation requires authenticated tenant IDs and server-enforced row-level access.
- Manual account-code override permission, mapping approvals, and system-account administration require backend roles.
- CSV import is implemented; native `.xlsx` parsing and vendor-specific Tally/Zoho/QuickBooks migration adapters remain planned.
- Existing module mappings use current configuration and account codes. A dedicated server-backed Accounting Settings → Account Mapping administration screen remains planned.
- Production consolidation and branch elimination rules remain planned.

## P0 — accounting integrity before production

- Replace browser persistence with a transactional company-scoped database and authenticated API.
- Make journals and audit events immutable after posting.
- Centralize every operational posting in one accounting command boundary.
- Enforce the implemented period policy from every dated server-side save/post/reverse/import/allocation command.
- Establish one reporting source from posted journal lines; remove demonstrative ledger/dashboard divergence.
- Implement server-enforced permissions, approvals and segregation of duties.

## P1 — complete core bookkeeping

- Build purchase bills, vendors, vendor payments and debit notes with automatic journals.
- Complete banking, statement import, matching and reconciliation.
- Complete expense and asset/depreciation engines.
- Implement production financial statements, closing balances and financial-year rollover. Statutory GST/TDS RETURNS (GSTR-1, GSTR-3B, TDS returns and every other filing) are a deliberate NON-GOAL for the Tax & Compliance section: its GST / Tax Reports and TDS Reports pages are accounting-level views over posted documents and prepare no return, and the GSTR-1 / GSTR-3B projections were deleted on 2026-09-29.
- Add document sequences per company/branch/year with transactional uniqueness.
- Add secure attachments and production document delivery.

## P2 — operational maturity

- Move the rebuilt budget prototype to a server-backed planning/approval engine; add recurring documents, notifications, scheduled filings and approval inboxes.
- Add database-backed configurable templates and PDF generation.
- Add observability, backups, recovery, performance testing, localization and accessibility verification.
- Introduce typed contracts, schema migrations and API compatibility/versioning.

## Settings audit — 2026-09-07

The grouped Settings Center and versioned browser-storage contract are implemented. Organization, accounting, transaction, sales/purchase, banking, expense, asset, inventory, GST/TDS, notification, automation and numbering preferences can be configured locally; dependencies and value limits are validated.

Highest-priority gap: move settings, roles, numbering and posting validation to one authenticated backend command boundary. Until then, business-module enforcement is partial and browser storage can be bypassed. Next connect `requireBranch`, `maxDiscount`, backdate/future-date limits, approval thresholds, GST visibility and system-controlled account restrictions to every applicable create/post command. Then add effective-dated settings, immutable settings audit, role/branch scope resolution, transactional number allocation, import validation, real integrations, and recoverable backups.

## Period-control production gap

The Period Lock prototype is navigable, styled, persistent, audited, and covered by domain tests. It is not a production lock: browser storage and simulated roles can be bypassed, and the operational transaction engines do not yet share an authenticated server-side command boundary. Production work must enforce the period policy atomically with every dated mutation.

