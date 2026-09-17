# Wayvida Books Knowledge Base

**Last verified:** 2026-09-17
**Source truth:** `src/`, `tests/`, `package.json`, `vite.config.mjs`, and root domain specifications.

This folder is the portable knowledge-transfer package for Wayvida Books. It is designed for engineers and AI coding tools that have no access to earlier conversations.

## Current handover snapshot

- Repository branch: `main`; current committed baseline: `632e747 Add inventory adjustments and shared empty states`.
- The working tree intentionally contains the latest New / Edit Inventory Adjustment UI work in `src/InventoryAdjustments.jsx`, `src/inventory-adjustments.css`, `tests/inventory-adjustments.test.mjs` and the synchronized documents. These changes are not represented by the baseline commit until the user explicitly commits them.
- Latest verified behavior: Items supports multi-organisation/branch availability, an enriched name/SKU/HSN-SAC register identity and standard master actions. Item Details now uses a full-width back header directly beneath Working Context, a focused identity/action card, and separate Basic Data, Transactions and History tabs. The field-first Inventory Adjustment create page remains the preceding checkpoint.
- Latest validation: Inventory Adjustment tests **25/25**, knowledge documents valid, Vite production build successful with 6,959 modules transformed, and the live page verified at local port 4001. The existing large-chunk advisory is non-blocking.
- Do not treat `.codex-item.patch`, `dist/`, browser storage, screenshots or machine-specific paths as product source. Preserve unrelated working-tree changes and inspect `git status` before editing.

The fastest clean-context route is: read `AGENTS.md`, then this file, then `TRANSFER-TO-ANOTHER-AI.md`, `WAYVIDA-BOOKS-HANDBOOK.md`, `AI-HANDOFF-PROMPT.md`, `project-manifest.json`, and the source/tests for the requested module.

## Status legend

| Status | Meaning |
|---|---|
| Implemented | Present in source and exercised by code or tests. |
| Prototype only | Interactive browser implementation without production backend guarantees. |
| Partially implemented | Some UI or domain code exists, but routing, integration, tests, or production controls are incomplete. |
| Planned | Product requirement or recommended production architecture; not current behavior. |

## Recommended reading order

1. [Transfer to Another AI](TRANSFER-TO-ANOTHER-AI.md)
2. [Project Overview](PROJECT-OVERVIEW.md)
3. [Technical Architecture](TECHNICAL-ARCHITECTURE.md)
4. [Accounting Domain](ACCOUNTING-DOMAIN.md)
5. [Modules](MODULES.md)
6. [Data Model](DATA-MODEL.md)
7. [Developer Guide](DEVELOPER-GUIDE.md)
8. [Security and Controls](SECURITY-AND-CONTROLS.md)
9. [Testing and QA](TESTING-AND-QA.md)
10. [Known Gaps and Roadmap](KNOWN-GAPS-AND-ROADMAP.md)
11. [UI Design System](UI-DESIGN-SYSTEM.md)
12. [Glossary](GLOSSARY.md)
13. [Period Locking Specification](PERIOD-LOCKING-SPECIFICATION.md)

For a single-file transfer, use [Wayvida Books Handbook](WAYVIDA-BOOKS-HANDBOOK.md). For a new AI session, paste [AI Handoff Prompt](AI-HANDOFF-PROMPT.md) and attach this folder or repository. Machine-readable inventory is in [project-manifest.json](project-manifest.json).

## Governing rules

- Source and tests override prose when they conflict.
- Existing root specifications describe intent but may exceed current implementation.
- Monetary values in accounting engines are integer paise.
- Browser storage is prototype persistence, not a production database.
- Operational documents create journals automatically; normal users do not enter accounting lines.
- Posted records are corrected through reversal or adjustment, not destructive editing.
- Do not claim role selectors or local UI gates provide authentication or authorization.

## Feature checkpoint maintenance

The knowledge package is a required part of every completed feature change. The implementer must update the relevant modular document and `project-manifest.json`, and update the standalone handbook whenever essential cross-project knowledge changes. Record actual test/build results in `TESTING-AND-QA.md` and refresh `Last verified` in materially changed documents.

```text
npm run docs:check
```

This checkpoint validator checks the required file set, strict manifest parsing and sections, verification metadata, and local Markdown links. It detects structural drift; the implementer remains responsible for semantic accuracy.

## Existing supporting specifications

The root documents remain authoritative supporting material for their topics: `AGENTS.md`, `ACCOUNTING-ARCHITECTURE-REVIEW.md`, `COA-EXPERIENCE.md`, `INVOICE-WORKFLOW.md`, `CREDIT-NOTES.md`, `RECEIPTS.md`, `RECEIPT-ENHANCEMENT-REVIEW.md`, `DAYBOOK.md`, and `DOCUMENT-TEMPLATES.md`.
