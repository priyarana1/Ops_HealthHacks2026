# ClearPath

Synthetic-only medical discharge prototype for Rutgers Health Hackathon 2026. Next.js App Router, TypeScript, MongoDB/Mongoose, Epic public FHIR R4 sandbox, AWS SDK v3 (Bedrock Converse, Transcribe Medical, S3), iron-session, and hashed OTP activation.

## Branch policy

Implementation is on `feat/clearpath-functionality-setup`, created from local `dev` tracking `origin/dev`. Intended merge order: feature → dev → main. No commits, pushes, merges, deployments, or paid resources were made by this implementation session.

## Start with Epic only (no MongoDB/AWS required)

Use Node.js 22 or newer. Keep your existing `.env.local` with the registered non-production Epic client ID/secret and exact redirect URI. Next loads it server-side. See [EPIC_SETUP.md](EPIC_SETUP.md) for exact variables and local browser testing.

```sh
npm install
npm run dev
```

Open `http://localhost:3000/provider`, enter the labeled local provider workspace if provider credentials are not configured, and choose **Connect to Epic Sandbox**. OAuth and chart viewing use secure server-side development sessions independently of MongoDB/AWS. Real API failures never return demo data. Empty EPIC_SCOPES defaults to Epic's documented `openid` sandbox scope; registered APIs still control chart access.

MongoDB is required only for persistent discharge plans and patient activation/dashboard. AWS credentials are required only for live transcription/Bedrock. Temporary AVS/chart preparation is explicitly labeled and stays only in the current page when database persistence is unavailable. Production still requires configured provider credentials, AUTH_SECRET and durable session/database storage; the localhost no-credential workspace is disabled.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

See [FILES.md](FILES.md) for the full changed-file inventory, [SETUP.md](SETUP.md) for later AWS/Atlas setup, and [IMPLEMENTATION.md](IMPLEMENTATION.md) for status.

## Full workflow

1. Sign in at `/signin` using the configured provider credentials.
2. Open `/provider/new`. Confirm synthetic-only input.
3. Connect Epic Sandbox, authorize as an Epic **clinician/staff** sandbox user, search for a permitted synthetic patient and inspect each resource's result. Select an encounter if returned. ClearPath does not collect an Epic password.
4. Paste or upload finalized synthetic AVS text. A general clinical note or CDA is never labeled a finalized AVS. Importing chart context alone cannot produce discharge instructions.
5. Create the draft. Optionally record dictation. Wait for the asynchronous job, review/correct the transcript, explicitly confirm it and save.
6. With AWS configured, generate with Bedrock. Compare clinical source and output side by side. Edit structured fields and resolve every high-risk ambiguity. Save edits.
7. Check the clinical review acknowledgment and approve the saved revision. The API also enforces the approval gate; JSON validity alone does not imply clinical accuracy.
8. Publish. In **development only**, an authenticated provider receives a private activation URL and ten-minute test OTP. Production publishing is blocked until a verified OTP delivery channel is implemented.
9. Open the invitation in a separate browser/private window, enter the OTP, and view `/patient/dashboard`. The dashboard reads only the matching published MongoDB plan; drafts and source records are not returned to patients.
10. Sign out and verify that the plan cannot be accessed without the patient session. An expired plan is denied immediately by application checks, even before physical TTL deletion.

## Explicit synthetic demo

From New Discharge choose **Start labeled synthetic demo**, then **Generate synthetic demo (no API call)** on its review page. This processes only the exact bundled synthetic AVS, not arbitrary clinical input. Resolve the intentional medication ambiguity before approval. The demo transcript button inserts text explicitly labeled as synthetic and does not call AWS. It is separate from the built-in demo-plan adapter; adding transcript text requires live Bedrock processing. `ENABLE_DEMO_MODE=false` disables demo actions server-side.

## Implementation map

- `src/app`: provider workspace, draft/review, sign-in, OTP activation, accessible patient dashboard.
- `src/app/api/[...path]/route.ts`: dispatches the documented API URLs with common authentication, origin checks, validation and error handling. Next.js catch-all routing preserves the requested endpoint contracts.
- `src/lib/auth`: opaque session cookies with iron-session; revocable, expiring server-side session records; durable rate-limit counters.
- `src/lib/epic`: discovery, PKCE/state, authorization-code exchange, encrypted short-lived server tokens, resource-level errors, FHIR normalization and patient-linked Binary downloads.
- `src/lib/aws`: SDK v3 S3, batch Transcribe Medical and configurable Bedrock Converse adapters.
- `src/lib/ai`: structured schema, source-reference validation, missing medication flags, approval gate, explicit demo adapter.
- `src/lib/db`: reusable connection; Patient, DischargePlan, PatientAccess, DeletionAudit plus operational sessions, rate limits, OAuth attempts, Epic connections and durable artifact manifests.
- `src/lib/expiration`: explicit cleanup with safe audit evidence and retry manifests.
- `src/types/future.ts`: Phase G **interfaces only**, each inheriting the original plan expiration. No future patient-tracking collections or APIs are implemented.
- `sample-data/synthetic-avs.txt`: synthetic manual-input fixture.
- `tests`: safety/normalization/auth mapping, mocked Mongo connection reuse and mocked cleanup orchestration.

## API surface

Provider-only: `GET /api/auth/me`, `/api/epic/connect`, `/api/epic/callback`, `/api/epic/status`, `/api/epic/patients?name=...`, `/api/epic/patients/:id/records`, `/api/epic/patients/:id/documents/:documentId`; `POST /api/epic/disconnect`.

Provider-only discharge APIs: `GET|POST /api/discharges`, `GET|PATCH /api/discharges/:id`, `POST /api/discharges/:id/process`, `/approve`, `/publish`, `/expire-test`. Updates and approval require the current `revision`; approved/published plans are immutable.

Provider-only audio APIs: `GET /api/audio/status`, `POST /api/audio/upload` (multipart `planId`, `audio`), `POST /api/audio/transcribe` (`audioId`), `GET /api/audio/jobs/:id`.

Authentication: `POST /api/auth/signin`, `POST /api/auth/logout`, `POST /api/patient/activate`, `POST /api/patient/verify`, authenticated `GET /api/patient/plan`. Browser writes require an `Origin` matching `APP_URL`.

Internal cleanup: `POST /api/internal/purge-expired`, authenticated by `Authorization: Bearer <PURGE_SECRET>`. Do not expose this secret to browsers.

## Current verification

With installed dependencies: TypeScript validation, Next/TypeScript ESLint, unit tests and the production build pass. Generated client assets were scanned and contained no configured Epic secret. There are 38 passing tests across six files, including 23 new OAuth/development-session tests. OAuth/FHIR requests in these tests use explicitly synthetic HTTP fixtures; database orchestration tests use mocked drivers. No live API success is claimed.

The local HTTP server could not start inside the execution sandbox (`listen EPERM 127.0.0.1:3000`), and a public discovery request failed DNS resolution for fhir.epic.com. A real Epic browser login, authorization-code exchange and chart read must be verified locally using EPIC_SETUP.md. Atlas, S3, Transcribe and Bedrock remain unconfigured and unverified. The existing lockfile is preserved and includes the installed jose dependency.

## Current limits and priorities

- Real-browser Epic authorization, live resource permission checks and credential-backed Atlas/AWS tests remain outstanding; static checks and production build pass.
- Only plain-text AVS uploads are supported. PDF/Word text must be pasted manually.
- FHIR searches show up to 50 results per resource and explicitly indicate additional pages. Binary downloads are limited to authorized references in the retrieved DocumentReference page. Resource support/permissions must be tested individually against the registered Epic app.
- Localhost-only no-credential synthetic workspace or one environment-configured development provider account. Sessions/Epic connections are server-memory in development; add institutional identity/SSO and durable storage before broader use.
- Server-record sessions are revocable; cookie lifetime is eight hours. Patient sessions additionally expire no later than their record.
- OTP delivery is development-only. Production publishing is intentionally disabled.
- Audio jobs can be polled while the page is open; server artifacts support cleanup, but a reload-resume job UI and a dedicated background transcription worker are not yet included. The default temporary artifact window is one hour.
- AI evidence checks validate quotations/references and verbatim medication values. They cannot prove clinical meaning, completeness, or readability; clinician review remains mandatory.
- Future patient-facing Epic identity must use a separate registered patient application and a validated identity-to-internal-patient link; no raw FHIR ID authentication exists.
- No claim of HIPAA compliance or second-exact physical deletion, including backups and copies.

Phase G remains deferred: symptoms, check-ins, medication completion, caregivers, reminders and chat history are not implemented.

The sibling Challenge 1 Discharge Services brief was reviewed. It additionally calls for multilingual translation; this implementation follows the requested English-first, clinician-reviewed workflow. Clinician-reviewed translations remain a next priority. The current request’s explicit caution against claiming second-exact deletion governs retention claims.
