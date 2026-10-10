# Common nursing discharge-communication elements

Across complex medical discharges, nurses are commonly expected to reinforce, not independently modify, the physician's discharge plan. Typical elements include:

| Area | What nursing commonly reinforces |
|---|---|
| Medication reconciliation | New medications, discontinued medications, dose/frequency changes, timing, and major precautions |
| Antibiotics | Indication explained in general terms, schedule, duration, importance of completing therapy, major warning symptoms |
| Heart failure | Daily weights, low-sodium diet, fluid instructions if ordered, edema/breathing changes, when to call |
| Diuretics | Expected increased urination, timing, dizziness/dehydration precautions, laboratory follow-up |
| Anticoagulants | Adherence, bleeding precautions, avoiding unapproved medications such as NSAIDs |
| Insulin/diabetes | Glucose monitoring, medication changes, hypoglycemia precautions |
| Respiratory disease | Inhaler technique, oxygen instructions, rescue-treatment plan, worsening respiratory symptoms |
| Lines/PICC | Site care, infection precautions, infusion schedule, what to do if the line malfunctions |
| Follow-up | Appointment dates, laboratory testing, specialty follow-up, transportation/access issues |
| Return precautions | Specific symptoms requiring a call versus urgent/emergency evaluation |
| Teach-back | Patient/caregiver explains the plan in their own words to verify understanding |
| Practical barriers | Ability to obtain medications, equipment, home services, transportation, and caregiver support |

**Important distinction:** nurses generally should not create new medication instructions, change doses, interpret abnormal results independently, or contradict the prescribing clinician's discharge plan. When the patient has questions or the medication list appears inconsistent, nursing typically contacts the responsible prescribing team or pharmacist for clarification before discharge.

## What this means for ClearPath
- The AI follows the same rule as the nurse: it restates and simplifies the plan; it never creates or changes it.
- Inconsistencies in the source become `[NEEDS REVIEW]` flags for a clinician, not guesses.
- Teach-back is a product feature (quiz), not just a conversation.
