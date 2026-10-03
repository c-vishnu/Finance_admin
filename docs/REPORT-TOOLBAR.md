# Report toolbar: the date-range preset and the one Export button

**Last verified:** 2026-09-29

## What the toolbar is

Every report page in the `Reports` section carries the same two controls in its heading action row,
immediately beside the search box and the `Filters` disclosure:

1. a **date-range preset dropdown** offering `All dates` (period reports only), `Today`, `This week`,
   `This month`, `This year` and `Custom selection`; and
2. **ONE `Export` button** whose dropdown holds the report own export actions.

Both live in `src/ReportToolbar.jsx`, with the pure range arithmetic in `src/report-toolbar.js` and
the styling in `src/report-toolbar.css`. The named periods are NOT redefined here: the control reads
`DATE_RANGE_PRESETS`, `resolveDateRange` and `matchDateRange` from
[date-range-filter.js](../src/date-range-filter.js), the module the five register filters already
share, so `This week` cannot mean one period on the Transaction Register and another on the Sales
Report. This section supersedes every older sentence in the knowledge base that describes a report
heading as carrying `Export Excel` and `Export PDF` side by side.

## The two date shapes

Reports come in two shapes and the preset has to answer each of them honestly.

- **A period report holds two dates** (`from` and `to`). A preset writes both ends. `All dates`
  clears both, exactly as it does on the registers. Pages: Transaction Register, Day Book, Journal
  Report, Account Statement, Profit & Loss, Cash Flow Statement, Cash & Bank Book, Bank
  Reconciliation, GST / Tax Reports, TDS Reports, Sales Report, Purchase Report, Expense Report.
- **An as-of report holds one date** (`date` or `asOf`). A preset writes **the close of the
  period**, because a report read as of a date states the position at the close of it: `Today`
  writes today, `This week` writes the Sunday, `This month` writes the last day of the month, `This
  year` writes 31 December. `All dates` is deliberately NOT offered, because it would have to clear
  the one date the report reads. A date a reader moved by hand reads as `Custom selection` rather
  than borrowing the name of a period it no longer closes. Pages: Trial Balance, Balance Sheet,
  Customer Outstanding, Supplier Outstanding, Customer Aging and Supplier Aging
  (`src/AgingReport.jsx`, which both aging routes render).

`applyRangePreset(key, from, to)` and `applyAsOfPreset(key, date)` are the only writers; both are
pure and both were proven in `tests/report-toolbar.test.mjs`.

## Custom selection

`Custom selection` is a real option in the dropdown, not only something the control falls back to.
Choosing it **never moves the dates**: it leaves them exactly where they were, so a reader cannot
lose the range they are looking at by asking to edit it by hand, and it calls the page `onCustom`
callback, which opens the `Filters` disclosure that holds the `From` and `To` inputs (or the single
`As of` input). The pages therefore wire `onCustom={()=>setFiltersOpen(true)}`.

The register filters behave differently and were left alone: they append
`<option value="custom">Custom range</option>` only while the dates are already custom, and picking
it runs through `resolveDateRange`, which clears both ends. That footgun is NOT reproduced on the
report pages, and the register filters were kept byte-for-byte so `tests/date-range-filter.test.mjs`
still holds its own contract.

## The one Export button

`ReportExportMenu` renders a single `Export` button (`summary` inside a `details.rptExportMenu`)
whose dropdown holds the report own actions. Each page passes the actions it already had, so no page
reimplemented an export:

```
<ReportExportMenu items={[{key:'excel',label:'Export Excel',icon:<IconFileSpreadsheet size={17}/>,onClick:exportExcel,disabled:!report.rows.length},{key:'pdf',label:'Export PDF',icon:<IconFileTypePdf size={17}/>,onClick:print,disabled:!report.rows.length}]}/>
```

- The export **handlers are unchanged**: `exportExcel` still writes through the page own sheet
  builder plus the shared `tableExport` / `excelReport` / `downloadReport` helpers, and `Export PDF`
  is still the application print path (`window.print()`).
- The `disabled` guard each page already had is passed through unchanged, so an export still
  disables itself on an empty report.
- Every action **closes the menu before it runs**, so a printout never contains the open menu.
- A report with a **single** export keeps a plain single button: a dropdown of one item is a control
  the reader has to open to learn nothing. That is why `src/DayBook.jsx` (Export PDF) and
  `src/BalanceSheet.jsx` (Export PDF) still carry one button and do not import `ReportExportMenu`.

## Where it is used

| Report | Control | Export |
| --- | --- | --- |
| Transaction Register | two-date preset | one Export dropdown (Excel, PDF) |
| Day Book | two-date preset | single PDF button (unchanged) |
| Journal Report | two-date preset | one Export dropdown |
| Account Statement | two-date preset | one Export dropdown |
| Trial Balance | as-of preset | one Export dropdown |
| Profit & Loss | two-date preset | one Export dropdown |
| Balance Sheet | as-of preset | single PDF button (unchanged) |
| Cash Flow Statement | two-date preset | one Export dropdown |
| Customer Outstanding | as-of preset | one Export dropdown |
| Customer Aging / Supplier Aging | as-of preset | one Export dropdown |
| Supplier Outstanding | as-of preset | one Export dropdown |
| Cash & Bank Book | two-date preset | one Export dropdown |
| Bank Reconciliation Report | two-date preset | one Export dropdown |
| GST / Tax Reports | two-date preset | one Export dropdown |
| TDS Reports | two-date preset | one Export dropdown |
| Sales Report | two-date preset | one Export dropdown |
| Purchase Report | two-date preset | one Export dropdown |
| Expense Report | two-date preset | one Export dropdown |

## Deliberate exceptions and limits

- **General Ledger** (`src/GeneralLedgerPro.jsx`) keeps its own bespoke heading. It already
  collapsed its four exports into one `Export` disclosure, so nothing changed there; only its
  `Date range` select was moved onto the shared vocabulary (`Today`, `This week`, `This month`,
  `This year`, `All dates` and `Custom selection` replacing `This Month`, `This Quarter`,
  `This Financial Year`, `Custom Range`). That control is **display-only and always has been**: the
  ledger never filtered its rows on it, and the rows are not filtered on it now. This is a
  pre-existing prototype limitation recorded in [KNOWN-GAPS-AND-ROADMAP.md](KNOWN-GAPS-AND-ROADMAP.md),
  not something this change introduced.
- `Purchase Reports` (`src/PurchaseReports.jsx`) and `Audit Log` (`src/AuditLog.jsx`) are not report
  pages of the `Reports` group and were left untouched. Each already carried exactly one export
  button (`Export CSV`), so neither ever had two buttons to collapse, and neither holds a date range
  a preset could write.
- The toolbar writes only through the props it is given, so every page kept its own filter state,
  its own count badge, its own `Clear filters` row, its own count-badge arithmetic and its own
  pagination reset (`useEffect(()=>{setPage(1)},[...filters...])` already covered the date presets).
  `src/DayBook.jsx` is the one page whose filter setter is not functional
  (`const set=(k,v)=>{setF({...f,[k]:v});setSelected(null)}`), so its preset writes both dates in one
  call rather than calling `set` twice, which would have dropped the first date.

## Styling and print

`src/report-toolbar.css` owns both controls so twenty report pages with twenty heading styles cannot
drift apart. The preset is a 40px pill matching the heading controls; the Export button matches the
same 40px; the dropdown is an absolutely positioned panel anchored to its button. Both controls are
`display:none` in `@media print`, and because every report heading row is also hidden in print the
printouts are unaffected either way.

## Validation

- `node tests/report-toolbar.test.mjs` — **7/7**, covering the preset list, the two date shapes, the
  `Custom selection` guarantee, the per-page wiring of all eighteen report pages, the collapsed
  export, and General Ledger.
- `node tmp/toolbar-render.mjs` — renders all eighteen pages through `react-dom/server` against a
  seeded book and asserts 214 contracts (a passing harness, not a committed suite).
- Full sweep: 110 files, 89 clean, 884 passing, the same 47 pre-existing failures in the same 16
  unrelated suites, 5 suites that cannot start because this sandbox refuses the esbuild spawn.
- **Not verified this pass:** the live browser check. The in-app browser automation refuses to run
  in this session, so the toolbar was verified through the preview server (every changed module and
  the new stylesheet served HTTP 200) and through the in-process render harness rather than by
  clicking the controls in a browser.
