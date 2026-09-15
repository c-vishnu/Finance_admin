# Customer Receipts — implementation and ERP gap analysis

## 1. Current receipt module gap analysis
The original flow immediately posted a payment against one invoice. It already produced balanced bank/receivable journals, calculated outstanding amounts, and retained payment history. It lacked independent receipt drafts, approval, advances, later allocation, reversal, attachments and bank matching. The new module is available at Sales → Receipts, or `?view=receipts`.

This implementation extends the existing **local prototype**. It is not a production-compliance claim. Existing invoice creation inputs and posting are unchanged.

## 2. Existing features reused
- Shared journal engine, integer-paise arithmetic, active posting-account validation and dimension checks.
- Customer Master receivable mapping; existing Chart of Accounts cash/bank and liability accounts.
- Invoice outstanding calculation, customer statements, General Ledger, Trial Balance and Day Book.
- Original payment records remain intact, visible and reversible without creating a second original journal.
- Existing inline form, typography, tab and table styles.

## 3. Missing accounting features and remaining boundaries
Implemented: separate receipt lifecycle, partial/multiple allocations, advance liability posting, unallocated normal receipts, append-only reversal journals, allocation voiding, receipt-period locks, threshold approval, duplicate numbering and bank-line matching.

Remaining production work: authenticated roles and separation of duties, tenant isolation, database transactions and locking, tamper-resistant audit storage, central cross-module period locks, secure attachments, verified webhook endpoints and bank connections. The Accountant/Finance Manager/Admin switch is explicitly a **local simulation**, not access control. Files are stored on this device with a 1 MB limit.

GST on advances, withholding/TDS, foreign currency, gateway fees, refunds and statutory receipt-voucher compliance are not inferred from the receipt amount. They require separately verified tax/accounting configuration and backend workflows. Cash/Bank Books and a formally classified Cash Flow Statement are not new standalone pages in this change; their source bank/cash journal movements are available through General Ledger and Day Book. Do not claim those separate report modules are complete.

## 4. UX improvements and product comparison
Receipt register includes search, status filter, amount, payment mode, account, allocation status, creator and icon-labelled action menu. Detail tabs cover Overview, Allocation, Accounting Impact, Ledger Impact and Audit Trail. Invoice **Receive Payment** opens the same draft form prefilled with customer and proposed allocation; it does not create a receipt automatically.

Design alignment, not feature parity:
- [Zoho Books excess payments](https://www.zoho.com/en-de/books/kb/payments/refund-excess-payment.html): retain excess/advance funds as customer-linked records rather than silently reducing revenue.
- [QuickBooks receive-payments guidance](https://quickbooks.intuit.com/content/dam/intuit/quickbooks/QBDT-Level-1-Manual-new.pdf): use a separate payment workflow linked to invoices, with unapplied funds visible. QuickBooks cash-basis reporting treatments are not imported into this accrual prototype.
- [Tally advance receipt guidance](https://help.tallysolutions.com/docs/te9rel60/Tax_India/gst/advance_rcpt_gst_6_0_3.htm): advance receipts are distinct voucher activity. This is older reference documentation, not certification of current Tally Prime or GST compliance.
- [SAP Business One incoming payments](https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727/44ea223bbbc903fde10000000a1553f6.html?locale=en-US&state=PRODUCTION&version=9.3): independent incoming-payment records with payment means and source links.

## 5. Database entity changes
Additive local collections, suitable for later relational tables:
- `receipts`: ID, unique number, date, customer ID/name snapshot, amount, cash/bank, mode, reference, notes, attachment, Normal/Advance kind, receivable/advance mapping snapshots, dimensions, revision, lifecycle and audit timestamps, original journal ID, bank-line link.
- `receiptAllocations`: ID, receipt ID, invoice ID, amount, effective date, request token, optional advance-transfer journal ID, creator, void flag/timestamp.
- `receiptBankLines`: unique imported bank ID, date, incoming amount, bank account, reference and match status.
- `receiptMatches`: receipt/bank-line IDs, amount, actor/time, reconciliation and void markers.
- `receiptRequests`: external provider/event ID, payload signature and resulting receipt ID for retry protection.
- Existing journal/audit records gain `receiptId`; journals retain original lines and optional `reversalOf`.
- `config.receipts`: approval threshold, advance liability mapping and receipt closed-through date.

No invoice lines, addresses, taxes or totals are copied into receipt records. Invoices are referenced by ID. A production schema must enforce unique numbering/event keys, foreign keys and transactional allocation constraints.

## 6. Accounting posting logic
All amounts are integer paise. Posting and related allocation succeed together or leave the original state untouched.

| Event | Debit | Credit | Invoice effect |
|---|---|---|---|
| Normal receipt posted | Cash/Bank | Customer Receivable | Only allocated amounts reduce invoice outstanding |
| Normal receipt allocated later | No new journal | No new journal | Reduces selected invoice outstanding |
| Advance posted | Cash/Bank | Customer Advance Liability | None until allocation |
| Advance allocated | Customer Advance Liability | Customer Receivable | Reduces selected invoice outstanding |
| Receipt reversed | Exact reversal of original and advance-allocation journals | Exact reversal | Voids allocations; restores invoice outstanding |

Normal receipts cannot exceed customer outstanding less other unapplied normal receipts. Choose Advance for excess or prepayment. Each allocation must be positive, within receipt availability and invoice outstanding, use the same customer and receivable mapping, and have a valid effective date. Paid/cancelled/unposted invoices are not allocatable. Current balances and historical journal views are distinct; later allocations do not rewrite the original posting date.

Posted records cannot be edited or deleted. Unposted records may be cancelled with a reason. Posted cancellation is performed as an atomic reversal, ending in Reversed rather than leaving an unbalanced intermediate Cancelled state. Reverse dates cannot precede allocation dates or fall in a closed receipt period. Bank matches must be removed, with an Admin and reason, before reversal.

## 7. Receipt user journey
Manual: New Receipt → customer/payment details → optional invoice allocations → Save Draft → Submit → approval → Post → allocate remaining funds → match imported bank lines → Reconcile.

Below the default ₹50,000 threshold, submission automatically approves; amounts at or above it require manager approval. Posting remains explicit. Admin simulation can configure threshold, advance liability and receipt-period lock in Settings.

From invoice: Receive Payment → same draft form with customer, amount due and allocation → approval/posting. Partial payments require adjusting both received amount and allocation; validation prevents accidental over-allocation.

Bank import: CSV headers `id,date,amount,bank,reference` (bank is an account code), or enter one statement line. Customer identification is manual. Create an unallocated advance draft, then post, match and reconcile. Partial matches are supported without exceeding either record's available amount.

Gateway: `ingestReceiptEvent` is a pure adapter boundary, not a public endpoint. A server must verify signature, merchant, status and currency before passing a trusted context. Duplicate events return the original receipt; changed payloads with the same event key are rejected. Above-threshold events remain Submitted instead of bypassing approval.

## 8. Acceptance criteria
- Saving a draft or creating/posting an invoice does not create a receipt journal.
- ₹50,000 allocated against ₹118,000 leaves ₹68,000 outstanding.
- Advance posting credits liability; later allocation clears liability and receivable once.
- Repeating post/reverse does not duplicate journals; gateway retry IDs are checked.
- Cross-customer, closed-period, excess and inactive-account operations fail without partial writes.
- Existing legacy payments remain present and can be reversed without duplication.
- Reversal restores outstanding while preserving journals and audit events.
- General Ledger/Trial Balance and Day Book read the shared posting; customer statements include receipt/advance movements without leaking other customers' rows.
- CSV validates headers, quoted values, duplicate bank IDs and import size.
- Posted receipts have no delete action; Print Receipt prints the receipt overview via the browser.

## 9. Development tasks
Completed locally: receipt UI and engine, existing invoice action integration, allocations, approval simulation, mapping/period settings, attachments, legacy compatibility, bank import/matching, reversal, journal/report linking and automated regression coverage.

Next backend milestones: transactional persistence and optimistic revisions across tabs/users; server-derived identity; approval policies; reconciliation statement boundaries; secure object storage; webhook verification and connector credentials; centrally enforced period locks; statutory advance-tax handling; Cash/Bank Book and classified Cash Flow report surfaces. Preserve the current invoice creation experience throughout.

The additive Ledger Impact, accounting preview, role policy, bank suggestions and audit enhancement review is documented in `RECEIPT-ENHANCEMENT-REVIEW.md`.
