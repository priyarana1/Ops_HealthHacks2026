import { clsx } from "@/lib/clsx";
import type { ReactNode } from "react";
import { AlertTriangle, Lock, RefreshCw, CheckCircle2, Clock } from "lucide-react";

type Tone = "red" | "amber" | "sage" | "blue";

const ICONS: Record<Tone, typeof AlertTriangle> = {
  red: AlertTriangle,
  amber: AlertTriangle,
  sage: CheckCircle2,
  blue: Lock,
};

/** Banner — prominent inline alert. `role="alert"` is applied for red/amber so screen
 *  readers announce safety-critical messages. Icon can be overridden. */
export function Banner({
  tone = "blue",
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: "alert" | "lock" | "refresh" | "check" | "clock";
  children: ReactNode;
  className?: string;
}) {
  const Icon = icon
    ? { alert: AlertTriangle, lock: Lock, refresh: RefreshCw, check: CheckCircle2, clock: Clock }[icon]
    : ICONS[tone];
  const assertive = tone === "red" || tone === "amber";
  return (
    <div
      className={clsx("cp-banner", `cp-banner--${tone}`, className)}
      role={assertive ? "alert" : "status"}
    >
      <Icon size={22} aria-hidden="true" style={{ flex: "none" }} />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
