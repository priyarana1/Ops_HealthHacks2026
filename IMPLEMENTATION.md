# Implementation checklist
- [x] Inspect repository and branches: only an empty README existed; no app to preserve.
- [x] Branch from dev into feat/clearpath-functionality-setup; no commits/pushes.
- [x] Next.js App Router, strict TS, Tailwind and Radix/shadcn-style button.
- [x] MongoDB connection reuse and required models; server-side provider/patient sessions.
- [x] Epic discovery, state + PKCE OAuth, encrypted server token storage and authorized chart import.
- [x] Per-resource status, chart/AVS distinction and manual plain-text AVS fallback.
- [x] Browser recording, S3 upload, asynchronous Transcribe Medical jobs and editable transcript.
- [x] Bedrock Converse extraction, Zod/evidence validation, clinician editing and approval gate.
- [x] Approved/published plans, private activation link, hashed OTP, rate limiting and patient-only dashboard.
- [x] Fixed expiration, TTL indexes, API checks, durable artifact cleanup and synthetic expiration endpoint.
- [x] Installed dependencies are now present; added jose from the local npm cache.
- [x] 38 unit tests, strict TypeScript and full Next/TypeScript lint pass.
- [x] Production build passes.
- [x] Epic OAuth, clinician identity, local provider sessions and chart display work independently of MongoDB/AWS in development.
- [ ] Complete live browser authorization locally; execution sandbox blocks listening ports and Epic DNS.
- [ ] Exercise authenticated Epic, AWS and Atlas integrations with configured accounts.
- [ ] Configure production OTP delivery before enabling production publish.

Future Phase G is reserved in src/types/future.ts only. There are no tracking/check-in/caregiver collections or routes.
