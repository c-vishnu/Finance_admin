# Customer Receipt enhancement review — Wayvida Books

Scope: additive enhancements to the existing local prototype. Invoice creation, invoice posting rules, the restored dashboard, existing transaction IDs and historical payments are unchanged. This is not a certification of production ERP readiness or feature parity with Zoho Books, QuickBooks, Tally Prime or SAP Business One.

## 1. Current feature review

The existing module already treats receipts as independent transactions. Creating an invoice does not create a receipt. It supports drafts, threshold-based approval, posting, full/partial/multiple invoice allocation, customer advances, later allocation, bank statement import, matching, reconciliation and append-only reversal journals. The engine validates integer-paise amounts, active account mappings, open receipt periods, allocation limits, customer ownership and balanced posting.

Legacy payment records remain readable without migration or reposting. Receipt allocations feed invoice outstanding. Customer statements, General Ledger, Trial Balance and Day Book consume existing shared accounting records.

## 2. Missing functionality

Added in this update:

- Ledger Impact with Customer Ledger, Bank/Cash Ledger and Journal Entry View.
- Transaction Type, source voucher number, Source Document and Reference displayed separately, with the journal number retained.
- An accounting preview that executes the actual posting validations on a disposable copy; it cannot save or post the draft.
- Direct View Journal and View Ledger actions alongside the existing receipt actions.
- Save as PDF through the browser print dialog, preserving browser-supported text and currency rendering. This is not a silent server-generated PDF download.
- Receipt date, payment mode and received account visible alongside amount, lifecycle and allocation summary.
- Explicit Accountant, Finance Manager and Admin command policies for the local UI.
- Ranked bank-match suggestions based on remaining amount, reference and date. Users must confirm; suggestions never reconcile or post automatically.
- Modified and Submitted audit metadata, cancellation actor/date and status-transition audit records; new receipt journals use the actual local actor.

Remaining: authenticated server enforcement, transactional multi-user storage, secure document generation/storage, live bank feeds, and complete standalone Cash Book, Bank Book and classified Cash Flow Statement reports. The existing dashboard is unchanged and remains sample data.

## 3. Accounting gaps

### Posting and allocation must not be counted twice

| Event | Debit | Credit | Invoice allocation |
|---|---|---|---|
| Normal receipt posted | Bank/Cash | Customer Receivable | Reduces invoice outstanding only for applied amounts |
| Normal receipt allocated later | No new journal | No new journal | Applies existing payment to selected invoice |
| Advance receipt posted | Bank/Cash | Customer Advance Liability | None unless allocation is also supplied |
| Advance allocated | Customer Advance Liability | Customer Receivable | Reduces the selected invoice balance |
| Posted receipt reversed | Exact opposite of original and advance-allocation entries | Exact opposite | Voids allocations and restores invoice outstanding |

An unallocated normal receipt already reduces the customer trade-AR control balance. The invoice remains open until allocation. Advance receipts remain liabilities until applied. Consequently the customer trade-AR ledger deliberately excludes advance-liability balances: it does not misleadingly label an advance as a reduction of trade receivables.

The requested example labelled “Receipt Allocation” with a credit is appropriate for an advance transfer. For an ordinary receipt the credit is labelled “Receipt”; allocating later must not create another credit. Both cases are covered by tests.

Receipt Ledger Impact views use only Posted journals. Bank balances include all recorded posted movements in that account, not a hard-coded opening balance or only this receipt. Missing historical opening journals are not invented.

Production dependencies remain: company/branch isolation, centrally enforced period locks, receivable mapping integrity across all modules, concurrency-safe allocation, and verified handling for TDS, advance GST, foreign exchange, bank charges and refunds. This update does not infer tax treatment from amounts or add accounting fields to invoice creation.

## 4. UX gaps

Previously all accounting tabs were always exposed, the ledger only showed combined customer receivable/advance movements, and the unposted accounting tab was empty.

Now Overview and Allocation are the default. “Show accounting details” exposes Accounting Impact, Ledger Impact and Audit Trail. View Journal/View Ledger actions reveal the appropriate view directly. The existing inline forms, card styling, icon buttons and minimum 12 px typography are retained.

The role selector is labelled local simulation. Accountants can prepare receipts; a Finance Manager or Admin must post. Reversal and configuration require Admin. These controls are usability and command-policy demonstrations, not authenticated security.

Print Receipt and Save as PDF first select the receipt overview. For PDF, choose Save as PDF in the system print dialog. The export contains current receipt status so drafts/reversed records are not presented as posted money received.

## 5. Database changes required

No replacement schema, renumbering, payment migration or reset is required locally. Existing receipt, allocation, bank-line, bank-match, journal and audit collections remain the source of truth.

Additive metadata:

- Receipt: `submittedAt`, `submittedBy`, `cancelledAt`, `cancelledBy`; existing `modifiedAt`/`modifiedBy` now track successful lifecycle actions too.
- Audit: `fromStatus`, `toStatus`; existing actor, timestamp, reason and journal links remain.
- New journal actors come from the command context. Historical actors are not guessed or rewritten.

Ledger classification, voucher labels, previews and bank suggestions are computed projections; no redundant stored balances or extra invoice fields are introduced.

Backend implementation must add tenant-scoped unique voucher constraints, immutable posted records, allocation foreign keys, transaction/row locking, payload-aware idempotency keys, secure audit retention and server-derived permissions. Role-less existing adapter calls remain backward-compatible and must not be exposed directly as public endpoints.

## 6. New screen architecture

- Receipt register: search, status filter, New Receipt, Bank Matching, Settings, icon-labelled actions.
- Receipt detail header: number/customer, amount, available funds, lifecycle, allocation, date, mode and bank/cash account.
- Overview: payment details, attachment, matching suggestions and confirmation.
- Allocation: history and remaining invoice balances; allocate available posted funds.
- Accounting details, collapsed by default:
  - Accounting Impact: validation blockers or proposed balanced entries before posting; actual entries after posting.
  - Ledger Impact: customer trade AR; full bank/cash ledger; receipt journal entries, including transfers and reversals.
  - Audit Trail: creation/modification/submission/approval/posting/cancellation/reversal metadata and event history.
- Report links: Customer Statement, General Ledger, Day Book and Trial Balance. Standalone cash-flow and cash/bank-book pages remain a separate backend/reporting milestone.

## 7. User flow

Invoice posted → customer receivable exists → money is received → New Receipt → optional invoice allocation → Save Draft → review accounting preview → Submit → automatic approval below threshold or Finance Manager approval → Finance Manager/Admin posts → balanced journal and shared ledger update → invoice balances reflect allocations → review reports → match imported bank transaction → Finance Manager reconciles.

Prepayments use Customer Advance, not a fabricated invoice. Unallocated funds can be applied later.

Draft/Submitted/Approved receipts can be cancelled with a reason. Posted receipts cannot be cancelled or deleted; Admin reverses them on an open date after removing bank matches. Cancelled and Reversed are terminal alternatives, not sequential mandatory steps.

## 8. Development tasks

Completed locally: read-only posting preview; separate ledger projections; progressive accounting views; source/voucher/reference labels; richer header; journal/ledger/PDF actions; role command policy; bank suggestions; audit enhancements; regression tests and existing-flow verification.

Backend sequence:

1. Move commands into authenticated tenant-scoped services; derive roles from identity, never request bodies or a browser selector.
2. Commit receipt, allocation, journal and audit changes in one database transaction. Enforce unique numbering and request signatures under concurrency.
3. Apply central financial-period and dimension policies across modules; do not treat receipt-only locks as a global lock.
4. Add secure attachment storage, server PDF generation and webhook signature/merchant verification.
5. Implement real statement imports/feeds, reconciliation controls and reviewed cash-flow classifications.
6. Build and reconcile dedicated AR, Cash Book, Bank Book and Cash Flow reports. Keep the invoice-creation experience unchanged.

## 9. Acceptance criteria

- Creating/saving an invoice or receipt draft does not automatically create a receipt posting.
- Preview leaves all saved state unchanged, returns the same lines as posting, and shows mapping/closed-period/allocation errors.
- Every posted receipt and reversal balances in paise.
- Normal allocation creates no second journal credit; invoice outstanding changes exactly once.
- Advance posting credits liability; allocation transfers liability to receivables; reversal restores both.
- Customer trade-AR ledger excludes unapplied advance liability; bank ledger includes other posted movements and excludes Draft journals.
- Ledger rows show transaction type, source voucher, source document, reference and journal number separately.
- Accountant cannot approve/post; Finance Manager can approve/post but cannot reverse/configure; Admin can reverse/configure. Unknown explicit roles are rejected.
- Posted receipt data is immutable; legacy payments are preserved without reposting.
- Bank suggestions do not mutate state; confirmed matches cannot exceed either available amount.
- Actors and status transitions are recorded; missing old metadata is shown as Not recorded.
- Basic views remain simple; accounting actions open the relevant advanced tab.
- Print/PDF show the selected receipt, amount, date and status. PDF uses the browser Save as PDF option.
- Existing invoice, credit-note, account, sales-order, Day Book and Sites packaging regression tests remain passing.

Production acceptance additionally requires multi-user concurrency tests, authenticated authorization tests, tenant isolation, tamper-resistant auditing and reconciled full reporting. Those cannot be certified by a browser-local prototype.
