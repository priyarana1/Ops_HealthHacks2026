"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProviderShell } from "@/components/provider/ProviderShell";
import { StatusChip } from "@/components/provider/StatusChip";
import { Button } from "@/components/ui/Button";
import { ToastProvider } from "@/components/ui/Toast";
import { Banner } from "@/components/ui/Banner";
import { Plus } from "lucide-react";
import { DISCHARGE_LIST, DEMO_PLAN_ID } from "@/mocks/discharges";
import { LANGUAGE_LABELS } from "@/types/plan";
import type { DischargeListItem } from "@/types/patient";
import { api } from "@/components/client-api";
import { planStatus } from "@/lib/discharge-status";
import { shortDiagnosis } from "@/lib/plan-adapter";

interface EpisodeRow { planId: string; state: string; createdAt: string; displayName: string | null; diagnosis: string | null }
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const toRow = (e: EpisodeRow): DischargeListItem => ({ planId: e.planId, patientName: e.displayName ?? "Unnamed patient", mrn: "—", diagnosis: (e.diagnosis && shortDiagnosis([e.diagnosis])) || "Draft not generated yet", languages: ["en"], status: planStatus(e.state), lastUpdated: when(e.createdAt), openable: true });
// Eleanor's scripted walkthrough stays available as a labelled demo row.
const demoRow = DISCHARGE_LIST.find((row) => row.planId === DEMO_PLAN_ID)!;

function DashboardInner() {
  const router = useRouter();
  const [rows, setRows] = useState<DischargeListItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("discharges").then((r: { episodes: EpisodeRow[] }) => setRows(r.episodes.map(toRow))).catch((e) => setError(e.message));
  }, []);

  return (
    <ProviderShell active="dash" crumb="Heart-failure discharges">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <h1>Heart-failure discharges</h1>
        <span style={{ flex: 1 }} />
        <Button onClick={() => router.push("/provider/discharge/new")}>
          <Plus size={18} aria-hidden="true" />
          New discharge
        </Button>
      </div>

      {error && <Banner tone="red" icon="alert">{error}</Banner>}
      <div className="cp-card cp-scroll-x" style={{ padding: "6px 8px" }}>
        <table className="cp-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>MRN</th>
              <th>Diagnosis</th>
              <th>Language(s)</th>
              <th>Status</th>
              <th>Last updated</th>
              <th>
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows === null && !error && (
              <tr><td colSpan={7} className="muted">Loading discharges…</td></tr>
            )}
            {[...(rows ?? []), demoRow].map((row) => (
              <tr key={row.planId}>
                <td>
                  <b>{row.patientName}</b>
                </td>
                <td className="tn">{row.mrn}</td>
                <td>{row.diagnosis}</td>
                <td>
                  {row.languages.map((l) => LANGUAGE_LABELS[l]).join(", ")}
                </td>
                <td>
                  <StatusChip status={row.status} />
                </td>
                <td className="tn">{row.lastUpdated}</td>
                <td>
                  <Link
                    className="cp-btn cp-btn--ghost cp-btn--sm"
                    href={`/provider/discharge/${row.planId}`}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
        Discharges disappear from this list when their 30-day window ends.
      </p>
    </ProviderShell>
  );
}

export default function ProviderDashboard() {
  return (
    <ToastProvider>
      <DashboardInner />
    </ToastProvider>
  );
}
