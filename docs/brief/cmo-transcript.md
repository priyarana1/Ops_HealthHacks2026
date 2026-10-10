# CMO video transcript

**Speaker:** Kiran Tadi, Associate Chief Medical Officer, RWJ New Brunswick

Welcome everyone. I'm Kiran Tadi, I'm the Associate Chief Medical Officer for RWJ New Brunswick. One of the biggest operational challenges we have in an acute care facility today is what we call the post discharge black hole.

So, every day we discharge a lot of patients, right? So, we send patients home with pages and pages of complex medical jargon. Patients immediately after discharge are many times groggy, overwhelmed, and many studies that were done actually show that they immediately forget over 80% of what we tell them at discharge. This communication breakdown is why medication compliance plummets, critical follow-up appointments are missed, and entirely preventable readmissions actually spike.

So, our challenge to you today is to build discharge AI, which we envision as a secure, web-based tool deployed at the exact moment of transition for a patient from an acute care facility. So, our care teams need a simple interface so they can record their discharge instructions live. Your AI pipeline must be able to translate that audio into the patient's native language, if necessary, but more importantly, it has to programmatically translate the medical jargon into plain, patient-friendly language. So, for example, if a doctor says ambulate, it needs to be able to tell the patient to move or walk.

There are certain non-negotiables, in view of HIPAA and privacy concerns. As a hospital, patient data security is paramount for us. So, your architecture must feature strict, HIPAA-compliant, authenticated access both for providers as well as patients. And obviously, to manage our risk, we would like for it to be automated data retention by way of the fact that every piece of audio and text must self-destruct after say about 30 days. So, what we're looking for really is a temporary bridge for the patient for recovery, not obviously a permanent data liability.

So, we're hoping that this interface will help us drive post-discharge care because when patients can play back clear instructions at home, when their families can listen to it, they then will take the right medications at the right time. They will actually show up at their follow-up appointments, and this will solve a multi-million dollar healthcare problem. Thank you.

## Design implications we drew from it

| What he said | What we build |
|---|---|
| "Post-discharge black hole" | A 30-day bridge that works after the patient leaves |
| "Forget over 80%" | A re-playable, structured plan instead of a one-time verbal handoff |
| "Groggy and overwhelmed" | Large type, short bullets, 5th-grade language, audio |
| "Record live" | Browser recording at the moment of discharge |
| "Authenticated access for providers and patients" | Staff login (MFA) and patient link + one-time code |
| "Every piece of audio and text self-destructs at about 30 days" | TTL + purge job + audio deletion + audit proof |
| "Families can listen" | Per-section audio playback and (stretch) caregiver sharing |
