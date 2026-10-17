# Page & Accounting Map

**Last verified:** 2026-10-16  
**Primary sources:** `src/App.jsx`, `src/Navigation.jsx`, `src/ReportsSecondaryNav.jsx`, `src/page-knowledge.js`, `src/invoice-engine.js`, `src/receipt-engine.js`, `src/credit-note-service.js`, `src/sales-order-service.js`, `src/purchase-service.js`, `src/banking-service.js`, `src/inventory-adjustments.js`, `src/operations-store.js`, `src/settings-store.js`.

## What this document is

One section per page a user can reach in Wayvida Books. Each section states the page purpose, the actions on it, and what each action does to the accounts: the journal it produces (with the debit and credit sides), or why it deliberately produces none. Read it with `docs/ACCOUNTING-DOMAIN.md` (the posting rules) and `docs/DATA-MODEL.md` (the stored shapes); this file is the page-by-page index that ties a screen to the ledger effect.

The in-app equivalent is machine-readable: `src/page-knowledge.js` exports `pageKnowledge` (one entry per operational page with `purpose`, `workflow`, `statuses`, `accountingImpact`, `actions`) and `statusKnowledge` (the meaning, allowed actions and accounting impact of every workflow status). When a screen and a document disagree, the engine in `src/` is authoritative and both this file and `src/page-knowledge.js` should be corrected.

## Rules that hold on every page

- **Double entry.** Every posting is a journal whose total debit equals total credit. `journal()` in `src/invoice-engine.js` refuses to persist an unbalanced entry, a line on an inactive or non-posting account, or a manual line on a control account (`controlAccount` or `allowManualPosting:false`).
- **Idempotency.** Each engine call carries a token; re-running the same command returns the existing journal instead of posting a second one.
- **Period lock.** Posting first validates the document date through `validatePostingDate()` / `checkPeriodLock()`; a closed period blocks the posting unless an authorized unlock is in force. See `docs/PERIOD-LOCKING-SPECIFICATION.md`.
- **Reversals, not edits.** A posted document is immutable. Cancelling or reversing it writes an equal-and-opposite journal that preserves the original. Drafts are the only editable state.
- **Master data never posts.** Creating a customer, vendor, item, category, bank account link or setting writes a record and no journal.
- **Reports never post.** Every page under the Reports section is a read-only projection of already-posted journals and documents.

### Workflow statuses

`src/page-knowledge.js` `statusKnowledge` defines the shared vocabulary:

| Status | Accounting impact | Typical next states |
| --- | --- | --- |
| Draft | No accounting entry | Pending Approval, Approved, Cancelled |
| Pending Approval | No posting yet | Approved, Draft, Cancelled |
| Approved | Posting may still be required | Posted, Sent, Cancelled |
| Posted | Journal, ledger and reports updated | Paid, Partially Paid, Reversed |
| Issued | Receivable or payable reduced | Adjusted, Cancelled |
| Unmatched | No effect until categorized | Matched, Categorized, Excluded |
| Matched | No duplicate journal created | Reconciled |
| Locked | Reconciled history retained | In Progress |
| Cancelled | Posted records need an opposite journal | - |

## At a glance

| Page | Posts? | Journal, when it posts |
| --- | --- | --- |
| Dashboard | No | Read-only summary |
| Chart of Accounts | No | Master data; group accounts can never post |
| Journal Entries | Yes (manual + automatic) | Operator entry; Dr total = Cr total |
| Items | No | Item master |
| Income | Yes | Dr Bank/AR, Cr Income, Cr GST Payable |
| Income Categories | No | Category-to-account mapping |
| Expense Claims / Create Expense | Yes | Dr Expense, Cr Bank/Payable |
| Expense Categories | No | Category-to-account mapping |
| Customers | No | Master data |
| Sales Orders | No | Commercial commitment |
| Invoices | Yes | Dr AR, Cr Income, Cr Output GST |
| Payments Received | Yes | Dr Bank, Cr AR (or Cr Customer Advance) |
| Credit Notes | Yes | Dr Sales Adjustment + Output GST, Cr AR |
| Customer Statement | No | Read-only statement |
| Vendors | No | Master data |
| Purchase Orders | No | Commercial commitment |
| Goods Receipts | No | Quantity control only |
| Purchase Bills | Yes | Dr Purchase/Expense + Input GST, Cr AP |
| Debit Notes | Yes | Dr AP, Cr Purchase/Expense + Input GST |
| Payments Made | Yes | Dr AP, Cr Bank |
| Purchase Reports | No | Read-only |
| Bank Accounts | Yes (opening balance only) | Dr Bank ledger, Cr Opening Balance Equity |
| Bank Transactions | Yes (categorize / manual) | Balanced journal or none when matched |
| Bank Reconciliation | No duplicate post; may create on categorize | Matching only, or one balanced journal per categorized line |
| Bank Transfers | Yes | Dr destination ledger, Cr source ledger |
| Banking Settings | No | Configuration |
| Asset Register | Yes (capitalize) | Dr Fixed Asset, Cr Bank or AP |
| Depreciation | Yes | Dr Depreciation Expense, Cr Accumulated Depreciation |
| Asset Transactions | No | Read-only projection |
| Budgets | No | Planning |
| Period Lock | No | Restricts posting; no journal |
| Inventory Adjustments | Yes | Dr/Cr Inventory Asset and the adjustment account |
| Settings Center, Company, Branches, Users & Roles, Tax Settings | No | Configuration |
| Help Center | No | Documentation |
| Reports (all leaves) | No | Read-only projections |
## Dashboard

- **Purpose:** read-only landing summary (cash flow chart, receivables/payables ageing, top expenses, bank balances, task list, recent transactions).
- **Source:** `src/App.jsx` (dashboard branch).
- **Actions:** navigation only; the sample cards raise a toast. No journal.
- **Accounting:** none. Every figure is illustrative until the underlying registers are posted.

## Accounting

### Chart of Accounts

- **Purpose:** the reusable account hierarchy every posting and report reads.
- **Source:** `src/AccountWorkspace.jsx`, `src/account-master.js`, `src/account-store.js`.
- **Actions:** choose an account type, create a posting or group account, map operational modules, review the ledger.
- **Accounting:** creating, editing or deactivating an account posts nothing. Two structural guards matter: group accounts are never valid posting targets, and an account that already has posted lines cannot be deleted (deactivate it instead).
- **Statuses:** Active, Inactive.

### Journal Entries

- **Purpose:** shows the automatic journals the engines post, plus controlled accountant adjustments.
- **Source:** `src/InvoiceWorkspace.jsx` (page `Journal Entries`), posting via `journal()` in `src/invoice-engine.js`, sample data in `src/simple-journal-transaction.js`.
- **Actions:** create a manual journal, balance debit and credit, post, reverse, view.
- **Accounting:** a manual journal posts as written (Dr total = Cr total). Posting is blocked when the entry is unbalanced, the date is locked, or a line targets a restricted account; control accounts reject manual journal posting and require a source transaction.
- **Statuses:** Draft, Pending Approval, Posted, Reversed.

## Items

- **Purpose:** item master (codes, units, rates, tax, inventory link).
- **Source:** `src/Items.jsx`, `src/item-master.js`.
- **Actions:** create, edit, activate/deactivate, delete.
- **Accounting:** none. Items are referenced by sales and purchase documents and by inventory adjustments; only the documents post.

## Income

### Income (register + Record Income)

- **Purpose:** records business income and, when money is received, the cash entry.
- **Source:** `src/IncomeReport.jsx`, `src/CreateIncomePage.jsx`, engine `createIncome` / `markIncomeAsReceived` / `reverseIncome` in `src/operations-store.js`.
- **Actions and their journals:**
  - **Record Income → Save Income** (`createIncome`, status not Draft): *received* → Dr Bank/Cash (default `1010`), Cr income account (default `4100`); *not yet received* → Dr Accounts Receivable (`1100`), Cr income. When the tax field carries a GST rate, a further Cr GST Payable (`2100`) is added (net + GST split for an exclusive amount). Since 2026-10-16 that split is `src/income-tax.js` `directIncomeTax`: the credit to the income account is the TAXABLE value and one Cr is written per non-zero cgst/sgst/igst component, the components and the CGST/SGST against IGST choice coming from `placeOfSupply({buyerState,registeredState})` rather than a hardcoded state, and a treatment that carries no GST (`Tax Exempt`, `Zero Rated`, `Non-GST / Out of Scope`) writes no tax line at all. An inclusive receipt derives that base out of the gross, so the Dr to Bank/Cash always equals the money the operator says was received and is never enlarged to make room for the tax.
  - **Record Income → Income For = Payment for Existing Invoices → Save Income** (`saveInvoiceReceipt` in `src/income-receipts.js`, over the existing receipt engine): Dr the chosen cash/bank ledger for the full amount received, Cr Accounts Receivable (`1100`) for the money allocated to invoices, and Cr the customer-advance liability (the configured `config.receipts.advanceAccount`, demo `2200`) for any remainder the operator chose to hold - the two credits always add back to the amount received. The payment NEVER credits the income account (default `4100`) and never posts GST Payable again, because the sales invoice already recorded both - which is why the page prints `GST already included in invoice amounts.` with `Additional GST on receipt` at Rs 0.00, and why it asks the operator for no treatment or rate at all on this workflow. A remainder held as an advance is classified before it is held: a taxable services advance adds one Cr per tax component and credits the liability NET of it, a goods advance is outside the charge when the money is received and credits the full amount, and a remainder nobody has classified is refused rather than filed as tax-free. `createReceiptIncome` files the register row (`INV-` document number, `receiptType:'InvoicePayment'`) with no journal of its own. A stale allocation (an invoice paid or cancelled while the form was open) is rejected in the operator's words rather than adjusted, and the `idempotencyKey` reuses the receipt a retry already created.
  - **Record Income → Income For = a direct income category** (interest, rent, commission, service, other): the invoice-allocation table is hidden and the entry is the ordinary one - Dr Bank/Cash (default `1010`) or Accounts Receivable (`1100`), Cr the mapped income account with the TAXABLE value, with one Cr per non-zero CGST/SGST/IGST component when the chosen treatment is taxable at a rate this book configures (`configuredRates`), and with no tax line when the treatment is `Tax Exempt`, `Zero Rated` or `Non-GST / Out of Scope`.
  - **Cancel Record on a settlement** (`reverseIncome` → `receiptCommand(state,'reverse',…)`): the receipt engine reverses its own journal, voids the allocations and restores the invoice balances.  - **Record Income → Save Draft:** no journal (status Draft).
  - **Save Income** for an amount marked not received stores status `Pending`; marking it received later posts a second journal.
  - **Mark Income Received** (`markIncomeAsReceived`): Dr Bank, Cr Accounts Receivable, source `Income Collection`.
  - **Edit (draft only)** (`updateIncome`): rewrites the draft, keeps the income's own number, and posts exactly as Save Income does the moment the edit records it - a received edit posts Dr Bank/Cash, Cr income account with the same GST split, an unreceived edit posts Dr Accounts Receivable, Cr income. An income that is not a Draft is refused, so a posted income is corrected by cancelling it and recording a new one.
  - **Cancel Record** (`reverseIncome`): an equal-and-opposite journal with source `Income Reversal`.
  - **Import Income:** one `createIncome` per imported row, so it posts exactly as the manual action does.
- **Statuses:** Draft (no journal), Pending (not received), Posted (received) - the words the record and the engine store. The Income register states every one of them in its own three-word vocabulary, `Draft`, `Recorded` or `Cancelled`, and keeps a cancelled income on the page.
- **Note:** the Create Income page's `Save Draft` button passes `status:'Draft'`, and `createIncome` honours it by skipping the journal.

### Income Categories

- **Purpose:** classify income and set a default posting account.
- **Source:** `src/IncomeCategories.jsx`, `src/operations-store.js` (`createIncomeCategory`).
- **Actions:** create, edit, deactivate.
- **Accounting:** none; the mapping is applied when an income record posts.

## Expenses

### Expense Claims and the Create Expense page

- **Purpose:** capture business costs and record the payment (or payable).
- **Source:** `src/OperationalModules.jsx` (page `Expense Claims`), `src/ExpenseReport.jsx`, `src/CreateExpensePage.jsx`, engine `createExpense` in `src/operations-store.js`.
- **Actions and their journals:**
  - **New expense → Save Expense** (`createExpense`): Dr the expense account (default `5900` Other Expenses), Cr the paid-through account (default `1010` Bank). The record is stored with status `Posted` and its `journalId` is set.
  - **Bulk Expense Entry:** one `createExpense` per valid line, so each line is its own posted journal.
  - **Import:** one `createExpense` per imported row.
  - **Save Draft:** the Create Expense page passes the draft status through, but `createExpense` does not branch on it today - the record is still written as `Posted` and the journal is still posted. Treat Save Draft on this page as a posted expense until the engine is changed.
- **Statuses:** Posted (a Draft value can be written by the form but the engine normalises to Posted).
- **Note:** the Expense details drawer opens on the right and its footer links to Journal Entries and General Ledger.

### Expense Categories

- **Purpose:** classify expenses and set a default posting account.
- **Source:** `src/OperationalModules.jsx` (page `Expense Categories`), `createCategory` in `src/operations-store.js`.
- **Actions:** create, edit, deactivate.
- **Accounting:** none.

## Sales

### Customers

- **Purpose:** customer identity, tax and receivable defaults.
- **Source:** `src/Customers.jsx`, `src/customer-tax.js`.
- **Actions:** create, edit, activate/deactivate, duplicate, delete, view customer, view statement.
- **Accounting:** none on the master. A customer used by a document is deactivated rather than deleted; inactive customers cannot be selected for new documents.

### Sales Orders

- **Purpose:** record a customer commitment before invoicing.
- **Source:** `src/SalesOrders.jsx`, `src/sales-order-service.js`.
- **Actions:** create, edit, confirm, convert to invoice, print.
- **Accounting:** **none.** A sales order is a commercial commitment; it creates no journal, receivable or revenue. Accounting begins only when the generated invoice is posted.
- **Statuses:** Draft, Confirmed, Completed, Cancelled.

### Invoices

- **Purpose:** bill a customer and create the receivable.
- **Source:** `src/InvoiceWorkspace.jsx`, `src/invoice-engine.js` (`post`), `src/invoice-tax.js`.
- **Actions and their journals:**
  - **Post** (allowed from Draft or Pending Approval): Dr Accounts Receivable for the total, Cr the line income account(s) for the taxable value, Cr CGST/SGST/IGST/Cess for each component present, and a round-off line to the rounding account (`5900`) when enabled. AR account defaults to `1100`, sales to `4100`, output tax to `2100` (`src/invoice-engine.js` `initial().config`).
  - **Receive payment** (`recordPayment`): Dr Bank/Cash, Cr AR. Payment date must be on or after the invoice date and cannot exceed the outstanding amount.
  - **Cancel** (`cancel`): when the invoice was posted, writes an `Invoice Reversal` journal with the original lines swapped (debit↔credit). Blocked when the invoice has payments, allocations or live credit notes.
- **Statuses:** Draft, Pending Approval, Approved, Sent, Partially Paid, Paid, Overdue, Cancelled.

### Payments Received (Receipts)

- **Purpose:** record customer money and optionally allocate it to invoices.
- **Source:** `src/Receipts.jsx`, `src/receipt-engine.js`.
- **Actions and their journals:**
  - **Post** (`post`): Dr Bank (an active cash/bank/wallet asset account), Cr Accounts Receivable for a normal receipt, or Cr Customer Advance for an advance receipt. The bank and receivable accounts must differ.
  - **Allocate:** a normal allocation only tags invoices and posts nothing; an advance allocation posts Dr the advance liability, Cr AR (source `Advance Allocation`).
  - **Reverse** (`reverse`): a manager reverses a posted receipt; each affected journal (the receipt and its advance allocations) gets an equal-and-opposite reversal. Blocked while a bank match is live.
- **Statuses:** Draft, Pending Approval, Posted, Reversed, Cancelled.

### Credit Notes

- **Purpose:** customer return or billing adjustment against an invoice.
- **Source:** `src/CreditNotes.jsx`, `src/credit-note-service.js` (`creditCommand`, `creditPostingPlan`).
- **Actions and their journals:**
  - **Issue** (`issue`): Dr the Sales Adjustment / revenue account for the taxable value, Dr the GST adjustment (or compatible output-tax) account for the tax reversed, Cr Accounts Receivable for the total. Mappings come from settings, with three documented fallbacks (role account → shared Sales Adjustment → the invoice line's own income account → configured Sales account; plus a reason-specific return/adjustment account and a per-document adjustment account on the amount-based method).
  - **Apply credit:** an allocation only - it reduces the invoice outstanding and posts nothing.
  - **Refund:** Dr AR, Cr Bank.
  - **Cancel/Reverse:** an equal-and-opposite `Credit Note Reversal` journal; blocked while a refund is outstanding.
- **Statuses:** Draft, Pending Approval, Approved, Issued, Cancelled.

### Customer Statement

- **Purpose:** statement of one customer's postings and allocations.
- **Source:** `src/CreditNotes.jsx` (page `Customer Statement`), `customerStatement()` in `src/credit-note-service.js`.
- **Actions:** view, print/export.
- **Accounting:** none - a read-only projection.

## Purchases

### Vendors

- **Purpose:** supplier identity, tax and payment defaults.
- **Source:** `src/Vendors.jsx`, `src/vendor-store.js`.
- **Actions:** create, edit, deactivate, view ledger.
- **Accounting:** none on the master.

### Purchase Orders

- **Purpose:** authorize intended goods or services from a vendor.
- **Source:** `src/Purchases.jsx` (page `Purchase Orders`), `src/purchase-service.js`.
- **Actions:** create, open/approve, receive, convert to bill, print.
- **Accounting:** **none.** A purchase order is a commitment; it creates no journal and no payable. Converting it produces a Purchase Bill draft.
- **Statuses:** Draft, Approved, Open, Partially Received, Received, Partially Billed, Completed, Cancelled.

### Goods Receipts

- **Purpose:** record quantities received against an open purchase order.
- **Source:** `src/GoodsReceipts.jsx`, `src/purchase-service.js`.
- **Actions:** create, view, convert to bill.
- **Accounting:** **none.** A goods receipt is a quantity document; it validates cumulative received quantity against ordered quantity and preserves PO/line traceability. No journal, no AP balance.
- **Statuses:** Posted, Cancelled.

### Purchase Bills

- **Purpose:** record vendor invoices and create Accounts Payable.
- **Source:** `src/Purchases.jsx` (page `Purchase Bills`), `postPurchaseBill` in `src/purchase-service.js`.
- **Actions and their journals:**
  - **Post:** Dr the mapped purchase/expense account per line (default `5000`), Dr Input CGST (`1410`) / Input SGST (`1420`) / Input IGST (`1430`) / Input Cess (`1440`) for each component, a round-off line when enabled, and Cr Accounts Payable (`2000`). The period is validated first; a posted bill is immutable.
  - **Cancel:** requires a reason and an open reversal date, is blocked while posted payments exist, and creates an equal-and-opposite journal.
- **Statuses:** Draft, Unpaid, Partially Paid, Paid, Cancelled.

### Debit Notes

- **Purpose:** vendor credit from a purchase return, pricing correction or other adjustment.
- **Source:** `src/DebitNotes.jsx`, `src/purchase-service.js`.
- **Actions and their journals:**
  - **Post:** Dr Accounts Payable, Cr the purchase/expense account and the applicable Input CGST/SGST/IGST/Cess.
  - **Apply to a bill:** a subledger allocation that reduces the bill balance and posts nothing second.
  - **Void:** an equal-and-opposite `Purchase Debit Note Reversal` journal, with the linked bill's credit rebalanced.
- **Statuses:** Draft, Pending Approval, Approved, Posted, Adjusted, Voided.

### Payments Made (Vendor Payments)

- **Purpose:** settle posted vendor bills from a bank account.
- **Source:** `src/VendorPayments.jsx`, `recordPurchasePayment` in `src/purchase-service.js`.
- **Actions and their journals:** **Record payment** posts Dr Accounts Payable, Cr Bank. The payment is idempotent, validates the date/period, and cannot exceed the outstanding bill balance. **Reverse** writes the opposite journal.
- **Statuses:** Posted, Reversed.

### Purchase Reports

- **Purpose:** purchase-side read-only reporting.
- **Source:** `src/PurchaseReports.jsx`, `src/purchase-reports.js`.
- **Accounting:** none.

## Banking

### Bank Accounts

- **Purpose:** link a real bank account to an Assets posting ledger.
- **Source:** `src/Banking.jsx`, `saveBankAccount` in `src/banking-service.js`.
- **Actions and their journals:** **Create bank account** writes the master record and, when an opening balance is given, posts an `Opening Balance` journal: Dr the bank ledger, Cr Opening Balance Equity (`3000`). One posting ledger can link to only one bank account.
- **Statuses:** Active, Inactive.

### Bank Transactions

- **Purpose:** shows posted book activity and imported statement lines.
- **Source:** `src/Banking.jsx`, `src/banking-service.js`.
- **Actions and their journals:**
  - **Import statement** (`importStatement`): no journal; writes `Unmatched` statement rows.
  - **Match** (`matchStatement`): links a statement line to an existing book entry; no second journal.
  - **Create accounting from a statement line** (`createStatementEntry`): a Money In line posts Dr Bank, Cr the counter account (Interest Income `4200` for interest/categorize income, or AR `1100` for a customer receipt); a Money Out line posts Dr the counter account (Bank Charges/Expense `6100`), Cr Bank.
  - **Record manual transaction** (`recordManualTransaction`): Money In → Dr Bank, Cr counter; Money Out → Dr counter, Cr Bank.
  - **Exclude** (`excludeStatement`): no journal; the line is set `Excluded`.
- **Statuses:** Unmatched, Matched, Categorized, Excluded.

### Bank Reconciliation

- **Purpose:** prove a bank statement agrees with the posted bank ledger for a period.
- **Source:** `src/BankReconciliation.jsx`, `src/banking-service.js` (`createReconciliation`, `autoMatchReconciliation`, `completeReconciliation`, `unlockReconciliation`).
- **Actions and their journals:** create reconciliation, import statement, auto match, match, categorize (may create one balanced journal per line via `createStatementEntry`), complete, export, unlock. Completion requires every unmatched line resolved and a zero difference, then locks the period; unlock needs the permission and a reason.
- **Statuses:** Draft, In Progress, Completed, Locked (in-app knowledge lists Draft / In Progress / Locked).

### Bank Transfers

- **Purpose:** move money between two linked bank accounts.
- **Source:** `src/Banking.jsx`, `transferMoney` in `src/banking-service.js`.
- **Actions and their journals:** **Transfer** posts a `Bank Transfer` journal: Dr the destination ledger, Cr the source ledger. Source and destination must differ; the date is locked-checked.

### Banking Settings

- **Purpose:** import settings, reconciliation settings, permissions, matching and categorization rules.
- **Source:** `src/BankingSettings.jsx`, `src/banking-service.js`.
- **Accounting:** none - configuration only.

## Assets

### Asset Register

- **Purpose:** maintain capital assets and their depreciation configuration.
- **Source:** `src/OperationalModules.jsx` (page `Asset Register`), `createAsset` in `src/operations-store.js`.
- **Actions and their journals:**
  - **Create asset (capitalize)** (`createAsset`): Dr the fixed-asset account (default `1300` Fixed Assets), Cr Bank (`1010`) for a cash purchase or Cr Accounts Payable (`2000`) when purchase mode is `On credit`. The asset is stored Active and an `Asset Acquisition` journal is written.
  - **Edit** updates the register record; **Depreciate** posts through the Depreciation page.
- **Statuses:** Draft, Active, Disposed.
- **Note:** the in-app knowledge and the demo data mention asset **disposal** (`type:'Disposal'`), but no disposal posting command exists in `src/operations-store.js` today - it is a documented gap, not a live posting.

### Depreciation

- **Purpose:** allocate asset cost over useful life.
- **Source:** `src/OperationalModules.jsx` (page `Depreciation`), `postDepreciation` in `src/operations-store.js`.
- **Actions and their journals:** **Post** writes a `Depreciation` journal: Dr Depreciation Expense (`5800`), Cr Accumulated Depreciation (`1350`), and reduces the asset book value. A value must be positive and no larger than the remaining book value.
- **Statuses:** Draft, Posted.

### Asset Transactions

- **Purpose:** shows capitalization, depreciation and disposal events.
- **Source:** `src/OperationalModules.jsx` (page `Asset Transactions`), `src/operations-store.js`.
- **Actions:** filter, view, open journal/ledger.
- **Accounting:** none - a read-only projection of asset journals.

## Reports

Every page below is a read-only projection: none of them posts a journal. The eligible rows, balances and totals are recomputed from already-posted journals and documents.

- **Transaction Register** - one index of every business transaction, each document linked to the journal it posted (`src/TransactionRegister.jsx`, `src/transaction-register.js`).
- **Journal Report** - one row per posted journal line, with each voucher re-proved from its own lines (`src/JournalReport.jsx`, `src/journal-report.js`).
- **General Ledger** - posted journal lines for one account with a running balance (`src/GeneralLedgerPro.jsx`, `ledger()` in `src/invoice-engine.js`).
- **Trial Balance** - closing debit and credit balances, proving they agree (`src/TrialBalance.jsx`, `src/trial-balance.js`).
- **Profit & Loss** - income and expenses to a net result (`src/ProfitLoss.jsx`, `src/profit-loss.js`).
- **Balance Sheet** - assets, liabilities and equity through a date (`src/BalanceSheet.jsx`, `src/balance-sheet.js`).
- **Cash Flow Statement** - cash movement by activity (`src/CashFlowStatement.jsx`, `src/cash-flow.js`).
- **Customer Outstanding** - outstanding receivable per customer (`src/CustomerOutstanding.jsx`, `src/customer-outstanding.js`).
- **Supplier Outstanding** - outstanding payable per vendor (`src/SupplierOutstanding.jsx`, `src/supplier-outstanding.js`).
- **Customer Aging** / **Supplier Aging** - outstanding bucketed by days past the document due date, re-proved against the AR/AP control account (`src/AgingReport.jsx`, `src/aging.js`).
- **Cash & Bank Book** - one row per posted journal line that touched a money account (`src/CashAndBankBook.jsx`, `src/cash-banking.js`).
- **Bank Reconciliation Report** - a read-only report of completed reconciliations (`src/BankReconciliationReport.jsx`).
- **GST Reports** - GST documents and component balances from posted invoices, credit notes and purchase documents (`src/GstTaxReports.jsx`, `gstDocuments()` in `src/credit-note-service.js`).
- **TDS Reports** - configured withholding transactions (`src/TdsReports.jsx`, `src/tax-compliance.js`).
- **Sales Report** - posted sales documents and totals (`src/SalesReport.jsx`, `src/business-reports.js`).
- **Purchase Report** - posted purchase documents and totals (`src/PurchaseReport.jsx`, `src/business-reports.js`).
- **Expense Report** - posted expense claims with filters and detail (`src/ExpenseReport.jsx`, `src/business-reports.js`).
- **Audit Log** - configuration and document change history (`src/AuditLog.jsx`, `src/audit-log.js`).
- **Financial Reports** - an in-page index of the above statements (page `Financial Reports` in `src/OperationalModules.jsx`).

## Settings

### Settings Center

- **Purpose:** control future ERP behaviour without rewriting posted history.
- **Source:** `src/SettingsWorkspace.jsx`, `src/settings-store.js`.
- **Actions:** choose a setting group, edit, save.
- **Accounting:** none from configuration alone. Default account mappings here (sales revenue `4000`, AR `1100`, output GST `2100`, purchase `5000`, AP `2000`, expense `5900`, bank `1010`, and so on) are the codes the posting engines read.

### Company

- **Purpose:** company legal and regional profile (name, GSTIN, financial year, currency).
- **Source:** `src/App.jsx` (page `Company`), `src/CompanySetup.jsx`.
- **Accounting:** none.

### Branches

- **Purpose:** branch master used for branch-scoped posting and reporting.
- **Source:** `src/App.jsx` (page `Branches`), `src/organisation-scope.js`.
- **Accounting:** none. Branch dimensions are copied onto journal lines at posting; a branch-required account fails to post without one.

### Users & Roles

- **Purpose:** roles, access and security policy.
- **Source:** `src/SettingsWorkspace.jsx`, `src/RolesSettingsPanel.jsx`.
- **Accounting:** none.

### Tax Settings

- **Purpose:** GST and TDS configuration.
- **Source:** `src/SettingsWorkspace.jsx`, `src/settings-store.js`.
- **Accounting:** none - it supplies the rates and accounts the posting engines use.

### Budgets

- **Purpose:** plan account amounts by period and compare to actuals.
- **Source:** `src/BudgetWorkspace.jsx`, `src/budget-store.js`, `createBudget` in `src/operations-store.js`.
- **Actions:** create, edit, and open the `Budget vs Actual` view.
- **Accounting:** none - a plan; the actual side is read from posted journals.

### Period Lock

- **Purpose:** protect finalized accounting dates.
- **Source:** `src/PeriodClosing.jsx`, `src/period-locking.js`.
- **Actions:** review the period, run closing checks, close the period, request unlock, approve and audit.
- **Accounting:** none - it writes no journal, but it restricts every other page's posting commands. Old dates cannot post while a period is closed; temporary unlocks expire.
- **Statuses:** Open, Closing, Closed, Reopened.

### Inventory Adjustments

- **Purpose:** correct stock quantity and value with accounting effect.
- **Source:** `src/InventoryAdjustments.jsx`, `src/inventory-adjustments.js` (`adjustmentCommand`, `entryLines`).
- **Actions and their journals:** **Post** writes an `Inventory Adjustment` journal: the inventory-asset accounts (`1200` or the item's own inventory account) take the value-movement side, and the configured adjustment account (settings `accountMappings.stockAdjustment`) takes the balancing side - debits before credits. A movement worth nothing posts no entry at all. **Reverse** writes an `Inventory Adjustment Reversal`.
- **Statuses:** Draft, Posted, Reversed.

## Help Center

- **Purpose:** in-app guidance and glossary for the modules.
- **Source:** `src/HelpCenter.jsx`, `src/help-content.js`, `src/page-knowledge.js`.
- **Accounting:** none.

## Related documents

- `docs/ACCOUNTING-DOMAIN.md` - the posting rules and invariants every engine obeys.
- `docs/DATA-MODEL.md` - the stored document and journal shapes.
- `docs/GLOSSARY.md` - the accounting vocabulary used above.
- `docs/MODULES.md` - the change log of module behaviour.
- `docs/PERIOD-LOCKING-SPECIFICATION.md` - the period states and unlock rules.
