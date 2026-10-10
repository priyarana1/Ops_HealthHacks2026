# Backend implementation record

Provider UI and patient frontend files were not modified. No branch switch, merge, commit, deployment or paid infrastructure configuration occurred. Provider sign-in and Epic OAuth code are unchanged. One server-side legacy-patient-session guard was added to prevent old creation-anchored cookies from disclosing records outside the new enrollment contract.

## Implemented code

- Episode/patient/source/plan/approval/invitation/account/session schemas and indexes.
- Discharge-based immutable retention boundary, source date candidates, confirmation and discrepancy checks.
- Idempotent manual ingestion, bounded document parsing adapters, real Epic import reuse and provenance.
- Bedrock Converse adapter, source evidence and deterministic safety checks, versioned review and approval fingerprints.
- Separate explicit enrollment grant, fail-closed SES adapter, hashed single-use invitation plus separately issued activation code.
- Password account activation/login/logout, separate patient cookie, ownership/version/expiry checks and revocation.
- Medical audio upload/job/poll adapters and clinician transcript correction.
- Cross-collection cleanup, S3/job manifests and retries, non-identifying audit, local commands and scheduler instructions.
- Shared contracts, integration guide, synthetic fixture/seed and real-service walkthrough script.

## Verification

TypeScript, lint, production build and 85 tests passed. Tests include explicitly mocked repository/AWS orchestration and do not establish live integration success. MongoDB ping failed with ECONNREFUSED. Registry installation failed with ENOTFOUND. BEDROCK_MODEL_ID, AWS_S3_BUCKET and SES_FROM_EMAIL are not configured in this environment. No real clinical generation, email/inbox delivery, S3 cleanup or end-to-end test succeeded here.

## Remaining work

1. Run backend:install on a networked machine and retain its updated dependency manifest/lockfile. Validate real PDF/DOCX extraction.
2. Verify Atlas connectivity, create indexes, and test actual multi-document transactions/concurrent duplicate requests.
3. Configure/test Bedrock, SES and optional S3/Transcribe with least-privilege IAM.
4. Integrate existing provider UI and teammate patient frontend with BACKEND_API.md; legacy payloads/screens are not wired to the new contract.
5. Run backend:demo with real services, human clinical review and actual mailbox verification.
6. Configure scheduler/alerts and verify external-object deletion and infrastructure backup/log retention.
7. Translation generation and review, production identity assurance and self-service password reset remain deferred.

## Modified files

- `.env.example`
- `README.md`
- `package.json`
- `src/lib/auth/session.ts`

## Created files

- `BACKEND_API.md`
- `BACKEND_SETUP.md`
- `sample-data/heart-failure-discharge.txt`
- `scripts/backend-cleanup.mjs`
- `scripts/backend-flow.mjs`
- `scripts/backend-indexes.mjs`
- `scripts/backend-seed.mjs`
- `src/app/api/audio/[...path]/route.ts`
- `src/app/api/discharges/[...path]/route.ts`
- `src/app/api/discharges/route.ts`
- `src/app/api/internal/backend-cleanup/route.ts`
- `src/app/api/patient/[...path]/route.ts`
- `src/lib/backend/audio.ts`
- `src/lib/backend/bedrock.ts`
- `src/lib/backend/body.ts`
- `src/lib/backend/cleanup.ts`
- `src/lib/backend/contracts.ts`
- `src/lib/backend/dependencies.ts`
- `src/lib/backend/documents.ts`
- `src/lib/backend/email.ts`
- `src/lib/backend/http.ts`
- `src/lib/backend/models.ts`
- `src/lib/backend/patient.ts`
- `src/lib/backend/policy.ts`
- `src/lib/backend/repository.ts`
- `src/lib/backend/service.ts`
- `tests/backend-aws.test.ts`
- `tests/backend-cleanup.test.ts`
- `tests/backend-documents.test.ts`
- `tests/backend-flow.test.ts`
- `tests/backend-policy.test.ts`
- `tests/fixtures/backend-memory.ts`
- `BACKEND_IMPLEMENTATION.md`
