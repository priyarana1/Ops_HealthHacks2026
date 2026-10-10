# ClearPath: rules for Claude Code

## Product in one paragraph
A nurse records or pastes discharge instructions. AI simplifies them to a 5th-grade reading level
(structured JSON), a clinician approves, the plan is translated (Spanish, Mandarin, Arabic) and
back-translation-checked, then published to the patient via a unique link + one-time code. The patient
reads/listens, chats with a plan-grounded chatbot, and does daily check-ins. ALL data is deleted at 30 days.

## Read first
docs/PROJECT_PLAN.md (phases, env vars, API table, data model), docs/stories.md (acceptance criteria),
docs/prompts/*.md (system prompts), docs/schemas/plan.schema.json, docs/samples/*.md, docs/design/*.html (UI reference).

## Non-negotiable rules
1. Synthetic data only unless a human says the environment is approved for PHI.
2. NEVER log PHI: no names, MRNs, transcripts, plan text, chat text, or OTPs in logs, errors, analytics or audit rows.
3. expiresAt is set server-side to createdAt + 30 days (2,592,000 s). Reject any client-supplied value.
4. Nothing patient-facing is readable until discharge.status == "approved" (and per-language "verified").
5. The AI never adds, changes or infers medical content. Ambiguity goes to ambiguityFlags for a clinician.
6. Drug names, doses and numbers must be byte-identical across English and translations.
7. Chatbot answers only from the approved plan JSON. Red-flag symptoms always trigger the 911 response
   (deterministic filter runs BEFORE the model).
8. No secrets in code, tests, fixtures or commits. Read config from environment / Secrets Manager.
9. Least-privilege IAM. Every Lambda gets its own role.
10. Every endpoint declares its allowed roles and has a test for 401/403.

## Stack
TypeScript everywhere. pnpm monorepo: apps/web (Next.js App Router, Tailwind), services/api (Lambda handlers),
packages/shared (zod schemas, prompts, triage rules, types), infra/ (Terraform). MongoDB Atlas. AWS (S3, KMS,
Cognito, API Gateway, Lambda, Step Functions, Transcribe, Comprehend Medical, Bedrock, Polly, EventBridge, SNS/SES).

## Commands
pnpm install | pnpm dev | pnpm test | pnpm lint | pnpm typecheck | pnpm e2e | pnpm eval | pnpm db:init

## Definition of done (every task)
Types pass, lint passes, unit tests added, an auth test added for new endpoints, no PHI in logs,
docs updated, .env.example updated if config changed.

## Working style
- Propose a plan before editing files. One task per commit.
- Use mock adapters (TRANSCRIBE_MODE, MODEL_MODE, SMS_MODE, TTS_MODE) so everything runs offline.
- When unsure about clinical behavior, retention rules or auth rules, ask. Do not guess.
