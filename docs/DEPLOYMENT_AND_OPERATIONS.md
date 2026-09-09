# Deployment and operations runbook

## Purpose

This runbook is for sGov technical teams deploying and operating the GCON 2027 Student Nurse Intake application. It applies to the supplied Node.js API and React/Vite frontend. It does not treat the ChatGPT Sites presentation copy as a production deployment pattern.

## Target topology

Use an approved TLS-terminating reverse proxy or web application firewall in front of one public intake hostname. Serve the compiled frontend from `dist/` and proxy `/v1/*` to the private Node.js API. Keep the API on a private interface or loopback behind the reverse proxy. Use the implemented Microsoft SQL Server adapter for transactional state and private object storage for applicant documents. Make the application service account read secrets only from the approved secret manager.

## Build and release

1. Obtain the approved source archive and verify its release manifest before unpacking it.
2. Install the approved Node.js LTS release and run `npm ci` from `source/`.
3. Run `npm test` and retain the result in the change record.
4. Run `npm run build`. The frontend is emitted to `dist/`; the generated `dist/server/` worker is for the stakeholder demo and does not replace the Node.js API.
5. Configure the production environment, start the API under the approved process supervisor, publish the static content, and route `/v1/*` to the API under the same origin.
6. Run the post-release verification below before exposing the intake advert.

## Required production configuration

| Variable or capability | Required production handling |
| --- | --- |
| `HOST` / `PORT` | Bind the API to loopback or a private interface; expose it only through the approved proxy. |
| `GCON_AUTH_MODE` | Do not use `demo`. Enable only with an approved external JWT validation adapter and identity configuration. |
| `GCON_DATABASE_PROVIDER` / `MSSQL_CONNECTION_STRING` | Set `GCON_DATABASE_PROVIDER=sqlserver` and inject the approved SQL Server connection string. Apply the checked-in SQL migrations before disabling startup DDL. `DATABASE_URL` is a legacy placeholder and does not activate this adapter. |
| `AZURE_STORAGE_CONNECTION_STRING` | Bind to private managed Blob or equivalent object storage; add access policy, retention, malware scanning, and download controls. |
| `AZURE_KEY_VAULT_URI` | Use the approved secret store for runtime configuration, database, storage, and identity material. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Connect to the approved observability service if used by the hosting environment. |

Never reuse the development fallback encryption key in `.env.example`, and never copy `.env` files, local `data/`, or uploaded documents into a source release.

## First start and release checks

| Check | Expected outcome |
| --- | --- |
| `GET /v1/health` | HTTP 200, service `gcon-api`, version `v1`, and a storage status that identifies the approved production adapters. |
| `GET /v1/openapi.json` | HTTP 200 and the OpenAPI 3.0.3 contract. |
| `GET /v1/intake/current` | The approved active intake configuration is returned. |
| Public landing page | GCON title, logo, current advert state, and static assets load with no browser errors. |
| Role boundary | Learner, staff, and employer users cannot read another organisation's records, documents, contact data, or unreleased candidates. |
| Audit | A controlled state change creates the expected audit record. |
| Document flow | Upload intent, content transfer, checksum completion, malware result, and staff review work against private storage. |

An HTTP 200 health response is not production acceptance if it reports `local-development-adapter`, a local document store, an environment-key fallback, or demo authentication.

## Routine operations

During an intake cycle, review health, error rate, latency, storage status, document-scan failures, suspicious authentication events, bulk actions, placement capacity errors, and audit anomalies every business day. Before each release or migration, take a restore-tested database backup and preserve document-storage versioning or immutable retention according to policy. Capture the release identifier, source checksum, Node.js version, deployment owner, verification results, rollback point, and approver in the change record.

## Incident response

For a suspected privacy or security incident, contain access, preserve audit and infrastructure logs, do not delete evidence, and use the sGov incident process. For a workflow discrepancy, retain the application reference, timestamp, and actor, then inspect the audit record and database transaction evidence. For document issues, trace upload intent, content upload, checksum completion, malware result, and storage access in that order.
