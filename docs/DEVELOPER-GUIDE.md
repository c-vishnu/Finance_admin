# Developer Guide

**Last verified:** 2026-09-05  
**Primary sources:** `package.json`, `vite.config.mjs`, `AGENTS.md`.

## Requirements and commands

Use a supported Node.js runtime and install dependencies from the checked-in lockfile.

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
npm run build
npm run test:sites
npm run docs:check
node --test tests/*.test.mjs
```

The broad test command is not defined as a package script; invoke Node's test runner directly. On shells that do not expand globs, pass explicit test files or enumerate them safely.

## Completion checkpoint

Every completed feature includes its documentation delta. Update the relevant module/domain/architecture document and manifest, update the handbook when clean-context handoff knowledge changes, record actual QA results, and run `npm run docs:check`. The mandatory checklist is in `AGENTS.md`.

## Entry points

- Start at `src/main.jsx`, then `src/App.jsx` and `src/Navigation.jsx`.
- Read `AGENTS.md` before changing domain behavior or visual conventions.
- For accounting work, read `invoice-engine.js` and the feature service before editing UI.
- For established module requirements, read the corresponding root specification and this knowledge base.

## Adding or extending a module

1. Define current versus target behavior and accounting effect.
2. Put domain validation/calculation in a service module, not JSX event handlers.
3. Keep commands deterministic where possible: clone state, validate, apply once, append audit event, return new state/result.
4. Use integer paise and balanced journal creation.
5. Add the component and scoped stylesheet under `src/`.
6. Add navigation in `Navigation.jsx` and rendering in `App.jsx`.
7. Add tests for success, invalid data, idempotency, lifecycle restrictions, reversal, and report impact.
8. Verify desktop/responsive UI and production build.
9. Update this knowledge package and `project-manifest.json` status.

## State conventions

- Read/write the main accounting aggregate through its store/service boundary.
- Never silently replace unreadable persisted accounting data.
- Preserve existing arrays and fields when adding optional modules.
- Treat local preferences separately from transaction data.
- Session-storage selection hints must be removed/consumed safely and must not become authorization.

## Accounting change checklist

- Are all accounts active posting accounts of the correct type?
- Are debit and credit totals equal in paise?
- Is the command idempotent?
- Are company, branch, cost centre, customer/vendor and source IDs retained?
- Does the command respect period status?
- Can a posted event be corrected without deletion?
- Do ledger, Day Book, Trial Balance, tax and dashboard projections update once?
- Is the audit event sufficient to explain actor, action, time, reason and source?

## Sites compatibility

Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and the Sites worker test intact. `npm run build` must leave the prepared client/server/hosting artifacts expected by the project. Do not confuse successful static hosting with production accounting readiness.
