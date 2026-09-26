# Data Model

**Last verified:** 2026-09-26  
**Primary sources:** `invoice-engine.js`, `account-master.js`, `receipt-engine.js`, `credit-note-service.js`, `period-locking.js`, `organisation-scope.js`, `organisation-context.js`.

### Additive account-master fields

Current browser records may include `reportingCategory`, `applicableBranches[]`, `moduleMappings[]`, `taxTreatment`, `defaultTaxRate`, `currency`, `createdBy`, `createdAt`, `modifiedBy`, and `modifiedAt`. These are additive prototype contracts. `branchId` remains the first applicable branch for backward compatibility, and account `code` remains the journal/ledger reference key.


### Simple transaction records

A transaction recorded through `src/simple-journal-transaction.js` and stored under `wayvida-manual-journals-v2` (the shared `MANUAL_JOURNAL_KEY`) keeps `id`, `number` (`JE-<financial year>-<six digits>`), `date`, `type: 'Business Transaction'`, `reference`, `narration` (the transaction name), `attachments[]`, `status` (Draft, Pending Approval, Approved, Rejected, Reversed or Cancelled), `createdBy`/`createdAt`/`modifiedAt`, `organizationId`/`organizationName`/`branchId`/`branchName`, `amount` in integer paise, `lines[]` carrying rupee amounts in the same shape the advanced editor writes, `simpleTransaction` (`transactionType`, `label`, `name`, `moneyAccount`, `toAccount`, `categoryAccount`, `categoryLabel`, `counterpartyAccount`, `partyId`, `partyName`, `documentId`, `documentNumber`, `description`, `externalReference` and the rupee `amount` string), `audit[]`, and, where they apply, `submittedBy`/`submittedAt`, `publishedBy`/`publishedAt`, `rejectedBy`/`rejectedAt`/`rejectionReason`, `cancelledBy`/`cancelledAt`/`cancellationReason`, `ledgerJournalId`, `reversalOf` and `reversalJournalId`/`reversalReason`/`reversedBy`/`reversedAt`. `automatic: true` marks a row projected from another module (an invoice or purchase payment), which the register shows with Preview only. Earlier rows may still carry the retired vocabulary; `normaliseStatus()` maps it on read and nothing rewrites stored records.

## Current persistence

The main accounting aggregate is stored under `wayvida-accounting-v1`. It contains a version, accounts, invoices, payments, journals, audit events, and configuration; later modules add arrays such as receipts, receipt allocations, credit notes, credit applications, openings, and account audit records. Feature UIs may use additional local keys. Storage is device/browser-specific and must not be treated as a database.

Important transient keys include `wayvida-open-account`, `wayvida-open-invoice`, `wayvida-open-credit`, and customer/document selection hints. These are navigation conveniences, not entity ownership. The sales create pages add their own keys for the Edit-customer detour: `wayvida-draft-order` / `wayvida-draft-invoice` hold the unsaved document, `wayvida-edit-customer` names the record to open and `wayvida-return-to` names the page to return to. They are consumed on the way back and are never read as entity data.

### Journal creation helpers

`wayvida-manual-journals-v2` stores the manual journal records shown by the Journal Entries register, including their lines, lifecycle status, attachments and audit array. It stays separate from the posted journal list inside `wayvida-accounting-v1`, which is written only by the posting engine.

Two presentation-only keys support the Create Journal Entry page and are never read by the ledger, reports or posting engine: `wayvida-journal-templates-v1` stores reusable templates (name, journal type, lines and an optional `None`, `Every month` or `Every year` repeat label) and `wayvida-journal-account-prefs-v1` stores the recent and favourite account codes used by the account picker. Sources: `src/JournalEntriesPro.jsx`, `src/journal-templates.js`, `src/JournalAccountPicker.jsx`. The Create Journal Entry page does not write the working-context keys (`wayvida-context-companies`, `wayvida-context-branches`, `wayvida-context-mode`, `wayvida-demo-company`, `wayvida-demo-branch`) or dispatch the working-context events at all: organisation and branch are edited per line instead, and no second context store exists. No field was added to the stored journal record: the mandatory reason (`narration`) is now edited in the metadata row, the collapsed Additional details keep the existing attachments array and approval comments projected from the existing audit trail, and the per-line organisation and branch selects write the `organization` and `branch` name fields that `emptyLine()` already stamped and `postToLedger()` already reads.

### Customer Master

`wayvida-customers` stores the customer records read by the register, the Customer Details screen, invoices, sales orders, receipts and credit notes. The core keys are unchanged and keep their meaning: `id`, `code` (unique, `CUSnnn` from `nextCustomerCode`), `name`, `type` (`Business` or `Individual`), `contact`, `email`, `phone`, `billing`, `shipping`, `state` (the place of supply), `limit`, `days` (credit days), `opening`, `account` (the receivable account code), `status` and the optional additive `auditTrail`.

The 2026-09-18 Create / Edit Customer rework adds only optional keys:

- `displayName` - defaults to `name` at save time.
- `gstTreatment` - one of the seven `GST_TREATMENTS` values. It drives which of the keys below are meaningful: a treatment that carries no GSTIN stores an empty `gstin`, an Overseas customer stores the billing country in `state` instead of an Indian state, and only `Tax Exempt` stores an `exemptionReason`. A record that names no treatment of its own is given the one its own data supports: a GSTIN present keeps the registered default, none opens `Unregistered Business`, and an `Individual` stays `Consumer` - handing a record without a GSTIN the registered default made it impossible to save.
- `taxPreference` - one of `TAXABILITY` (`Taxable`, `Tax Exempt`, `Zero Rated`, `Non-GST / Out of Scope`); `exemptionReason` is stored only while it is `Tax Exempt`.
- `legalName`, `tradeName`, `gstStatus`, `taxpayerType` and `principalAddress` - the taxpayer fields, populated by the GST lookup and editable by the operator.
- `gstLookup` - `{at, status, source}` recorded when Get Taxpayer Details succeeds, so the lookup date and the returned GST status stay with the customer for reference.
- `website` - the input was removed, so nothing writes a new value, but an existing stored value is carried through `save` untouched.
- `billingAddress` and `shippingAddress` - `{line1, line2, city, state, pin, country}` with `country` defaulting to `India`, so the form reopens exactly what was entered. `line1` and `line2` are the Address 1 and Address 2 inputs.
- `shippingSameAsBilling` - boolean, true by default; while true the composed `shipping` mirrors `billing`.
- `currency` (default `INR`), `paymentTerms` (the chosen term label), `openingDate`, `website`, `tags`, `notes`.
- `contacts[]` - `{id, firstName, lastName, email, phone, designation, primary}`, with exactly one primary enforced by `normaliseContacts`.
- `customFields[]` - `{id, label, value}`.

`displayName`, `tags`, `notes` and `customFields` no longer have create/edit inputs, because the 2026-09-18 density pass removed them from More details. They remain part of the record: `save` carries their existing values through untouched, and `displayName` is still derived from `name` when it is blank. Reading them is therefore safe, and an existing customer never loses them by being edited.
- `documents[]` - `{id, name, size}` metadata only; the file content itself is never stored.

`billing`, `shipping` and `state` stay authoritative for every other module. They are composed from the structured objects by `composeAddress` and are never edited directly. A record written before this change carries no structured address, so `parseAddress` restores the whole composed string into `line1` instead of inventing parts, and `normaliseCustomer` fills every missing field so the form opens complete. No customer field posts a journal; the opening balance remains master data.

`wayvida-accounting-v1` also carries the recurring schedule a posted invoice can hold, as an additive optional `recurring` object: `{frequency, nextDate, endDate, setAt}`. `frequency` is one of the engine's `RECURRING_FREQUENCIES` (Monthly, Quarterly, Half-Yearly, Yearly), `endDate` is an empty string when the schedule has no end, and `setAt` is when it was last set. The `recurring` command action writes it, `off:true` writes `null` rather than dropping the key, and it changes no total, journal or posting field: the prototype records the schedule and does not generate or post future invoices.

### Credit Notes

`wayvida-accounting-v1` holds credit notes in `creditNotes`, their invoice applications in `creditApplications` and their refunds in `creditRefunds`. The stored lifecycle is `status` (Draft, Pending Approval, Approved, Issued, Cancelled); everything that has happened to the money is derived by `creditNoteStatus()` from the applications and refunds, never stored twice.

The refactor added only optional keys to a note: `type` (`Against Invoice` / `Standalone Credit Note`, with the earlier `Without Invoice` still read through `noteType`), `creditMethod` (`Item Based Credit` / `Amount Based Credit`), `inventoryImpact` (`Return Stock To Inventory` / `Financial Adjustment Only`), `adjustmentAmount`, `adjustmentTax`, `adjustmentAccount`, `companyId` / `companyName` / `branchId` / `branchName` for the posting scope, `internalNote`, `reason` from the structured vocabulary (a note written earlier keeps its own string and is read through `canonicalReason`), `reasonNote` for `Other`, `notes`, and `salesReturnId`, which links the note to a Sales Return document and is validated to belong to the same customer and invoice. A refund is an additive record: `{id, number, creditNoteId, customerId, customerName, amount, date, bank, method, reference, journalId, token, createdAt, createdBy}` - posting a balanced journal like every other ledger entry and never editing the note or the invoice.

A credit note never moves stock. The inventory side belongs to the Sales Return document, which is not built yet; until it is, no credit note can create an inventory movement.

### Vendor Master

`wayvida-vendors-v1` stores vendor identity, contact and multiple-address data, GST/PAN/TDS configuration, payment terms, bank details, opening balance metadata, status, audit timestamps, and the Accounts Payable control-account reference. The create/edit form writes one extra flag beside the two addresses: `shippingSameAsBilling`, which records whether the shipping address is held equal to the billing address and is why an edit reopens with the shipping grid either shown or hidden; the form mirrors a billing edit into shipping while the flag is true and `save` writes `shipping` from `billing` in that case, so the stored pair is never left disagreeing. A record written before the flag existed still opens: the form derives it by comparing the two stored addresses. The current UI stores attachment file names only; file contents are not uploaded. Vendors are sub-ledger entities and do not create one Chart of Accounts record per vendor. Sources: `src/vendor-store.js`, `src/Vendors.jsx`.

### Sales Orders

`wayvida-sales-orders` stores the order header (number, date, due date, terms, customer id and name, billing/shipping/place, reference, shipment, salesperson, notes, terms and conditions, files), its lines, the calculated totals and the tax policy, plus `status` (`Draft` / `Confirmed` / `Completed` / `Cancelled`).

2026-09-18 added five fields so the register can show the scope and the audit trail it was asked for. They are stamped at save from the working context and the acting role, never invented: `organizationId`, `organizationName`, `branchId` and `branchName` from `getCurrentOrganizationContext()`, and `createdBy` from the acting role (`Admin` for the Business owner view, `Accountant` for Head of Accountant). Each is written as `form.x||stamped`, so re-saving an existing order never overwrites a stored value, and an order saved before this change shows **Not recorded** in those columns until it is next saved.

Payment status is not stored on the order. The register derives it: it finds the invoice whose `sourceOrder` is the order and calls `paymentStatus(state, invoice)` from `src/invoice-engine.js`, which returns `Unpaid` / `Partially Paid` / `Paid` / `Overdue` from the receipts allocated to that invoice. An order with no linked invoice reads `Not invoiced`.

2026-09-19 added two additive optional fields to the order header, beside the existing `place` string: `placeSource` (`customer_address`, `shipping_address` or `manual`) and `placeCode`, the GST state code read from the existing `GST_STATE_CODES` table. `place` keeps its name and meaning - `calculate()` in `src/invoice-engine.js` compares it with the company state and every template and print preview prints it - so no stored value moved and no reader changed. A record saved before this change carries a `place` with no source, and that is read as `manual` on purpose, so an old order is never silently re-taxed. `convertSalesOrder` carries all three fields onto the invoice it creates, and the create page derives them through `placeOfSupplySuggestion` in `src/customer-tax.js`. Nothing here posts a journal; the posting path is unchanged and still requires a place of supply.

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
## Document line tax identity and the format preference (2026-09-25)

A sales or invoice LINE now carries the tax identity it inherited from the Item master: `hsnSac` (the 4-8 digit code `src/item-master.js` validates) and `itemType` (`Goods` or `Service`, which decides whether that code is printed as an HSN or an SAC). `itemDefaults(item)` in `src/SalesDocumentFields.jsx` copies both, `calculate()` passes unknown line keys through untouched, and the printed sheet reads `l.hsnSac` directly because it has the document but not the Item master. An ad-hoc line carries neither, so the code prints as an em dash rather than a blank.

The number and currency format is an ORGANISATION preference, stored with the other settings under `wayvida-settings-v1` in `organization`: `numberFormat` (a locale id such as `en-IN` or `en-US`), `currencySymbol`, `decimalPlaces` (0-4, `Default` being 2), `roundOffQuantity` and `roundOffRate`. Nothing on a document stores the format it was raised with, so a reprint follows the current setting - that is deliberate, and the round-off switches never move a posted amount, only how a quantity or a rate is written.
