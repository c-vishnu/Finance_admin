# Data Model

**Last verified:** 2026-09-16  
**Primary sources:** `invoice-engine.js`, `account-master.js`, `receipt-engine.js`, `credit-note-service.js`, `period-locking.js`, `organisation-scope.js`, `organisation-context.js`.

### Additive account-master fields

Current browser records may include `reportingCategory`, `applicableBranches[]`, `moduleMappings[]`, `taxTreatment`, `defaultTaxRate`, `currency`, `createdBy`, `createdAt`, `modifiedBy`, and `modifiedAt`. These are additive prototype contracts. `branchId` remains the first applicable branch for backward compatibility, and account `code` remains the journal/ledger reference key.

## Current persistence

The main accounting aggregate is stored under `wayvida-accounting-v1`. It contains a version, accounts, invoices, payments, journals, audit events, and configuration; later modules add arrays such as receipts, receipt allocations, credit notes, credit applications, openings, and account audit records. Feature UIs may use additional local keys. Storage is device/browser-specific and must not be treated as a database.

Important transient keys include `wayvida-open-account`, `wayvida-open-invoice`, `wayvida-open-credit`, and customer/document selection hints. These are navigation conveniences, not entity ownership.

### Journal creation helpers

`wayvida-manual-journals-v2` stores the manual journal records shown by the Journal Entries register, including their lines, lifecycle status, attachments and audit array. It stays separate from the posted journal list inside `wayvida-accounting-v1`, which is written only by the posting engine.

Two presentation-only keys support the Create Journal Entry page and are never read by the ledger, reports or posting engine: `wayvida-journal-templates-v1` stores reusable templates (name, journal type, lines and an optional `None`, `Every month` or `Every year` repeat label) and `wayvida-journal-account-prefs-v1` stores the recent and favourite account codes used by the account picker. Sources: `src/JournalEntriesPro.jsx`, `src/journal-templates.js`, `src/JournalAccountPicker.jsx`. The Create Journal Entry page does not write the working-context keys (`wayvida-context-companies`, `wayvida-context-branches`, `wayvida-context-mode`, `wayvida-demo-company`, `wayvida-demo-branch`) or dispatch the working-context events at all: organisation and branch are edited per line instead, and no second context store exists. No field was added to the stored journal record: the mandatory reason (`narration`) is now edited in the metadata row, the collapsed Additional details keep the existing attachments array and approval comments projected from the existing audit trail, and the per-line organisation and branch selects write the `organization` and `branch` name fields that `emptyLine()` already stamped and `postToLedger()` already reads.

### Vendor Master

`wayvida-vendors-v1` stores vendor identity, contact and multiple-address data, GST/PAN/TDS configuration, payment terms, bank details, opening balance metadata, status, audit timestamps, and the Accounts Payable control-account reference. The current UI stores attachment file names only; file contents are not uploaded. Vendors are sub-ledger entities and do not create one Chart of Accounts record per vendor. Sources: `src/vendor-store.js`, `src/Vendors.jsx`.

### Purchase Orders, Goods Receipts, Purchase Bills and Vendor Payments

`wayvida-purchase-orders-v1` stores operational purchase orders with vendor snapshots, delivery/reference data, item lines, ordered and received quantities, calculated totals, lifecycle status, and linked bill IDs. Purchase orders are non-accounting records.

`wayvida-goods-receipts-v1` stores receipt number/date, source PO/vendor references, delivery reference, actor/timestamp, and lines containing ordered, previously received, received-now and pending quantities. Goods Receipts are non-accounting records.

`wayvida-purchase-bills-v1` stores independent and PO-derived bill projections. PO-derived lines retain `orderLineId` and `maxQty`, preventing billing above received/unbilled quantity. Posted bill copies live in `wayvida-accounting-v1.purchaseBills`; `vendorPayments` contains bill/vendor/journal links and idempotency tokens. Monetary totals and journal lines use integer paise. Sources: `src/purchase-service.js`, `src/Purchases.jsx`, `src/GoodsReceipts.jsx`, `src/VendorPayments.jsx`.

### Budget Management

`wayvida-budgets-v4` stores budget masters, mapped account snapshots, period allocations, revisions, lifecycle status, scope/template metadata, settings and activity history. Each budget maps account codes to `p1`..`p12` allocation slots, which expand to 12, 4, 2 or 1 slots for Monthly, Quarterly, Half-Yearly or Yearly periods and to a single `p1` for a `Custom` period, whose column header is `Custom Period`; the dates the plan covers travel with it as `startDate` / `endDate`, derived from the financial year for every standard period and stored from the planner's own range for a Custom one. Budgets are planning records: they reference Chart of Accounts codes and read posted `wayvida-accounting-v1.journals` for actuals, but never create accounts or post journals. Source: `src/budget-store.js`, `src/BudgetWorkspace.jsx`.

### Banking

`wayvida-banking-v1` stores `bankAccounts`, imported `bankTransactions`, `bankMatches`, saved `reconciliations`, `matchingRules`, and Banking audit events. Reconciliations store bank/period identity, ledger-derived opening balance, optional statement balances, lifecycle status, ownership/completion/unlock metadata and final difference. Statement rows may carry a `reconciliationId`, category and match display reference. Each bank account's `accountCode` is a one-to-one reference to a posting Assets account. Book balances remain projections of posted `wayvida-accounting-v1.journals`; statement balances never overwrite accounting. Source: `src/banking-service.js`.

### Inventory Adjustments

`src/inventory-adjustments.js` keeps its documents inside the shared accounting aggregate rather than a store of its own: `state.inventoryAdjustments[]` plus the matching `state.audit[]` events in `wayvida-accounting-v1`, written through `adjustmentCommand` and the same `readAccounts`/`writeAccounts` pair every other accounting screen uses, so an adjustment can never land in a different store from the journal it posts. An adjustment carries `id`, `number` (`ADJ-00001`, and a stored reference is never reused), `date`, `type`, `entryMode`, `companyId`/`companyName`, `branchId`/`branchName`, `account`, `reason`, `notes`, `lines[]`, `status`, `posted`, `journalId`, the lifecycle actors and timestamps (`createdAt`/`createdBy`, `updatedAt`/`updatedBy`, `submittedAt`/`submittedBy`, `cancelledAt`/`cancelledBy`/`cancellationReason`, `postedAt`/`postedBy`), the correction links (`reversalOf`, `reversedBy`, `reversedAt`) and an `activity[]` trail. A line keeps the item, its location and the figures the document was posted with, so a reversal mirrors it exactly: `itemId`, `locationId`, the item snapshot (`name`, `sku`, `unit`, `inventoryAccount`), `rate`, `currentQty`/`previousQty`, `currentValue`/`previousValue`, `qtyDelta`, `valueDelta`, `newQty`, `newValue` and `valueImpact`, every money figure in integer paise. The item master is not this module's to write: `finance-erp-items` is read only, and the `Current quantity` a line starts from is derived at view time from each item's `openingQuantity × openingRate` plus every posted adjustment line, keyed on `itemId::locationId`.

### Period locking

`wayvida-period-control-v1` stores `periods[]`, `requests[]`, `audit[]` and `overrides[]`; `wayvida-period-settings-v1` stores the single locking policy record. A period carries its scope (`companyId`, `organisationName`, `scopeType`, `branchIds[]`, `branchNames[]`, `modules[]`), its range (`start`, `end`, `frequency`), its lifecycle (`status`, `lockType`, `lockedBy`, `lockedAt`, `reason`, `approvalStatus`, `lastAction`, `version`) and, while temporarily unlocked, `lockTypeBeforeUnlock`, `unlockScope`, `unlockStartDate`, `unlockEndDate`, `unlockExpiresAt` and `unlockManual`.

An unlock request records the lock it targets, the requested `unlockScope` with `unlockStartDate` and `unlockEndDate`, the requested duration, the reason and the decision (`status`, `approvedBy`, `approvedAt`, `approvalId`, `remarks`, `expiresAt`, `manual`), plus `cancelledBy`, `cancelledAt`, `decisionReason` and `expiredAt` when it is cancelled or expires. The shared audit record carries `user`, `date`, `action`, `organisation`, `branch`, `beforeValue`, `afterValue`, `reason`, `periodId` and `requestId` for every locking event.

## Main current entities

| Entity | Important fields |
|---|---|
| Account | `id?`, `code`, `name`, `type`, `parent`, `active`, `system`, `isGroup`, `controlAccount`, `branchRequired`, `costCentreRequired`, tax policy fields, `revision` |
| Invoice | `id`, `number`, dates, customer, addresses, place, terms/reference, lines, totals, status, posted, journal/account references, revision, audit timestamps |
| Invoice line | item/name snapshot in `description`, quantity, unit, rate, discount, tax selections, derived gross/taxable/taxes/total, optional mapped income account |
| Journal | `id`, `number`, source, reference, date, token, status, lines, source IDs, customer/company metadata, audit timestamps |
| Journal line | account code, integer-paise debit/credit, description, branch and cost-centre dimensions |
| Credit note | invoice/customer linkage, reason, lines/totals, lifecycle fields, posting and receivable references |
| Credit application | credit-note ID, invoice ID, amount, date, token, void metadata |
| Receipt | customer, amount, bank, mode, reference, type, accounts, planned allocations, reconciliation, lifecycle/audit fields |
| Receipt allocation | receipt/invoice IDs, amount, date, token, optional journal, void metadata |
| Inventory adjustment | `id`, `number` (`ADJ-00001`), date, type, entry mode, organisation/branch, adjustment account, reason, notes, lines, status, posted, `journalId`, lifecycle actors and timestamps, reversal links, activity trail |
| Inventory adjustment line | `itemId`, `locationId`, item snapshot (name/SKU/unit/inventory account), rate, previous/current quantity and value, quantity and value deltas, derived new quantity and value, value impact in paise |
| Period | company/year/name/date range/status/lock type/actor/date/reason — partial module |
| Unlock request | period/requester/reason/status/approver/timestamps — partial module |

## Money and dates

- Domain engines store money as safe integers in paise.
- UI input is converted with `minor()` and formatted with `money()`.
- Date-only values use ISO `YYYY-MM-DD` strings.
- Audit timestamps use ISO date-time strings.
- Never mix rupee decimal values with paise fields in posting code.

## Identity and consistency

- Browser entities generally use `crypto.randomUUID()`. `src/crypto-uuid.js` installs a UUID v4 fallback when that method is missing (HTTP VM / non-secure context), so identity generation does not require HTTPS.
- Human document numbers are generated locally and checked case-insensitively.
- Revisions protect some draft edits from stale updates.
- Posting and allocation tokens implement local idempotency.
- Current clone-and-return commands provide aggregate atomicity in memory; `localStorage` writes are not multi-user transactions.

## Proposed production database

Minimum aggregates/tables: companies, branches, users, roles, permissions, financial years, financial periods, period locks, unlock requests, period audit events, accounts, account mappings, customers, vendors, items, tax codes/rates, sales orders/lines, invoices/lines/tax lines, credit notes/lines/applications, receipts/allocations, bank accounts/statements/matches/reconciliations, journals/journal lines, document sequences, attachments, templates/preferences, and audit events.

Required properties:

- Every business row carries `company_id`; dimensioned rows carry nullable/required `branch_id` and `cost_centre_id` according to account rules.
- Journal and journal-line tables are append-only after posting.
- Monetary columns use fixed integer minor units or exact decimal database types with one documented convention.
- Unique constraints cover company-scoped document numbers, account codes, idempotency keys, and allocation tokens.
- Foreign keys prevent orphaned master/source references.
- Optimistic concurrency uses a revision/version column.
- Period status validation and journal creation occur in the same database transaction.
Item records may include `taxApplicable`, `taxRate`, `interStateTaxRate`, `cessRate`, `taxPreference` and `priceTaxMode` (`exclusive` or `inclusive`). `taxRate` is the total GST of an intra-state supply and is what a sales or purchase line splits into CGST + SGST, while `interStateTaxRate` is the IGST rate of an inter-state supply; both are stored as strings and both are zeroed when the item is not taxable, which is recorded as `taxApplicable:false` with a `taxPreference` of `Non-taxable`, `Exempt`, `Zero Rated` or `Non-GST`. The selectable rates and treatments come from the shared `src/item-master.js` masters (`ITEM_TAX_RATES`, `ITEM_CESS_RATES`, `ITEM_TAX_TREATMENTS`) rather than a second tax-rate source. These are defaults copied into a sales-order or invoice line and may be overridden on that document. Item creation no longer collects a preferred vendor; production vendor relationships belong to purchasing/vendor-price agreements rather than the item’s core sales tax configuration.

