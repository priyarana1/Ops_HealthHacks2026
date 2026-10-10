"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/ui/Brand";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Banner } from "@/components/ui/Banner";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { clsx } from "@/lib/clsx";
import {
  AlertTriangle,
  ShieldCheck,
  User,
  Siren,
  Phone,
  Clock,
  Database,
  Lock,
  X,
  Check,
  MessageCircle,
  Calendar,
  Minus,
} from "lucide-react";
import {
  ESCALATIONS,
  ELEANOR_WEIGHTS,
  makeAudit,
  type AuditRow,
  type Zone,
  type Escalation,
} from "@/mocks/coordinator";

function ZoneChip({ zone }: { zone: Zone }) {
  if (zone === "red")
    return (
      <Chip tone="red">
        <Siren size={14} aria-hidden="true" />
        Red · call 911 advised
      </Chip>
    );
  if (zone === "yellow")
    return (
      <Chip tone="amber">
        <Phone size={14} aria-hidden="true" />
        Yellow · call today
      </Chip>
    );
  if (zone === "gray")
    return (
      <Chip tone="gray">
        <Minus size={14} aria-hidden="true" />
        No check-in
      </Chip>
    );
  return <span className="muted">—</span>;
}

const utc = (t: number) =>
  new Date(t).toISOString().slice(0, 19).replace("T", " ") + "Z";
function timeLeft(t: number) {
  const ms = t - Date.now();
  if (ms <= 0) return "Expired";
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  return `${d}d ${String(h).padStart(2, "0")}h left`;
}

function CoordinatorInner() {
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<"esc" | "audit">("esc");
  const [mode, setMode] = useState<"demo" | "prod">("demo");
  const [audit, setAudit] = useState<AuditRow[]>(() => makeAudit());
  const [tt, setTt] = useState(false);
  const [drawer, setDrawer] = useState<Escalation | null>(null);

  // Live countdown refresh (every 30s) for the audit table.
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(i);
  }, []);

  function timeTravel() {
    const row = audit.find((a) => a.id === "DSC-7Q2K" && a.state === "live");
    if (!row) return;
    setAudit((prev) =>
      prev
        .filter((a) => a.id !== "DSC-7Q2K")
        .concat({
          id: "DSC-7Q2K",
          event: "purged",
          created: row.created,
          exp: Date.now(),
          del: Date.now(),
          items: "audio, transcript, translations, chat logs",
          state: "purged",
        }),
    );
    setTt(true);
    toast("Record expired and purged. No PHI retained.");
  }

  function resetDemo() {
    setAudit(makeAudit());
    setTt(false);
  }

  const red = ESCALATIONS.filter((r) => r.zone === "red").length;
  const yel = ESCALATIONS.filter((r) => r.zone === "yellow").length;
  const flags = ESCALATIONS.filter((r) => r.flag).length;
  const live7Q2K = audit.find((a) => a.id === "DSC-7Q2K" && a.state === "live");
  const ex7Q2K = audit.find((a) => a.id === "DSC-7Q2K");

  return (
    <div className="cp-app cp-coordinator">
      <aside className="cp-rail" aria-label="Main navigation">
        <div className="cp-brand">
          <Brand size={28} />
        </div>
        <button
          className={clsx("cp-nav", view === "esc" && "cp-nav--on")}
          onClick={() => setView("esc")}
        >
          <AlertTriangle size={18} aria-hidden="true" />
          <span className="cp-lbl">Escalations</span>
        </button>
        <button
          className={clsx("cp-nav", view === "audit" && "cp-nav--on")}
          onClick={() => setView("audit")}
        >
          <ShieldCheck size={18} aria-hidden="true" />
          <span className="cp-lbl">Audit &amp; Purge</span>
        </button>
        <span className="cp-rail-sp" />
        <small>Synthetic data only</small>
      </aside>

      <div className="cp-main">
        <header className="cp-topbar">
          <span className="cp-role">
            <User size={16} aria-hidden="true" />
            Role: Care Coordinator — Sam Ortiz
          </span>
          <span className="cp-topbar-sp" />
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 700, fontSize: 13 }}>
            Mode:
            <span className="cp-seg-mode" role="group" aria-label="Mode">
              <button
                className={clsx(mode === "demo" && "cp-seg--on")}
                aria-pressed={mode === "demo"}
                onClick={() => setMode("demo")}
              >
                Demo
              </button>
              <button
                className={clsx(mode === "prod" && "cp-seg--on")}
                aria-pressed={mode === "prod"}
                onClick={() => setMode("prod")}
              >
                Production
              </button>
            </span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            Exit
          </Button>
        </header>

        <div className="cp-content">
          {view === "esc" ? (
            <>
              <div className="cp-page-heading"><div><span className="cp-eyebrow">CARE COORDINATION</span><h1>Who needs attention</h1><p className="muted">A clear view of your patients. Start with those who need you most.</p></div><Chip tone="sage"><Check size={14} aria-hidden="true" />{ESCALATIONS.length} patients monitored</Chip></div>
              <div className="cp-stats" aria-label="Summary">
                <span className="cp-stat" style={{ background: "var(--red-bg)", color: "var(--red-fg)" }}>
                  <Siren size={16} aria-hidden="true" />
                  <span><b>{red}</b><small>Urgent follow-up</small></span>
                </span>
                <span className="cp-stat" style={{ background: "var(--amber-bg)", color: "var(--amber-fg)" }}>
                  <Phone size={16} aria-hidden="true" />
                  <span><b>{yel}</b><small>Call today</small></span>
                </span>
                <span className="cp-stat" style={{ background: "var(--blue-bg)", color: "var(--blue-fg)" }}>
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span><b>{flags}</b><small>Needs a check-in</small></span>
                </span>
              </div>
              <div className="cp-card cp-scroll-x" style={{ padding: "6px 8px" }}>
                <div className="cp-queue-heading"><h2>Patient follow-up queue</h2><span className="muted">Latest check-ins</span></div><table className="cp-table">
                  <thead>
                    <tr>
                      <th>Patient (synthetic)</th>
                      <th>Zone</th>
                      <th>Trigger</th>
                      <th>Flag</th>
                      <th>Last check-in</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {ESCALATIONS.map((r) => (
                      <tr key={r.id} data-zone={r.zone}>
                        <td>
                          <div className="cp-patient-cell"><span className="cp-avatar" aria-hidden="true">{r.name.split(" ").map((n) => n[0]).join("")}</span><span><b>{r.name}</b><small>{r.dx}</small></span></div>
                        </td>
                        <td>
                          <ZoneChip zone={r.zone} />
                        </td>
                        <td>{r.trigger || "—"}</td>
                        <td>
                          {r.flag ? (
                            <Chip tone="blue">
                              {r.kind === "mh" ? (
                                <MessageCircle size={14} aria-hidden="true" />
                              ) : r.kind === "appt" ? (
                                <Calendar size={14} aria-hidden="true" />
                              ) : (
                                <Clock size={14} aria-hidden="true" />
                              )}
                              {r.flag}
                            </Chip>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="tn">{r.last}</td>
                        <td>
                          <Button variant="ghost" size="sm" onClick={() => setDrawer(r)}>
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                Synthetic patient data · Open a patient to review their follow-up needs.
              </p>
            </>
          ) : (
            <>
              <h1>Audit &amp; data lifecycle</h1>
              <div className="cp-stats" style={{ marginTop: 14 }}>
                <Chip tone="sage">
                  <Lock size={14} aria-hidden="true" />
                  TLS in transit: ON
                </Chip>
                <Chip tone="sage">
                  <ShieldCheck size={14} aria-hidden="true" />
                  Encryption at rest: ON
                </Chip>
                <Chip tone="sage">
                  <Database size={14} aria-hidden="true" />
                  Synthetic data only: ON
                </Chip>
              </div>

              <Card>
                <h2>No-PHI audit log</h2>
                <p className="muted" style={{ fontSize: 13 }}>
                  No names, diagnoses, or plan text are ever stored here.
                </p>
                <div className="cp-scroll-x">
                  <table className="cp-table">
                    <thead>
                      <tr>
                        <th>discharge_id</th>
                        <th>event</th>
                        <th>created_at</th>
                        <th>expires_at</th>
                        <th>countdown</th>
                        <th>deleted_at</th>
                        <th>deleted_items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.map((a) => (
                        <tr key={a.id + a.state}>
                          <td className="cp-mono">
                            <b>{a.id}</b>
                          </td>
                          <td>
                            <Chip tone={a.event === "purged" ? "gray" : "blue"}>
                              {a.event}
                            </Chip>
                          </td>
                          <td className="tn cp-mono">{utc(a.created)}</td>
                          <td className="tn cp-mono">{utc(a.exp)}</td>
                          <td className="tn">
                            {a.state === "live" ? (
                              timeLeft(a.exp)
                            ) : (
                              <Chip tone="gray">Expired</Chip>
                            )}
                          </td>
                          <td className="tn cp-mono">{a.del ? utc(a.del) : "—"}</td>
                          <td>{a.items}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card>
                <h2>Server-set expiry proof</h2>
                <p style={{ margin: "6px 0 0" }}>
                  <span className="cp-mono">
                    expires_at = created_at + 2,592,000 seconds (30 days).
                  </span>{" "}
                  Set by the server. Not editable.
                </p>
                <div className="cp-lockfield" aria-label="expires_at, locked">
                  <Lock size={18} aria-hidden="true" />
                  <span className="cp-mono tn">
                    {ex7Q2K ? utc(ex7Q2K.exp) : "—"}
                  </span>
                  <Chip tone="gray"><span style={{ marginLeft: "auto" }}>read-only</span></Chip>
                </div>
              </Card>

              {mode === "demo" ? (
                <Card>
                  <h2>Prove the self-destruct</h2>
                  <p className="muted">
                    Instead of waiting 30 days, this control moves the clock
                    forward for one record and runs the same purge job.
                  </p>
                  <Button
                    variant="amber"
                    disabled={!(live7Q2K && !tt)}
                    onClick={timeTravel}
                    style={{ borderWidth: 3 }}
                  >
                    <Clock size={18} aria-hidden="true" />
                    DEMO ONLY — Time-Travel: expire DSC-7Q2K now
                  </Button>
                  {tt && (
                    <Button variant="ghost" onClick={resetDemo} style={{ marginLeft: 8 }}>
                      Reset demo
                    </Button>
                  )}
                </Card>
              ) : (
                <Banner tone="blue" icon="lock">
                  Time-Travel is hidden in Production mode. The endpoint returns
                  403.
                </Banner>
              )}

              {tt && (
                <Card>
                  <h2>Verification</h2>
                  <p className="muted">
                    Independent checks that nothing is left behind.
                  </p>
                  <div className="cp-proof">
                    <Card>
                      <div className="cp-mono">
                        Database query: GET /discharges/DSC-7Q2K
                      </div>
                      <p className="cp-mono" style={{ margin: "10px 0" }}>
                        → 404 — no document found.
                      </p>
                      <Chip tone="red">
                        <X size={14} aria-hidden="true" />
                        not found
                      </Chip>
                    </Card>
                    <Card>
                      <div className="cp-mono">
                        Audio storage: GET /audio/DSC-7Q2K.mp3
                      </div>
                      <p className="cp-mono" style={{ margin: "10px 0" }}>
                        → Not found (object purged).
                      </p>
                      <Chip tone="red">
                        <X size={14} aria-hidden="true" />
                        not found
                      </Chip>
                    </Card>
                  </div>
                  <p style={{ margin: "12px 0 0" }}>
                    <b>The patient link now shows the expired page.</b>
                  </p>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Patient drawer */}
      {drawer && (
        <>
          <div className="cp-drawer-bg" onClick={() => setDrawer(null)} />
          <aside className="cp-drawer" role="dialog" aria-modal="true" aria-labelledby="dH">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <h2 id="dH">
                  {drawer.name} · {drawer.dx}
                </h2>
                <div style={{ marginTop: 8 }}>
                  {drawer.zone ? (
                    <ZoneChip zone={drawer.zone} />
                  ) : (
                    <Chip tone="blue">
                      <AlertTriangle size={14} aria-hidden="true" />
                      Flag
                    </Chip>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDrawer(null)} aria-label="Close">
                <X size={16} aria-hidden="true" />
                Close
              </Button>
            </div>

            {drawer.kind === "weight" && (
              <Card style={{ marginTop: 18 }}>
                <h3 className="muted" style={{ marginBottom: 6 }}>
                  Weight trend, last 7 days
                </h3>
                <WeightChart />
              </Card>
            )}

            <Banner tone="amber" icon="alert">
              <b>Recommended action</b>
              <div style={{ fontWeight: 400 }}>
                {RECOMMENDED[drawer.kind]}
              </div>
            </Banner>
            <p className="muted" style={{ fontSize: 13 }}>
              Synthetic data. This view shows only what is needed for follow-up.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <Button
                onClick={() => {
                  toast("Marked as contacted.");
                  setDrawer(null);
                }}
              >
                <Check size={16} aria-hidden="true" />
                Mark contacted
              </Button>
              <Button variant="ghost" onClick={() => setDrawer(null)}>
                Close
              </Button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

const RECOMMENDED: Record<Escalation["kind"], string> = {
  weight: "Call patient to review the weight plan.",
  chest: "Call the patient now to confirm they called 911 or have been seen.",
  swell: "Call patient to review the weight plan.",
  nocheck: "Call to check in and remind the patient about the daily check-in.",
  mh: "Call the patient today and offer follow-up support.",
  appt: "Help the patient schedule the urology visit.",
};

/** Inline SVG weight trend (ported from CoordinatorApp.html). */
function WeightChart() {
  const w = 420, h = 210, l = 46, b = 36, t = 14, r = 14, min = 178, max = 188;
  const n = ELEANOR_WEIGHTS.length;
  const x = (i: number) => l + (i * (w - l - r)) / (n - 1);
  const y = (v: number) => t + ((max - v) * (h - t - b)) / (max - min);
  const pts = ELEANOR_WEIGHTS.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      role="img"
      aria-label="Weight trend over 7 days: steady near 182 pounds, then 186 pounds today"
      style={{ maxWidth: w }}
    >
      {[178, 180, 182, 184, 186, 188].map((v) => (
        <g key={v}>
          <line x1={l} x2={w - r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
            {v}
          </text>
        </g>
      ))}
      <polyline points={pts} fill="none" stroke="var(--ink-soft)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {ELEANOR_WEIGHTS.map((v, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(v)}
          r={i === n - 1 ? 7 : 4}
          fill={i === n - 1 ? "var(--amber)" : "var(--card)"}
          stroke={i === n - 1 ? "var(--amber-fg)" : "var(--ink-soft)"}
          strokeWidth="2.5"
        />
      ))}
    </svg>
  );
}

export default function CoordinatorPage() {
  return (
    <ToastProvider>
      <CoordinatorInner />
    </ToastProvider>
  );
}
