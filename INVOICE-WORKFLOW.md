# Sales invoice workflow

## Implemented

The existing React prototype now has an invoice service (`src/invoice-engine.js`) shared by invoice posting, receipts, general ledger, trial balance and financial statements. Values are stored in integer paise. A command clones the repository, validates all entries and returns a new snapshot. The UI commits that snapshot with one localStorage write; a failed command does not partially persist a journal.

Storage key: `wayvida-accounting-v1`. Existing customers, items, sales orders and original sample balances are retained. The historical sample balances are not balanced opening journals, so reports explicitly show the live invoice ledger only. Customer lists show invoice outstanding separately from their original opening-balance field. Account details show live invoice movement separately from sample balances.

Lifecycle is separate from derived payment status. Drafts create no entries. Approve & post freezes the document, debits receivables, credits income and output tax, and adds a rounding entry when required. Receipts debit cash/bank and credit the invoice's frozen receivable account. Overdue is derived without journals. Repeated post/payment requests are idempotent. Cancellation of unpaid posted invoices adds reversing entries; cancellation with receipts is blocked rather than silently deleting or refunding payments.

Sales order conversion creates one linked invoice draft per source order. GST, payment terms and order adjustments require review before posting; an order's TDS is not automatically treated as invoice GST. The button labelled Mark as sent records a status only; it does not send email.

## Verification

Run `node --test tests/invoice-engine.test.mjs`.
Tests cover the ₹100,000 service + ₹18,000 GST invoice, zero journals at draft, balanced posting, bank receipt, zero final receivable, partial payments, overdue, excess-payment rejection, duplicate requests, reversals, missing mappings, discounts and interstate tax.

The browser demo was created as INV-0001 for the existing ABC Retail customer, posted and fully paid. Trial Balance and Balance Sheet reconciled; P&L showed ₹100,000 income excluding GST.

## Production boundary

This is a local, single-user prototype, not a production financial backend. Browser storage is editable and not a tamper-proof audit system. Before production replace persistence with database transactions, authorization, tenant-scoped foreign keys, unique constraints, idempotency keys, optimistic locking, closed-period checks and an append-only server audit log. Browser-local persistence is not a cross-tab or multi-user transaction guarantee.

The GST calculator demonstrates regular domestic ad-valorem supplies based on explicit place of supply. It is not a complete statutory tax engine: special place-of-supply rules, UTGST, SEZ/export/zero-rated supplies, reverse charge, specific cess, e-invoicing/IRN, filing and statutory credit notes need a reviewed implementation. Tax rates must be verified against current requirements. Posting assumes the invoiced service/goods qualify for immediate revenue recognition; deferred revenue and inventory/COGS workflows are not implemented here.

Original manual journal/sample dashboard functionality remains a separate legacy prototype; those sample transactions do not feed the new reports. Backend integration, credit notes/refunds, overpayments, period closing and legal compliance remain required before real business use.
