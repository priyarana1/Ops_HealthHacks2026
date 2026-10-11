# ClearPath

Discharge AI for Rutgers Health Hackathon 2026 (Ops Unleashed, Challenge 1). A nurse uploads the
discharge document, AI turns it into plain-language instructions, a clinician reviews and approves
them, and the patient opens their plan on a phone with a secure link and a 6-digit code. Everything
expires 30 days after discharge.

**Synthetic data only.** This is a prototype: it is not HIPAA compliant and must never receive real
patient information.

## Run it

Use Node.js 22 or newer.

```sh
npm install
cp .env.example .env    # then fill in the values below
npm run dev             # http://localhost:3000
```

Open the app at `http://localhost:3000`, not `127.0.0.1`: requests must come from `APP_URL`.

### What goes in `.env`

Ask a teammate for the shared values privately; never commit `.env` or paste keys in chat.

| Needed for | Variables |
|---|---|
| Database (required) | `MONGODB_URI` (Atlas connection string), `MONGODB_DB_NAME=clearpath` |
| Sessions (required) | `AUTH_SECRET`: any random string of 32+ characters (`openssl rand -base64 48`) |
| Provider sign-in (required) | `DEV_PROVIDER_EMAIL`, `DEV_PROVIDER_PASSWORD`: the login for `/signin` |
| AI (required, pick one) | OpenAI: `OPENAI_API_KEY` + `OPENAI_MODEL` (we use `gpt-6.1-sol`). Or Anthropic: `ANTHROPIC_API_KEY`. Or Amazon Bedrock: `AWS_PROFILE`, `AWS_REGION`, `BEDROCK_MODEL_ID`. The first one set, in that order, is used. |
| Expiry demo | `DEV_PROVIDER_ADMIN=true`, `ENABLE_EXPIRATION_TEST=true` |
| Epic sandbox (optional) | `EPIC_*`: see [EPIC_SETUP.md](EPIC_SETUP.md) |

Restart `npm run dev` after editing `.env`, and after anyone changes `src/lib/backend/models.ts`.

## Demo vs real

| | Real flow (backend, AI, MongoDB) | Scripted demo (sample data, no AI, no setup) |
|---|---|---|
| Provider | `/signin` → `/provider` → **New discharge** (`/provider/discharge/new`) | `/provider/discharge/ELN-7Q2K` (Eleanor) |
| Patient | `/p/<link>` from the Publish step + the 6-digit code | `/p/ELN-7Q2K`, code `418203` |

Use the scripted demo as a fallback if the AI is slow during a live demo. The coordinator view
(`/coordinator`) is still sample data.

## The real flow

1. **Capture.** Upload the discharge PDF, Word or text file, or paste the text. The text is extracted and
   stored in MongoDB.
2. **AI draft (40–90 s).** Stage 1: the AI picks exact passages from the document, and the server copies
   them word for word. Stage 2: the AI rewrites them in plain language. Code checks reject any rewrite that
   changes a number, drops a condition ("only if…", "do not"), turns sodium into salt, adds dosing times or
   invents pill counts; the original wording is kept instead.
3. **Review.** Source document next to the patient preview, reading level, and review flags. The clinician
   marks flags reviewed, confirms the discharge time, and approves.
4. **Translate (optional).** Spanish, Mandarin or Arabic, one click each (about a minute). Medicine names and
   doses are never translated. Each line is checked in code (numbers, units, medicine names), translated back
   to English independently, and compared with the approved plan. A mismatch blocks that language until the
   clinician re-translates or edits the line; then they publish it. Patients only see published languages.
   This is a safety net, not certification: real use needs review by a qualified medical interpreter.
5. **Publish.** Creates the patient link and a 6-digit code (shown once to the nurse). The code works until
   the plan expires; 5 wrong tries lock the link; issuing a new code revokes the old link.
6. **Patient app.** The approved plan: medicines grouped new / keep taking / stop or hold, daily to-dos,
   appointments, and when to call the care team or 911. The chat tab is a demo assistant with example
   answers.
7. **Expiry.** Access ends exactly 30 days after discharge; MongoDB deletes the records afterwards. The
   Publish step has a **Simulate 30-day expiry** test button.

## Checks

```sh
npm run typecheck && npm run lint && npm test   # no network, no cost
npm run build
npm run eval:ai          # 8 synthetic cases through the real AI (needs npm run dev; costs AI credits)
npm run backend:upload -- sample-data/discharge-pdfs/Patient_1_HFrEF_Pneumonia_AKI.pdf
```

`sample-data/discharge-pdfs/` holds the three synthetic discharge PDFs from the judges' examples.

## Where things are

| Path | What |
|---|---|
| `src/app/`, `src/components/` | Pages and UI (provider portal, patient app, coordinator) |
| `src/components/provider/DischargeWizard.tsx` | Real discharge wizard; `demo/EleanorWizard.tsx` is the scripted one |
| `src/components/patient/PatientApp.tsx`, `PatientPortal.tsx` | Patient app and the real `/p/<link>` sign-in |
| `src/lib/plan-adapter.ts` | Converts the backend plan into the UI's plan format |
| `src/lib/backend/` | Discharge API: upload, AI pipeline, review, approval, publishing, patient access, cleanup |
| `src/lib/backend/llm.ts` | Chooses OpenAI, Anthropic or Bedrock |
| `src/lib/epic/` | Epic sandbox sign-in and chart import |

More detail: [BACKEND_API.md](BACKEND_API.md) (API contract), [BACKEND_SETUP.md](BACKEND_SETUP.md)
(backend setup and pipeline), [EPIC_SETUP.md](EPIC_SETUP.md), [SETUP.md](SETUP.md).

## Limits

- AI output is a draft: a clinician must review it, and automated checks cannot prove it is complete.
- Patient codes are shown to the nurse for the demo; real use needs a verified SMS or email channel.
- Scanned PDFs (images without text) cannot be read; there is no OCR.
- Deletion at 30 days covers MongoDB records; backups, logs and AI-provider retention need separate
  controls before any real use.
