# Wayvida Books — Accounting Architecture Review

Reviewed 4 September 2026. Scope: current source implementation and isolated, in-memory checks. No live accounting data, application screens or transaction workflows were changed. This is an enhancement plan, not certification of financial or statutory compliance.

## 1. Current ERP Accounting Architecture Review

**Overall: Partial.** The product already demonstrates business transactions generating balanced journals. It does not yet implement a complete organization-wide accounting system.

Working local flow: invoice posting / receipt posting / credit-note issue → shared journal collection → ledger and aggregate financial statements. Account openings also use that journal generator. Sales orders correctly remain non-posting.

The application is a React prototype whose financial records live in browser storage. `worker/index.js` serves assets and the app shell; it is not an accounting API. Browser storage, local actor labels and an Operator/Manager switch cannot provide production authorization, database atomicity, audit immutability or tenant isolation.

Primary evidence:
- `src/invoice-engine.js`: `command`, `journal`, `outstanding`, `ledger`, `reports`.
- `src/receipt-engine.js`: receipt lifecycle, allocation, advance transfer, reversal and receipt-only period checks.
- `src/credit-note-service.js`: issue/application/reversal and customer statement projections.
- `src/account-master.js`, `src/account-settings.js`: master protections, tax settings and openings.
- `src/App.jsx`: routes, placeholder modules, hard-coded dashboard and non-persistent manual-journal UI.
- `src/daybook-service.js`: read-only posted-journal projection.

Verification: 38 existing domain tests passed in this review. Isolated synthetic checks additionally confirmed direct Draft-to-posted invoice processing, posting within a receipt-closed period, fallback revenue mapping and inclusion of an injected Draft journal in `reports`. These checks did not touch localStorage or real transactions. Passing tests demonstrate supported cases, not completeness.

## 2. Current vs Required Architecture Comparison

| Layer | Current | Required |
|---|---|---|
| Business transactions | Sales-side workflows partly connected; purchase-side routes mostly placeholders | Every confirmed financial activity uses the same posting boundary |
| Validation | Module-specific functions | Shared checks plus transaction-specific validators |
| Approval | Invoice posting can bypass submission; receipts/credits have separate lifecycles | Configurable, server-enforced policies with recorded decisions |
| Accounting rules | Embedded in transaction functions | Versioned business-event rules resolving semantic account roles |
| Mapping | Mixed global defaults and customer/item snapshots | Deterministic company-scoped resolver with explicit permitted fallbacks |
| Tax | Basic explicit GST components; TDS configuration only | Effective-dated tax determination, eligibility, withholding and accounting |
| Dimensions | Required branch/cost-centre checks if supplied | Validated company/branch/cost-centre/department/project relationships |
| Posting | Balanced local journal append | Atomic, idempotent, authorized posting transaction |
| Ledger / statements | Recalculated from shared journals, incompletely scoped | Posted-only, period/company/dimension-scoped projections |
| Dashboard | Sample metrics and charts | Same posted-ledger and subledger projections as reports |
| Audit | Local arrays and partly hard-coded identities | Actor-derived, append-only audit committed with each event |

## 3. Missing Components

1. Complete Purchase Bill, Expense, Vendor Payment and Debit Note transaction engines.
2. Vendor/AP and expense-category masters connected to posting, plus actual inventory movements where needed.
3. One posting/approval/period-lock service shared by all financial entry paths, including legacy payment and opening paths.
4. Central semantic mapping and effective-dated tax-policy resolution.
5. Authenticated roles, legal-entity isolation, durable persistence, transactional locking and audited reversals.
6. As-of-date receivable/payable reports, reconciliation controls, Cash/Bank Books and classified Cash Flow Statement.
7. Live dashboard projections and consistent navigation into source records.
8. A genuine manual-adjustment workflow replacing simulated success actions, without removing the module.

## 4. Incorrect Accounting Flows and Control Gaps

### P0 — Inconsistent receivable mapping
Invoice posting uses `s.config.ar`; receipt creation uses `Customer.account || s.config.ar`. If Customer Master maps to 1110 but the invoice posts to 1100, a receipt adopts 1110 and allocation rejects the mismatch. Unallocated receipt posting may still credit the different account. Resolve both through the same policy. For settlement of existing invoices, honor the original receivable-account snapshot; split posting lines by original account where necessary. Do not rewrite historical journals when a master mapping changes.

### P0 — Approval is not consistently enforced
`command('post')` accepts Draft and Pending Approval invoices, then sets `posted=true` and `status='Approved'`. There is no separate recorded approval decision for that route. Receipts and credit notes have stronger local lifecycle gates, but none has authenticated authorization. Keep existing labels if needed, but separate approval status from posting state underneath and require an explicit policy decision.

### P0 — Period closing is local to receipts
`config.receipts.closedThrough` applies inside the receipt service only. Invoice posting, invoice cancellation, credit-note issue/cancellation and opening entries do not use that common lock. An isolated invoice posted successfully inside a receipt-closed period. Enforce a central legal-entity period lock at every posting/reversal boundary. Reverse in an open period; never modify the closed original.

### P1 — Reports assume all stored journals are posted
`ledger()` and `reports()` read the entire journal collection, unlike Day Book's explicit Posted filter. Current generators normally append Posted journals, but imported or future draft journals can silently affect official statements. A synthetic Draft journal increased reported revenue. Add a shared official-posted query and test all reports against it before implementing stored manual drafts.

### P1 — Dashboard and manual journals imply functionality they do not have
Dashboard metrics, trend arrays, balances and alerts are hard-coded. Refresh displays a notification without fetching financial projections. Manual journal save/submit/post buttons notify and change local UI mode; they do not persist a journal into the accounting store. The page combines live generated entries with separate sample manual rows. Label the boundary until connected; never convert sample balances into real accounting.

### P1 — Mapping failure can be hidden by defaults
Missing line revenue mapping falls back to global sales mapping. That is acceptable only under an explicitly approved default policy, not when an item requires its own account. Report the mapping resolution and fail when a required mapping is absent. Receipt cash/bank eligibility partly relies on account-name matching; replace that with explicit account roles.

### P1 — Incomplete master dependency and audit controls
Account-reference checks cover several global mappings, invoices and external masters, but not every receipt configuration/draft or nested credit mapping. A configured unused account may therefore become invalid for later posting. Extend dependency checks. Journal creator is hard-coded as Admin even where receipt audit events use a local actor. Use one trusted actor context and capture approval/post/reversal metadata consistently.

### P1 — Current balances are not historical balances
Invoice outstanding subtracts all non-voided allocations regardless of reporting cut-off. Reversing an allocation changes the current projection; an as-of report needs effective-dated allocation/reversal events. Customer summaries can combine advances with trade receivables: present gross invoice due, unapplied credits, advance liability and net customer position separately, reconciling each to its control account.

## 5. Required New Components

These are logical services within the existing product, not a requirement to introduce microservices or replace the UI.

| Component | Responsibility |
|---|---|
| Posting orchestrator | Validate identity, source revision, approval, period and idempotency; commit once |
| Business rule registry | Convert InvoicePosted, ReceiptPosted, BillPosted etc. into account-role amounts |
| Mapping resolver | Resolve customer AR, vendor AP, item revenue/inventory, category expense, bank and tax roles |
| Tax policy service | Determine applicable regime, rates, eligibility, taxable base, components and withholding |
| Dimension resolver | Derive authorized dimensions from existing masters/context; reject invalid combinations |
| Journal validator | Require valid posting accounts, one-sided non-negative lines and balanced currency totals |
| Allocation service | Link payments/credits to open items with concurrency and effective-date protection |
| Projection service | Produce ledger, statements, ageing, Day Book and dashboard from the same posted facts |
| Exception inbox | Explain configuration blockers and route authorized users to the relevant settings |

Do not execute financial reports before recording the audit. The source update, journal, allocations, audit and outbox event must commit atomically; downstream refresh/notifications follow commit.

## 6. Module-wise Enhancement Plan

Each module below covers current capability, missing automation, correctness risk, enhancement, data and UX impact.

### 1. Sales Invoice — Partial
- **Current:** Item selection maps revenue snapshots; explicit GST components calculate; posting creates AR/revenue/tax journals and reversal preserves originals.
- **Missing automation:** Shared approval, customer AR resolution, period/entity checks and complete tax/dimension defaults.
- **Risk:** Global AR differs from receipt mapping; Draft can post directly; missing income silently falls back.
- **Enhancement:** Use the common posting resolver and a recorded approval policy; preserve invoice inputs.
- **Data:** Posting/approval state, mapping and rule versions, source revision, company, effective date.
- **UX:** Existing form stays; clear Confirm/Post outcome and configuration error links. No debit/credit fields.

### 2. Purchase Bill — Not implemented as accounting
- **Current:** Navigation route leads to generic placeholder rather than a bill engine.
- **Missing automation:** Vendor AP, purchase/expense/inventory debit, recoverable input GST, withholding and settlement.
- **Risk:** Treating route availability or Day Book type support as a working bill module.
- **Enhancement:** Implement Bill posting through shared rules; distinguish expenses, assets and inventory.
- **Data:** Vendor, bill/lines, due dates, tax evidence, AP mapping and open items.
- **UX:** Vendor/item/category business form; accounting remains automatic.

### 3. Expenses — Not implemented as accounting
- **Current:** Expense Claims/Categories routes are placeholders.
- **Missing automation:** Category mapping, paid/unpaid distinction, approval, employee/vendor liability and eligible tax.
- **Risk:** Posting every expense directly to bank would incorrectly treat unpaid claims as paid.
- **Enhancement:** Separate recognition from settlement; avoid duplicating purchase-bill expense recognition.
- **Data:** Categories, claims/expense documents, payee, settlement state and dimensions.
- **UX:** Category, amount, payee and paid-from information only where relevant.

### 4. Customer Receipt — Partial, working locally
- **Current:** Independent drafts, approval threshold, posting, allocations, advance liability, reversal and bank matching.
- **Missing automation:** Authenticated approvals, shared mapping/period policy and live connectors.
- **Risk:** AR mismatch, local role simulation, legacy payment command outside receipt policy; unapplied amounts need careful presentation.
- **Enhancement:** Preserve the flow; unify posting and show separately available advances and unapplied normal payments.
- **Data:** Retain receipts, allocations, matches and event keys; add server revisions and trusted identities.
- **UX:** Receive Payment remains a separate transaction, not an automatic invoice side effect.

### 5. Vendor Payment — Not implemented as accounting
- **Current:** Payments Made is a generic placeholder.
- **Missing automation:** AP settlement, advances, allocations, withholding and reversal.
- **Risk:** Reusing a customer receipt journal unchanged would reverse the required direction.
- **Enhancement:** Vendor payment engine using shared allocation/posting components with AP-specific rules.
- **Data:** Payments, vendor allocations, advance assets, bank matches and remittance references.
- **UX:** Pay vendor → select bills → confirm; no manual debit/credit selection.

### 6. Credit Note — Partial, working locally
- **Current:** Original-invoice validation, issue, revenue/tax/AR reversal, later allocation and cancellation reversal.
- **Missing automation:** Common period/approval/security layer; inventory return movements where applicable.
- **Risk:** No central closed-period enforcement; physical returns must not be inferred from accounting credit alone.
- **Enhancement:** Retain issue-once/application-without-reposting semantics and integrate inventory only with real movement evidence.
- **Data:** Rule/tax snapshots, return links, central approval and reversal metadata.
- **UX:** Existing credit-note flow remains, with explicit return vs price-adjustment purposes.

### 7. Debit Note — Not implemented as accounting
- **Current:** Route only; no source-posting engine.
- **Missing automation:** Defined debit-note purpose and corresponding AP/AR/tax adjustments.
- **Risk:** “Debit Note” can mean a buyer's vendor claim or a seller's additional charge; one universal rule is unsafe.
- **Enhancement:** Define the Purchases module document as a supplier-linked adjustment and separately support statutory seller debit notes if needed.
- **Data:** Purpose, original source ID, tax-document linkage and settlement effect.
- **UX:** Clear business-purpose label; never ask users to choose journal direction.

### 8. Chart of Accounts — Partial, strong local foundation
- **Current:** Persistent master, hierarchy/cycle validation, unique codes, protected/used accounts, tax settings and opening journals.
- **Missing automation:** Complete reference registry, semantic roles and company-scoped mapping policies.
- **Risk:** Some nested/receipt dependencies are absent from reference checks; settings are not authenticated permissions.
- **Enhancement:** Extend protections and role mapping without redesigning business/accounting views.
- **Data:** Account-role relationships, mapping references, effective dates and immutable account IDs.
- **UX:** Normal users keep business labels; finance administrators maintain advanced configuration.

### 9. Tax Configuration — Partial GST, TDS not automated
- **Current:** Explicit CGST/SGST/IGST/Cess rates and arithmetic; optional account-rate validation; TDS section/rate/account metadata.
- **Missing automation:** Tax classification, effective-date schedules, input eligibility, reverse charge, UTGST/special supply handling and TDS transactions.
- **Risk:** State-string equality and stored TDS settings are not a comprehensive legal determination engine.
- **Enhancement:** Resolve tax treatment from master/context; keep tax ledgers hidden from normal users.
- **Data:** Versioned tax codes, legal regime/section identifiers, rates, thresholds, bases and component accounts.
- **UX:** Show understandable tax treatment and totals, with exceptions routed to finance.

### 10. General Ledger — Partial
- **Current:** Account movements and running balance from shared journals; date/account/debit-credit filters and source links.
- **Missing automation:** Consistent posted-only/entity/as-of queries; full dimension/creator columns and generic source routing.
- **Risk:** Draft imports affect totals; source-link logic remains partly invoice-oriented.
- **Enhancement:** One journal-line query powering all account-ledger views.
- **Data:** Journal header/line IDs, source type/ID, dimensions, actor and posting sequence.
- **UX:** Finance view exposes date, voucher, source, account, debit, credit, balance, branch, cost centre and creator.

### 11. Trial Balance — Partial
- **Current:** Aggregates journal balances and compares debit/credit totals.
- **Missing automation:** Period opening/movement/closing, entity scope and posted-only consistency.
- **Risk:** A balanced TB can still omit bills/expenses or include incorrectly mapped transactions.
- **Enhancement:** Reconcile to the same ledger query and separately surface missing-posting exceptions.
- **Data:** Report cut-off and projection version; no duplicate authoritative balances required initially.
- **UX:** Opening, period debit/credit and closing columns, with account drill-down.

### 12. Reports — Partial; dashboard disconnected
- **Current:** Basic P&L/Balance Sheet and customer/GST views use stored postings; dashboard uses sample values.
- **Missing automation:** Complete AP/expense sources, period scope, Cash/Bank Books, classified cash flow and live KPIs.
- **Risk:** “Financial position” excludes unimplemented sources; fixed dashboard amounts contradict live reports.
- **Enhancement:** Shared projections; P&L period movements versus Balance Sheet cumulative cut-off, with opening/closing equity handled correctly.
- **Data:** Classification policies, report scope, cut-off and projection watermark.
- **UX:** Display scope and refresh time from actual data; never silently mix samples and postings.

### 13. Day Book — Partial, correct read-only foundation
- **Current:** Posted-voucher view, separate unposted tab, filters, full-voucher totals, source/audit details and exports.
- **Missing automation:** Transactions from unimplemented source modules, complete historical metadata and some generic source/reversal linkage.
- **Risk:** Supported type names do not create missing transactions; receipt reversal history/status should be linked consistently by receipt ID.
- **Enhancement:** Reuse shared posting facts and source registry; keep original and reversal entries visible.
- **Data:** Source type/ID, posting ID and reversal-of references.
- **UX:** Chronological activity only. Dimension filters currently retain whole vouchers: label that scope, not branch-only financial totals.

## 7. Database/Data Model Impact

Prefer additive migration behind the existing UI. Preserve current document IDs, account codes, legacy payment records, posted amounts and journal history; never migrate demonstration balances as postings.

Required entities: companies/periods; source documents/lines; customers/vendors; items/categories; accounts/account roles; mappings/rule versions; tax policies; dimensions; approvals; journal headers/lines; open items/allocations; bank matches; audit events; idempotency requests; transactional outbox.

Key constraints:
- Unique document number within the configured company/type/fiscal series.
- Unique posting identity `(company, source type, source ID, source revision, posting event)`; retries with a different payload must fail.
- Journal lines reference valid company accounts and dimension IDs; amounts are fixed precision, never floating-point money.
- Source revision and open-item allocation locks prevent simultaneous posting/over-allocation.
- Posted rows cannot be updated/deleted through ordinary commands; reversal links to original posting.
- Approval decision binds to the approved revision; editing an unposted document invalidates approval when required.
- Currency, rule, mapping and tax snapshots retain the meaning of historical postings.
- Backfill missing metadata as unknown with provenance, not invented Admin/company/branch values.

Migration reconciliation: per-account balance, total debits/credits, customer/vendor control balances, open invoices/bills, unapplied credits/advances, tax component totals and source-to-posting counts must match before cutover.

## 8. UX Changes Required

Keep all modules and existing business forms. Normal users choose customers/vendors/items/categories and actual cash/bank destinations; none of that requires choosing Debit Account or Credit Account.

- Derive accounts from masters and show optional read-only Accounting Impact after confirmation.
- Separate business status (Sent/Paid), approval state and posting state without needlessly renaming established screens.
- Add actionable errors: “Unable to post invoice: Sales account mapping is missing for Consulting. Configure now.” Route only authorized users to configuration; others request finance help.
- Show what posted, journal reference, amount and relevant follow-up; do not say “posted” when only a draft or sample action completed.
- Keep manual journals available to finance users for depreciation, accruals, provisions, opening adjustments, corrections and year-end entries. Require purpose, narration/evidence, approval, period checks and actual posting. Block ordinary manual settlement of AR/AP, bank reconciliation or tax control accounts unless an explicitly authorized adjustment workflow handles related subledgers.
- Derive branch/cost centre/department/project from authorized company/session/master context, with approved overrides. Missing required metadata is a setup exception, not an invented default.
- Keep trade AR, customer advances and net customer position distinct. The same separation applies to AP and vendor advances.

## 9. Accounting Rules Required

Rules below describe accrual-accounting patterns, not automatic tax eligibility decisions. Confirm treatment through the configured policy before posting.

| Business event | Debit | Credit |
|---|---|---|
| Invoice posted | Customer AR, gross | Revenue net of discounts; output tax components; controlled round-off difference |
| Purchase bill posted | Expense/asset/inventory and eligible input tax | Vendor AP; withholding liability where applicable |
| Expense recognized unpaid | Expense and eligible tax | Vendor/employee/accrual liability |
| Expense paid directly, not already recognized | Expense and eligible tax | Cash/bank and withholding where applicable |
| Customer receipt posted | Cash/bank | Customer AR |
| Customer advance received | Cash/bank | Customer advance liability; separately required tax entries only under verified policy |
| Customer advance allocated | Advance liability | AR |
| Vendor payment against AP | AP | Cash/bank; withholding if recognition occurs at settlement and not already posted |
| Vendor advance paid | Vendor advance asset | Cash/bank |
| Vendor advance allocated | AP | Vendor advance asset |
| Sales credit note issued | Revenue reduction and eligible output-tax reduction | AR |
| Supplier credit accepted / buyer adjustment supported | AP | Purchase/asset reduction and applicable input-tax adjustment |
| Seller debit note issued | AR | Additional revenue/tax, according to purpose |
| Approved finance adjustment | Rule-authorized accounts | Rule-authorized offsets |
| Reversal | Exact opposite of original lines | Exact opposite; preserve original and effective reversal date |

Example: ₹100,000 taxable sales + ₹18,000 tax → Dr AR ₹118,000; Cr Revenue ₹100,000; Cr Output CGST ₹9,000 and SGST ₹9,000 for a qualifying intra-state supply, or IGST ₹18,000 where applicable. Receipt later: Dr Bank ₹118,000, Cr AR ₹118,000. Revenue/tax are not posted a second time on receipt. Goods may additionally require inventory/COGS postings supported by an actual inventory ledger.

GST safeguards: supplier location and legally determined place of supply, special supply treatment, effective rates, component ledger roles, recoverability, exemptions and document lineage. State equality alone does not cover the statutory scope and exceptions. [CBIC IGST provisions](https://taxinformation.cbic.gov.in/content-page/explore-act/1000616/1000001).

TDS safeguards: legally applicable payment category, effective regime/section, threshold aggregation, counterparty status, certificates, deduction timing and ledger role. Do not hard-code historic section identifiers or infer a rate from an account name. The Income Tax Department's transition guidance addresses section references for transactions from April 2026; implement effective-dated identifiers and verify applicability rather than copying old labels. [Income Tax Department tax-payment guidance](https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/tax-payments?mobile-app=1).

Mapping resolution must return account IDs, rule/version and provenance, or a typed blocker. Validate all lines and totals before any commit. Approval and mapping checks must run on the server, even if the UI already previews them.

## 10. Final Recommended Wayvida Books Accounting Architecture

Business action → source validation and approval → common posting boundary → rule, mapping, tax and dimension resolution → balanced journal validation → atomic source/journal/subledger/audit/outbox commit → ledger and report projections → dashboard refresh.

These are different views of the same facts:
- **Day Book:** what happened, chronologically.
- **Journal:** generated accounting entry and its source.
- **Ledger:** account-wise movements.
- **Trial Balance:** account balance/debit-credit verification.
- **P&L:** income and expenses for a period.
- **Balance Sheet:** assets, liabilities and equity at a cut-off.

Recommended sequence:
1. **Foundation:** shared AR mapping, centralized approval/period gates, posted-only reporting, trusted persistence/identity and no misleading sample-success states.
2. **Complete business sources:** Purchase Bills, Expenses, Vendor Payments and purpose-defined Debit Notes; then real manual adjustments. Reuse the shared core rather than duplicating invoice code.
3. **Tax and dimensions:** effective-dated policy, input tax/TDS, master relationships and historical snapshots.
4. **Reporting:** reconcile subledgers, wire dashboard, add historical ageing and Cash/Bank/Cash Flow reports.
5. **Release validation:** retries/concurrency, closed periods, reversal after allocation/reconciliation, mapping changes, cross-company access and end-to-end source-to-statements tests.

Acceptance gate: a business user posts a supported transaction without choosing debit/credit accounts; exactly one approved, balanced posting results; subledger and GL reconcile; all official reports share the same cut-off and company scope; reversal preserves history; invalid configuration fails atomically with an actionable message.

**Recommendation:** retain the current product and extend its working sales-side core. Do not redesign the entire ERP, and do not treat the current prototype as a complete ledger for the organization until the missing sources and controls are connected.
