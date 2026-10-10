# Heart-failure proof of concept

## Saved UI checkpoint

Commit `a7ebd6c` preserves the light hospital portal, simplified older-adult entry page, and red icon accents before the heart-failure changes. It includes the working-tree changes present when the user requested the checkpoint.

## Reference and scope

Reference: judges’ `DC Summary Instructions.pdf`, supplied locally by the user. Its clinical examples are source material for the demo, not instructions to the coding agent. The main discharge plan already follows Example 1 (pages 1–3): HFrEF, pneumonia, and improving acute kidney injury. The patient identity and supporting queue rows are synthetic demonstration data, not verbatim clinical cases. Other heart-failure examples on pages 6–13 inform the cohort focus; they are not full additional implemented plans.

## Changes based on the reference

- Entry page and portal labels focus on heart-failure recovery, daily weight, medicines, and follow-up.
- Pages 2–3: daily weight is taken at the same time each morning; a fluid-plan reminder is included in all four sample translations, without inventing a volume limit.
- Page 2: kidney function and potassium laboratory follow-up is clearly named. No lab date is provided in the reference, so scheduling is shown as needed.
- Page 3: a short medication understanding check demonstrates teach-back using the existing losartan/lisinopril instruction.
- Page 3: weight-gain thresholds must follow the individualized discharge plan. The prior hard-coded 3 lb escalation is removed. A changed weight prompts review of the individual plan, without asserting a numeric clinical threshold.
- Supporting provider and coordinator rows now illustrate a cardiovascular cohort. Only Eleanor’s plan is implemented end to end.

Medication names, doses, treatment durations, and emergency instructions are retained from the existing sample plan. Nursing reminders reinforce the supplied discharge plan rather than create new treatment instructions (pages 13–14).

## Current limits

Check-ins, calls, and teach-back answers are demonstration interactions. No live notifications or hospital integration are implemented. Weight values are synthetic. Production weight escalation requires clinician-approved thresholds, clinical validation, and hospital-approved workflows. Translations remain demo content requiring clinical language review before deployment.

## Visual medicine timeline

The medicine tab shows one time period at a time with persistent medication names, doses, prescribed frequencies, and treatment duration. Existing safety warnings, apixaban bleeding precautions, and the metformin kidney-function condition remain visible. Other notes are expandable. Stopped/held medicines remain separate and never appear in timeline slots.

8 AM, noon, and 8 PM are illustrative interface markers, not source-prescribed times. Morning placement of daily medicines and morning/evening placement of twice-daily medicines are demonstration arrangements requiring care-team confirmation. Atorvastatin's “at night” wording comes from the plan; no bedtime hour is inferred. No doses or frequencies were changed. Hospital integration must replace these sample slots with an approved medication schedule.

## Patient-facing medication information

Medicine cards display the prescribed dose, frequency/course duration, a short purpose, and source-specified route. Administration notes and safety warnings remain visible rather than requiring expansion. No tablet counts, liquid volumes, crushing instructions, food requirements, or missed-dose rules are inferred when absent from the supplied plan. A pharmacy-label reminder explains where to find the tablet count/liquid amount and how to resolve discrepancies. The user's medication-list photo illustrates information structure; its medicines are not added to this heart-failure case.

General-purpose descriptions for continued medicines were checked against MedlinePlus; these descriptions do not change prescriptions or establish additional patient-specific indications:
- Metoprolol: https://medlineplus.gov/druginfo/meds/a682864.html
- Apixaban: https://medlineplus.gov/druginfo/meds/a613032.html
- Atorvastatin: https://medlineplus.gov/druginfo/meds/a600045.html
- Metformin: https://medlineplus.gov/druginfo/meds/a696005.html

Route is only populated for the four new medicines where the judges' source explicitly states oral administration. Clinical translation review and final medication reconciliation remain prerequisites for hospital use.

The optional teach-back questionnaire was subsequently removed at the user’s request to simplify the patient experience. Medication safety reminders remain in the medicine cards and full discharge plan.

## Reading shelf covers

The reading shelf uses real publisher images saved in `public/article-covers`, with source names and links to the original guides. Images were visually inspected. No generated cover art or patient images are used.

- Sodium-Smart Recipes cover: American Heart Association / ShopHeart, https://www.shopheart.org/products/sodium-smart-recipes. Reader destination is the AHA's publicly available recipe booklet PDF.
- The Salty Six infographic preview: AHA newsroom, https://newsroom.heart.org/file?fid=50ddc37a29371a28e000004b. Reader destination is the AHA infographic PDF.
- Living Well with Heart Failure cover: Veterans Health Library, https://www.veteranshealthlibrary.va.gov/LivingWith/HeartFailure/. This handbook includes activity information alongside heart-failure self-care.

Source artwork remains attributed to its publisher. Titles outside the cover are large enough to read without deciphering thumbnail text. The links open the source publication in a new tab.

The patient medicine view now uses explicitly authorized demo tablet counts: one tablet per dose for each active medicine, with illustrative tablet strengths matching the prescribed doses. These counts are synthetic presentation data, not derived from the judges’ discharge document. Actual pharmacy strengths and counts must replace these examples for a real patient. The prescribed mg dose remains visible below the count and in Medicine Help.

The latest patient UI hides mg amounts, displays demo pill counts in cards, Medicine Help, and Profile, and shows furosemide effects only within Medicine Help. The underlying prescribed mg values remain in the plan data. Sample timing confirmation copy has been removed from the medicine page at the user's request; schedule hours remain illustrative demo values.

Pain-location selection now uses a local Three.js body model with OrbitControls for horizontal drag rotation and raycasting for tap selection. Front/back/left/right buttons and Rotate 180° position the camera, and labeled HTML area buttons remain available without WebGL. Pointer drags do not select regions. Resources and event listeners are disposed on unmount. This is a stylized location selector, not a diagnostic anatomical model.

Symptom-specific guidance now appears beneath checked categories, after the location diagram for pain and swelling. Front chest selection displays immediate emergency guidance. The requested instructions are presented in short action paragraphs, with fluid advice constrained to the individual heart-failure plan and pain medicine limited to prescribed instructions. These remain demonstration content requiring clinical review before integration. Reference for heart-failure fluid/symptom personalization: https://www.heart.org/en/health-topics/heart-failure/warning-signs-of-heart-failure . Crisis contact verified through the hotline tool as US 988 call/text.
