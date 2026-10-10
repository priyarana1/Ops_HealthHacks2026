"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProviderShell } from "@/components/provider/ProviderShell";
import { StatusChip } from "@/components/provider/StatusChip";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { Plus } from "lucide-react";
import { DISCHARGE_LIST } from "@/mocks/discharges";
import { LANGUAGE_LABELS } from "@/types/plan";

function DashboardInner() {
  const router = useRouter();
  const toast = useToast();

  return (
    <ProviderShell active="dash" crumb="Heart-failure discharges">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <h1>Heart-failure discharges</h1>
        <span style={{ flex: 1 }} />
        <Button onClick={() => router.push("/provider/discharge/ELN-7Q2K")}>
          <Plus size={18} aria-hidden="true" />
          New discharge
        </Button>
      </div>

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
            {DISCHARGE_LIST.map((row) => (
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
                  {row.openable ? (
                    <Link
                      className="cp-btn cp-btn--ghost cp-btn--sm"
                      href={`/provider/discharge/${row.planId}`}
                    >
                      Open
                    </Link>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toast("Prototype: only Eleanor's discharge is wired up.")
                      }
                    >
                      Open
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
        All names and MRNs are synthetic. &quot;Expired&quot; records have already
        been deleted.
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
