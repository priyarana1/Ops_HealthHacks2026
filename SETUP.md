# ClearPath external configuration and troubleshooting

For the immediate Epic-only workflow, use [EPIC_SETUP.md](EPIC_SETUP.md). MongoDB and AWS are **not** prerequisites for development OAuth or chart viewing. The sections below describe later persistent/AI workflows.

All data must be synthetic. This session did not create accounts, purchase services, deploy, or provision infrastructure.

## 1. MongoDB Atlas

Use an existing approved development cluster or obtain approval before provisioning a paid cluster. Create a database user scoped to `clearpath`, allow the development server's network address, and set `MONGODB_URI` to the Atlas connection string (URL-encode password characters). Set `MONGODB_DB_NAME=clearpath`. Persistent patient authentication and discharge data require MongoDB; local provider authentication and Epic OAuth use server-memory sessions independently. Credentials remain server-only.

Mongoose connection promises are reused across hot reloads/concurrent requests and reset after failures. TTL indexes are declared on Patient, DischargePlan, PatientAccess, AppSession, EpicConnection, OAuthAttempt and RateLimit. The application rejects expired records itself; TTL is asynchronous. For an existing cluster, verify indexes in Atlas and apply them with your approved database migration process; do not assume a declaration repaired an old index. Artifact manifests intentionally have no TTL, so they cannot disappear before external deletion succeeds. DeletionAudit contains no plan IDs, patient IDs, names, source text or service-error payloads.

If connection fails: verify Atlas IP access rules, DNS/SRV support, user/database permissions, credentials, and cluster availability. Never switch silently to a mock store.

## 2. Provider sign-in

Generate a random `AUTH_SECRET` of at least 32 characters locally using a secret manager or `openssl rand -base64 48`. Do not paste it into source control. For credential-based sign-in, set `DEV_PROVIDER_EMAIL` and either `DEV_PROVIDER_PASSWORD` (development only, hashed with bcrypt before comparison) or `DEV_PROVIDER_PASSWORD_HASH` (bcrypt hash). Production accepts only the hash option, but this remains a development auth implementation, not institutional SSO.

Set `APP_URL=http://localhost:3000` exactly for local development; browser mutation Origin must match. Cookies are HTTP-only, SameSite=Lax, Secure in production, and contain only an iron-session-protected opaque random session credential. Roles/identity/plan authorization live on the server. Logout deletes the active session and its Epic connection.

For the explicit admin-only synthetic expiration demo, set both `DEV_PROVIDER_ADMIN=true` and `ENABLE_EXPIRATION_TEST=true`, then sign in again. Normal provider sessions cannot use this test. This flag does not authorize deployment or paid service changes.

## 3. Epic public FHIR R4 sandbox

Register an application on [Epic on FHIR](https://fhir.epic.com/) using the clinician/staff/administrative user context and R4. Use its **non-production** client ID, selected read/search APIs and the sandbox readiness process. Configure your exact redirect URI as `http://localhost:3000/api/epic/callback` for this local setup; the server sends the environment value unchanged. Set `EPIC_CLIENT_ID`, `EPIC_REDIRECT_URI`, and `EPIC_SCOPES` to the exact scopes supported by that registration. If registering a confidential client with client-secret basic authentication, set server-only `EPIC_CLIENT_SECRET`; otherwise leave it empty for the registered public PKCE client. Private-key JWT clients are supported; see EPIC_SETUP.md for algorithm, key path/PEM, kid and registered public-key requirements.

Request only the read/search APIs needed by this app: Patient, Encounter, Condition, MedicationRequest, MedicationStatement if supported, DocumentReference, referenced Binary, and Appointment if supported. Scope syntax and grants depend on the registration; do not copy wildcard scopes or assume a resource is supported. An empty `EPIC_SCOPES` defaults to the documented `openid` sandbox scope; explicitly configure registered identity/resource scopes when applicable. The public sandbox base is fixed to:

`https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/`

The adapter discovers OAuth endpoints through SMART configuration, trusts only Epic's public sandbox host/path, uses S256 PKCE when discovery supports it (or does not advertise methods), binds a five-minute single-use state to the current provider session, and stores encrypted access tokens only server-side for at most one hour. It does not request or retain refresh tokens. Expiration or 401 requires reconnecting. Local disconnect deletes the stored connection; it does not claim to revoke an Epic-wide login session.

Sign in to ClearPath first, then choose Connect to Epic Sandbox. Authenticate on Epic's own authorization page with the **provider/clinician sandbox user type** from Epic's current testing guide. Do not use MyChart patient credentials for the provider connection. ClearPath never asks for that password. The current provider integration is authorization to read chart data, not ClearPath authentication.

Search by a known synthetic patient name from Epic's sandbox test data; unrestricted patient listing is not assumed. Each resource call is independent and displays denied, unsupported, empty, or error status. Patient IDs are FHIR IDs, not MRNs. The stored issuer qualifies every Epic patient/encounter reference. General notes/CDAs are never treated as finalized AVS; paste/upload the synthetic finalized instructions separately.

Troubleshooting: registration changes may need sandbox propagation time; compare client ID, exact redirect URI, user context, enabled APIs, scope spelling, token expiry, and returned resource status. A 403 is not an empty chart. Reconnect after a 401. Full resource-by-resource live verification requires your registered app and authorization.

Sources: [Epic OAuth, standalone launch, discovery and sandbox testing documentation](https://fhir.epic.com/Documentation), [open.epic](https://open.epic.com/).

## 4. AWS

Use an existing authorized AWS account and region. Before creating resources or enabling paid usage, obtain the project owner's approval. Set `AWS_REGION`, optionally `AWS_PROFILE` for your existing local profile, `AWS_S3_BUCKET`, and `BEDROCK_MODEL_ID`. SDK clients use the standard AWS credential provider chain; do not embed access keys in code. Production should use an appropriate workload IAM role. `BEDROCK_MODEL_ID` may be an allowed model ID or inference-profile identifier supported in your Region/account.

For an existing dedicated temporary S3 bucket: block public access, require TLS, enable default encryption, restrict IAM/bucket policies to the `temporary/` prefix, and align region with Transcribe Medical. Uploads explicitly request SSE-S3 (or SSE-KMS if `AWS_KMS_KEY_ID` is set). Transcription output uses S3 default encryption or the configured KMS key. Avoid versioning, replication, Object Lock and backups for this synthetic temporary bucket unless their deletion implications are explicitly managed. The cleanup code also enumerates and deletes object versions; permissions for this are required even on an unversioned bucket.

Required workload permissions, narrowed to the approved bucket/prefix, model/inference profile and job resources where the service supports scoping:

- `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:DeleteObjectVersion`, `s3:ListBucketVersions`.
- `transcribe:StartMedicalTranscriptionJob`, `transcribe:GetMedicalTranscriptionJob`, `transcribe:DeleteMedicalTranscriptionJob`.
- `bedrock:InvokeModel` for Converse with the chosen model/profile and any backing regional model ARNs required by that profile.
- If using KMS, appropriate `kms:Encrypt`, `kms:Decrypt`, `kms:GenerateDataKey` and key-policy grants for the workload and transcription service flow.

Validate bucket and service policies using your account's IAM tools. No broad administrator policy is needed. This document is a configuration checklist, not a provisioned policy.

Recording uses MediaRecorder and selects supported WebM/Opus, MP4 or Ogg. The medical batch API accepts these formats; unsupported browser formats are rejected instead of falsely converted. Input is limited to 25 MB. Browser recording requires HTTPS or localhost and microphone permission. Jobs use unique random names, `en-US`, `PRIMARYCARE`, `DICTATION`, explicit S3 input/output and asynchronous polling. Transcript text is copied into the draft unconfirmed and must be reviewed; temporary audio, output and terminal job metadata are then removed. Failed cleanup retains a durable retry manifest. Live transcription is disabled when bucket/credential resolution fails. The explicit synthetic transcript button never contacts AWS.

Bedrock uses Converse with configurable model/profile and schema/evidence validation; failed parsing gets one correction attempt, SDK transient errors use bounded retries, and failed real calls do not return demo text. AccessDenied typically means missing IAM grants, model access or profile permissions; a validation error may mean a model/profile is unavailable in the chosen Region. Check account configuration rather than hard-coding another model.

Sources: [Transcribe Medical batch request and supported formats](https://docs.aws.amazon.com/transcribe/latest/APIReference/API_StartMedicalTranscriptionJob.html), [Bedrock Converse](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html).

## 5. Patient activation

Publishing an approved plan creates a cryptographically random invitation token and a six-digit OTP. Only hashes are stored (SHA-256 for the high-entropy token, bcrypt for OTP). OTP expires after ten minutes or the plan expiration, whichever comes first. Verification is limited to five attempts per invitation plus durable rate limiting. A successful claim is single-use and creates a server-side session mapped to that exact plan and patient.

Development returns the OTP only to the authenticated publishing provider and labels it development-only. It is never returned by a public OTP-reading endpoint or logged. Activation URLs carry the token in a fragment, which is removed from the address bar immediately; fragments are not sent in HTTP referrers/request logs. For a separate patient session, use a private window or another browser. A missing/expired code requires the clinician to create a fresh invitation. Production publishing remains disabled until a verified out-of-band OTP delivery adapter is implemented; do not work around the gate by returning production OTPs to patients.

Future patient-facing Epic login must be a separately registered adapter which verifies its own OIDC identity and links it to an existing authorized patient record. It must not reuse the provider OAuth connection or use a raw Epic ID as a credential. Missing future credentials do not block development OTP activation.

## 6. Retention, cleanup and expiration demo

Patient-specific records use `expiresAt = first createdAt + 30 × 24 × 60 × 60 seconds`. Edits, approval, invitations, and publishing never reset the deadline. Associated sessions cannot outlive it. Temporary audio has a shorter one-hour deadline capped by the plan deadline.

Configure a long random `PURGE_SECRET`. An authorized scheduler calls `POST /api/internal/purge-expired` with `Authorization: Bearer <secret>` over TLS. This endpoint bypasses browser Origin because bearer authentication is required. Never put the secret into frontend code. The service deletes expired database records/sessions and external objects, including versions, and writes only non-identifying event evidence. Artifact manifests survive TTL and remain until deletion succeeds. Active transcription jobs cause cleanup to retry after they reach a terminal state, avoiding output regeneration after deletion.

Deployment plan (not deployed): invoke every 5 minutes using an approved scheduler with a secret-injecting worker, retry transient failures with exponential backoff, alert if `retryRequired` is true or manifests grow/age, repeatedly invoke until batches (100 artifacts per call) drain, then verify no expired patient records, sessions or overdue manifests remain. Reconcile configured bucket versions/replicas/backups and database backup retention separately. S3 lifecycle is defense in depth, not the application deletion guarantee. Use least-privilege scheduler identity and protect network access to the endpoint. TTL and scheduled physical deletion are asynchronous; this prototype does not claim second-exact erasure or erase provider/database backups by magic.

For a local synthetic test, sign in with the admin flags enabled, create a synthetic draft, and call `POST /api/discharges/<planId>/expire-test` from the signed-in browser with matching Origin. Verify subsequent reads return 410 (or 404 after physical deletion), patient sessions fail, artifacts are gone or report a retry, and DeletionAudit has no identifying content. Reset the flags after testing. No actual record needs to wait 30 days.

## 7. Verification and blockers

First fix package registry connectivity and run `npm install`. Then run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and the README's full flow. Static checks and the production build pass with installed dependencies. Epic OAuth and development sessions have synthetic-fixture tests independent of MongoDB/AWS; real authorization remains a local manual check because the execution sandbox denies HTTP listening and Epic DNS access. No live-success results are claimed.

Add credential-backed smoke tests for each enabled Epic resource and real Atlas connection/indexes, AWS upload/job/output cleanup, Bedrock schema behavior and a browser test covering login → approval → invitation → correct patient plan → expiration. Confirm other patient/session IDs cannot access that plan. Review active-job cleanup, failed-job recovery, concurrent publish/activation behavior and source/AI content with synthetic edge cases before a demonstration.

## Manual chart / AVS workflow without Epic or AWS

Set `MONGODB_URI` and `MONGODB_DB_NAME` (exact spelling) in `.env.local`. In Atlas, use a database user with read/write access to this database and add your current public IP to the project IP access list. The database user is separate from your Atlas website login. Restart the development server after editing configuration.

Run `npm run db:check` to perform a read-only ping. It prints no URI or password. A failed ping does not establish whether the cause is the local network, Atlas access list, or credentials. The new-discharge page also checks database connectivity using the provider-authenticated `/api/database/status` endpoint.

1. Sign in at `http://localhost:3000/provider` and start a new discharge.
2. Paste/upload a synthetic `.txt` chart (under 60 KB), and paste/upload finalized synthetic AVS text separately. PDF/Word extraction is not enabled. Chart context alone cannot be processed as finalized discharge instructions.
3. Confirm synthetic data, then save. Reload the review page and verify the uploaded chart and AVS remain present. Return to the provider list and reopen the draft. Saving does not require AWS or Epic.
4. To test the entire patient flow without AWS, start a **separate built-in synthetic demo** with `ENABLE_DEMO_MODE=true`. This uses its own canned source, not your uploaded chart. Select **Generate synthetic demo (no API call)**, review, approve, publish, and use the development-only invitation and OTP in a private browser window.
5. To process your own uploaded text, configure AWS credentials through the standard SDK chain, `AWS_REGION`, and `BEDROCK_MODEL_ID`, then use **Generate with Bedrock**. S3 and Transcribe are needed only for audio, not text processing. Failed real requests never automatically become demo results.

All saved drafts retain the initial 30-day expiration. Approval and patient publication remain separate actions. This local prototype is not a production deployment.
