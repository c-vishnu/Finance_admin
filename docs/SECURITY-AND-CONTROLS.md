# Security and Accounting Controls

**Last verified:** 2026-09-12  
**Primary sources:** `AGENTS.md`, service command checks, `period-locking.js`.

### Purchase controls

Purchase Bill posting checks configured period locks, validates balanced accounting, prevents duplicate vendor invoice numbers within the same vendor, and is idempotent by bill id. Accounting mappings are visually restricted to an Accountant/Admin disclosure, but this is not real authorization. Production must enforce approval roles, account permissions, vendor/company ownership, duplicate constraints, attachment malware scanning, immutable posting, and atomic database/journal commits on the server.

## Current state

The application is a browser prototype. Local role selectors, hidden buttons, and client-side command checks improve the demonstration but do not provide authenticated security. Any user with browser developer tools can inspect or alter local state.

## Existing integrity controls

- Balanced-journal validation.
- Active/account-type/group/control-account validation.
- Unique local document/account codes.
- Revision checks on selected drafts.
- Idempotency tokens for supported financial commands.
- Cancellation restrictions and reversal journals.
- Audit arrays recording domain actions.
- A centralized browser audit register that observes tracked persistence writes and classifies create, update, status-change, remove, and configuration events.
- Dimension requirements on configured accounts.
- Receipt approval threshold and manager-context checks in domain commands.

## Production requirements

- Server-side authentication with organization membership.
- Deny-by-default RBAC/permission policies at API command boundaries.
- Company/branch row isolation in every query and mutation.
- Transactional posting, journal append, source update and audit write.
- Immutable posted journals with database constraints and privileged reversal workflows.
- Period-lock validation within the same transaction as dated mutations.
- Approval segregation of duties and prevention of self-approval where required.
- Tamper-evident, append-only audit records with before/after snapshots or event payload hashes.
- Encrypted transport/storage, secret management, secure attachments, backups, retention and restore testing.
- Rate limits, input validation, output encoding, dependency scanning, logging and alerting.

## Period control permissions

| Role | View locks | Lock | Request unlock | Approve/reopen | Modify closed data |
|---|---:|---:|---:|---:|---:|
| Business User | Yes | No | No | No | No |
| Business Owner | Yes | Yes | No | Yes | Only through the audited reopen workflow |
| Accountant | Yes | No | Yes | No | Soft-lock exception only if explicitly granted |
| Admin | Yes | Yes | Yes | Yes | Only through audited policy; hard-lock edits remain blocked until reopened |

Period Closing is implemented as a browser prototype and must not be represented as production protection until all dated command handlers invoke the validator atomically on an authenticated server. Client-side role labels and storage can be bypassed. The in-page "Working as" selector and the "Allowed roles" setting are simulation only: they demonstrate the requester/approver split but enforce nothing.

The centralized Audit Log is also a prototype control. It provides useful cross-module traceability for demonstrations and regression review, but browser storage can be edited or cleared and the current actor label is simulated. It must not be represented as a legally immutable or security-grade audit record.

## Locking enforcement and audit

Period locking enforcement fails closed. `assertOperationAllowed()` rejects every enforced operation when no matching period exists, when the resolved lock state cannot be read, and whenever any active lock covers the date; only the explicit `Off` locking mode or a configured module exemption allows a system posting through. Enforcement returns the blocking lock plus a remedy instead of a bare failure, and an administrator override always requires a written reason and writes both an override record and an audit entry.

An unlock request cannot escape its lock: a selected date range must sit completely inside the locked period, an approved window releases only the dates it names, and overlapping locks stay independently enforceable. Approval, rejection, cancellation and expiry each write their own audit event, expiry is attributed to the explicit `System` actor, and every locking audit record carries actor, timestamp, action, organisation, branch, before value, after value, reason and the related lock or request id.

## Audit minimum

Capture actor ID, role, company, branch, action, entity type/ID, source document, journal, old/new status, timestamp, reason, approval chain, request/idempotency key, and relevant before/after values. Never log credentials, secrets, or unrestricted attachment contents.
