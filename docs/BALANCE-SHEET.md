# Balance Sheet

**Last verified:** 2026-09-26

`src/BalanceSheet.jsx` is a read-only, date-based financial-position report over the shared account store. `src/balance-sheet.js` includes posted journals through the selected date, applies the selected branch, classifies account balances into assets, liabilities and equity, and includes current earnings in equity so the accounting equation can be checked.

The report uses the same surface and toolbar treatment as Day Book: a single white report card, title and description on the left, account search, a Filters disclosure and Export PDF on the right, analytic totals and a sticky balance validation footer. Organisation, branch, as-on date, report basis, financial year and comparison choices are in the Filters panel; searching narrows displayed account rows without altering totals.

The statement is one expandable accounting hierarchy rather than a flat account list. Assets, liabilities and equity each contain section and account-group rows, and account rows state account code, debit movement, credit movement and a business-facing positive closing balance. An account click still opens Chart of Accounts. Presentation uses the closing-balance magnitude so normal business readers are not shown confusing negative account signs; debit/credit movement retains the underlying accounting direction.

Account rows remain drill-down links to Chart of Accounts. The report never creates, posts, edits or deletes journals or accounts.

Validation: `node tests/balance-sheet.test.mjs`; `node scripts/validate-knowledge-docs.mjs`.
