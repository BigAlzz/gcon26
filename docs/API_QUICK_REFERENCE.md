# API quick reference

The authoritative machine-readable interface is `source/openapi/v1.json`, served at `GET /v1/openapi.json` by the local API. It is OpenAPI 3.0.3, version 1.1.0. The summary below is for orientation; use the contract for request and response shapes.

| Area | Representative endpoints | Access boundary |
| --- | --- | --- |
| Health and intake | `GET /v1/health`, `GET /v1/openapi.json`, `GET /v1/storage/status`, `GET/PATCH /v1/intake/current` | Public health/contract where applicable; configuration updates are protected. |
| Authentication | `GET /v1/auth/session`, `POST /v1/auth/login`, `POST /v1/auth/logout`, `POST /v1/auth/demo-login`, `POST /v1/auth/learner/register`, invitation routes | Production identity is an sGov integration requirement; demo login must be disabled in production. |
| Qualification | `POST /v1/qualification/evaluate` | Public pathway evaluation only; no cross-pathway score conversion. |
| Learner application | `GET/PATCH /v1/applications/me`, `POST /v1/applications/submit`, `POST /v1/applications/non-qualifier` | Learner-owned records and controlled pre-registration flow. |
| Documents | `POST /v1/documents/upload-intent`, `PUT /v1/documents/{id}/content`, `POST /v1/documents/{id}/complete`, `POST /v1/documents/{id}/review` | Owner/staff roles, organisation scope, and production document protection. |
| Staff review | `GET /v1/reviews/queue`, `POST /v1/reviews/{ref}/decision`, `POST /v1/reviews/mass-decline`, shortlist and interview routes | Staff role, organisation scope, record state, and audit boundaries. |
| Placement | `POST /v1/placements/{ref}/prepare`, `POST /v1/placements/{ref}/response`, withdrawal and termination-letter routes | Staff preparation and released employer response only. |
| Communications and audit | Communications, notifications, applicant chat, and `GET /v1/audit` | Audience, ownership, role, and organisation scope. |

Every state-changing route is designed to enforce workflow, role, organisation, and record-release checks and to create an audit event. The contract and server code must be reviewed together when adding a route or changing a workflow transition.
