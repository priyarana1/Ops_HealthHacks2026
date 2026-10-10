# ClearPath backend setup

This backend is for synthetic hackathon data only. Provider UI files and Epic integration are unchanged. The new discharge APIs require integration into the existing provider UI; old creation/approval/publish payloads are deliberately not accepted as authorization for this new workflow. The teammate's patient frontend is not imported or merged.

## Audit and reference requirements

Read the challenge DOCX and discharge-instruction PDF in `../Ops_Unleashed/Ops_Unleashed_Challenge1/`. Requirements include faithful medication reconciliation, labs, follow-up, heart-failure monitoring, warning escalation, teach-back and practical barriers. The brief mentions expiration from creation; the current user requirement supersedes that: **expiration is dischargeAt + 30 elapsed days**. The sample fixture is a newly written synthetic example, not an Epic response.

The existing provider session implementation and real Epic adapter are reused. Existing Mongo connection pooling, S3 encryption/version deletion and Transcribe SDK clients are reused. New temporary collections are separate from legacy plans so old records without confirmed discharge times are not silently migrated or made patient-accessible. Legacy patient cookies no longer authorize the old dashboard; only the new patient API authenticates new accounts.

## Install and configure

```sh
npm ci
npm run backend:install
npm run db:check
npm run backend:indexes
npm run dev
```

The registry was unreachable during implementation (`ENOTFOUND registry.npmjs.org`), so `backend:install` is an explicit remaining step. It installs the SESv2 SDK, Mammoth and pdf-parse v2 and updates package.json/package-lock.json. They are runtime-loaded server dependencies; missing packages cause HTTP 503, never a fake parse or email. Include installed node_modules in deployment; if producing a standalone bundle, explicitly include these runtime modules. Use a supported recent Node version (Node 24 was used for checks). TXT ingestion, schemas and the installed AWS adapters can be tested without those optional packages.

Required for storage and provider authentication:

```dotenv
MONGODB_URI=
MONGODB_DB_NAME=clearpath
AUTH_SECRET=
APP_URL=http://localhost:3000
DEV_PROVIDER_EMAIL=
DEV_PROVIDER_PASSWORD=
DEV_PROVIDER_PASSWORD_HASH=
```

AUTH_SECRET must be a strong random secret, shared by server instances. Production provider sign-in requires the password hash, not the plaintext development password. No credentials are generated or committed by this backend.

## MongoDB Atlas

Use an Atlas replica-set cluster (multi-document transactions are required). Add the application host's IP to Network Access; create a database user limited to read/write on the ClearPath database. Use a separate setup principal for creating indexes if the operational principal cannot do so. Database users are separate from Atlas website users. `MONGODB_DB_NAME` is the exact variable name.

`npm run db:check` performs a read-only ping with sanitized errors. `npm run backend:indexes` creates TTL, unique idempotency, source, invitation, account and session indexes. Model initialization also requests indexes. Run this before accepting traffic; uniqueness is a correctness requirement. The implementation environment's ping failed with ECONNREFUSED; Atlas was not verified live.

Every temporary patient-data collection carries a Date `expiresAt` and TTL index `{expireAfterSeconds:0}`. Record expiry is inherited from the episode and never recalculated on update. Patients are episode-scoped references; operation retries must retain the same requestId. This does not implement a cross-hospital master-patient matching service.

## AWS credentials and Bedrock

```dotenv
AWS_REGION=us-east-1
AWS_PROFILE=
BEDROCK_MODEL_ID=
```

Use the standard AWS SDK credential chain (local profile/SSO or deployment IAM role). Do not put access keys in source or client code. Configure an available Converse-capable model ID or inference profile for the selected region. Grant `bedrock:InvokeModel` only for that model/profile and any destination model ARNs required by a cross-region profile. Confirm model access in the AWS console. No model is hard-coded.

Converse uses bounded SDK retries and one retry for invalid structured output. AWS errors fail explicitly; invalid output never becomes an approved plan. Every output is validated with Zod, source quotations, numeric/unit/date checks, medication-field checks and conditional/negation discrepancy flags. Clinician source-completeness sign-off is mandatory: these checks cannot prove clinical equivalence, detect every omission, or certify fifth-grade readability. Store the model/profile ID, region, timestamp and request ID; AWS does not always expose an immutable model revision in Converse responses.

English is implemented first. A translation contract reserves language, source-plan version and separate review status. Translation generation/publication is not implemented; untranslated English is never labeled as another language.

## S3 and Transcribe Medical

```dotenv
AWS_S3_BUCKET=
AWS_KMS_KEY_ID=
```

Use a private bucket with Block Public Access, encryption, TLS-only access and no public ACLs. If S3 is configured, original documents are uploaded privately; an upload failure rejects ingestion. If S3 is absent, extracted source text is retained in MongoDB and the response states `originalStored:false`. Never infer S3 storage from a parsed source.

Restrict permissions to the `clinical/` prefix: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:DeleteObjectVersion`, and bucket `s3:ListBucketVersions`. For a KMS key, grant the necessary encrypt/decrypt/data-key permissions to the app and Transcribe roles. Configure bucket permissions for Transcribe Medical input/output access. Grant `transcribe:StartMedicalTranscriptionJob`, `GetMedicalTranscriptionJob`, `DeleteMedicalTranscriptionJob` as needed; some actions require wildcard resource permissions. Keep a short lifecycle as a backup only.

Medical jobs use `en-US`, `PRIMARYCARE`, `DICTATION`, unique names, an encrypted input and configured output key. MIME/signatures are checked; no audio conversion is implemented. Transcribe may still reject a container/codec combination; return that failure and record a compatible format rather than fabricate text. Transcripts are unconfirmed sources until the clinician corrects and confirms them.

## SES invitations

```dotenv
SES_FROM_EMAIL=
```

Verify the sender in the same AWS region. In SES sandbox, verify every test recipient too. Grant `ses:SendEmail` for the verified identity; restrict permitted recipients for synthetic testing where practical. The email contains a generic invitation link with its token in a URL fragment, no patient name, diagnosis or clinical instructions. Invite tokens are random and stored as hashes; the separately issued eight-digit code is bcrypt-hashed. Both are required to activate.

Only a current approved version plus an explicit provider grant may create an invitation. A pending-delivery invitation is unusable. SES acceptance is required to mark it SENT; a failed or uncertain send leaves no usable new entitlement. SES acceptance does not prove inbox delivery. Grants revoke old invitations, accounts and sessions; resending requires a new code shared separately. The activationCode is returned only to the authenticated authorized provider. Email-plus-code is an MVP assurance method, not proof of production clinical identity.

Patient passwords are bcrypt-hashed, minimum 12 characters and maximum 72 UTF-8 bytes. Patient cookies are separate from provider cookies, HttpOnly, SameSite=Lax and Secure in production. Patient auth rate limits are in MongoDB. No public registration or reset-by-email bypass exists. Password-reset returns 503 with rate limiting; replacement invitations require provider action.

## Retention and scheduler

```dotenv
PURGE_SECRET=
ENABLE_EXPIRATION_TEST=false
DEV_PROVIDER_ADMIN=false
```

Run `npm run backend:cleanup` while the app is reachable. It calls `POST /api/internal/backend-cleanup` with a secret bearer header. Never put that secret into a public URL. Schedule this command every minute or five minutes using a deployment scheduler (for example an existing container cron or an EventBridge-triggered worker making the HTTPS request). No infrastructure is deployed by this change. Configure retries, alarm on nonzero exit or `retryRequired:true`, and run a subsequent verification cleanup. Every child collection is queried independently; parent deletion does not cascade.

Opaque S3/job cleanup manifests intentionally have NO TTL: deleting the manifest before external deletion succeeds would orphan data. They contain opaque internal identifiers/keys and retry state, not source text, emails or patient names. They survive parent TTL deletion, retry with bounded exponential backoff, and are removed after object versions/job deletion succeeds. A running Transcribe job must finish before job deletion; access is already denied while cleanup retries. Audit rows contain only random event IDs, timestamps, success and technical codes.

Immediate denial is enforced on every new patient request at or after episode expiry. TTL/cron/service deletion is asynchronous; there is no guarantee of second-exact physical deletion. Atlas backups, exports, AWS logs, Bedrock invocation logging, email retention, caches, replicas and S3 Object Lock need separate deployment controls. Disable clinical payload logging, configure backup/log retention and prohibit unsupported immutable/object-locked storage. This prototype does not claim HIPAA compliance or verified permanent erasure of every copy.

Legacy cleanup is still available at `/api/internal/purge-expired`; schedule BOTH cleanup paths while legacy data remains, or retire legacy records through a separately reviewed migration. No creation-anchored legacy record is automatically migrated into the new patient-access workflow.

## Verification and demonstration

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run backend:seed
npm run backend:demo
```

Seed creates one synthetic draft using a stable request ID; rerunning with changed data gets 409 instead of creating a duplicate identity. Set `SYNTHETIC_SEED_REQUEST_ID` to a new UUID only when intentionally creating a separate example. The seed is not approved or sent to a patient.

The real demo signs in, creates an episode, uploads the synthetic TXT document, persists it, calls Bedrock, prints the synthetic generated plan for human comparison, pauses for explicit review and discrepancy resolutions, approves, grants access, sends SES email, asks for the actual received invitation link, activates, logs in and retrieves the matching approved plan. With local admin expiration flags enabled and PURGE_SECRET set, it simulates an expired discharge, verifies denial and invokes purge. Do not claim an end-to-end success if any service step or inbox step is skipped. The script was supplied but could not be exercised against live services here.

The unit/orchestration suite uses explicitly labeled service/repository doubles. It does not validate real MongoDB transactions, concurrent isolation, AWS IAM, PDF/DOCX extraction with installed parsers, delivery to an inbox, S3 version removal or browser integration. Those are required next live checks.

Example container cron configuration (inject APP_URL and PURGE_SECRET through the deployment secret store):

```cron
*/5 * * * * cd /app && /usr/local/bin/node scripts/backend-cleanup.mjs
```

Use the actual deployment paths and ensure the scheduler can reach the application's HTTPS endpoint. Capture the command exit status, alert on failures, and keep periodic retries enabled; cleanup manifests retain retry work even if MongoDB TTL deletes episode rows first. With EventBridge Scheduler, invoke a small IAM-authenticated worker that obtains PURGE_SECRET from the secret store and makes the same POST; configure bounded retries and a dead-letter queue. Creating that paid infrastructure requires separate approval and was not performed.

## Test MongoDB and Bedrock only

With the development server running, use `npm run backend:demo -- --approval-only`. This authenticates the provider, creates a synthetic discharge, submits source text as JSON (no S3 upload), invokes real Bedrock, pauses for human review and critical issue resolutions, approves the plan, then fetches it again to check the saved APPROVED state. It stops before SES, patient activation, audio, and expiration simulation. This creates real temporary synthetic MongoDB records and invokes billable Bedrock inference. Do not resolve an issue without checking the source; stop if the generated content is incorrect.
