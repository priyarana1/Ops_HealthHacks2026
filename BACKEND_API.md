# ClearPath backend integration contract

Version 1. JSON schemas and shared TypeScript types are in `src/lib/backend/contracts.ts`. All data is synthetic. Existing provider login and `/api/epic/*` remain unchanged. No UI files or teammate branches were changed. These new discharge APIs replace the legacy route contracts; provider UI integration is an explicit remaining task for its owner.

## Common behavior

- Base path `/api`. Same-origin writes require `Origin` equal to APP_URL. Browser fetch should use `credentials:'include'`; same-origin is recommended. There is no wildcard CORS or cross-origin credential sharing. Integrate the teammate's frontend into this Next.js origin or configure a reviewed reverse proxy.
- Provider routes require the existing server-authenticated provider session and enforce owner identity. Patient routes use a **separate** `clearpath_patient` cookie. Never authorize using browser role flags or medical identifiers.
- Failure shape: `{ "error": "safe message" }`. Statuses: 400 malformed input, 401 unauthorized/invalid credentials, 403 origin or forbidden access, 404 unavailable record, 409 version/state/idempotency conflict, 410 expired episode, 413 size limit, 415 unsupported content, 422 clinical validation, 429 rate limit, 503 unavailable dependency/service. Patient credential failures are generic; no public patient search or registration exists.
- `requestId` is a caller-generated UUID. Reuse it for a retry of identical data; changed data with the same key returns 409. New clinical versions use optimistic `version` checks. IDs are opaque internal UUIDs, never Epic MRNs.
- `dischargeAt` must contain an explicit time and offset and match its IANA timezone. Example: `2026-10-10T08:00:00-04:00`, `America/New_York`. For UTC timestamps use `UTC`. Substitute a valid past date for examples. UTC dischargeAt and dischargeAt + 30 elapsed days are stored; future and already-expired episodes are rejected. A source calendar date is only a candidate and never silently assigned midnight.

## Provider endpoints

| Method and route | Input | Response / purpose |
|---|---|---|
| POST `/discharges` | create example below | `{episodeId,patientId,planId,state,version,dischargeAt,expiresAt}` |
| GET `/discharges` | none | `{episodes:[...]}` owned, unexpired records only |
| GET `/discharges/:planId` | none | `{episode,patient,plan,sources,normalized}` for side-by-side review |
| GET `/discharges/:planId/sources` | none | original extracted text and provenance |
| POST `/discharges/:planId/sources` | JSON source or multipart below | `{sourceId,version,documentType,originalStored}` |
| PATCH `/discharges/:planId/sources` | `{version,sourceId,text,transcriptConfirmed}` | corrected source; clears output/approval/access |
| POST `/discharges/:planId/process` | `{}` | runs real Bedrock; snapshot with PENDING_REVIEW output |
| PATCH `/discharges/:planId/review` | `{version,content?,dischargeConfirmed?,resolutions?}` | edited snapshot; increments version, invalidates prior approval/access |
| POST `/discharges/:planId/approve` | `{version,clinicalReviewConfirmed:true}` | `{state:"APPROVED",version,fingerprint}` |
| POST `/discharges/:planId/grant-access` | `{version,email,enrollmentAuthorized:true}` | provider-only `{state,invitationId,activationCode,validUntil,delivery,identityAssurance}` |
| POST `/discharges/:planId/resend-invitation` | same grant payload | replaces invitation/code and invalidates old accounts/sessions; explicit provider action |
| POST `/discharges/:planId/revoke` | `{}` | REVOKED, invitations/accounts/sessions invalidated |
| POST `/discharges/:planId/expire-test` | `{}` | development + admin + ENABLE_EXPIRATION_TEST + synthetic episode only; expires all records, does not automatically purge |

Creation:

```json
{
  "requestId": "12345678-1234-4234-8234-123456789012",
  "syntheticConfirmed": true,
  "patient": { "displayName": "Synthetic Patient A" },
  "dischargeAt": "2026-10-10T08:00:00-04:00",
  "dischargeTimezone": "America/New_York",
  "dischargeConfirmed": false,
  "clinicalInput": "NEW: Furosemide 40 mg by mouth once daily.",
  "sourceKind": "FINAL_AVS"
}
```

`clinicalInput` is optional to allow a draft before upload. Optional `epicPatientId` and `encounterId` invoke the existing real provider-authorized Epic adapter and store issuer + FHIR patient + encounter identity. Manual text cannot claim EPIC_FHIR provenance. A failed real Epic import is not replaced with local data.

Source JSON:

```json
{
  "requestId": "12345678-1234-4234-8234-123456789014",
  "kind": "FINAL_AVS",
  "text": "Synthetic finalized discharge text.",
  "transcriptConfirmed": false
}
```

Source kinds: FINAL_AVS, DISCHARGE_SUMMARY, CHART_CONTEXT, CLINICIAN_NOTE, AUDIO_TRANSCRIPT, EPIC_FHIR. The last is reserved for the server import adapter. Audio content is supplemental. Manually entered AUDIO_TRANSCRIPT text is not represented as a successful AWS transcription.

Multipart upload: fields `requestId`, `kind`, `file`. PDF/DOCX/TXT, maximum 5 MB; maximum extracted text 120,000 characters; PDFs maximum 100 pages. Signature/MIME/extension and ZIP expansion are checked. Scans without text return 422; OCR is not implemented. PDF/DOCX require `npm run backend:install`. HTML is not returned or rendered. Original private S3 storage is conditional and explicitly reported.

A generated plan contains: language, summary, hospitalCourse, diagnoses, medications, dailyActions, diet, fluids, activity, otherInstructions, appointments, labsAndMonitoring, warningSigns, definitions, teachBackQuestions, practicalBarriers and issues. `GeneratedContent` is the exact schema. Clinical statements carry `{sourceId,quote}` evidence. Medication status is **CHANGE**, not legacy CHANGED; STOP and HOLD stay separate. Missing medication fields are null. Warning levels are CONTACT_CARE_TEAM, URGENT, EMERGENCY. No values are invented from a generic heart-failure template.

Resolution example:

```json
{
  "version": 2,
  "dischargeConfirmed": true,
  "resolutions": [{ "id": "source-completeness", "resolution": "Compared the full synthetic source with the output, including medications and labs." }]
}
```

Review corrections must be clinically justified. A resolution is a clinician attestation, not an automatic fix. Unsupported medication values/quantities still fail deterministic validation. Resolve every critical issue, including source completeness. If a missing dose needs clarification, correct/add the authoritative source and regenerate rather than guess. Edits after approval invalidate approval, invitations, accounts and sessions. Discharge timestamp is immutable after creation; correct an incorrectly dated draft by creating a new correctly dated episode and revoking the old access, not extending its retention boundary.

State transitions:

```text
DRAFT -> PROCESSING -> PENDING_REVIEW -> APPROVED -> ACCESS_GRANTED -> ACTIVE
processing failure -> prior draft/review state
clinical/source edit -> DRAFT or PENDING_REVIEW; prior approval/access invalidated
APPROVED / ACCESS_GRANTED / ACTIVE -> REVOKED
any state at expiresAt -> immediate denial; TTL/cleanup removes records
```

Processing alone never grants access. APPROVED alone never sends email. ACCESS_GRANTED can have a pending delivery record, but activation is impossible until SES acceptance and SENT status. Failed delivery returns to APPROVED with an unusable FAILED invitation. Revoke is idempotent. A revoked episode can be corrected and reviewed again before expiration; no expiration reset is allowed.

## Patient frontend integration

The invitation email points to `/patient/activate#token=...`. Read the fragment in client code, keep it out of analytics/logs, and clear it from browser history after capturing it. Do not request or display any medical information on activation screens.

| Method and route | Input | Response |
|---|---|---|
| POST `/patient/activate` | `{token,activationCode,password}` | `{activated:true}`; single use; does **not** log the patient in |
| POST `/patient/login` | `{email,password}` | `{authenticated:true,validUntil}` plus HttpOnly cookie |
| POST `/patient/logout` | `{}` | `{ok:true}`; server session deleted |
| GET `/patient/me` | cookie only | `{authenticated:true,accountId,episodeId,planId,expiresAt}` |
| GET `/patient/discharge-plan` | cookie only; **no caller-supplied patient ID** | `PatientPlanResponse` |
| POST `/patient/password-reset` | no functional reset yet | rate-limited 503; ask provider for replacement invitation/code |

Activation proves possession of the emailed token and the separately issued provider code. Invitation is valid for at most 30 minutes and never beyond the episode. Five incorrect code attempts consume the invitation attempt budget. Password minimum 12 characters, maximum 72 UTF-8 bytes. New accounts require an approved/current granted plan. Login selects an active matching credential among the email's temporary accounts; no patient list is exposed.

Example patient fetch:

```ts
import type { PatientPlanResponse } from '@/lib/backend/contracts';
const response = await fetch('/api/patient/discharge-plan', { credentials: 'include', cache: 'no-store' });
if (!response.ok) { /* show sign-in/unavailable state without medical details */ }
const plan: PatientPlanResponse = await response.json();
```

Only approved content is returned, with episode ID, plan ID, patient ID, discharge date/timezone, expiresAt, current version and approvedVersion. Raw sources, email, password hashes, invitations, unresolved drafts and AWS metadata are not returned. Show unavailable on expired/revoked access. Never continue displaying a cached plan as if access remained valid. No symptom/check-in/tracking collections or endpoints were added.

## Audio and operations

POST `/audio/upload`: multipart `{planId,audio}` -> `{audioId}`. POST `/audio/transcribe`: `{audioId}` -> `{jobId,status}`. GET `/audio/jobs/:jobId`: status or `{status:"COMPLETED",sourceId,transcript,transcriptConfirmed:false}`. Correct/confirm via PATCH sources before processing. Provider ownership and episode expiry are checked. GET `/audio/status` reports configuration only, never claims a live connection.

POST `/internal/backend-cleanup`: bearer PURGE_SECRET, no browser Origin required -> `{objectsDeleted,recordsDeleted,failures,retryRequired}`. Retry if failures remain. This endpoint has no patient disclosure and is not callable with an ordinary provider/patient cookie alone. Deployment configuration and limits are in BACKEND_SETUP.md.

## Source-first processing pipeline

Uploading/pasting saves the original decoded text in `clinicalsources.text` before any AI request. TXT whitespace is preserved. `POST /api/discharges/:planId/process` now runs two Bedrock stages: (1) verbatim, evidence-linked extraction, persisted in `clinicaldischargeplans.extraction` with `extractionModel`; (2) prose-only simplification. Stage 2 receives only prose fields and returns an allowlisted rewrite list. It cannot modify structured medication name, dose, route, frequency, duration, formulation, status, evidence, or approval. Values such as PO remain PO in the structured medication; plainLanguage may explain them without changing the order. Final validated content remains in `content` and requires clinician review and approval. Failed simplification leaves raw source and saved extraction available; no automatic fake result is generated. Source edits clear extraction and generated content. A processing request normally makes two inference calls, with up to one validation retry per stage. Outputs remain unverified until clinician review. Raw source is preserved as decoded text, not an archival byte-for-byte copy of the original file; private original binary storage remains optional S3 functionality.
