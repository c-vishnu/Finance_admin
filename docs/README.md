# Wayvida Books Knowledge Base

**Last verified:** 2026-09-14  
**Source truth:** `src/`, `tests/`, `package.json`, `vite.config.mjs`, and root domain specifications.

This folder is the portable knowledge-transfer package for Wayvida Books. It is designed for engineers and AI coding tools that have no access to earlier conversations.

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
