# Security and production readiness

## Current implementation boundary

The supplied application is intentionally useful for local workflow testing, but it is not yet a production service. It includes local email/password sessions, demo-role bearer shortcuts when `GCON_AUTH_MODE=demo`, an AES-256-GCM encrypted development state file, local document bytes, seeded demonstration records, and a hosted presentation worker with runtime-memory state. These mechanisms support development and stakeholder demonstration only.

The public ChatGPT Sites URL must not receive real applicant information, credentials, certificate images, identity numbers, or production communications. It is not the production database, document store, identity provider, or security boundary.

## Mandatory work before production acceptance

| Area | sGov production requirement |
| --- | --- |
| Identity and access | Approved external identity provider, verified JWT issuer/audience/key rotation, MFA for staff and employer roles, lifecycle-managed organisation memberships, least-privilege role mapping, and separation of platform administration from operational review. |
| Data and records | Managed Microsoft SQL Server through the implemented adapter, with transaction, migration, backup, recovery, retention, audit, and access-control procedures. Do not use the local encrypted file as the production database. |
| Documents | Private object storage, malware scanning and quarantine, encryption, short-lived authorised access, content-type and size controls, access logging, lifecycle retention, legal hold, and secure deletion procedures. |
| Secrets | Key Vault or the approved secret manager. No committed keys, connection strings, passwords, development fallback keys, or `.env` files. |
| Network and application edge | TLS, reverse proxy or WAF, security headers, rate limiting, request-size limits, private service exposure, dependency patching, and centralised log correlation. |
| Observability and recovery | Central logs, metrics, alerts, on-call ownership, database/object-store backup, restore tests, RPO/RTO, incident and breach procedures. |
| POPIA and policy | Approved retention, access, correction, deletion, subject-access, audit-export, consent, complaints, escalation, and data-breach processes. |
| Accessibility and assurance | Agreed accessibility target, browser/device testing, load and concurrency testing, penetration/security review, and approval of the final admissions workflow. |

## Admissions policy decisions that remain external to the code

Academic values must remain pathway-specific. NSC APS, Senior Certificate M score, and NC(V) percentages cannot be converted or ranked against one another until GCON approves a versioned equivalency matrix. That approval must define formulas, included subjects, weights, maxima, rounding, tie handling, missing/upgraded result treatment, validation evidence, effective cycle, approvers, and appeals. It must then be stored as cycle-scoped configuration and copied into immutable submission/ranking snapshots.

The applicant qualification checker is an eligibility aid, not a final admissions decision. Staff must verify certificates, evidence, addresses, identity, and policy conditions before recording controlled workflow outcomes.

## Acceptance evidence requested from sGov

- Architecture approval covering the public edge, private API, SQL Server adapter, object storage, identity, secrets, logging, and disaster recovery.
- Production adapter and migration evidence, including a health response that identifies approved production providers rather than the local-development adapter.
- Role and organisation-scope negative tests using at least two organisations.
- Malware-scan and document-access test evidence.
- Backup and restore test evidence for database and document storage.
- Security review, dependency scan, load test, and browser/accessibility acceptance.
- Controlled release record with source checksum, approvals, monitoring ownership, rollback plan, and post-release smoke-test evidence.
