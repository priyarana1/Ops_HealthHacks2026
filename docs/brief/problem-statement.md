# Project brief: Challenge 1, "Discharge AI"

This brief outlines the immediate development mission for the Inpatient AI team: building a web-based platform called "Discharge AI." The application's goal is to capture complex clinical discharge instructions, translate them into plain language and the patient's native tongue, and securely auto-delete the data after 30 days to protect patient privacy.

## The challenge: the post-discharge understanding gap

The transition from a hospital bed to home care is one of the most vulnerable moments in a patient's medical journey.

- **The problem:** Discharge paperwork is notoriously dense, filled with complex medical jargon, and typically only printed in English. Patients often leave the hospital confused about their medication schedules and follow-up care, leading to high 30-day readmission rates.
- **The solution:** A mobile-friendly web application that allows clinical staff to quickly dictate or paste raw, complex discharge instructions. The AI backend immediately synthesizes this data into simple, accessible, multi-lingual action steps for the patient.
- **The security constraint:** To comply with strict institutional data-retention policies and protect health information, all generated patient discharge links and data must permanently self-destruct after exactly 30 days.

## Core functional requirements

Your MVP web application must successfully execute three core automated workflows:

```
[Clinical Input] --> [AI Synthesis & Translation Engine] --> [Secure 30-Day Patient Link]
(Audio or EMR Text)   (Jargon Removal + Native Language)     (Auto-Purges Data at Day 30)
```

1. **Audio recording and ingestion.** A simple web interface where a nurse can record their voice instructions or paste unstructured text straight from an electronic medical record (EMR).
2. **Patient-centric translation engine.** An AI pipeline that translates medical jargon into a 5th-grade reading level (for example, changing "Ambulating with assistance" to "Walk only with help"). It must offer one-click translation into a patient's native language (for example, Spanish, Mandarin, Arabic).
3. **Ephemeral hosting (the 30-day clock).** A secure, unique web view generated for the patient. The system backend must feature a hard-coded data expiration rule that completely wipes the database entry exactly 30 days after creation.

## Hackathon team assignments

To deliver a working web prototype by the final pitch deadline, team members align on these immediate targets:

- Build the mobile-responsive web layouts: one clean interface for the provider to record or input text, and a clear, large-font dashboard for the patient to view their customized instructions.
- Build the API endpoints to handle text and audio data, hooks into the AI processing layers, and the 30-day time-to-live (TTL) database deletion script.
- Design the system prompts that ensure the AI removes confusing clinical acronyms, formats instructions into concise bullet points, and reliably translates text without losing critical medical intent.
- Build the final live demonstration scripts.

For more details, see the video resource: https://www.youtube.com/shorts/B_YMUvPV_eA
