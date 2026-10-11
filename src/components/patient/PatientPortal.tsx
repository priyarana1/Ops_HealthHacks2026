"use client";

import { useCallback, useEffect, useState } from "react";
import { PatientApp, type CodeCheck, type PatientData } from "@/components/patient/PatientApp";
import { shortDiagnosis, toPlanContent } from "@/lib/plan-adapter";
import type { GeneratedContent } from "@/lib/backend/contracts";
import { LANGS, type Language } from "@/types/plan";
import { withScheduledAppointments } from "@/lib/demo-appointments";

/**
 * Real patient entry for /p/<token>: asks the server about the link, verifies the 6-digit code,
 * then loads the clinician-approved plan for this patient's session. Nothing about the patient
 * is fetched or shown before the code is verified.
 */
type LinkStatus = "loading" | "code_required" | "locked" | "signed_in" | "unavailable";

const NOT_SIGNED_IN: PatientData = { name: "", firstName: "", diagnosis: "", expiresAt: new Date().toISOString(), content: {}, demo: false };

async function post(path: string, body: object) {
  const response = await fetch("/api/patient/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || "Request failed.");
  return json;
}

export function PatientPortal({ token }: { token: string }) {
  const [status, setStatus] = useState<LinkStatus>("loading");
  const [data, setData] = useState<PatientData>();

  const loadPlan = useCallback(async () => {
    const response = await fetch("/api/patient/discharge-plan", { cache: "no-store" });
    if (!response.ok) throw new Error("Plan unavailable.");
    const plan: { displayName: string | null; expiresAt: string; content: GeneratedContent; translations?: Partial<Record<Language, GeneratedContent>> } = await response.json();
    const name = plan.displayName || "there";
    const diagnosis = shortDiagnosis(plan.content.diagnoses.map((d) => d.text));
    // English plus every clinician-published translation the app has an interface for; the language picker offers only these.
    // Appointments are shown as booked at RWJBarnabas Health locations (demo-appointments.ts).
    const english = toPlanContent(plan.content);
    const scheduled = (content: GeneratedContent, lang: Language) => withScheduledAppointments(toPlanContent(content, lang, plan.content), english, plan.expiresAt, lang);
    const translated = Object.entries(plan.translations ?? {}).filter(([lang]) => (LANGS as readonly string[]).includes(lang)).map(([lang, content]) => [lang, scheduled(content!, lang as Language)]);
    setData({ name, firstName: name.split(" ")[0], diagnosis, expiresAt: plan.expiresAt, content: { en: scheduled(plan.content, "en"), ...Object.fromEntries(translated) }, demo: false });
  }, []);

  useEffect(() => {
    post("link", { token })
      .then(async (result: { status: LinkStatus }) => {
        if (result.status === "signed_in") await loadPlan();
        setStatus(result.status);
      })
      .catch(() => setStatus("unavailable"));
  }, [token, loadPlan]);

  const verify = useCallback(async (code: string): Promise<CodeCheck> => {
    const result: { verified: boolean; triesLeft?: number } = await post("link/verify", { token, code });
    if (!result.verified) return { ok: false, triesLeft: result.triesLeft ?? 0 };
    await loadPlan();
    return { ok: true };
  }, [token, loadPlan]);

  if (status === "loading") {
    return <div className="pt-stage"><div className="pt-device pt-clinical"><main className="pt-main"><p className="lead" role="status">Opening your plan…</p></main></div></div>;
  }
  if (status === "unavailable") {
    // An expired, replaced or unknown link: show the expired screen and never fall back to sample data.
    return <PatientApp expired data={NOT_SIGNED_IN} verify={async () => ({ ok: false, triesLeft: 0 })} locked />;
  }
  return <PatientApp data={data ?? NOT_SIGNED_IN} verify={verify} signedIn={status === "signed_in"} locked={status === "locked"} />;
}
