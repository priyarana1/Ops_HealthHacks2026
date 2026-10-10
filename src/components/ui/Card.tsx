import { clsx } from "@/lib/clsx";
import type { HTMLAttributes } from "react";

type Tone = "default" | "sage" | "amber" | "red" | "blue" | "gray";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
}

/** Card — the primary surface in all three prototypes. Tones tint the surface for
 *  medication groups and status callouts. */
export function Card({ tone = "default", className, ...rest }: CardProps) {
  return (
    <div
      className={clsx("cp-card", tone !== "default" && `cp-card--${tone}`, className)}
      {...rest}
    />
  );
}
