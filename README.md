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

The hosted copy preserves the Applicant, Admissions and Employer demo role pickers and includes a hosted demo worker with seeded presentation data. It is intended for stakeholder demonstration only: the hosted copy does not connect to the local encrypted API, PostgreSQL, Azure Blob Storage or the local uploaded documents, and hosted state-changing actions are not a production persistence boundary. Access management on the hosted URL is explicitly labelled **Sites demo registration**: it accepts demo values only, creates an expiring in-memory learner session, and does not store the password, identifier or personal contact details. Use the local app for real API, authentication, persistence and document workflow acceptance. The platform-admin identity remains available for local API testing, not as a separate hosted UI workspace.

`npm run build` now compiles the Vite frontend and generates `dist/server/index.js`, a Cloudflare-compatible static/demo worker used by Sites. The project binding is stored in `.openai/hosting.json`; it contains only the Sites project ID. The hosted demo is not the production deployment described in the design specification.

## Verify a production build

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

## QA paths

1. Applicant portal → Check my qualification → Check qualification.
2. If qualified, continue to Access management → create an ID-number username/password account → complete the profile.
3. Upload both required evidence rows → Review application → Submit application.
3. Switch to Admissions workspace → Applications and confirm the generated daily reference is listed.
4. Applications → filter each qualification pathway and confirm academic ranks restart at 1 for each pathway; do not compare APS, M score and NC(V) percentages.
5. Review queue → Approve for shortlist → Audit trail and confirm the decision event.
6. Applications → select eligible under-review records → mass decline → confirm the individual in-app outcomes and batch audit event.
7. Placements → prepare an offer → confirm campus capacity is enforced → use the Employer portal to accept or decline the released offer.
8. Dashboard → pause/publish the advert, reload, and confirm the cycle state persists.
9. Hosted demo → choose Applicant → complete qualification → use the clearly labelled Sites demo registration with throwaway values → confirm the temporary session opens the profile workflow.

The active frontend path uses the local API for workflow state and does not fall back to `src/mockStore.js`. Qualification evaluation is rechecked by the API before the result is displayed. Learner evidence controls use the `/v1` upload-intent, content-upload and completion sequence and retain the returned document state, so file bytes are not falsely marked as uploaded. The local API stores development state in `data/gcon-local-store.enc` using AES-256-GCM and stores local document bytes under `data/documents/`.

The local login dialog supports email/password sessions, invitation acceptance and clearly labelled demo shortcuts for the presentation. Qualified applicants can also create a learner account through Access management using their 13-digit ID number as the username; passwords are stored as scrypt hashes. Demo sessions use `Bearer demo-learner`, `Bearer demo-staff`, and `Bearer demo-employer` only when `GCON_AUTH_MODE=demo`; they are not a production identity solution. The API exposes role-scoped `/v1` contracts for learner, staff, and employer workflows. The machine-readable contract is available at [`/v1/openapi.json`](http://127.0.0.1:4000/v1/openapi.json).

Annual intake settings are cycle-scoped. A staff supervisor or administrator can use the floating `Configure intake settings` control in the Admissions dashboard, or `PATCH /v1/intake/current`, to change the season name, opening/closing dates, Published/Paused advert status, approved evidence labels, and pathway requirement wording. These changes are persisted by the local API and recorded in the audit trail; submitted applications keep their immutable snapshots. Production should version and approve each annual cycle configuration so a new season can be opened without overwriting previous submissions.

## Qualification and academic-ranking policy

The qualification checker is an eligibility aid, not the final admissions decision. It preserves the applicant's original pathway and reported values and applies the current prototype minimums separately for NSC / Grade 12, Senior Certificate, and NC(V) Level 4. Staff must verify the certificate, subject results, address, identity and evidence before making a controlled decision.

Academic ranks are also pathway-scoped:

- NSC applicants are ranked against other NSC applicants using the reported APS.
- Senior Certificate applicants are ranked against other Senior Certificate applicants using the reported M score.
- NC(V) applicants are ranked against other NC(V) applicants using the recorded percentage value used by the current prototype.
- APS, M score and NC(V) percentages are not numerically compared, converted or merged into one intake-wide order.
- The API recalculates and returns the selected pathway's original score/result before the qualification result is shown. It does not invent a common M score for different certificates.

NC(V) entry is grouped into Fundamental Subjects and Vocational Subjects. Fundamental selectors provide 50–100, while vocational selectors provide 60–100; each group also includes “Below requirement” so an applicant can truthfully record a non-qualifying result.

The profile includes certificate-dependent remaining subjects, previous nursing training records, and up to three detailed work-experience records with dates, current-employment state, employer, job title, responsibilities and reason for leaving.

Cross-pathway ranking is a production policy blocker until GCON approves a versioned equivalency matrix. That approval must define the calculation for every pathway, included subjects, weights, score maxima, rounding, tie-breaking, missing or upgraded results, validation evidence, effective intake cycle, approvers and appeal process. Once approved, the matrix must be stored as cycle-scoped configuration and its version must be copied into each immutable submission/ranking snapshot. Until then, the UI and API must show original scores and within-pathway ranks only.

Mass decline and in-app outcomes are supported in the Admissions Applications workspace. Staff can select multiple applications that are still under review or awaiting correction, choose a controlled decline reason, and confirm one atomic batch action. The API checks staff role, organisation scope, ownership, and workflow state before changing any record. It then records an individual decline audit event for each application, a batch summary audit event, and one linked `in_app` notification for every affected learner through the existing communications and notifications store. Learners see the outcome and notification in their application portal; no email or SMS is required for this low-cost communication path.

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

- `GET /v1/health`, `GET /v1/openapi.json`, `GET /v1/storage/status`, `GET /v1/state`, `GET/PATCH /v1/intake/current`
- `GET /v1/auth/session`, `POST /v1/auth/login`, `POST /v1/auth/logout`, `POST /v1/auth/demo-login`, `POST /v1/auth/learner/register`
- `POST /v1/qualification/evaluate`
- `POST/GET /v1/auth/invitations`, `POST /v1/auth/invitations/accept`
- `GET/PATCH /v1/applications/me`, `POST /v1/applications/submit`, `POST /v1/applications/non-qualifier`
- `GET/POST /v1/applicant/chat`
- `POST /v1/documents/upload-intent`, `PUT /v1/documents/:id/content`, `POST /v1/documents/:id/complete`, `POST /v1/documents/:id/review`
- `GET /v1/reviews/queue`, `POST /v1/reviews/:ref/decision`, `POST /v1/reviews/mass-decline`, `POST /v1/shortlists`, `POST /v1/interviews`, `PATCH /v1/interviews/:ref/outcome`
- `GET /v1/employer/dashboard`, `GET /v1/employer/candidates`, `POST /v1/placements/:ref/response`
- `POST /v1/placements/:ref/prepare`, `PATCH /v1/applications/:ref/withdrawal`, `POST /v1/placements/:ref/termination-letter`
- `GET /v1/communications`, `GET /v1/notifications`, `GET /v1/audit` and `POST /v1/communications/issue`

Every state-changing endpoint emits an audit event and applies role, organisation, record-release, and workflow-transition checks.
