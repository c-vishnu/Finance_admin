# Known Gaps and Roadmap

**Last verified:** 2026-09-05  
**Primary sources:** repository inspection and existing root reviews.

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
- Implement production financial statements, GST/TDS reports, closing balances and financial-year rollover.
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

The Period Closing prototype is navigable, styled, persistent, audited, and covered by domain tests. It is not a production lock: browser storage and simulated roles can be bypassed, and the operational transaction engines do not yet share an authenticated server-side command boundary. Production work must enforce the period policy atomically with every dated mutation.

