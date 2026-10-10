import { clsx } from "@/lib/clsx";
import type { ReactNode } from "react";

type Tone = "gray" | "sage" | "amber" | "red" | "blue";

/** Chip — small status/label pill. Tones carry the same semantic meaning everywhere:
 *  sage = good/done, amber = caution, red = danger, blue = info, gray = neutral. */
export function Chip({
  tone = "gray",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={clsx("cp-chip", `cp-chip--${tone}`, className)}>
      {children}
    </span>
  );
}
