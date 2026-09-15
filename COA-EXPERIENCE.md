# Chart of Accounts experience update

1. **Previous screen issues:** Basic creation exposed a large advanced form too early; setup and impact review shared one step.
2. **UX improvements:** Five explicit steps, optional advanced disclosure, understandable category names and actionable duplicate detection. Simple View and Accounting View share one account master; equity remains visible.
3. **Accounting safeguards:** No journal on ordinary account creation. Tax mapping, validation, TDS configuration, control-account restrictions and reviewed opening postings remain available. Income/expenses are not presented as cash flow.
4. **Information architecture:** Category → Basic details → Automatic setup → Advanced settings → Impact preview.
5. **Screens:** Existing list/cards, accounting hierarchy and detail panel are retained. Templates open a preview before import. Existing-name matches are skipped.
6. **User journey:** Add Account, choose a category, enter name/description, accept optional suggestions, inspect generated setup, optionally configure advanced settings, review impact and create. Existing duplicate accounts can be opened directly.
7. **Fields:** Required: category and name. Optional: description. Automatic: available code, normal balance, report classification and a matching existing summary parent. Advanced: account code/group/parent, tax rules, mappings, dimensions, opening entry and control designation. System designation remains protected/read-only.
8. **Actions:** Create/edit, existing-account reuse, four template previews/imports, CSV import/export, detail/ledger/report navigation, protected activation/deletion and change history.
9. **Backend impact:** Existing local accounting services and validations are preserved. Templates use the same account creation validation and never post journals. TDS remains saved configuration, not automatic withholding. Accounting View is not authorization; authenticated accountant permissions require a backend.
10. **Migration:** No destructive migration or account renaming. Existing codes, mappings and journal references remain intact. No conversion of sample balances to openings. Template imports are opt-in and additive.

Visual browser testing was not performed in this update. Compilation, server rendering and accounting regression tests cover the implemented code paths.
