import { Chip } from "@/components/ui/Chip";
import { Pencil, Eye, Check, RefreshCw, Clock } from "lucide-react";
import type { PlanStatus } from "@/types/plan";

const MAP: Record<
  PlanStatus,
  { tone: "gray" | "amber" | "sage"; label: string; Icon: typeof Pencil }
> = {
  draft: { tone: "gray", label: "Draft", Icon: Pencil },
  needs_review: { tone: "amber", label: "Needs review", Icon: Eye },
  approved: { tone: "sage", label: "Approved", Icon: Check },
  needs_reapproval: { tone: "amber", label: "Needs re-approval", Icon: RefreshCw },
  expired: { tone: "gray", label: "Expired", Icon: Clock },
};

/** Renders a consistent status chip for a discharge plan. */
export function StatusChip({ status }: { status: PlanStatus }) {
  const { tone, label, Icon } = MAP[status];
  return (
    <Chip tone={tone}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </Chip>
  );
}
