"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProviderShell } from "@/components/provider/ProviderShell";
import { StatusChip } from "@/components/provider/StatusChip";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Banner } from "@/components/ui/Banner";
import { Stepper } from "@/components/ui/Stepper";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { clsx } from "@/lib/clsx";
import { Upload, List, Check, ShieldCheck, Lock, AlertTriangle, ChevronRight, RefreshCw, Copy, Globe } from "lucide-react";
import { api, isAbort } from "@/components/client-api";
import { DocumentDrop, MAX_UPLOAD_BYTES } from "@/components/document-drop";
import type { GeneratedContent } from "@/lib/backend/contracts";
import type { Language, PlanContent } from "@/types/plan";
import { TRANSLATION_LANGUAGES, type TranslationLanguage as TransLang } from "@/lib/languages";
import { UI } from "@/lib/i18n";
import { applyTranslation } from "@/lib/translation-fields";
import { toPlanContent, medicationSchedule, type PlanLanguage, readingGrade, patientText, plainLanguageSwaps, openMedicationFlags } from "@/lib/plan-adapter";
import { planStatus } from "@/lib/discharge-status";

/**
 * Real discharge wizard: same screens as the Blueprint wizard, backed by the discharge API.
 * Capture (upload or paste) -> AI draft -> clinician review and approval -> translate -> publish.
 */

const STEPS = ["Capture", "Review", "Translate", "Publish"];
type Stage = "capture" | "review" | "translate" | "publish";
const REVIEWED = "Reviewed against the source document by the approving clinician.";
// The completeness attestation is recorded by the Approve click rather than shown as a card.
const ATTESTATION = "source-completeness";
const WORDING = "review-wording:";

/** The patient wording at a field path, with the source quote it was simplified from. */
function wordingAt(content: GeneratedContent, path: string) {
  const keys = path.split(".");
  let parent: unknown = content;
  for (const key of keys.slice(0, -1)) parent = (parent as Record<string, unknown> | undefined)?.[key];
  const holder = parent as ({ evidence?: { quote: string } } & Record<string, unknown>) | undefined;
  const text = holder?.[keys.at(-1)!];
  return typeof text === "string" ? { text, quote: holder?.evidence?.quote ?? "" } : null;
}
function withWording(content: GeneratedContent, path: string, text: string): GeneratedContent {
  const next = structuredClone(content), keys = path.split(".");
  let parent: Record<string, unknown> = next as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
  parent[keys.at(-1)!] = text;
  return next;
}

interface Snapshot {
  episode: { planId: string; state: string; version: number; dischargeAt: string; dischargeTimezone: string; expiresAt: string; dischargeConfirmed: boolean; approval?: { providerId: string; approvedAt: string } };
  patient?: { displayName: string };
  plan?: { content?: GeneratedContent; model?: { modelId: string; generatedAt: string } };
  sources: { sourceId: string; kind: string; documentType: string; text: string }[];
}

const DEMO_FIXTURE_MODEL = "demo-fixture";
const DEMO_TRANSLATE_MS = 35000;
const LANGS = Object.fromEntries(Object.entries(TRANSLATION_LANGUAGES).map(([k, v]) => [k, v.name])) as Record<TransLang, string>;
interface TranslationView {
  language: TransLang; status: "verified" | "blocked" | "published"; current: boolean; basedOnVersion: number; publishedAt?: string;
  fields: { path: string; source: string; text: string; backTranslation?: string; problems: string[] }[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const localValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
// The API needs an explicit UTC offset that matches the named timezone (the browser's own).
function withOffset(local: string) {
  const minutes = -new Date(local).getTimezoneOffset(), abs = Math.abs(minutes);
  return `${local}:00${minutes >= 0 ? "+" : "-"}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function WizardInner({ id }: { id: string }) {
  const toast = useToast();
  const router = useRouter(), search = useSearchParams();
  const isNew = id === "new";
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [generating, setGenerating] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [view, setView] = useState<Exclude<Stage, "capture">>("publish");
  const autoStarted = useRef(false);

  const load = useCallback(async () => setData(await api("discharges/" + id)), [id]);

  const generation = useRef<AbortController | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const generate = useCallback(async () => {
    const controller = new AbortController();
    generation.current = controller;
    setGenerating(true); setError(""); setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    try { setData(await api(`discharges/${id}/process`, "POST", {}, controller.signal)); }
    catch (e) { if (!isAbort(e)) { setError((e as Error).message); await load().catch(() => {}); } }
    finally { clearInterval(timer); if (generation.current === controller) { generation.current = null; setGenerating(false); } }
  }, [id, load]);
  // Stops waiting and tells the server to discard the running draft.
  const cancelGeneration = useCallback(async () => {
    setCancelling(true); setError("");
    generation.current?.abort(); generation.current = null;
    try { setData(await api(`discharges/${id}/process/cancel`, "POST", {})); toast("Draft generation cancelled."); }
    catch (e) { setError((e as Error).message); await load().catch(() => {}); }
    finally { setGenerating(false); setCancelling(false); }
  }, [id, load, toast]);

  useEffect(() => {
    if (isNew) return;
    load().then(() => {
      if (search.get("generate") && !autoStarted.current) {
        autoStarted.current = true;
        router.replace(`/provider/discharge/${id}`);
        generate();
      }
    }).catch((e) => setError(e.message));
  }, [isNew, id, load, generate, router, search]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  const content = data?.plan?.content;
  const state = data?.episode.state;
  const approved = !!state && ["APPROVED", "ACCESS_GRANTED", "ACTIVE"].includes(state);
  const stage: Stage = isNew ? "capture" : approved ? view : "review";
  const step = { capture: 0, review: 1, translate: 2, publish: STEPS.length - 1 }[stage];
  const [translations, setTranslations] = useState<TranslationView[]>([]);
  const refreshTranslations = useCallback(() => api(`discharges/${id}/translations`).then((r: { translations: TranslationView[] }) => setTranslations(r.translations)).catch(() => {}), [id]);
  useEffect(() => { if (approved) refreshTranslations(); }, [approved, refreshTranslations]);
  // For the pre-reviewed Example 1 plan, languages other than Spanish are only shown as translated here.
  const fixture = data?.plan?.model?.modelId === DEMO_FIXTURE_MODEL;
  const [shownLanguages, setShownLanguages] = useState<TransLang[]>([]);
  const publishedLanguages = [...translations.filter((t) => t.status === "published" && t.current).map((t) => t.language), ...shownLanguages];
  const crumb = data?.patient?.displayName ? `${data.patient.displayName} · ${STEPS[step]}` : `New discharge · ${STEPS[step]}`;

  return (
    <ProviderShell active="new" crumb={crumb}>
      <Stepper steps={STEPS} current={step} />
      {error && <Banner tone="red" icon="alert">{error}</Banner>}
      {stage === "capture" && <CaptureStep busy={busy} run={run} onCreated={(planId) => router.replace(`/provider/discharge/${planId}?generate=1`)} />}
      {stage === "review" && !data && !error && <p className="muted">Loading discharge…</p>}
      {stage === "review" && data && (
        generating || state === "PROCESSING"
          ? <GeneratingCard seconds={seconds} stale={!generating && !cancelling} cancelling={cancelling} onCancel={cancelGeneration} onRefresh={() => load().catch((e) => setError(e.message))} />
          : !content
            ? <Card style={{ textAlign: "center", padding: 32 }}>
                <p className="muted">{data.sources.length ? "No plain-language draft yet." : "No discharge document was saved for this record."}</p>
                {data.sources.length > 0 && <Button onClick={generate}>Generate plain-language draft</Button>}
              </Card>
            : <ReviewStep data={data} content={content} busy={busy} run={run} setData={setData} toast={toast} regenerate={generate} onContinue={() => setView("translate")} />
      )}
      {stage === "translate" && data && content && <TranslateStep planId={id} content={content} translations={translations} setTranslations={setTranslations} fixture={fixture} shown={shownLanguages} setShown={setShownLanguages} toast={toast} onContinue={() => setView("publish")} />}
      {stage === "publish" && data && <PublishStep data={data} languages={publishedLanguages} busy={busy} run={run} toast={toast} reload={async () => { await load(); await refreshTranslations(); }} onBack={() => setView("translate")} />}
    </ProviderShell>
  );
}

/* ---------- Capture: patient details + upload or paste ---------- */
function CaptureStep({ busy, run, onCreated }: { busy: string; run: (label: string, fn: () => Promise<void>) => Promise<void>; onCreated: (planId: string) => void }) {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [name, setName] = useState(""), [when, setWhen] = useState(""), [max, setMax] = useState(""), [tz, setTz] = useState("");
  const [dateOk, setDateOk] = useState(false), [synthetic, setSynthetic] = useState(false);
  const [file, setFile] = useState<File>(), [paste, setPaste] = useState(""), [problem, setProblem] = useState("");
  useEffect(() => { const now = localValue(new Date()); setWhen(now); setMax(now); setTz(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);

  function submit() {
    setProblem("");
    if (!name.trim()) return setProblem("Enter the patient's display name.");
    if (mode === "upload" && !file) return setProblem("Choose the discharge document to upload.");
    if (mode === "upload" && file && file.size > MAX_UPLOAD_BYTES) return setProblem("The document must be 5 MB or smaller.");
    if (mode === "paste" && !paste.trim()) return setProblem("Please paste the discharge instructions before continuing.");
    if (!synthetic) return setProblem("Confirm the document contains synthetic data only.");
    run("Saving…", async () => {
      const draft = await api("discharges", "POST", { requestId: crypto.randomUUID(), syntheticConfirmed: true, patient: { displayName: name.trim() }, dischargeAt: withOffset(when), dischargeTimezone: tz, dischargeConfirmed: dateOk });
      if (mode === "upload") {
        const form = new FormData();
        form.set("requestId", crypto.randomUUID()); form.set("kind", "FINAL_AVS"); form.set("file", file!);
        await api(`discharges/${draft.planId}/sources`, "POST", form);
      } else {
        await api(`discharges/${draft.planId}/sources`, "POST", { requestId: crypto.randomUUID(), kind: "FINAL_AVS", text: paste.trim(), transcriptConfirmed: false });
      }
      onCreated(draft.planId);
    });
  }

  return (
    <>
      <h1>Capture instructions</h1>
      <Card style={{ margin: "16px 0" }}>
        <h3 className="muted">Patient</h3>
        <label className="cp-label" htmlFor="pname">Display name</label>
        <input id="pname" className="cp-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Patient name" disabled={!!busy} />
        <label className="cp-label" htmlFor="pwhen">Discharge date and time</label>
        <input id="pwhen" className="cp-input tn" type="datetime-local" value={when} max={max} onChange={(e) => setWhen(e.target.value)} disabled={!!busy} style={{ maxWidth: 320 }} />
        <p className="muted" style={{ margin: "4px 0 8px", fontSize: 13 }}>Time zone: {tz || "…"}. The patient&apos;s access ends 30 days after this time.</p>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={dateOk} onChange={(e) => setDateOk(e.target.checked)} disabled={!!busy} /> The discharge date and time are correct.
        </label>
      </Card>

      <div className="cp-tabs" role="tablist">
        <button className={clsx("cp-tab", mode === "upload" && "cp-tab--on")} role="tab" aria-selected={mode === "upload"} onClick={() => setMode("upload")}>
          <Upload size={18} aria-hidden="true" />
          Upload document
        </button>
        <button className={clsx("cp-tab", mode === "paste" && "cp-tab--on")} role="tab" aria-selected={mode === "paste"} onClick={() => setMode("paste")}>
          <List size={18} aria-hidden="true" />
          Paste EMR text
        </button>
      </div>

      {mode === "upload" ? (
        <Card style={{ padding: 20 }}><DocumentDrop file={file} onFile={setFile} disabled={!!busy} /></Card>
      ) : (
        <>
          <label className="cp-label" htmlFor="pt">Raw EMR discharge text</label>
          <textarea id="pt" className="cp-textarea" style={{ minHeight: 300 }} value={paste} onChange={(e) => setPaste(e.target.value)} disabled={!!busy} />
          <div style={{ marginTop: 8 }}><Button variant="ghost" size="sm" onClick={() => setPaste("")}>Clear text</Button></div>
        </>
      )}

      <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
        <input type="checkbox" checked={synthetic} onChange={(e) => setSynthetic(e.target.checked)} disabled={!!busy} /> This document contains synthetic data only, not a real patient.
      </label>
      {problem && <Banner tone="red" icon="alert">{problem}</Banner>}
      <div className="cp-bar">
        <span className="cp-bar-sp" />
        <Button onClick={submit} disabled={!!busy}>{busy || (mode === "upload" ? "Upload and process" : "Process text")}</Button>
      </div>
    </>
  );
}

function GeneratingCard({ seconds, stale, cancelling, onCancel, onRefresh }: { seconds: number; stale: boolean; cancelling: boolean; onCancel: () => void; onRefresh: () => void }) {
  const pct = Math.min(95, Math.round((seconds / 45) * 100));
  return (
    <Card>
      <h2>Reading the document and simplifying…</h2>
      {stale ? (
        <>
          <p className="muted">A draft is already being generated for this discharge.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="ghost" onClick={onRefresh}><RefreshCw size={16} aria-hidden="true" />Refresh</Button>
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">{seconds}s · usually 40–90 seconds. Every statement is checked against the source text before it is saved.</p>
          <div className="cp-prog" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
          <Button variant="ghost" onClick={onCancel} disabled={cancelling} style={{ marginTop: 14 }}>{cancelling ? "Cancelling…" : "Cancel"}</Button>
        </>
      )}
    </Card>
  );
}

/* ---------- Review ---------- */
function ReviewStep({ data, content, busy, run, setData, toast, regenerate, onContinue }: {
  data: Snapshot; content: GeneratedContent; busy: string;
  run: (label: string, fn: () => Promise<void>) => Promise<void>;
  setData: (d: Snapshot) => void; toast: (m: string) => void; regenerate: () => void; onContinue: () => void;
}) {
  const { episode } = data;
  const approved = ["APPROVED", "ACCESS_GRANTED", "ACTIVE"].includes(episode.state);
  const plan = toPlanContent(content);
  const grade = readingGrade(patientText(plan));
  const medFlags = openMedicationFlags(content);
  const swaps = plainLanguageSwaps(content);
  const visible = content.issues.filter((i) => i.id !== ATTESTATION);
  const open = visible.filter((i) => !i.resolution?.trim()), done = visible.filter((i) => i.resolution?.trim());
  const [editing, setEditing] = useState<{ id: string; path: string; text: string } | null>(null);
  const openCritical = open.filter((i) => i.severity === "critical").length;
  const ready = openCritical === 0 && episode.dischargeConfirmed;

  const review = (body: object, message: string) => run("Saving…", async () => {
    setData(await api(`discharges/${episode.planId}/review`, "PATCH", { version: episode.version, ...body }));
    toast(message);
  });
  const markReviewed = (ids: string[]) => review({ resolutions: ids.map((id) => ({ id, resolution: REVIEWED })) }, ids.length > 1 ? `${ids.length} flags marked reviewed.` : "Flag marked reviewed.");
  // A wording edit is saved into the plan and re-validated by the server; no new scan is needed.
  const saveWording = () => editing && run("Saving…", async () => {
    const updated = withWording(content, editing.path, editing.text.trim());
    updated.issues = updated.issues.map((i) => (i.id === editing.id ? { ...i, resolution: "Wording edited by the approving clinician." } : i));
    setData(await api(`discharges/${episode.planId}/review`, "PATCH", { version: episode.version, content: updated }));
    setEditing(null);
    toast("Wording updated.");
  });
  const approve = () => run("Approving…", async () => {
    let version = episode.version;
    if (content.issues.some((i) => i.id === ATTESTATION && !i.resolution?.trim())) {
      const saved: Snapshot = await api(`discharges/${episode.planId}/review`, "PATCH", { version, resolutions: [{ id: ATTESTATION, resolution: "Approving clinician checked the simplified wording against the source document." }] });
      version = saved.episode.version;
    }
    await api(`discharges/${episode.planId}/approve`, "POST", { version, clinicalReviewConfirmed: true });
    setData(await api(`discharges/${episode.planId}`));
    toast("English plan approved. Patient-facing version unlocked.");
  });

  return (
    <>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <h1>Review before approving</h1>
        <StatusChip status={planStatus(episode.state)} />
        <span style={{ flex: 1 }} />
        {!approved && <Button variant="ghost" size="sm" onClick={regenerate} disabled={!!busy}><RefreshCw size={14} aria-hidden="true" />Regenerate draft</Button>}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "12px 0 18px" }}>
        {grade != null && (
          <span className="cp-badge" style={grade <= 5 ? { background: "var(--sage-bg)", color: "var(--sage-fg)" } : { background: "var(--amber-bg)", color: "var(--amber-fg)" }}>
            {grade <= 5 ? <Check size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
            Reading level: Grade {grade.toFixed(1)} (target ≤ 5.0)
          </span>
        )}
        <span className="cp-badge" style={medFlags === 0 ? { background: "var(--sage-bg)", color: "var(--sage-fg)" } : { background: "var(--amber-bg)", color: "var(--amber-fg)" }}>
          <ShieldCheck size={16} aria-hidden="true" />
          Medications vs source: {medFlags === 0 ? "0 open flags" : `${medFlags} to check`}
        </span>
        <span className="cp-badge" style={{ background: "var(--blue-bg)", color: "var(--blue-fg)" }}>
          <Lock size={16} aria-hidden="true" />
          Nothing reaches the patient until you approve
        </span>
      </div>

      <div className="cp-grid2">
        <div>
          <h2 style={{ marginBottom: 8 }}>Clinician source</h2>
          <div className="cp-srcbox" lang="en">{data.sources.map((s) => s.text).join("\n\n— — —\n\n")}</div>
        </div>
        <div>
          <h2 style={{ marginBottom: 8 }}>Patient-facing (simplified)</h2>
          <Card><PlanPreview plan={plan} /></Card>
        </div>
      </div>

      <Card style={{ marginTop: 18 }}>
        <h2>Plain-language swaps</h2>
        {swaps.length ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
            {swaps.map(([before, after]) => (
              <span className="cp-swap" key={before}><s style={{ color: "var(--muted)" }}>{before}</s> → {after}</span>
            ))}
          </div>
        ) : <p className="muted">The draft keeps the source wording; no rewrites to show.</p>}
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 4px" }}>
        <h2 style={{ margin: 0 }}>Needs your review</h2>
        <span style={{ flex: 1 }} />
        {!approved && open.length > 1 && <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => markReviewed(open.map((i) => i.id))}><Check size={14} aria-hidden="true" />Mark all reviewed</Button>}
      </div>

      {!episode.dischargeConfirmed && (
        <div className="cp-flagcard">
          <b>[NEEDS REVIEW] discharge date and time not confirmed</b>
          <p style={{ margin: "4px 0 8px" }}>Recorded as {new Date(episode.dischargeAt).toLocaleString()} ({episode.dischargeTimezone}). Patient access ends 30 days later.</p>
          <Button size="sm" disabled={!!busy} onClick={() => review({ dischargeConfirmed: true }, "Discharge time confirmed.")}>Confirm</Button>
        </div>
      )}
      {open.map((issue) => {
        const path = issue.id.startsWith(WORDING) ? issue.id.slice(WORDING.length) : null;
        const wording = path ? wordingAt(content, path) : null;
        return (
          <div className="cp-flagcard" key={issue.id}>
            <b>[NEEDS REVIEW] {wording ? "check the simplified wording" : issue.severity === "critical" ? "important" : "check"}</b>
            <p style={{ margin: "4px 0 8px" }}>{issue.description}</p>
            {wording && <>
              <div style={{ background: "var(--sage-bg)", color: "var(--sage-fg)", borderRadius: 8, padding: "6px 10px", margin: "6px 0" }}><b>Original:</b> {wording.quote}</div>
              {editing?.id === issue.id ? (
                <>
                  <label className="cp-label" htmlFor={"edit-" + issue.id}>Patient sees</label>
                  <textarea id={"edit-" + issue.id} className="cp-textarea" style={{ minHeight: 80 }} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
                </>
              ) : (
                <div style={{ background: "var(--blue-bg)", color: "var(--blue-fg)", borderRadius: 8, padding: "6px 10px", margin: "6px 0" }}><b>Patient sees:</b> {wording.text}</div>
              )}
            </>}
            {!approved && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {editing?.id === issue.id ? (
                  <>
                    <Button size="sm" disabled={!!busy || !editing.text.trim()} onClick={saveWording}>{busy === "Saving…" ? busy : "Save wording"}</Button>
                    <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setEditing(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => markReviewed([issue.id])}>{wording ? "Looks right" : "Mark reviewed"}</Button>
                    {wording && path && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setEditing({ id: issue.id, path, text: wording.text })}>Edit wording</Button>}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
      {done.map((issue) => (
        <div className="cp-flagcard cp-flagcard--done" key={issue.id}>
          <b><Check size={16} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> Reviewed:</b> {issue.description}
        </div>
      ))}

      <div className="cp-bar">
        {approved ? (
          <>
            <Chip tone="sage"><Check size={14} aria-hidden="true" />English approved</Chip>
            <span className="cp-bar-sp" />
            <Button onClick={onContinue}>Continue to translate <ChevronRight size={16} aria-hidden="true" /></Button>
          </>
        ) : (
          <>
            <span className="muted">{!ready ? (!episode.dischargeConfirmed ? "Confirm the discharge time and review every flag first." : "Review every flag first.") : "Approving confirms you checked the simplified wording against the source document."}</span>
            <span className="cp-bar-sp" />
            <Button disabled={!ready || !!busy} onClick={approve} title={ready ? "" : "Review every important flag first"}>
              <Check size={16} aria-hidden="true" />
              {busy === "Approving…" ? busy : "Approve (English)"}
            </Button>
          </>
        )}
      </div>
    </>
  );
}

/* ---------- Patient preview (review step, English), built from the real draft ---------- */
function PlanPreview({ plan, lang = "en" }: { plan: PlanContent; lang?: PlanLanguage }) {
  // Group headings use the patient app's interface strings, in English where the app has none.
  const t = UI[lang as Language] ?? UI.en;
  const groups: Array<["new" | "keep" | "stop", string]> = [["new", t.groupNew], ["keep", t.groupKeep], ["stop", t.groupStop]];
  const yellow = plan.warnings.find((w) => w.severity === "yellow"), red = plan.warnings.find((w) => w.severity === "red");
  return (
    <div>
      <h3 className="muted" style={{ margin: "6px 0" }}>{plan.whyTitle}</h3>
      <p>{plan.why || <span className="muted">No hospital summary in the source.</span>}</p>
      {groups.map(([k, label]) => plan.medications[k].length > 0 && (
        <div key={k} className={`cp-pfblock cp-pfblock--${k}`}>
          <b>{label}</b>
          <ul>
            {plan.medications[k].map((m) => (
              <li key={m.name}><b>{m.name}{m.dose ? ` ${m.dose}` : ""}</b>{medicationSchedule(m) ? `, ${medicationSchedule(m)}.` : "."} {m.note ?? ""}</li>
            ))}
          </ul>
        </div>
      ))}
      {plan.todos.length > 0 && <>
        <h3 className="muted" style={{ margin: "10px 0 4px" }}>Daily to-do</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>{plan.todos.map((t) => <li key={t.id}>{t.label}</li>)}</ul>
      </>}
      {plan.appointments.length > 0 && <>
        <h3 className="muted" style={{ margin: "10px 0 4px" }}>Appointments and tests</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>{plan.appointments.map((a) => <li key={a.type}>{a.type}{a.scheduleNeeded ? " (scheduling needed)" : ""}</li>)}</ul>
      </>}
      {yellow && (
        <div className="cp-zonebox cp-zonebox--y">
          <b><AlertTriangle size={16} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> Call your care team if:</b>
          <ul>{yellow.items.map((it) => <li key={it}>{it}</li>)}</ul>
        </div>
      )}
      {red && (
        <div className="cp-zonebox cp-zonebox--r">
          <b><AlertTriangle size={16} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> Go to the ER or call 911 if:</b>
          <ul>{red.items.map((it) => <li key={it}>{it}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

/* ---------- Translate & verify ---------- */
function fieldLabel(path: string, content: GeneratedContent) {
  const [section, index, key] = path.split(".");
  if (section === "summary") return "Why you were in the hospital";
  if (section === "medications") {
    const part = { plainLanguage: "explanation", frequency: "how often", route: "how to take it", duration: "how long" }[key] ?? key;
    return `${content.medications[Number(index)]?.name ?? "Medicine"} — ${part}`;
  }
  const names: Record<string, string> = { hospitalCourse: "Hospital stay", diagnoses: "Diagnosis", dailyActions: "Daily to-do", diet: "Diet", fluids: "Fluids", activity: "Activity", otherInstructions: "Instruction", appointments: "Appointment", labsAndMonitoring: "Test or monitoring", warningSigns: "Warning sign" };
  return `${names[section] ?? section} ${Number(index) + 1}`;
}

function TranslateStep({ planId, content, translations, setTranslations, fixture, shown, setShown, toast, onContinue }: {
  planId: string; content: GeneratedContent; translations: TranslationView[];
  setTranslations: React.Dispatch<React.SetStateAction<TranslationView[]>>;
  fixture: boolean; shown: TransLang[]; setShown: React.Dispatch<React.SetStateAction<TransLang[]>>;
  toast: (m: string) => void; onContinue: () => void;
}) {
  const [selected, setSelected] = useState<TransLang[]>(() => translations.map((x) => x.language));
  const [tab, setTab] = useState<TransLang | undefined>(translations[0]?.language);
  const [working, setWorking] = useState(""), [seconds, setSeconds] = useState(0), [error, setError] = useState("");
  const [queue, setQueue] = useState<TransLang[]>([]);
  const running = useRef<AbortController | null>(null);
  const [editing, setEditing] = useState<{ path: string; text: string } | null>(null);
  const t = translations.find((x) => x.language === tab);
  const base = `discharges/${planId}/translations/${tab}`;
  const translated = (Object.keys(LANGS) as TransLang[]).filter((k) => translations.some((x) => x.language === k));
  const pending = selected.filter((k) => !shown.includes(k) && !translations.some((x) => x.language === k && x.current));
  async function act(label: string, fn: (signal: AbortSignal) => Promise<TranslationView>, message: string) {
    const controller = new AbortController();
    running.current = controller;
    setWorking(label); setError(""); setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    try {
      const next = await fn(controller.signal);
      setTranslations((list) => [...list.filter((x) => x.language !== next.language), next]);
      setEditing(null); toast(message);
    } catch (e) { if (!isAbort(e)) setError((e as Error).message); }
    finally { clearInterval(timer); setWorking(""); running.current = null; }
  }
  function cancel() {
    running.current?.abort();
    toast("Translation cancelled.");
  }
  // Translates each selected language in turn; each one is checked line by line before it is shown.
  async function translateSelected() {
    const controller = new AbortController(), { signal } = controller;
    running.current = controller;
    setWorking("translate"); setError(""); setSeconds(0); setQueue(pending); setEditing(null);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    const real = fixture ? pending.filter((l) => l === "es") : pending, simulated = pending.filter((l) => !real.includes(l));
    const wait = simulated.length
      ? new Promise<void>((resolve) => { const t = setTimeout(resolve, DEMO_TRANSLATE_MS); signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true }); })
      : Promise.resolve();
    try {
      for (const lang of real) {
        const next: TranslationView = await api(`discharges/${planId}/translations/${lang}`, "POST", undefined, signal);
        setTranslations((list) => [...list.filter((x) => x.language !== next.language), next]);
        setQueue((q) => q.filter((l) => l !== lang)); setTab(lang);
      }
      await wait;
      if (signal.aborted) return;
      setShown((list) => [...list, ...simulated]);
      toast(pending.length === 1 ? `${LANGS[pending[0]]} translated and checked.` : `${pending.length} languages translated and checked.`);
    } catch (e) { if (!isAbort(e)) setError((e as Error).message); }
    finally { clearInterval(timer); setWorking(""); setQueue([]); running.current = null; }
  }
  const flagged = t?.fields.filter((f) => f.problems.length) ?? [];
  const valuesOk = !!t && !t.fields.some((f) => f.problems.some((p) => /missing or changed|adds|medicine name|does not contain/i.test(p)));
  const dir = tab ? TRANSLATION_LANGUAGES[tab].dir : "ltr", langClass = clsx(tab === "zh" && "lang-zh", tab === "ar" && "lang-ar");
  const busyLabel = (label: string, idle: string) => (working === label ? `Working… ${seconds}s` : idle);
  const total = Math.max(1, fixture ? pending.filter((l) => l === "es").length : pending.length), pct = Math.min(95, Math.round((seconds / (40 * total)) * 100));
  const list = (langs: TransLang[]) => langs.map((l) => LANGS[l]).join(", ");

  return (
    <>
      <h1>Translate &amp; verify</h1>
      <p className="muted">English is approved. Choose the patient&apos;s languages, then check each back-translation. Drug names and numbers are kept identical.</p>
      {error && <Banner tone="red" icon="alert">{error}</Banner>}
      <Card>
        <h2 style={{ marginBottom: 10 }}>Patient languages</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "8px 16px" }}>
          {(Object.keys(LANGS) as TransLang[]).map((k) => {
            const x = translations.find((y) => y.language === k);
            return (
              <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 32 }}>
                <input type="checkbox" checked={selected.includes(k)} disabled={!!working || !!x || shown.includes(k)} onChange={(e) => setSelected((list) => (e.target.checked ? [...list, k] : list.filter((l) => l !== k)))} />
                {LANGS[k]}
                {x && !x.current ? <Chip tone="amber">Out of date</Chip> : x?.status === "published" ? <Chip tone="sage">Published</Chip> : x?.status === "blocked" ? <Chip tone="red">Blocked</Chip> : x || shown.includes(k) ? <Chip tone="sage">Verified</Chip> : null}
              </label>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
          <Button onClick={translateSelected} disabled={!!working || pending.length === 0}>
            <Globe size={18} aria-hidden="true" />
            {pending.length > 1 ? `Translate ${pending.length} languages` : pending.length === 1 ? `Translate to ${LANGS[pending[0]]}` : "Translate selected"}
          </Button>
          <span className="muted" style={{ fontSize: 13 }}>Each line is translated back to English independently and compared with the approved plan.</span>
        </div>
      </Card>

      {working === "translate" ? (
        <Card>
          <h2>Translating to {list(queue) || "the selected languages"} and checking every line…</h2>
          <p className="muted">{seconds}s · usually under a minute per language.</p>
          <div className="cp-prog" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
          <Button variant="ghost" onClick={cancel} style={{ marginTop: 14 }}>Cancel translation</Button>
        </Card>
      ) : !tab || !t ? null : (
        <>
          {translated.length > 1 && (
            <div className="cp-tabs" role="tablist">
              {translated.map((k) => (
                <button key={k} className={clsx("cp-tab", tab === k && "cp-tab--on")} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setEditing(null); }} disabled={!!working}>
                  <Globe size={16} aria-hidden="true" />
                  {LANGS[k]}
                </button>
              ))}
            </div>
          )}
          {!t.current ? (
            <Card style={{ textAlign: "center", padding: 36 }}>
              <p><b>The English plan changed after this translation.</b> Translate it again.</p>
              <Button onClick={() => act("translate", (signal) => api(base, "POST", undefined, signal), `${LANGS[tab]} translated and checked.`)} disabled={!!working} style={{ marginTop: 8 }}>
                <Globe size={18} aria-hidden="true" />
                Translate to {LANGS[tab]} again
              </Button>
            </Card>
          ) : (
        <>
          <div className="cp-grid2">
            <div>
              <h2 style={{ marginBottom: 8 }}>{LANGS[tab]} patient text</h2>
              <div className={clsx("cp-tr-text", flagged.length > 0 && "cp-tr-text--bad", langClass)} dir={dir} lang={tab}>
                <PlanPreview plan={toPlanContent(applyTranslation(content, t.fields), tab, content)} lang={tab} />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {valuesOk ? <Chip tone="sage"><Check size={14} aria-hidden="true" />Drug names &amp; numbers identical</Chip> : <Chip tone="red"><AlertTriangle size={14} aria-hidden="true" />Drug names or numbers changed</Chip>}
                {tab === "ar" && <Chip tone="blue">Right-to-left layout</Chip>}
                {tab === "zh" && <Chip tone="blue">Noto Sans SC</Chip>}
              </div>
            </div>
            <div>
              <h2 style={{ marginBottom: 8 }}>Back-translation check</h2>
              {flagged.length ? (
                <Banner tone="red" icon="alert">
                  <b>High-risk mismatch.</b> Publishing {LANGS[tab]} is blocked until {flagged.length === 1 ? "this line is" : `these ${flagged.length} lines are`} fixed.
                  <div style={{ marginTop: 8 }}>
                    <Button variant="red" size="sm" disabled={!!working} onClick={() => act("retranslate", () => api(`${base}/retranslate`, "POST", {}), "Flagged lines re-translated and re-checked.")}>
                      {busyLabel("retranslate", "Re-translate flagged lines")}
                    </Button>
                  </div>
                </Banner>
              ) : (
                <Banner tone="sage" icon="check">All {t.fields.length} lines match the approved English.</Banner>
              )}
              {flagged.map((f) => (
                <div className="cp-flagcard" key={f.path}>
                  <b>{fieldLabel(f.path, content)}</b>
                  <div style={{ background: "var(--sage-bg)", color: "var(--sage-fg)", borderRadius: 8, padding: "6px 10px", margin: "6px 0" }}><b>Original (EN):</b> {f.source}</div>
                  <div style={{ background: "var(--red-bg)", color: "var(--red-fg)", borderRadius: 8, padding: "6px 10px", margin: "6px 0" }}><b>Back-translated (EN):</b> {f.backTranslation ?? "—"}</div>
                  <ul style={{ margin: "4px 0 8px", paddingLeft: 18 }}>{f.problems.map((p) => <li key={p}>{p}</li>)}</ul>
                  {editing?.path === f.path ? (
                    <>
                      <label className="cp-label" htmlFor={"edit-" + f.path}>{LANGS[tab]} text</label>
                      <textarea id={"edit-" + f.path} className={clsx("cp-textarea", langClass)} dir={dir} lang={tab} value={editing.text} onChange={(e) => setEditing({ path: f.path, text: e.target.value })} style={{ minHeight: 90 }} />
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <Button size="sm" disabled={!!working || !editing.text.trim()} onClick={() => act("edit", () => api(base, "PATCH", editing), "Line updated and re-checked.")}>{busyLabel("edit", "Save and re-check")}</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={!!working}>Cancel</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className={langClass} dir={dir} lang={tab} style={{ margin: "4px 0" }}>{f.text}</p>
                      <Button variant="ghost" size="sm" disabled={!!working} onClick={() => setEditing({ path: f.path, text: f.text })}>Edit</Button>
                    </>
                  )}
                </div>
              ))}
              <p className="muted" style={{ fontSize: 13 }}>Machine translation, checked line by line with an independent back-translation. Before real use, a qualified medical interpreter must review it.</p>
            </div>
          </div>

          <div className="cp-bar">
            <Button variant="ghost" disabled={!!working} onClick={() => act("translate", (signal) => api(base, "POST", undefined, signal), `${LANGS[tab]} translated again and checked.`)}><RefreshCw size={16} aria-hidden="true" />Translate again</Button>
            <span className="cp-bar-sp" />
            {t.status === "published" ? (
              <Chip tone="sage"><Check size={14} aria-hidden="true" />{LANGS[tab]} published</Chip>
            ) : (
              <Button disabled={flagged.length > 0 || !!working} title={flagged.length ? "Blocked: fix the flagged lines first" : ""} onClick={() => act("publish", () => api(`${base}/publish`, "POST"), `${LANGS[tab]} published. The patient can now choose it.`)}>
                {busyLabel("publish", `Publish ${LANGS[tab]}`)}
              </Button>
            )}
            <Button variant="ghost" onClick={onContinue} disabled={!!working}>Continue to publish <ChevronRight size={16} aria-hidden="true" /></Button>
          </div>
        </>
          )}
        </>
      )}
      {!t && !working && (
        <div className="cp-bar"><span className="cp-bar-sp" /><Button variant="ghost" onClick={onContinue}>{shown.length ? "Continue to publish" : "Skip — publish in English only"} <ChevronRight size={16} aria-hidden="true" /></Button></div>
      )}
    </>
  );
}

function PublishStep({ data, languages, busy, run, toast, reload, onBack }: {
  data: Snapshot; languages: TransLang[]; busy: string;
  run: (label: string, fn: () => Promise<void>) => Promise<void>;
  toast: (m: string) => void; reload: () => Promise<void>; onBack: () => void;
}) {
  const [issued, setIssued] = useState<{ link: string; code: string }>();
  const published = data.episode.state === "ACCESS_GRANTED" || data.episode.state === "ACTIVE";
  const ex = new Date(data.episode.expiresAt);
  const dt = ex.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const tm = ex.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const publish = () => run("Publishing…", async () => {
    const result: { link: string; code: string } = await api(`discharges/${data.episode.planId}/publish`, "POST", {});
    setIssued({ link: result.link, code: result.code });
    await reload();
    toast(published ? "New link and code issued. The previous link no longer works." : `Published. ${data.patient?.displayName ?? "The patient"} can now open their plan.`);
  });
  return (
    <>
      <h1>{published ? "Published to patient" : "Ready to publish"}</h1>
      <div className="cp-grid2" style={{ marginTop: 14 }}>
        <Card>
          <h3 className="muted">Patient link</h3>
          {issued ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
              <code className="tn" style={{ background: "var(--panel)", padding: "8px 12px", borderRadius: 10, flex: 1, wordBreak: "break-all" }}>{issued.link}</code>
              <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(issued.link).then(() => toast("Link copied."), () => toast("Copy failed; select the link instead."))}>
                <Copy size={14} aria-hidden="true" />
                Copy
              </Button>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 6 }}>{published ? "The link is shown only when it is issued. Issue a new code to get a new link." : "A secure link is created when you publish."}</p>
          )}
          <p style={{ margin: "16px 0 0" }}>Languages: <b>{["English", ...languages.map((l) => LANGS[l])].join(", ")}</b></p>
        </Card>
        <div>
          {issued ? (
            <Banner tone="blue" icon="lock">
              <div style={{ fontSize: 16 }}>
                Give the patient this code: <b className="tn" style={{ fontSize: 22, letterSpacing: 2 }}>{issued.code.slice(0, 3)}-{issued.code.slice(3)}</b>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Shown once. It works until the plan expires; 5 wrong tries lock the link.</div>
            </Banner>
          ) : null}
          <Banner tone="amber" icon="clock">
            This plan expires on <b>{dt}</b> at <b>{tm}</b> (exactly 30 days after discharge). Set by the server — not editable.
          </Banner>
        </div>
      </div>
      <div className="cp-bar">
        <Button variant="ghost" onClick={onBack}>Back to translate</Button>
        <span className="cp-bar-sp" />
        {published && <Chip tone="sage"><Check size={14} aria-hidden="true" />Published</Chip>}
        <Button onClick={publish} disabled={!!busy}>{busy === "Publishing…" ? busy : published ? "Issue a new code" : "Publish to patient"}</Button>
      </div>
    </>
  );
}

export function DischargeWizard({ id }: { id: string }) {
  return (
    <ToastProvider>
      <WizardInner id={id} />
    </ToastProvider>
  );
}
