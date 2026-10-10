"use client";

import { useEffect, useRef, useState } from "react";
import { ProviderShell } from "@/components/provider/ProviderShell";
import { StatusChip } from "@/components/provider/StatusChip";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Banner } from "@/components/ui/Banner";
import { Stepper } from "@/components/ui/Stepper";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { clsx } from "@/lib/clsx";
import {
  Mic,
  MicOff,
  Square,
  RefreshCw,
  List,
  Check,
  ShieldCheck,
  Lock,
  Globe,
  AlertTriangle,
  Copy,
  ChevronRight,
} from "lucide-react";
import {
  ELEANOR,
  ELEANOR_SOURCE_TEXT,
  PLAIN_LANGUAGE_SWAPS,
} from "@/mocks/patient";
import { ELEANOR_PLAN_CONTENT } from "@/mocks/plan";
import type { PlanStatus, Language } from "@/types/plan";
import {
  transcribeAudio,
  simplifyInstructions,
  translatePlan,
  backTranslateCheck,
  approvePlan,
  publishPlan,
} from "@/services/dischargeService";

const STEPS = ["Capture", "Transcript", "Review", "Translate", "Publish"];
type Step = 0 | 1 | 2 | 3 | 4;
type TransLang = "es" | "zh" | "ar";

const waveBars = (on: boolean) =>
  Array.from({ length: 40 }, (_, i) => (
    <i
      key={i}
      style={{ height: `${15 + Math.abs(Math.sin(i * 1.3)) * 70}%` }}
    />
  )).map((el, i) =>
    on ? el : <i key={i} style={{ height: `${15 + Math.abs(Math.sin(i * 1.3)) * 70}%` }} />,
  );

function WizardInner() {
  const toast = useToast();
  const [step, setStep] = useState<Step>(0);

  // Capture
  const [mode, setMode] = useState<"record" | "paste">("record");
  const [rec, setRec] = useState<"idle" | "recording" | "done">("idle");
  const [sec, setSec] = useState(0);
  const [paste, setPaste] = useState(ELEANOR_SOURCE_TEXT);
  const [pasteErr, setPasteErr] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Transcript
  const [tp, setTp] = useState<"ready" | "progress" | "fail">("ready");
  const [tpPct, setTpPct] = useState(0);
  const [garbFixed, setGarbFixed] = useState(false);
  const tpTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Review
  const [thr, setThr] = useState<number | null>(null);
  const [thrInput, setThrInput] = useState("");
  const [fluid, setFluid] = useState<"na" | "limit" | null>(null);
  const [fluidAdd, setFluidAdd] = useState(false);
  const [fluidInput, setFluidInput] = useState("");
  const [approved, setApproved] = useState(false);
  const [working, setWorking] = useState(false);

  // Translate
  const [tab, setTab] = useState<TransLang>("es");
  const [translated, setTranslated] = useState<Record<TransLang, boolean>>({
    es: false,
    zh: false,
    ar: false,
  });
  const [esFixed, setEsFixed] = useState(false);
  const [published, setPublished] = useState<Record<string, boolean>>({});

  // Publish
  const [planPublished, setPlanPublished] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (tpTimer.current) clearInterval(tpTimer.current);
    };
  }, []);

  const status: PlanStatus = approved ? "approved" : "needs_review";
  const flagsOk = thr != null && fluid != null;

  function startRecording() {
    setRec("recording");
    setSec(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSec((s) => s + 1), 1000);
  }
  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRec("done");
  }

  async function runTranscription(fail = false) {
    setStep(1);
    setTp("progress");
    setTpPct(0);
    if (tpTimer.current) clearInterval(tpTimer.current);
    tpTimer.current = setInterval(() => {
      setTpPct((p) => {
        const next = Math.min(100, p + 8);
        if (next >= 100 && tpTimer.current) clearInterval(tpTimer.current);
        return next;
      });
    }, 180);
    const res = await transcribeAudio({ simulateFailure: fail });
    if (tpTimer.current) clearInterval(tpTimer.current);
    setTpPct(100);
    setTp(res.ok ? "ready" : "fail");
  }

  async function processPaste() {
    const text = paste.trim();
    if (!text) {
      setPasteErr(true);
      return;
    }
    setPasteErr(false);
    const res = await simplifyInstructions(text);
    if (res.ok) setStep(2);
    else toast(res.error);
  }

  async function doApprove() {
    setWorking(true);
    const res = await approvePlan();
    setWorking(false);
    if (res.ok) {
      setApproved(true);
      toast("English plan approved. Patient-facing version unlocked.");
    }
  }

  async function doTranslate() {
    setWorking(true);
    await translatePlan(tab);
    await backTranslateCheck(tab, { fixed: tab === "es" ? esFixed : true });
    setWorking(false);
    setTranslated((t) => ({ ...t, [tab]: true }));
  }

  async function doPublish() {
    setWorking(true);
    const res = await publishPlan();
    setWorking(false);
    if (res.ok) {
      setPlanPublished(true);
      toast("Published. Eleanor can now open her plan.");
    }
  }

  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");

  return (
    <ProviderShell active="new" crumb={`New discharge · ${STEPS[step]}`}>
      <Stepper steps={STEPS} current={step} />

      {/* STEP 0 — CAPTURE */}
      {step === 0 && (
        <>
          <h1>Capture instructions</h1>
          <Card style={{ margin: "16px 0" }}>
            <h3 className="muted">Patient (synthetic)</h3>
            <p style={{ fontSize: 17, margin: "6px 0 0" }}>
              <b>{ELEANOR.name}</b> · {ELEANOR.age} · MRN {ELEANOR.mrn}
            </p>
            <p className="muted" style={{ margin: "2px 0 0" }}>
              {ELEANOR.summary}
            </p>
          </Card>

          <div className="cp-tabs" role="tablist">
            <button
              className={clsx("cp-tab", mode === "record" && "cp-tab--on")}
              role="tab"
              aria-selected={mode === "record"}
              onClick={() => setMode("record")}
            >
              <Mic size={18} aria-hidden="true" />
              Record voice
            </button>
            <button
              className={clsx("cp-tab", mode === "paste" && "cp-tab--on")}
              role="tab"
              aria-selected={mode === "paste"}
              onClick={() => setMode("paste")}
            >
              <List size={18} aria-hidden="true" />
              Paste EMR text
            </button>
          </div>

          {mode === "record" ? (
            <Card style={{ textAlign: "center", padding: 28 }}>
              <div className="cp-timer" aria-live="off">
                {mm}:{ss}
              </div>
              <div
                className={clsx("cp-wave", rec === "recording" && "cp-wave--on")}
                style={{ margin: "12px 0" }}
                aria-hidden="true"
              >
                {waveBars(rec === "recording")}
              </div>
              {rec === "idle" && (
                <>
                  <button
                    className="cp-mic"
                    onClick={startRecording}
                    aria-label="Start recording"
                  >
                    <Mic size={40} aria-hidden="true" />
                  </button>
                  <p className="muted" style={{ marginTop: 12 }}>
                    Press to start. Speak the discharge instructions as you
                    normally would.
                  </p>
                </>
              )}
              {rec === "recording" && (
                <>
                  <Button variant="red" onClick={stopRecording}>
                    <Square size={16} aria-hidden="true" />
                    Stop
                  </Button>
                  <p className="muted" style={{ marginTop: 10 }}>
                    Recording… Re-recording replaces the previous take.
                  </p>
                </>
              )}
              {rec === "done" && (
                <>
                  <Chip tone="sage">
                    <Check size={14} aria-hidden="true" />
                    Recording saved
                  </Chip>
                  <div style={{ marginTop: 14 }}>
                    <Button variant="ghost" onClick={startRecording}>
                      <RefreshCw size={16} aria-hidden="true" />
                      Re-record
                    </Button>
                  </div>
                </>
              )}
              <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
                <MicOff size={14} aria-hidden="true" style={{ verticalAlign: "-2px" }} />{" "}
                Microphone capture is simulated in this prototype. No audio leaves
                your device.
              </p>
            </Card>
          ) : (
            <>
              <label className="cp-label" htmlFor="pt">
                Raw EMR discharge text
              </label>
              <textarea
                id="pt"
                className="cp-textarea"
                style={{ minHeight: 300 }}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
              />
              {pasteErr && (
                <Banner tone="red" icon="alert">
                  Please paste the discharge instructions before continuing.
                </Banner>
              )}
              <div style={{ marginTop: 8 }}>
                <Button variant="ghost" size="sm" onClick={() => setPaste("")}>
                  Clear text
                </Button>
              </div>
            </>
          )}

          <div className="cp-bar">
            <span className="cp-bar-sp" />
            {mode === "record" ? (
              <Button disabled={rec !== "done"} onClick={() => runTranscription()}>
                Transcribe
              </Button>
            ) : (
              <Button onClick={processPaste}>Process text</Button>
            )}
          </div>
        </>
      )}

      {/* STEP 1 — TRANSCRIPT */}
      {step === 1 && (
        <>
          <h1>Review transcript</h1>
          {tp === "progress" && (
            <Card>
              <h2>Transcribing…</h2>
              <p className="muted">{tpPct}%</p>
              <div
                className="cp-prog"
                role="progressbar"
                aria-valuenow={tpPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <i style={{ width: `${tpPct}%` }} />
              </div>
            </Card>
          )}
          {tp === "fail" && (
            <Banner tone="red" icon="alert">
              <b>Transcription failed.</b> Nothing was sent to the AI. Try again,
              or paste the text instead.
              <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                <Button onClick={() => runTranscription()}>Retry</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setMode("paste");
                    setStep(0);
                  }}
                >
                  Paste text instead
                </Button>
              </div>
            </Banner>
          )}
          {tp === "ready" && (
            <>
              <p className="muted">
                Check drug names and numbers before the AI simplifies anything.
                Highlighted words look wrong.
              </p>
              <Card>
                <p style={{ lineHeight: 1.8, fontSize: 16, margin: 0 }}>
                  Continue{" "}
                  {garbFixed ? (
                    <mark
                      style={{
                        background: "var(--sage-bg)",
                        color: "var(--sage-fg)",
                        borderRadius: 4,
                        padding: "0 4px",
                        fontWeight: 700,
                      }}
                    >
                      metoprolol succinate
                    </mark>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setGarbFixed(true);
                          toast("Corrected to “metoprolol”.");
                        }}
                        style={{
                          background: "var(--amber-bg)",
                          color: "var(--amber-fg)",
                          border: "2px dashed var(--amber)",
                          borderBottom: "3px solid var(--amber)",
                          borderRadius: 4,
                          padding: "0 4px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                        aria-label="Possible error: met operol. Press to fix to metoprolol."
                      >
                        met operol
                      </button>{" "}
                      <span className="muted">succinate</span>
                    </>
                  )}{" "}
                  50 mg once a day, apixaban 5 mg twice a day, atorvastatin 40 mg
                  at night, and metformin 500 mg twice a day. New medicines:
                  furosemide 40 mg, losartan 25 mg, empagliflozin 10 mg,
                  amoxicillin-clavulanate 875/125 mg twice a day for 3 more days.
                </p>
              </Card>
              {!garbFixed && (
                <Banner tone="amber" icon="alert">
                  1 term needs a check: “met operol”. Click it to fix.
                </Banner>
              )}
              <div className="cp-bar">
                <span className="cp-bar-sp" />
                <Button disabled={!garbFixed} onClick={() => setStep(2)}>
                  Looks right — continue
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* STEP 2 — REVIEW */}
      {step === 2 && (
        <>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <h1>Review before approving</h1>
            <StatusChip status={status} />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "12px 0 18px" }}>
            <span className="cp-badge" style={{ background: "var(--sage-bg)", color: "var(--sage-fg)" }}>
              <Check size={16} aria-hidden="true" />
              Reading level: Grade 4.8 (target ≤ 5.0)
            </span>
            <span className="cp-badge" style={{ background: "var(--sage-bg)", color: "var(--sage-fg)" }}>
              <ShieldCheck size={16} aria-hidden="true" />
              Medications vs source: 0 changes
            </span>
            <span className="cp-badge" style={{ background: "var(--blue-bg)", color: "var(--blue-fg)" }}>
              <Lock size={16} aria-hidden="true" />
              Nothing reaches the patient until you approve
            </span>
          </div>

          <div className="cp-grid2">
            <div>
              <h2 style={{ marginBottom: 8 }}>Clinician source</h2>
              <div className="cp-srcbox" lang="en">
                {ELEANOR_SOURCE_TEXT}
              </div>
            </div>
            <div>
              <h2 style={{ marginBottom: 8 }}>Patient-facing (simplified)</h2>
              <Card>
                <PatientPreview thr={thr} fluid={fluid} fluidInput={fluidInput} />
              </Card>
            </div>
          </div>

          <Card style={{ marginTop: 18 }}>
            <h2>Plain-language swaps</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
              {PLAIN_LANGUAGE_SWAPS.map(([a, b]) => (
                <span className="cp-swap" key={a}>
                  <s style={{ color: "var(--muted)" }}>{a}</s> → {b}
                </span>
              ))}
            </div>
          </Card>

          <h2 style={{ margin: "20px 0 4px" }}>Needs your review</h2>

          {/* weight threshold flag */}
          {thr != null ? (
            <div className="cp-flagcard cp-flagcard--done">
              <b>
                <Check size={16} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> Resolved:
              </b>{" "}
              weight-gain threshold set to <b className="tn">{thr} lb</b>.
            </div>
          ) : (
            <div className="cp-flagcard">
              <b>[NEEDS REVIEW] weight-gain threshold missing</b>
              <p style={{ margin: "4px 0 8px" }}>No exact number was given in the note.</p>
              <label className="cp-label" htmlFor="thr" style={{ margin: "0 0 4px" }}>
                Enter weight-gain threshold (lb)
              </label>
              <input
                id="thr"
                className="cp-input tn"
                type="number"
                min={1}
                max={20}
                placeholder="e.g. 3"
                value={thrInput}
                onChange={(e) => setThrInput(e.target.value)}
                style={{ maxWidth: 220, display: "inline-block", width: "auto" }}
              />{" "}
              <Button
                size="sm"
                onClick={() => {
                  const x = Number(thrInput);
                  if (!x || x < 1) return toast("Enter a number of pounds.");
                  setThr(x);
                }}
              >
                Resolve
              </Button>
            </div>
          )}

          {/* fluid limit flag */}
          {fluid != null ? (
            <div className="cp-flagcard cp-flagcard--done">
              <b>
                <Check size={16} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> Resolved:
              </b>{" "}
              {fluid === "na"
                ? "fluid limit marked not applicable."
                : `fluid limit set to ${fluidInput}.`}
            </div>
          ) : (
            <div className="cp-flagcard">
              <b>[NEEDS REVIEW] fluid limit not stated</b>
              <p style={{ margin: "4px 0 8px" }}>
                The note says to follow the heart team&apos;s fluid plan but gives
                no amount.
              </p>
              {fluidAdd ? (
                <>
                  <input
                    className="cp-input"
                    placeholder="e.g. 64 oz (2 liters)"
                    value={fluidInput}
                    onChange={(e) => setFluidInput(e.target.value)}
                    style={{ marginBottom: 6 }}
                  />{" "}
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!fluidInput.trim()) return toast("Enter the fluid limit.");
                      setFluid("limit");
                    }}
                  >
                    Resolve
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setFluid("na")}>
                    Mark as not applicable
                  </Button>{" "}
                  <Button variant="ghost" size="sm" onClick={() => setFluidAdd(true)}>
                    Add limit
                  </Button>
                </>
              )}
            </div>
          )}

          <div className="cp-bar">
            {approved ? (
              <>
                <Chip tone="sage">
                  <Check size={14} aria-hidden="true" />
                  English approved
                </Chip>
                <span className="cp-bar-sp" />
                <Button onClick={() => setStep(3)}>
                  Continue to translate <ChevronRight size={16} aria-hidden="true" />
                </Button>
              </>
            ) : (
              <>
                {!flagsOk && (
                  <span className="muted">Resolve all [NEEDS REVIEW] flags first.</span>
                )}
                <span className="cp-bar-sp" />
                <Button
                  disabled={!flagsOk || working}
                  onClick={doApprove}
                  title={flagsOk ? "" : "Resolve all [NEEDS REVIEW] flags first"}
                >
                  <Check size={16} aria-hidden="true" />
                  {working ? "Approving…" : "Approve (English)"}
                </Button>
              </>
            )}
          </div>
        </>
      )}

      {/* STEP 3 — TRANSLATE */}
      {step === 3 && (
        <TranslateStep
          tab={tab}
          setTab={setTab}
          translated={translated}
          esFixed={esFixed}
          setEsFixed={setEsFixed}
          published={published}
          setPublished={setPublished}
          working={working}
          doTranslate={doTranslate}
          toast={toast}
          onContinue={() => setStep(4)}
        />
      )}

      {/* STEP 4 — PUBLISH */}
      {step === 4 && (
        <PublishStep
          published={published}
          planPublished={planPublished}
          doPublish={doPublish}
          working={working}
        />
      )}
    </ProviderShell>
  );
}

/* ---------- Patient preview (review step, English) ---------- */
function PatientPreview({
  thr,
  fluid,
  fluidInput,
}: {
  thr: number | null;
  fluid: "na" | "limit" | null;
  fluidInput: string;
}) {
  const c = ELEANOR_PLAN_CONTENT.en;
  const groups: Array<["new" | "keep" | "stop", string]> = [
    ["new", "NEW — start these"],
    ["keep", "KEEP TAKING"],
    ["stop", "STOP or HOLD"],
  ];
  return (
    <div>
      <h3 className="muted" style={{ margin: "6px 0" }}>
        {c.whyTitle}
      </h3>
      <p>{c.why}</p>
      {groups.map(([k, label]) => (
        <div key={k} className={`cp-pfblock cp-pfblock--${k}`}>
          <b>{label}</b>
          <ul>
            {c.medications[k].map((m) => (
              <li key={m.name}>
                <b>
                  {m.name}
                  {m.dose ? ` ${m.dose}` : ""}
                </b>
                {m.frequency ? `, ${m.frequency}.` : "."}{" "}
                {m.note ?? ""}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <h3 className="muted" style={{ margin: "10px 0 4px" }}>
        Daily to-do
      </h3>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>Eat low salt (about 2 grams of sodium).</li>
        <li>Weigh yourself every morning. Write it down.</li>
        <li>
          {fluid == null
            ? "Follow the fluid plan from your heart team."
            : fluid === "limit"
              ? `Drink no more than ${fluidInput} a day.`
              : "Follow the fluid plan from your heart team."}
        </li>
        <li>Finish your antibiotic.</li>
      </ul>
      <div className="cp-zonebox cp-zonebox--y">
        <b>
          <AlertTriangle size={16} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> Call
          your care team if:
        </b>
        <ul>
          <li>
            {thr != null ? `Your weight goes up ${thr} lb or more` : (
              <mark style={{ background: "var(--amber-bg)", color: "var(--amber-fg)", border: "2px dashed var(--amber)", borderRadius: 6, padding: "0 6px", fontWeight: 700 }}>
                [NEEDS REVIEW] weight-gain number
              </mark>
            )}
          </li>
          <li>Your legs or belly swell more</li>
          <li>You are more short of breath</li>
        </ul>
      </div>
      <div className="cp-zonebox cp-zonebox--r">
        <b>
          <AlertTriangle size={16} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> Go to
          the ER or call 911 if:
        </b>
        <ul>
          {c.warnings.find((w) => w.severity === "red")?.items.map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- Translate step ---------- */
function TranslateStep({
  tab,
  setTab,
  translated,
  esFixed,
  setEsFixed,
  published,
  setPublished,
  working,
  doTranslate,
  toast,
  onContinue,
}: {
  tab: TransLang;
  setTab: (l: TransLang) => void;
  translated: Record<TransLang, boolean>;
  esFixed: boolean;
  setEsFixed: (b: boolean) => void;
  published: Record<string, boolean>;
  setPublished: (p: Record<string, boolean>) => void;
  working: boolean;
  doTranslate: () => void;
  toast: (m: string) => void;
  onContinue: () => void;
}) {
  const LABELS: Record<TransLang, string> = { es: "Spanish", zh: "Mandarin", ar: "Arabic" };
  const content = ELEANOR_PLAN_CONTENT[tab as Language];
  const isBad = tab === "es" && !esFixed;
  const dir = tab === "ar" ? "rtl" : "ltr";

  return (
    <>
      <h1>Translate &amp; verify</h1>
      <p className="muted">
        English is approved. Translate each language, then check the
        back-translation. Drug names and numbers are kept identical.
      </p>
      <div className="cp-tabs" role="tablist">
        {(Object.keys(LABELS) as TransLang[]).map((k) => (
          <button
            key={k}
            className={clsx("cp-tab", tab === k && "cp-tab--on")}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
          >
            <Globe size={16} aria-hidden="true" />
            {LABELS[k]}
            {published[k] ? (
              <Chip tone="sage">Published</Chip>
            ) : translated[k] ? (
              k === "es" && !esFixed ? (
                <Chip tone="red">Blocked</Chip>
              ) : (
                <Chip tone="sage">Verified</Chip>
              )
            ) : null}
          </button>
        ))}
      </div>

      {!translated[tab] ? (
        <Card style={{ textAlign: "center", padding: 36 }}>
          <p className="muted">
            Safety-critical lines are checked by back-translation after translating.
          </p>
          <Button onClick={doTranslate} disabled={working} style={{ marginTop: 8 }}>
            <Globe size={18} aria-hidden="true" />
            {working ? "Translating…" : `Translate to ${LABELS[tab]} (one click)`}
          </Button>
        </Card>
      ) : (
        <>
          <div className="cp-grid2">
            <div>
              <h2 style={{ marginBottom: 8 }}>{LABELS[tab]} patient text</h2>
              <div
                className={clsx("cp-tr-text", isBad && "cp-tr-text--bad", tab === "zh" && "lang-zh", tab === "ar" && "lang-ar")}
                dir={dir}
                lang={tab}
              >
                <p>
                  <b>{content.whyTitle}</b>
                  <br />
                  {content.why}
                </p>
                <p>
                  <b>{tab === "es" ? "NUEVAS" : tab === "zh" ? "新药" : "جديد"}</b>
                  <br />
                  {content.medications.new.map((m) => (
                    <span key={m.name} className="cp-ltr" style={{ display: "block" }}>
                      {m.name} {m.dose}, {m.frequency}
                    </span>
                  ))}
                </p>
                <div
                  style={
                    isBad
                      ? { background: "var(--red-bg)", color: "var(--red-fg)", borderRadius: 8, padding: "4px 8px" }
                      : undefined
                  }
                >
                  <b>
                    {isBad
                      ? "Puede tomar losartan y lisinopril juntos."
                      : content.medications.new.find((m) => m.warning)?.warning}
                  </b>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <Chip tone="sage">
                  <Check size={14} aria-hidden="true" />
                  Drug names &amp; numbers identical
                </Chip>
                {tab === "ar" && <Chip tone="blue">Right-to-left layout</Chip>}
                {tab === "zh" && <Chip tone="blue">Noto Sans SC</Chip>}
              </div>
            </div>
            <div>
              <h2 style={{ marginBottom: 8 }}>Back-translation check</h2>
              {isBad ? (
                <Banner tone="red" icon="alert">
                  <b>High-risk mismatch.</b> Publishing Spanish is blocked until
                  this is fixed.
                  <div style={{ marginTop: 8 }}>
                    <div style={{ background: "var(--sage-bg)", color: "var(--sage-fg)", borderRadius: 8, padding: "6px 10px", margin: "4px 0" }}>
                      <b>Original (EN):</b> “Do not take both. Losartan replaces
                      lisinopril.”
                    </div>
                    <div style={{ background: "var(--red-bg)", color: "var(--red-fg)", borderRadius: 8, padding: "6px 10px", margin: "4px 0" }}>
                      <b>Back-translated (EN):</b> “You may take both losartan and
                      lisinopril.”
                    </div>
                  </div>
                  <Button
                    variant="red"
                    size="sm"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      setEsFixed(true);
                      toast("Spanish corrected. Re-check passed.");
                    }}
                  >
                    Fix translation
                  </Button>
                </Banner>
              ) : (
                <Banner tone="sage" icon="check">
                  All safety-critical lines match the approved English.
                </Banner>
              )}
            </div>
          </div>

          <div className="cp-bar">
            <span className="cp-bar-sp" />
            {published[tab] ? (
              <Chip tone="sage">
                <Check size={14} aria-hidden="true" />
                {LABELS[tab]} published
              </Chip>
            ) : (
              <Button
                disabled={isBad}
                title={isBad ? "Blocked: fix the mismatch first" : ""}
                onClick={() => {
                  setPublished({ ...published, [tab]: true });
                  toast("Published.");
                }}
              >
                Publish {LABELS[tab]}
              </Button>
            )}
            <Button variant="ghost" onClick={onContinue}>
              Continue to publish <ChevronRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </>
      )}
    </>
  );
}

/* ---------- Publish step ---------- */
function PublishStep({
  published,
  planPublished,
  doPublish,
  working,
}: {
  published: Record<string, boolean>;
  planPublished: boolean;
  doPublish: () => void;
  working: boolean;
}) {
  const ex = new Date(Date.now() + 2_592_000 * 1000);
  const dt = ex.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const tm = ex.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <>
      <h1>Ready to publish</h1>
      <div className="cp-grid2" style={{ marginTop: 14 }}>
        <Card>
          <h3 className="muted">Patient link</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <code
              className="tn"
              style={{ background: "var(--panel)", padding: "8px 12px", borderRadius: 10, flex: 1, wordBreak: "break-all" }}
            >
              https://clearpath.rwjbh.example/p/ELN-7Q2K
            </code>
            <Button variant="ghost" size="sm">
              <Copy size={14} aria-hidden="true" />
              Copy
            </Button>
          </div>
          <p style={{ margin: "16px 0 0" }}>
            Languages: <b>English</b>
            {published.es ? ", Spanish" : ""}
            {published.zh ? ", Mandarin" : ""}
            {published.ar ? ", Arabic" : ""}
          </p>
        </Card>
        <div>
          <Banner tone="blue" icon="lock">
            <Chip tone="blue">MOCK: not a real text message</Chip>
            <div style={{ fontSize: 16, marginTop: 6 }}>
              RWJ: Your ClearPath code is 418-203. Expires in 15 minutes.
            </div>
          </Banner>
          <Banner tone="amber" icon="clock">
            This plan expires on <b>{dt}</b> at <b>{tm}</b> (exactly 30 days /
            2,592,000 seconds after creation). Set by the server — not editable.
          </Banner>
        </div>
      </div>
      <div className="cp-bar">
        <span className="cp-bar-sp" />
        {planPublished ? (
          <Chip tone="sage">
            <Check size={14} aria-hidden="true" />
            Published
          </Chip>
        ) : (
          <Button onClick={doPublish} disabled={working}>
            {working ? "Publishing…" : "Publish to patient"}
          </Button>
        )}
      </div>
    </>
  );
}

export default function DischargeWizardPage() {
  return (
    <ToastProvider>
      <WizardInner />
    </ToastProvider>
  );
}
