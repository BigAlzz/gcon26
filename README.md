# GCON 2027 intake platform

Local React/Vite and Node API MVP for the Gauteng College of Nursing 2027 intake.

## Run locally

```powershell
npm install
npm run dev:api
# In a second terminal:
npm run dev -- --host 127.0.0.1 --port 4173
```

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). The Vite server proxies `/api` to the local API on port 4000.

## ChatGPT Sites demo

The current frontend demo is published privately on ChatGPT Sites at [https://gcon-nursing-intake.alistairljohanson.chatgpt.site](https://gcon-nursing-intake.alistairljohanson.chatgpt.site). Access is restricted to the owning ChatGPT account unless the Sites access policy is deliberately changed.

The hosted copy preserves the Applicant, Admissions, Employer and Admin demo role pickers and includes a hosted demo worker with seeded presentation data. It is intended for stakeholder demonstration only: the hosted copy does not connect to the local encrypted API, PostgreSQL, Azure Blob Storage or the local uploaded documents, and hosted state-changing actions are not a production persistence boundary. Use the local app for API and document workflow acceptance.

`npm run build` now compiles the Vite frontend and generates `dist/server/index.js`, a Cloudflare-compatible static/demo worker used by Sites. The project binding is stored in `.openai/hosting.json`; it contains only the Sites project ID. The hosted demo is not the production deployment described in the design specification.

## Verify a production build

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

## QA paths

1. Applicant portal → Check my qualification → Check qualification.
2. Continue registration → upload both required evidence rows → Review application → Submit application.
3. Switch to Admissions workspace → Applications and confirm the generated daily reference is listed.
4. Review queue → Approve for shortlist → Audit trail and confirm the decision event.
5. Dashboard → pause/publish the advert, reload, and confirm the cycle state persists.

6. Hosted demo → choose a demo role → confirm the corresponding learner, admissions or employer workspace loads.

The active frontend path uses the local API for workflow state and does not fall back to `src/mockStore.js`. Learner evidence controls use the `/v1` upload-intent, content-upload and completion sequence so file bytes are not falsely marked as uploaded. The local API stores development state in `data/gcon-local-store.enc` using AES-256-GCM and stores local document bytes under `data/documents/`.

The local login dialog supports email/password sessions, invitation acceptance and clearly labelled demo shortcuts for the presentation. Demo sessions use `Bearer demo-learner`, `Bearer demo-staff`, and `Bearer demo-employer` only when `GCON_AUTH_MODE=demo`; they are not a production identity solution. The API exposes role-scoped `/v1` contracts for learner, staff, and employer workflows. The machine-readable contract is available at [`/v1/openapi.json`](http://127.0.0.1:4000/v1/openapi.json).

Annual intake settings are cycle-scoped. A staff supervisor or administrator can use the floating `Configure intake settings` control in the Admissions dashboard, or `PATCH /v1/intake/current`, to change the season name, opening/closing dates, Published/Paused advert status, approved evidence labels, and pathway requirement wording. These changes are persisted by the local API and recorded in the audit trail; submitted applications keep their immutable snapshots. Production should version and approve each annual cycle configuration so a new season can be opened without overwriting previous submissions.

## Production binding checklist

The local server reports its active adapter at `/v1/health` and `/v1/storage/status`. Before production, configure:

- `DATABASE_URL` for the PostgreSQL adapter.
- `AZURE_STORAGE_CONNECTION_STRING` for private Blob Storage.
- `AZURE_KEY_VAULT_URI` and an external identity provider for secrets and authentication.
- A malware scanning worker and retention policy for uploaded documents.
- An external JWT validation adapter; deployments using any `GCON_AUTH_MODE` other than `demo` fail closed until that adapter is configured.

The development adapter encrypts `data/gcon-local-store.enc`, stores uploaded document bytes under `data/documents/`, and migrates older local state non-destructively to the organisation-aware schema.

The local document directory is intentionally excluded from the Sites source repository. Uploaded learner documents must never be included in a source archive or static hosted demo.

## API surface

- `GET/PATCH /v1/intake/current`, `GET /v1/auth/session`, `GET /v1/state`
- `POST /v1/auth/login`, `POST /v1/auth/logout`, `POST/GET /v1/auth/invitations`, `POST /v1/auth/invitations/accept`
- `GET/PATCH /v1/applications/me`, `POST /v1/applications/submit`
- `POST /v1/documents/upload-intent`, `PUT /v1/documents/:id/content`, `POST /v1/documents/:id/complete`, `POST /v1/documents/:id/review`
- `GET /v1/reviews/queue`, `POST /v1/reviews/:ref/decision`, `POST /v1/shortlists`, `POST /v1/interviews`, `PATCH /v1/interviews/:ref/outcome`
- `GET /v1/employer/dashboard`, `GET /v1/employer/candidates`, `POST /v1/placements/:ref/response`
- `POST /v1/placements/:ref/prepare`, `PATCH /v1/applications/:ref/withdrawal`, `POST /v1/placements/:ref/termination-letter`
- `GET /v1/communications`, `GET /v1/notifications`, `GET /v1/audit` and `POST /v1/communications/issue`

Every state-changing endpoint emits an audit event and applies role, organisation, record-release, and workflow-transition checks.
