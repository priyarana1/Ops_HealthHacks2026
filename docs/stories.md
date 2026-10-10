# ClearPath user stories and acceptance criteria

**Priority labels:** MUST HAVE (required by the brief, the CMO video, the judging criteria, or the live demo cannot run without it) · SHOULD HAVE · COULD HAVE · WON'T (roadmap).
**Source tags:** [BRIEF] [CMO VIDEO] [JUDGING] [DEMO-CRITICAL] [TEAM DIFFERENTIATOR].
**Sizes:** S under 2 h · M 2 to 4 h · L 4 to 8 h.

> **Honest classification.** The chatbot, daily check-ins, the coordinator view and caregiver features are NOT in the brief. The chatbot, the weight check-in and a minimal coordinator view are MUST HAVE only because the scripted demo depends on them ([DEMO-CRITICAL]). Everything else beyond the brief is SHOULD or COULD.
>
> **Update to the TTL stories.** The stories below say "TTL on `expiresAt`". The project plan (Phase 2 and Phase 9) refines this: `expiresAt = createdAt + 30 days` is the official expiry, the API refuses reads after it, a purge job deletes everything (including S3 audio) shortly after, and the Mongo TTL index sits on `purgeAfter = expiresAt + 1 hour` as a backstop. Treat the plan as authoritative.

Where a story says "Whisper", read "the transcription service" (Amazon Transcribe Medical in the plan; Whisper is an alternative).

---

## Authentication and access control

### Provider login with role separation
- **Priority:** MUST HAVE · **Source:** [CMO VIDEO] [JUDGING] · **Persona:** Nurse Priya · **Size:** M
- **Story:** As a discharging nurse, I want to log in with authenticated credentials scoped to a provider role, so that only authorized staff can create and approve discharge plans.
- **Acceptance criteria:**
  1. Given valid provider credentials, when I log in, then I receive a provider-scoped token and land on the provider dashboard in under 2 s.
  2. Given invalid credentials, when I submit, then access is denied and no session token is issued.
  3. Given a patient-role token, when it calls a provider-only endpoint, then the API returns 403 and logs the attempt without PHI.
  4. Given I am logged in, when I view the UI, then no PHI from other discharges is visible.

### Patient secure link and one-time code (OTP)
- **Priority:** MUST HAVE · **Source:** [CMO VIDEO] [BRIEF] [DEMO-CRITICAL] · **Persona:** Eleanor (78) · **Size:** M
- **Story:** As a patient, I want to open my unique link and confirm a one-time code, so that only I (and people I show it to) can see my plan.
- **Acceptance criteria:**
  1. Given a valid link and the correct code, when I submit, then my plan loads on a mobile viewport.
  2. Given a wrong code, when I submit, then access is denied and no plan content is in the response body.
  3. Given 5 wrong attempts, when I try a 6th within the cool-down window, then it is blocked.
  4. Given an expired discharge, when I open the link, then I see the "plan expired" page, not content.

### Session timeout for providers
- **Priority:** SHOULD HAVE · **Source:** [JUDGING] · **Persona:** Nurse Priya · **Size:** S
- **Story:** As a nurse on a shared workstation, I want my session to expire after inactivity, so that PHI is not left exposed.
- **Acceptance criteria:**
  1. Given 15 minutes of inactivity, when I return, then I must re-authenticate.
  2. Given active use, when I act before the timeout, then the session extends.
  3. Given an expired session, when a stale token calls the API, then it returns 401.

### Mocked OTP delivery (honest framing)
- **Priority:** SHOULD HAVE · **Source:** [DEMO-CRITICAL] · **Persona:** Dr. Tadi · **Size:** S
- **Story:** As the CMO, I want OTP delivery clearly labeled as mocked, so that reviewers trust we are not claiming a real HIPAA SMS gateway.
- **Acceptance criteria:**
  1. Given demo mode, when an OTP is generated, then it is shown on screen with "MOCK: not a real text message".
  2. Given production mode, when the flag is set, then the mock display is suppressed and the API never returns the code.

---

## Clinical input (record or paste)

### Nurse records voice instructions
- **Priority:** MUST HAVE · **Source:** [BRIEF] [CMO VIDEO] [DEMO-CRITICAL] · **Persona:** Nurse Priya · **Size:** M
- **Story:** As a nurse, I want to record discharge instructions in the browser, so that I capture the plan live at the moment of transition.
- **Acceptance criteria:**
  1. Given mic permission, when I press record and stop, then audio is captured and uploaded, with a visible timer while recording.
  2. Given a completed recording, when upload finishes, then transcription starts automatically.
  3. Given I re-record, when I confirm, then the prior take is replaced, not appended.
  4. Given upload fails, when it errors, then I see a retry control and no silent data loss.

### Mic-denied fallback to text
- **Priority:** MUST HAVE · **Source:** [DEMO-CRITICAL] [JUDGING] · **Persona:** Nurse Priya · **Size:** S
- **Story:** As a nurse whose browser blocks the microphone, I want to fall back to pasting text, so that the workflow never dead-ends.
- **Acceptance criteria:**
  1. Given mic permission is denied, when I open the input screen, then a clear message and a visible paste-text option appear.
  2. Given no mic hardware, when detected, then the record button is disabled with explanatory text, not a crash.
  3. Given I switch to paste, when I submit text, then the pipeline proceeds identically.

### Nurse pastes unstructured EMR text
- **Priority:** MUST HAVE · **Source:** [BRIEF] · **Persona:** Nurse Priya · **Size:** S
- **Story:** As a nurse, I want to paste unstructured EMR discharge text, so that I can process existing notes without re-recording.
- **Acceptance criteria:**
  1. Given pasted text, when I submit, then it enters the simplification pipeline.
  2. Given empty input, when I submit, then I get a validation error and no job is created.
  3. Given text over the size limit, when I submit, then it is rejected with a clear message.

### Select patient language at input
- **Priority:** MUST HAVE · **Source:** [BRIEF] [CMO VIDEO] · **Persona:** Nurse Priya · **Size:** S
- **Story:** As a nurse, I want to select the patient's native language, so that the correct translation is produced.
- **Acceptance criteria:**
  1. Given the input screen, when I choose a language, then it is stored with the discharge record.
  2. Given no language selected, when I submit, then English is used and translation is marked pending.
  3. Given an unsupported language, then it is not selectable.

---

## Transcription

### Transcription of nurse audio
- **Priority:** MUST HAVE · **Source:** [BRIEF] [DEMO-CRITICAL] · **Persona:** Nurse Priya · **Size:** M
- **Story:** As a nurse, I want my recording transcribed to editable text, so that the AI can process spoken instructions.
- **Acceptance criteria:**
  1. Given an uploaded recording, when transcription completes, then editable text appears in the provider view.
  2. Given transcription is running, when I wait, then a progress state is shown.
  3. Given the service fails, when it errors, then I see a message and can retry or paste text instead.

### Nurse corrects garbled medical terms
- **Priority:** MUST HAVE · **Source:** [JUDGING] [DEMO-CRITICAL] · **Persona:** Nurse Priya · **Size:** S
- **Story:** As a nurse, I want to edit mis-transcribed drug names and doses before simplification, so that no wrong medical content enters the plan.
- **Acceptance criteria:**
  1. Given a transcript error (for example "met operol"), when I edit it, then the corrected text is what the AI receives.
  2. Given I edit, when I save, then the raw transcript is kept for audit until purge.
  3. Given no edits, when I proceed, then the transcript passes through unchanged.

### Transcript confidence highlighting
- **Priority:** COULD HAVE · **Source:** [TEAM DIFFERENTIATOR] · **Persona:** Nurse Priya · **Size:** S
- **Story:** As a nurse, I want low-confidence words highlighted, so that I focus my review on risky tokens.
- **Acceptance criteria:** 1. Low-confidence tokens are visually highlighted. 2. With all high confidence, no highlights appear.

---

## AI simplification engine

### Simplify to 5th-grade schema-valid JSON
- **Priority:** MUST HAVE · **Source:** [BRIEF] [JUDGING] · **Persona:** Eleanor · **Size:** L
- **Story:** As a patient, I want jargon converted to clear 5th-grade bullets in a fixed structure, so that I understand and remember my plan.
- **Acceptance criteria:**
  1. Patient-facing English text scores Flesch-Kincaid grade 5.0 or lower (automated check).
  2. Output is valid JSON against `plan.schema.json`.
  3. "Ambulate with assistance" becomes "walk only with help".
  4. Given malformed model output, when parsing fails, then the item is held for review and never shown to a patient.

### Exact preservation of drug names, doses and timing
- **Priority:** MUST HAVE · **Source:** [JUDGING] · **Persona:** Dr. Lee · **Size:** M
- **Story:** As a hospitalist, I want drug names, doses and timing kept exact, so that the AI never alters my plan.
- **Acceptance criteria:**
  1. "furosemide 40 mg daily" keeps "furosemide", "40 mg" and the frequency unchanged.
  2. No dose number is added, removed or rounded.
  3. No drug name appears that is not in the source (automated diff).

### Ambiguity flags instead of guesses
- **Priority:** MUST HAVE · **Source:** [JUDGING] [DEMO-CRITICAL] · **Persona:** AI-Prompt owner, Nurse Priya · **Size:** M
- **Story:** As a nurse, I want anything missing or unclear flagged `[NEEDS REVIEW]` rather than guessed, so that the AI never invents instructions.
- **Acceptance criteria:**
  1. A missing or ambiguous field appears in `ambiguityFlags`, not as a confident statement.
  2. An open flag is visibly surfaced on the review screen.
  3. A medication the AI cannot classify is flagged, not guessed.

### Classify medicines NEW / KEEP / STOP-HOLD from source only
- **Priority:** MUST HAVE · **Source:** [JUDGING] [TEAM DIFFERENTIATOR] · **Persona:** Eleanor, Mr. Diaz · **Size:** M
- **Story:** As a patient, I want my medicines sorted into NEW, KEEP TAKING and STOP/HOLD, so that I do not double-dose or miss medicines.
- **Acceptance criteria:**
  1. A medicine the source labels NEW appears under NEW only.
  2. When the source states a swap (furosemide to torsemide), a "do not take both" note is produced.
  3. When the source does not state a swap, no such note is invented.

### Derive RED and YELLOW zones from source precautions
- **Priority:** MUST HAVE · **Source:** [JUDGING] [TEAM DIFFERENTIATOR] · **Persona:** Eleanor · **Size:** M
- **Story:** As a patient, I want clear "call your team" and "call 911" lists from my note, so that I know when to seek urgent care.
- **Acceptance criteria:**
  1. RED and YELLOW items populate from the source's return precautions.
  2. Added standard red flags are limited to the approved list and are not patient-specific inventions.
  3. With no precautions in the source, the zones are flagged `[NEEDS REVIEW]`, not fabricated.

---

## Clinician review and approval gate

### Hard approval gate before patient visibility
- **Priority:** MUST HAVE · **Source:** [DEMO-CRITICAL] [JUDGING] · **Persona:** Dr. Lee, Nurse Priya · **Size:** M
- **Story:** As a clinician, I want nothing patient-facing until I approve it, so that no unverified AI content reaches a patient.
- **Acceptance criteria:**
  1. For an unapproved plan, no link or content is generated.
  2. A direct patient-view URL for unapproved content returns 403 or 404, never the draft.
  3. On approval, the link and OTP become active and the approval is audit-logged without PHI.

### Side-by-side source vs simplified review
- **Priority:** MUST HAVE · **Source:** [JUDGING] · **Persona:** Dr. Lee · **Size:** M
- **Story:** As a clinician, I want source and simplified output side by side, so that I can verify fidelity quickly.
- **Acceptance criteria:**
  1. Source and simplified sections display together.
  2. Any medication that differs from the source is visually flagged.
  3. Every patient-facing section is visible before Approve is enabled.

### Clinician edits before approval
- **Priority:** SHOULD HAVE · **Source:** [JUDGING] · **Persona:** Dr. Lee · **Size:** M
- **Story:** As a clinician, I want to edit simplified text before approving, so that I can fix wording without changing the medical plan.
- **Acceptance criteria:** 1. The edited version is what is published. 2. An edit to a dose writes an audit entry (no content). 3. Cancel keeps the original draft.

### Re-approval required after any change
- **Priority:** MUST HAVE · **Source:** [DEMO-CRITICAL] · **Persona:** Dr. Lee · **Size:** S
- **Story:** As a clinician, I want any post-approval edit to revoke patient visibility until re-approved, so that patients never see unverified changes.
- **Acceptance criteria:**
  1. Editing an approved plan reverts its status to pending and withholds patient content.
  2. Re-approval restores visibility and writes a new audit entry.
  3. Editing a translation reverts only that language.

---

## Translation and back-translation safety check

### One-click Spanish translation
- **Priority:** MUST HAVE · **Source:** [BRIEF] [CMO VIDEO] [JUDGING] [DEMO-CRITICAL] · **Persona:** Mr. Diaz · **Size:** M
- **Story:** As a non-English patient, I want my approved plan in Spanish with one click, so that I understand it in my own language.
- **Acceptance criteria:**
  1. An approved English plan renders fully in Spanish after one click.
  2. Drug names and numbers are identical to the source ("40 mg" unchanged).
  3. If translation fails, English stays available and the error is shown, not a blank page.

### Back-translation safety check blocks high-risk mismatches
- **Priority:** MUST HAVE · **Source:** [JUDGING] [TEAM DIFFERENTIATOR] · **Persona:** AI-Prompt owner, Dr. Lee · **Size:** M
- **Story:** As a clinician, I want safety-critical fields back-translated and compared, so that a mistranslated dose or red flag cannot publish.
- **Acceptance criteria:**
  1. Doses, red flags and "do not take both" are back-translated and compared.
  2. A high-risk mismatch blocks that language from publishing and flags it for review.
  3. When all fields match, publishing is allowed and the check result is audit-logged.

### Mandarin and Arabic translation
- **Priority:** SHOULD HAVE · **Source:** [BRIEF] · **Persona:** Mrs. Chen · **Size:** L
- **Story:** As a Mandarin- or Arabic-speaking patient, I want my plan in my language.
- **Acceptance criteria:** 1. All sections render with drug names and numbers unchanged. 2. Arabic renders right-to-left. 3. A high-risk back-translation mismatch blocks the language.

### Arabic right-to-left layout correctness
- **Priority:** SHOULD HAVE · **Source:** [BRIEF] [JUDGING] · **Persona:** Arabic-speaking patient · **Size:** M
- **Story:** As an Arabic-speaking patient, I want proper right-to-left layout, so that the plan is readable.
- **Acceptance criteria:** 1. Text direction and alignment are right-to-left. 2. Latin drug names and numbers stay legible and unbroken. 3. Switching back to English returns left-to-right.

---

## Patient view and audio playback

### Large-font, high-contrast patient sheet
- **Priority:** MUST HAVE · **Source:** [JUDGING] [CMO VIDEO] [DEMO-CRITICAL] · **Persona:** Eleanor (low vision) · **Size:** M
- **Story:** As an elderly patient, I want a large, high-contrast, phone-friendly sheet, so that I can read my plan while groggy.
- **Acceptance criteria:**
  1. Body font is 20px or larger and contrast is at least 4.5:1 (aim 7:1).
  2. At 400px width there is no horizontal scroll.
  3. Touch targets are 48px or larger.
  4. A long section never truncates safety text.

### NEW / KEEP / STOP-HOLD blocks with "do not take both"
- **Priority:** MUST HAVE · **Source:** [JUDGING] [TEAM DIFFERENTIATOR] · **Persona:** Eleanor, Mr. Diaz · **Size:** M
- **Story:** As a patient, I want medicines grouped with clear duplicate warnings, so that I do not double-dose.
- **Acceptance criteria:** 1. Three visually distinct blocks appear. 2. A stated swap shows a prominent warning on both medicines. 3. With no swap in the source, no warning appears.

### RED and YELLOW help zones
- **Priority:** MUST HAVE · **Source:** [JUDGING] [CMO VIDEO] · **Persona:** Eleanor · **Size:** S
- **Story:** As a patient, I want separate "call your team" and "call 911" sections, so that I act correctly on warning signs.
- **Acceptance criteria:** 1. Zones are distinct by icon, label and color. 2. The RED zone has a tappable 911 action (48px or larger). 3. Unresolved zones are withheld, not shown blank.

### Per-section audio playback
- **Priority:** MUST HAVE · **Source:** [CMO VIDEO] [JUDGING] [DEMO-CRITICAL] · **Persona:** Eleanor, Maria · **Size:** M
- **Story:** As a patient or family member, I want to play each section aloud, so that we can hear the plan at home.
- **Acceptance criteria:** 1. Tapping play reads that section in the current language. 2. Switching language changes the audio. 3. Unsupported audio shows a graceful message, not a crash.

### Language switcher
- **Priority:** MUST HAVE · **Source:** [BRIEF] [CMO VIDEO] · **Persona:** Mr. Diaz, Maria · **Size:** S
- **Story:** As a bilingual family, I want to toggle languages, so that each person reads their preferred language.
- **Acceptance criteria:** 1. Text and audio update. 2. A blocked language is disabled with a reason. 3. Drug names and numbers stay identical across languages.

### Expired-plan page
- **Priority:** MUST HAVE · **Source:** [BRIEF] [DEMO-CRITICAL] · **Persona:** Eleanor (day 30) · **Size:** S
- **Story:** As a patient after 30 days, I want a clear "plan expired" page, so that I understand the bridge has ended.
- **Acceptance criteria:** 1. An expired link shows a plain expired page. 2. No plan content is anywhere in the response. 3. The care-team contact shown is generic, not PHI.

---

## Ephemeral data, 30-day TTL and audit proof

### Server-set expiresAt = createdAt + exactly 30 days
- **Priority:** MUST HAVE · **Source:** [BRIEF] [CMO VIDEO] [JUDGING] · **Persona:** Backend owner, Dr. Tadi · **Size:** S
- **Story:** As the CMO, I want expiry set server-side to exactly 30 days, so that the self-destruct is tamper-proof.
- **Acceptance criteria:** 1. `expiresAt - createdAt = 2,592,000 s`, set server-side. 2. A client-supplied value is ignored or rejected. 3. The stored delta is exact.

### Database TTL index (backstop)
- **Priority:** MUST HAVE · **Source:** [BRIEF] [JUDGING] · **Persona:** Backend owner · **Size:** S
- **Story:** As an engineer, I want a TTL index, so that records self-delete even if the purge job misses them.
- **Acceptance criteria:** 1. When the TTL field passes, the document is removed by the TTL monitor. 2. `expireAfterSeconds` is 0. 3. A non-expired record remains. (See the note at the top about `purgeAfter`.)

### Purge job wipes PHI fields and audio files
- **Priority:** MUST HAVE · **Source:** [BRIEF] [CMO VIDEO] [JUDGING] · **Persona:** Backend owner · **Size:** M
- **Story:** As an engineer, I want a purge that also deletes audio files and every PHI field, so that nothing survives in object storage.
- **Acceptance criteria:** 1. Transcript, simplified text, translations, chat logs and audio are deleted. 2. After purge, the audio object returns not found. 3. A partial failure retries and does not mark deletion complete.

### No-PHI deletion audit record
- **Priority:** MUST HAVE · **Source:** [CMO VIDEO] [JUDGING] · **Persona:** Dr. Tadi · **Size:** S
- **Story:** As the CMO, I want every deletion logged without PHI, so that I can prove compliance without creating a new liability.
- **Acceptance criteria:** 1. A purge writes `{discharge reference, deleted_at, deleted_items}`. 2. The record has no name, date of birth, diagnosis or plan text. 3. Access, approval and deletion events are each logged without PHI.

### Demo-only time-travel control
- **Priority:** MUST HAVE · **Source:** [DEMO-CRITICAL] [JUDGING] · **Persona:** Demo owner · **Size:** S
- **Story:** As a presenter, I want a demo-only button that expires a record and runs the purge, so that I can prove self-destruct live.
- **Acceptance criteria:** 1. In demo mode, clicking it expires the record and invokes the purge. 2. In production mode, the control is hidden and the endpoint returns 403. 3. It writes the same audit record as a real expiry.

### Encryption at rest and TLS in transit
- **Priority:** MUST HAVE · **Source:** [CMO VIDEO] [JUDGING] · **Persona:** Backend owner · **Size:** S
- **Story:** As an engineer, I want TLS and encryption at rest, so that PHI is protected during the 30-day bridge.
- **Acceptance criteria:** 1. Every call is HTTPS only. 2. Stored data is encrypted at rest (setting shown). 3. A non-TLS request is refused.

---

## Patient chatbot and urgent-care triage

### Grounded chatbot limited to the approved plan
- **Priority:** MUST HAVE (demo-critical) · **Source:** [DEMO-CRITICAL] [JUDGING] · **Persona:** Mr. Diaz · **Size:** L
- **Story:** As a patient, I want answers only from my approved plan, so that I get trustworthy answers without invented medical content.
- **Acceptance criteria:** 1. In-plan questions are answered from the plan only. 2. Out-of-plan questions get "I don't see that in your plan" and the care-team number, never a guess. 3. A dose question restates the exact source dose.

### RED symptom triggers a 911 banner
- **Priority:** MUST HAVE · **Source:** [DEMO-CRITICAL] [JUDGING] · **Persona:** Eleanor · **Size:** S
- **Story:** As a patient typing a red-flag symptom, I want an immediate 911 banner, so that I seek emergency care fast.
- **Acceptance criteria:** 1. "Chest pain" shows a prominent 911 banner. 2. A benign message shows no banner. 3. The banner never says to wait or self-treat.

### Mental-health message: empathy, 988, care-team flag
- **Priority:** MUST HAVE (demo-critical) · **Source:** [DEMO-CRITICAL] · **Persona:** Eleanor (isolated) · **Size:** S
- **Story:** As a lonely or distressed patient, I want an empathetic reply with 988 and a care-team flag, so that emotional needs are met and escalated.
- **Acceptance criteria:** 1. "I feel alone" gets an empathetic reply and the care-team number. 2. Self-harm language shows 988 and raises a care-team flag. 3. The bot never diagnoses or prescribes.

### Chatbot replies in the patient's language
- **Priority:** SHOULD HAVE · **Source:** [TEAM DIFFERENTIATOR] · **Persona:** Mrs. Chen · **Size:** M
- **Story:** As a non-English patient, I want replies in my language.
- **Acceptance criteria:** 1. In a Spanish view, replies are Spanish. 2. Doses and drug names stay unchanged. 3. Safe refusals are also in-language.

### Chat logs purged at 30 days
- **Priority:** MUST HAVE · **Source:** [CMO VIDEO] [JUDGING] · **Persona:** Dr. Tadi · **Size:** S
- **Story:** As the CMO, I want chat logs deleted with everything else, so that no conversational PHI persists.
- **Acceptance criteria:** 1. Purge deletes the chat logs. 2. A query for that chat returns nothing. 3. The audit record lists "chat_logs" without content.

---

## Daily check-ins and escalation

### Daily weight and symptom check-in with escalation
- **Priority:** MUST HAVE (demo-critical) · **Source:** [DEMO-CRITICAL] [JUDGING] · **Persona:** Eleanor (HF) · **Size:** M
- **Story:** As a heart-failure patient, I want to log my weight and symptoms and be told when to call, so that fluid overload is caught early.
- **Acceptance criteria:** 1. A weight above the note's threshold (for example +4 lb) shows YELLOW "call your team" and creates an escalation. 2. A normal entry shows GREEN and creates none. 3. A red-level symptom shows a 911 prompt.

### No-check-in-for-2-days nudge and flag
- **Priority:** SHOULD HAVE · **Source:** [TEAM DIFFERENTIATOR] · **Persona:** Sam (coordinator) · **Size:** M
- **Story:** As a coordinator, I want patients with no entries for 2 days flagged, so that silent non-adherence is caught.
- **Acceptance criteria:** 1. After 2 days, a nudge shows to the patient and a flag appears on the dashboard. 2. A recent entry raises no flag.

### Thresholds pulled from the note
- **Priority:** SHOULD HAVE · **Source:** [TEAM DIFFERENTIATOR] · **Persona:** AI-Prompt owner · **Size:** S
- **Story:** As a patient, I want thresholds based on my own note, so that escalation fits my condition.
- **Acceptance criteria:** 1. A note with a weight threshold is used by the check-in. 2. With none, a conservative default is used and flagged `[NEEDS REVIEW]`.

---

## Caregiver sharing, teach-back, appointments, social and emotional support

### Caregiver shared access
- **Priority:** SHOULD HAVE · **Source:** [CMO VIDEO] [TEAM DIFFERENTIATOR] · **Persona:** Maria · **Size:** M
- **Story:** As a remote caregiver, I want authenticated access to view and hear the plan, so that I can help manage medicines and follow-ups.
- **Acceptance criteria:** 1. An invited caregiver sees the same approved plan and audio. 2. A revoked invite is denied. 3. Caregiver access is purged at expiry.

### Appointment tracker with "no date yet" flag
- **Priority:** SHOULD HAVE · **Source:** [TEAM DIFFERENTIATOR] · **Persona:** Mr. Diaz · **Size:** S
- **Story:** As a patient, I want follow-ups listed with a "no date yet" flag, so that I do not miss appointments.
- **Acceptance criteria:** 1. Each appointment shows provider and date or "no date yet". 2. Nothing is fabricated when the note has none.

### Teach-back quiz
- **Priority:** COULD HAVE · **Source:** [TEAM DIFFERENTIATOR] · **Persona:** Eleanor · **Size:** M
- **Story:** As a patient, I want a short check on my plan, so that I confirm I understood it.
- **Acceptance criteria:** 1. A wrong answer re-shows the correct plan text. 2. With no quiz content, the feature hides gracefully.

### Social-needs and emotional check-in routing
- **Priority:** COULD HAVE · **Source:** [TEAM DIFFERENTIATOR] · **Persona:** Sam · **Size:** M
- **Story:** As a patient, I want simple food, transport and loneliness prompts routed to my care team.
- **Acceptance criteria:** 1. A "yes" creates a flag on the coordinator dashboard. 2. A "no" creates none.

---

## Care coordinator and admin dashboard

### Read-only escalation view
- **Priority:** MUST HAVE (demo-critical) · **Source:** [DEMO-CRITICAL] [JUDGING] · **Persona:** Sam · **Size:** M
- **Story:** As a coordinator, I want to see which patients escalated, so that I can intervene before readmission.
- **Acceptance criteria:** 1. A new escalation appears with its zone. 2. With none, the list is empty, not an error. 3. A patient-role token gets 403.

### Admin view of deletion and audit proof
- **Priority:** SHOULD HAVE · **Source:** [JUDGING] · **Persona:** Dr. Tadi · **Size:** S
- **Story:** As the CMO, I want to view no-PHI audit entries, so that I can show compliance to leadership.
- **Acceptance criteria:** 1. Entries show reference, deleted_at and deleted_items only. 2. No PHI field is ever displayed.

### Loneliness and self-harm flag surfacing
- **Priority:** SHOULD HAVE · **Source:** [DEMO-CRITICAL] · **Persona:** Sam · **Size:** S
- **Story:** As a coordinator, I want chatbot mental-health flags surfaced, so that I can follow up on risk.
- **Acceptance criteria:** 1. A raised flag appears with a mental-health marker. 2. With no flag, none appears.

---

## Non-functional

### WCAG 2.1 AA accessibility on the patient view
- **Priority:** MUST HAVE · **Source:** [JUDGING] [CMO VIDEO] · **Persona:** Eleanor (low vision and hearing) · **Size:** M
- **Story:** As an elderly or disabled patient, I want AA-accessible pages, so that I can use the tool despite impairments.
- **Acceptance criteria:** 1. Passes AA contrast with no critical automated violations. 2. Keyboard-only use reaches every control with visible focus. 3. Screen readers get labels for sections and audio buttons. 4. Meaning is never carried by color alone.

### Touch targets and mobile ergonomics
- **Priority:** MUST HAVE · **Source:** [JUDGING] · **Persona:** Eleanor · **Size:** S
- **Story:** As a patient with shaky hands, I want large tap targets.
- **Acceptance criteria:** 1. Every control is 48px or larger with spacing. 2. No controls overlap on a phone. 3. A mis-tap fires no destructive action.

### OTP rate limiting
- **Priority:** MUST HAVE · **Source:** [JUDGING] [CMO VIDEO] · **Persona:** Backend owner · **Size:** S
- **Story:** As an engineer, I want OTP attempts rate-limited, so that patient links resist brute force.
- **Acceptance criteria:** 1. Beyond the threshold, further attempts are blocked for a cool-down. 2. A correct code after the cool-down succeeds. 3. Blocks are audit-logged without PHI.

### Graceful degradation when the LLM or transcription fails
- **Priority:** MUST HAVE · **Source:** [DEMO-CRITICAL] [JUDGING] · **Persona:** Demo owner, Nurse Priya · **Size:** S
- **Story:** As a presenter, I want clear fallbacks when AI services fail, so that the demo never crashes to a blank screen.
- **Acceptance criteria:** 1. An LLM error shows a friendly message and retry, and nothing is auto-published. 2. A transcription failure offers paste-text. 3. A timeout ends the loading state with a message.

### Performance targets (p95)
- **Priority:** SHOULD HAVE · **Source:** [JUDGING] · **Persona:** Backend owner · **Size:** S
- **Story:** As a user, I want responsive pages.
- **Acceptance criteria:** 1. Patient view loads in under 2 s at p95 on demo hardware. 2. Translation shows progress within a defined budget. 3. A slow network shows a skeleton loader.

### Audit logging without PHI (access and approvals)
- **Priority:** MUST HAVE · **Source:** [CMO VIDEO] [JUDGING] · **Persona:** Dr. Tadi · **Size:** S
- **Story:** As the CMO, I want all access and approval events logged without PHI.
- **Acceptance criteria:** 1. Each login, approval or access writes role, action, timestamp and reference only. 2. No names, diagnoses or plan text appear. 3. Failed authentication is logged.

---

## Demo and pitch readiness

### Seeded synthetic data from the five notes
- **Priority:** MUST HAVE · **Source:** [DEMO-CRITICAL] [JUDGING] · **Persona:** Demo owner · **Size:** S
- **Story:** As a presenter, I want the five notes seeded, so that the demo runs on realistic, privacy-safe data.
- **Acceptance criteria:** 1. The seed script loads all five notes. 2. The data contains no real PHI. 3. A reset returns the demo to a clean seeded state.

### Offline and local fallback for the live demo
- **Priority:** MUST HAVE · **Source:** [DEMO-CRITICAL] · **Persona:** Demo owner · **Size:** M
- **Story:** As a presenter, I want a cached path, so that venue wifi or API outages do not kill the demo.
- **Acceptance criteria:** 1. With no network, a cached Note 1 run (transcript, simplified, Spanish, audio) plays. 2. It is labeled as cached. 3. When the network returns, live mode resumes.

### Backup demo video
- **Priority:** MUST HAVE · **Source:** [DEMO-CRITICAL] · **Persona:** Demo owner · **Size:** S
- **Story:** As a presenter, I want a recorded full run, so that a total failure still shows the whole pipeline.
- **Acceptance criteria:** 1. It shows record, approve, Spanish, patient phone, chatbot, check-in, time-travel. 2. It uses synthetic data only. 3. It fits about 5 minutes.

### Rehearsal checklist and role assignment
- **Priority:** SHOULD HAVE · **Source:** [DEMO-CRITICAL] · **Persona:** Demo owner · **Size:** S
- **Story:** As a team, I want a rehearsed script with assigned speakers.
- **Acceptance criteria:** 1. The full flow completes in 5 minutes. 2. Each step has an owner and a backup. 3. Each failure point has a documented fallback.

---

## MUST HAVE summary
About 44 MUST HAVE stories, roughly 89 hours of work using midpoints (S = 1, M = 3, L = 6). Protect these first: the pipeline, the approval gate, the TTL and purge proof, and the patient view.
