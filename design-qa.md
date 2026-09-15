# Organization Context Row Design QA

**Source visual truth:** `C:/Users/asus/AppData/Local/Temp/codex-clipboard-9a73fef1-554e-489e-a391-c2ade3037030.png`  
**Implementation:** `http://127.0.0.1:4173/`, global application shell  
**Last verified:** 2026-09-08

## Shared Working Context and Chart of Accounts checkpoint

- Source visual: `codex-clipboard-65c096bc-8f29-4866-ad20-80991f3869c2.png` supplied by the user.
- Implemented a dynamic `Chart of Accounts (N)` title, retained the supplied description, and moved Company/Branch into a compact shared context bar.
- Added a right-side context drawer, five-category summary strip, and the requested eight-column grouped account grid.
- The separate page-local context and duplicate account count were removed; no account actions or tree data were removed.
- Live browser inspection verified the page hierarchy and drawer controls at the connected narrow viewport. The drawer uses full viewport width on small screens and remains right-aligned on desktop.
- Follow-up refinement removes the tall selection-mode cards, uses accessible modern checkbox controls, exposes full selected-context lists on hover, and aligns Posting Controls to the same 24px create-account gutter.
- Final density pass removes the eyebrow and multi-selection explanation banner, reduces header/body/list spacing, and exposes more selection rows before scrolling.

## Evidence

- Source: focused desktop crop showing company, branch, and financial-year selectors occupying the primary application header.
- Implementation source review: `src/HeaderOrgSelectors.jsx`, `src/header-org-selectors.css`, and `src/ui-quality-polish.css`.
- Cross-project drawer review: General Ledger, Banking manual match, Contextual Help, operational-module forms/details, document-preview customization, and the legacy detail drawer.
- Automated contracts verify canonical right alignment and isolation from global `header` and `aside` rules.

## Findings

- Resolved P0: Transaction Details now resets inherited position, inset, width, height, margin, and padding for the drawer and its header.
- Resolved P1: drawer title, transaction metadata, close control, detail sections, accounting-impact grid, and footer actions no longer share the fixed shell-header geometry.
- Resolved P1 in source: the three accounting-context selectors now render in an independent row directly below the primary header.
- Resolved P2 in source: main and portal content are offset below both global rows; small screens retain access through a horizontally scrollable context row.
- Resolved P2: narrow layouts use full-width drawers, reduced padding, stacked footer actions, and contained accounting-table overflow.
- Focused header-context and Purchase Reports regression contracts passed 7/7.
- The connected browser viewport is narrower than the supplied desktop reference, so responsive containment was checked in addition to structural parity.

## Implementation checklist

- [x] Right-align Transaction Details.
- [x] Isolate nested drawer header and aside geometry.
- [x] Keep content and accounting data intact.
- [x] Standardize other application side drawers to the right.
- [x] Preserve centered modals and full-page forms.
- [x] Add narrow-screen safeguards.
- [x] Add source-level regression tests.
- [x] Inspect the implemented page and context drawer in the connected browser.

**final result: passed**
