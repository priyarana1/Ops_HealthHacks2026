import type { DischargeListItem } from "@/types/patient";

/**
 * SYNTHETIC DEMO DATA. Provider dashboard rows, ported from ProviderApp.html.
 * Only Eleanor's discharge is wired up end-to-end; the rest illustrate statuses.
 * "Expired" rows represent records that have already been purged.
 */
export const DISCHARGE_LIST: DischargeListItem[] = [
  {
    planId: "ELN-7Q2K",
    patientName: "Eleanor Okafor",
    mrn: "00-421-889",
    diagnosis: "Heart failure (reduced EF)",
    languages: ["en", "es"],
    status: "approved",
    lastUpdated: "Today 10:12",
    openable: true,
  },
  {
    planId: "ROS-4421",
    patientName: "Rosa Delgado",
    mrn: "00-553-204",
    diagnosis: "HFpEF, AFib, cellulitis",
    languages: ["en"],
    status: "draft",
    lastUpdated: "Today 09:40",
    openable: false,
  },
  {
    planId: "WAL-1183",
    patientName: "Walter Brennan",
    mrn: "00-118-337",
    diagnosis: "Heart failure with pneumonia",
    languages: ["en", "es"],
    status: "approved",
    lastUpdated: "Yesterday",
    openable: false,
  },
  {
    planId: "MEI-9025",
    patientName: "Mei Chen",
    mrn: "00-902-551",
    diagnosis: "Heart failure with kidney injury",
    languages: ["en", "zh"],
    status: "expired",
    lastUpdated: "32 days ago",
    openable: false,
  },
];
