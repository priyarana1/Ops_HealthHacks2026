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
import { Upload, List, Check, ShieldCheck, Lock, AlertTriangle, ChevronRight, RefreshCw, Copy } from "lucide-react";
import { api } from "@/components/client-api";
import { DocumentDrop, MAX_UPLOAD_BYTES } from "@/components/document-drop";
import type { GeneratedContent } from "@/lib/backend/contracts";
import type { PlanContent } from "@/types/plan";
import { toPlanContent, readingGrade, patientText, plainLanguageSwaps, openMedicationFlags } from "@/lib/plan-adapter";
import { planStatus } from "@/lib/discharge-status";

/**
 * Real discharge wizard: same screens as the Blueprint wizard, backed by the discharge API.
 * Capture (upload or paste) -> AI draft -> clinician review and approval -> translate -> publish.
 */

const STEPS = ["Capture", "Review", "Translate", "Publish"];
type Step = 0 | 1 | 2 | 3;
const REVIEWED = "Reviewed against the source document by the approving clinician.";

interface Snapshot {
  episode: { planId: string; state: string; version: number; dischargeAt: string; dischargeTimezone: string; expiresAt: string; dischargeConfirmed: boolean; approval?: { providerId: string; approvedAt: string } };
  patient?: { displayName: string };
  plan?: { content?: GeneratedContent; model?: { modelId: string; generatedAt: string } };
  sources: { sourceId: string; kind: string; documentType: string; text: string }[];
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
  const [after, setAfter] = useState<2 | 3>(2);
  const autoStarted = useRef(false), placed = useRef(false);

  const load = useCallback(async () => setData(await api("discharges/" + id)), [id]);

  const generate = useCallback(async () => {
    setGenerating(true); setError(""); setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    try { setData(await api(`discharges/${id}/process`, "POST", {})); }
    catch (e) { setError((e as Error).message); await load().catch(() => {}); }
    finally { clearInterval(timer); setGenerating(false); }
  }, [id, load]);

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
  useEffect(() => {
    if (!placed.current && state) { placed.current = true; if (state === "ACCESS_GRANTED" || state === "ACTIVE") setAfter(3); }
  }, [state]);
  const step: Step = isNew ? 0 : approved ? after : 1;
  const crumb = data?.patient?.displayName ? `${data.patient.displayName} · ${STEPS[step]}` : `New discharge · ${STEPS[step]}`;

  return (
    <ProviderShell active="new" crumb={crumb}>
      <Stepper steps={STEPS} current={step} />
      {error && <Banner tone="red" icon="alert">{error}</Banner>}
      {step === 0 && <CaptureStep busy={busy} run={run} onCreated={(planId) => router.replace(`/provider/discharge/${planId}?generate=1`)} />}
      {step === 1 && !data && !error && <p className="muted">Loading discharge…</p>}
      {step === 1 && data && (
        generating || state === "PROCESSING"
          ? <GeneratingCard seconds={seconds} stale={!generating} onRefresh={() => load().catch((e) => setError(e.message))} />
          : !content
            ? <Card style={{ textAlign: "center", padding: 32 }}>
                <p className="muted">{data.sources.length ? "No plain-language draft yet." : "No discharge document was saved for this record."}</p>
                {data.sources.length > 0 && <Button onClick={generate}>Generate plain-language draft</Button>}
              </Card>
            : <ReviewStep data={data} content={content} busy={busy} run={run} setData={setData} toast={toast} regenerate={generate} onContinue={() => setAfter(2)} />
      )}
      {step === 2 && <TranslatePlaceholder onContinue={() => setAfter(3)} />}
      {step === 3 && data && <PublishStep data={data} busy={busy} run={run} toast={toast} reload={load} onBack={() => setAfter(2)} onExpired={(message) => { setData(undefined); setError(message); }} />}
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
        <h3 className="muted">Patient (synthetic)</h3>
        <label className="cp-label" htmlFor="pname">Display name</label>
        <input id="pname" className="cp-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="e.g. Synthetic Patient A" disabled={!!busy} />
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

function GeneratingCard({ seconds, stale, onRefresh }: { seconds: number; stale: boolean; onRefresh: () => void }) {
  const pct = Math.min(95, Math.round((seconds / 75) * 100));
  return (
    <Card>
      <h2>Reading the document and simplifying…</h2>
      {stale ? (
        <>
          <p className="muted">A draft is already being generated for this discharge.</p>
          <Button variant="ghost" onClick={onRefresh}><RefreshCw size={16} aria-hidden="true" />Refresh</Button>
        </>
      ) : (
        <>
          <p className="muted">{seconds}s · usually 40–90 seconds. Every statement is checked against the source text before it is saved.</p>
          <div className="cp-prog" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
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
  const open = content.issues.filter((i) => !i.resolution?.trim()), done = content.issues.filter((i) => i.resolution?.trim());
  const openCritical = open.filter((i) => i.severity === "critical").length;
  const ready = openCritical === 0 && episode.dischargeConfirmed;

  const review = (body: object, message: string) => run("Saving…", async () => {
    setData(await api(`discharges/${episode.planId}/review`, "PATCH", { version: episode.version, ...body }));
    toast(message);
  });
  const markReviewed = (ids: string[]) => review({ resolutions: ids.map((id) => ({ id, resolution: REVIEWED })) }, ids.length > 1 ? `${ids.length} flags marked reviewed.` : "Flag marked reviewed.");
  const approve = () => run("Approving…", async () => {
    await api(`discharges/${episode.planId}/approve`, "POST", { version: episode.version, clinicalReviewConfirmed: true });
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
      {open.map((issue) => (
        <div className="cp-flagcard" key={issue.id}>
          <b>[NEEDS REVIEW] {issue.severity === "critical" ? "important" : "check"}</b>
          <p style={{ margin: "4px 0 8px" }}>{issue.description}</p>
          {!approved && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => markReviewed([issue.id])}>Mark reviewed</Button>}
        </div>
      ))}
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
            {!ready && <span className="muted">{!episode.dischargeConfirmed ? "Confirm the discharge time and review every important flag first." : "Review every important flag first."}</span>}
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
function PlanPreview({ plan }: { plan: PlanContent }) {
  const groups: Array<["new" | "keep" | "stop", string]> = [["new", "NEW — start these"], ["keep", "KEEP TAKING"], ["stop", "STOP or HOLD"]];
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
              <li key={m.name}><b>{m.name}{m.dose ? ` ${m.dose}` : ""}</b>{m.frequency ? `, ${m.frequency}.` : "."} {m.note ?? ""}</li>
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

/* ---------- Translate and publish: connected in the next build steps ---------- */
function TranslatePlaceholder({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <h1>Translate &amp; verify</h1>
      <Card style={{ textAlign: "center", padding: 36 }}>
        <p className="muted">Real translation with a back-translation safety check is being connected. English is approved and ready.</p>
      </Card>
      <div className="cp-bar"><span className="cp-bar-sp" /><Button variant="ghost" onClick={onContinue}>Continue to publish <ChevronRight size={16} aria-hidden="true" /></Button></div>
    </>
  );
}

function PublishStep({ data, busy, run, toast, reload, onBack, onExpired }: {
  data: Snapshot; busy: string;
  run: (label: string, fn: () => Promise<void>) => Promise<void>;
  toast: (m: string) => void; reload: () => Promise<void>; onBack: () => void; onExpired: (message: string) => void;
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
  const expire = () => {
    if (!window.confirm("Simulate reaching the end of the 30-day window now? Patient access ends immediately and the records are deleted shortly after. Synthetic test records only.")) return;
    run("Expiring…", async () => {
      await api(`discharges/${data.episode.planId}/expire-test`, "POST", {});
      onExpired("This discharge has expired. The patient link no longer works, and MongoDB deletes the records automatically within about a minute.");
    });
  };
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
          <p style={{ margin: "16px 0 0" }}>Languages: <b>English</b></p>
        </Card>
        <div>
          {issued ? (
            <Banner tone="blue" icon="lock">
              <Chip tone="blue">Demo: no text message is sent</Chip>
              <div style={{ fontSize: 16, marginTop: 6 }}>
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
      <details className="cp-card" style={{ marginTop: 18 }}>
        <summary>Testing tools (synthetic records only)</summary>
        <p className="muted">Simulates the end of the 30-day window: the patient link stops working at once and the records are deleted shortly after.</p>
        <Button variant="red" size="sm" disabled={!!busy} onClick={expire}>{busy === "Expiring…" ? busy : "Simulate 30-day expiry (test)"}</Button>
      </details>
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
