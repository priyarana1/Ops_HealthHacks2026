/**
 * ClearPath service layer — MOCK IMPLEMENTATION (demo only).
 *
 * Every function here simulates a backend/AI operation with realistic latency and
 * occasional (opt-in) failures so the UI can exercise loading, success and error
 * states. These are clearly-labeled demo stubs: they do NOT call AWS Transcribe,
 * Bedrock, Comprehend Medical, or any real service, and they never claim to.
 *
 * To integrate the real backend later, replace the bodies of these functions with
 * fetch() calls to the API routes (e.g. /api/discharge/:id/transcribe). The function
 * signatures and the ServiceResult shape are designed to stay stable across that swap.
 */

import {
  ELEANOR_SPOKEN_TEXT,
  ELEANOR_SOURCE_TEXT,
} from "@/mocks/patient";

export const IS_MOCK = true;

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Transcribe recorded audio. Returns the spoken note (with its garbled term so the
 * transcript-review step has something to catch). `simulateFailure` forces the error
 * path for the "transcription failed" demo state.
 */
export async function transcribeAudio(
  opts: { simulateFailure?: boolean } = {},
): Promise<ServiceResult<{ transcript: string }>> {
  await delay(1400);
  if (opts.simulateFailure) {
    return {
      ok: false,
      error:
        "Transcription failed. Nothing was sent to the AI. Try again, or paste the text instead.",
    };
  }
  return { ok: true, data: { transcript: ELEANOR_SPOKEN_TEXT } };
}

/**
 * Simplify clinician text into the structured patient plan. In the demo this just
 * acknowledges the source and resolves — the structured content itself is the
 * reviewed mock plan (see src/mocks/plan.ts). The AI never invents clinical content;
 * ambiguities (weight threshold, fluid limit) surface as review flags in the UI.
 */
export async function simplifyInstructions(
  sourceText: string,
): Promise<ServiceResult<{ sourceText: string; readingLevel: string; medsChecked: number }>> {
  await delay(1200);
  if (!sourceText.trim()) {
    return { ok: false, error: "No instructions were provided to simplify." };
  }
  return {
    ok: true,
    data: { sourceText, readingLevel: "Grade 4.8", medsChecked: 8 },
  };
}

/** Translate the approved English plan into a target language (mock). */
export async function translatePlan(
  lang: "es" | "zh" | "ar",
): Promise<ServiceResult<{ lang: string }>> {
  await delay(900);
  return { ok: true, data: { lang } };
}

/**
 * Back-translation safety check. For Spanish the demo returns a seeded high-risk
 * mismatch (the "do not take both" warning inverted) to exercise the publish block,
 * unless `fixed` is set. Other languages pass.
 */
export async function backTranslateCheck(
  lang: "es" | "zh" | "ar",
  opts: { fixed?: boolean } = {},
): Promise<ServiceResult<{ mismatch: boolean }>> {
  await delay(700);
  const mismatch = lang === "es" && !opts.fixed;
  return { ok: true, data: { mismatch } };
}

/** Record clinician approval of the English plan (mock gate). */
export async function approvePlan(): Promise<ServiceResult<{ approvedAt: string }>> {
  await delay(500);
  return { ok: true, data: { approvedAt: new Date().toISOString() } };
}

/**
 * Publish the approved plan and return the patient link + OTP + server-set expiry.
 * expiresAt is computed as createdAt + 30 days to mirror the server rule; it is not
 * client-editable in the real system.
 */
export async function publishPlan(): Promise<
  ServiceResult<{ link: string; otp: string; expiresAt: string }>
> {
  await delay(700);
  const expiresAt = new Date(Date.now() + 2_592_000 * 1000).toISOString();
  return {
    ok: true,
    data: {
      link: "https://clearpath.rwjbh.example/p/ELN-7Q2K",
      otp: "418203",
      expiresAt,
    },
  };
}

export { ELEANOR_SOURCE_TEXT };
