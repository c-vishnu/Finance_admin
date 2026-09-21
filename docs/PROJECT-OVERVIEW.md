# Project Overview

**Last verified:** 2026-09-14  
**Primary sources:** `src/App.jsx`, `src/Navigation.jsx`, `src/invoice-engine.js`, `AGENTS.md`.

## Product

Wayvida Books is an Indian accounting ERP prototype intended to let non-accountants perform normal business operations while an accounting engine produces balanced journals, ledgers, tax effects, and reports. Accountants and administrators receive deeper controls for Chart of Accounts, journals, reconciliation, reporting, and period closure.

## Users

- **Business user:** creates customers, items, sales documents, receipts, expenses, and payments without choosing debit/credit lines.
- **Accountant:** reviews journals and ledgers, manages accounts, reconciles activity, closes periods, and requests controlled corrections.
- **Administrator:** manages companies, branches, roles, tax/account mappings, document templates, and period controls.

Role behavior is a product target. Current role selectors are local simulations and are not security boundaries.

## Product principles

1. Operational input stays simple; accounting mappings come from master data.
2. Every posted journal must balance exactly.
3. Money is calculated in integer paise to avoid floating-point posting errors.
4. Sales orders never post accounting; invoices and financial transactions do.
5. Posted history is immutable; correction uses reversal, credit note, or adjustment.
6. GST follows place-of-supply logic and mapped liability accounts.
7. Reports derive from posted journals, not editable dashboard totals.
8. Company is the root entity; branch and cost centre are accounting dimensions.

## Current capability map

| Area | Status | Notes |
|---|---|---|
| Dashboard | Prototype only | Rich financial dashboard using realistic sample values; not a real-time backend aggregate. |
| Company and branches | Prototype only | Setup/list UI and header selectors exist, and one shared scope rule (`src/organisation-scope.js` plus the `OrganisationBranchScope` control) decides when an organisation or branch selector is needed across Chart of Accounts, Journal Lines, the Period Lock Create Lock drawer and the request unlock drawer, reading the header's working context through `src/organisation-context.js`; production tenant isolation is planned. |
| Chart of Accounts | Implemented prototype | Hierarchy, create/edit/deactivate in a right-side drawer with a searchable account-group combobox, opening journals, mapping settings, ledger drill-down, and the shared horizontal three-dot row menu. Account scope and the grid's Organisation/Branch columns come from the shared organisation/branch scope module, so a single-branch organisation hides its one-option picker and a branch from another organisation can never be selected. |
| Items and customers | Prototype only | Browser-local masters and forms. |
| Sales orders | Implemented prototype | Shared sales fields, validation, conversion to invoice draft; no accounting posting. |
| Sales invoices | Implemented prototype | GST calculation, lifecycle actions, journals, ledger/report projections. |
| Credit notes | Implemented prototype | Invoice-linked limits, issue/application/cancellation reversal. |
| Receipts | Implemented prototype | Draft/approval/posting, allocations, advances, matching, reconciliation, reversal. |
| Journal entries | Implemented prototype | Automatic and manual views/forms; source and ledger drill-down; register row actions use the shared horizontal three-dot menu. |
| General Ledger | Implemented prototype | Posted-journal projection with account/date/dimension/voucher/status filters, balance movements, reconciliation state, and journal/source drill-down. Seeded rows are retained only when no posted journal state exists. |
| Trial Balance and reports | Prototype only | Derived reporting views exist; production report coverage is incomplete. |
| Day Book | Implemented prototype | Read-only projections from posted journals; unposted documents isolated. |
| Document templates | Implemented prototype | Preview, print, share summary, customization drawer, local preferences. |
| Period Lock | Implemented prototype | Navigable period-closing register with soft/hard locks, a right-side locking policy popup holding one headingless settings card with two toggle switches (enable automatic locking, require approval to unlock) around the closing schedule, manual and automatic lock creation, a Locked Periods / Requests toggle beside a search box and one Filters disclosure whose panel holds Period, Status and the Financial Year, Organisation, Branch, Closed By and Closed Type filters, a compact never-dismissible Before you close attention pill in the heading actions whose popover reads the failing checks and their entries-affected total before Review all opens the pre-close drawer, a current accounting period popup opened from More actions, unlock approval and an audit trail, all browser-local; the More actions menu holds only Current accounting period and Period closing settings, the filtered register is the only lock list because the lock history drawer was removed, and the unlock Requests half is one seven-column, pageless table (Period, a combined Organisation & Branch cell, Reason, Requested, Requested By, Status and Actions) whose Status cell carries the page badge and whose row menu adds View Details, and a request is viewed, approved, withdrawn or deleted through one View button beside one 3-dot menu (Approve, Cancel, View Details, Delete), every filtered request on one page behind a combined Organisation & Branch column and a Status column, with the Hard Lock / Soft Lock lock type withheld from the period details drawer; authoritative backend enforcement is planned. |
| Purchases, banking, expenses, assets, tax, budgets | Planned/placeholder | Navigation exists; full domain engines are not present. |

## Current limitations

- The application is frontend-only and stores operational data in browser `localStorage`.
- There is no real identity provider, server authorization, database transaction, API, job queue, or multi-user concurrency control.
- Some dashboards and General Ledger examples use seeded or demonstrative data rather than a single production-grade reporting source.
- Navigation is primarily React state under one route; deep-link support is limited.
- Uploads and shares are demonstrations; they are not backed by secure object storage or delivery services.

## Product direction

The production system should retain the current domain boundaries while replacing browser persistence with a tenant-aware transactional backend, explicit command APIs, immutable journal storage, authorization policies, audit events, period locks, and database-derived reporting projections.
