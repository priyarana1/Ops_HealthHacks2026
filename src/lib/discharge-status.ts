import type { PlanStatus } from "@/types/plan";

/** Maps a backend discharge state onto the frontend's plan status chips. */
export function planStatus(state: string): PlanStatus {
  switch (state) {
    case "PENDING_REVIEW":
      return "needs_review";
    case "APPROVED":
    case "ACCESS_GRANTED":
    case "ACTIVE":
      return "approved";
    case "REVOKED":
      return "needs_reapproval";
    case "EXPIRED":
      return "expired";
    default:
      return "draft";
  }
}
