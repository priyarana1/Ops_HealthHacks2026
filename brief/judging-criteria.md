# MVP deliverables and judging criteria

The solution is graded on a 10-point scale across the following categories.

1. **Clinical to vernacular translation (1-10).** How well does the model strip out complex terminology and present crystal-clear, safe, and accurate steps in a foreign language?
2. **Technical architecture and compliance (1-10).** Does the application successfully record audio and text, and is the 30-day self-destruct mechanism fully functional in the database code?
3. **User experience (1-10).** Is the patient interface accessible, easy to read, and clear for elderly or stressed patients?
4. **The live demo.** A flawless walk-through where the team speaks complex medical instructions into the app, shows the immediate translation on a simulated patient's phone, and proves the backend data expiration rule is active.

## Our interpretation (team notes)

- Criterion 1 is won by safety, not just fluency: medication diff = 0 changes, ambiguity flags, back-translation check, clinician approval gate.
- Criterion 2 is won by a provable deletion: server-set `expiresAt`, TTL index, purge job that also deletes audio, no-PHI audit record, visible time-travel proof.
- Criterion 3 is won by large type, high contrast, audio playback, big touch targets, plain words, language switching.
- Criterion 4 is won by rehearsal, offline fallbacks and a backup video.
