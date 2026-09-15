# Credit Notes implementation

Credit Notes reuse the existing browser-local accounting repository (`wayvida-accounting-v1`), tax calculator, balanced journal writer, general ledger and financial reports. They are not an independent accounting store. Existing invoices and customer data are preserved.

## Workflow

Create against a posted invoice → Save Draft → Submit for Approval → Approve → Issue → Apply Credit.

Issuing posts debit adjustment/contra-revenue, debit output-tax components, and credit the original invoice's receivable account. Draft/approval do not post. Price/Sales Return/Other adjustments need an explicitly selected Income account in Credit Notes → Account mapping; select a contra-revenue account if your chart contains one. Tax-only adjustments have zero revenue reversal and credit only the calculated tax reduction. Every credit line is bounded by the original line's remaining taxable value, each tax component, and total. Sales returns additionally enforce cumulative returned quantities. Issue revalidates current remaining allowances; duplicate issue/application requests are idempotent.

Invoice balances and customer net receivables are distinct: issue reduces customer net receivables while creating unapplied credit; application changes invoice allocation only, without another journal. Net receivable = total issued invoices − payments − issued credit notes. Invoice outstanding = invoice total − payments − active credit applications. Available credit = issued notes − active applications. Only same-customer invoices using the same receivable control account can receive applications. Independent credits, refunds and cross-control-account transfers are intentionally rejected/not offered.

Cancellation reverses the original journal, retains history, and voids applications so invoice balances reopen. Related invoice cancellation is blocked while active issued credits or allocations exist. GST register includes both original posted documents and dated reversals; it is a transaction register, not a filed statutory return.

## UI integration

- Sales → Credit Notes: searchable, sortable, paginated list and customer/date/reason/status filters.
- Note detail: Overview, Applications, Accounting and Audit trail.
- Customers → Statement & credits: derived net receivable, available credit, invoiced, paid and credited totals; statement references drill down to source documents.
- GST: signed posted tax documents with GSTIN snapshots when available, original invoice link, taxable value and component taxes.
- Journal/GL/Trial Balance/Financial Statements share the same journal data; GL credit references open the note.

## Production boundaries

This is a functional local prototype, NOT a production-ready backend. Authorization and approver roles, tamper-proof audit retention, multi-user database transactions/locks, closed-period controls, server numbering/idempotency constraints, backups, and statutory GST/e-invoice/credit-note eligibility checks are still required before real financial use. Existing user identity is the prototype Admin. Current GST master values are captured where historic invoice snapshots are absent; absent GSTIN is shown as Not captured rather than invented.

There is an item master but no stock movement, valuation or COGS subsystem. Sales Return validates quantities and posts customer/revenue/tax adjustments; it does not invent stock or COGS movements. The UI explicitly discloses this. Tax adjustments represent component-rate reductions on an entered base, not jurisdiction reclassification. Export/SEZ/RCM/UTGST/specific cess and tax-period compliance require a reviewed backend extension.

Tests: `node --test tests/credit-note.test.mjs tests/invoice-engine.test.mjs tests/sales-order.test.mjs tests/sites-worker.test.mjs` after build/packaging. Tests cover ₹118,000 invoice → ₹23,600 credit → ₹94,400 receivable; ₹10,000 and ₹13,600 allocations; balanced journals, reports, statement, tax register, over-credit/over-application protection, tax-only treatment, quantity limits, cancellation and idempotency.
