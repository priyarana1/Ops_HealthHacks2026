import { clsx } from "@/lib/clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "red" | "amber";
type Size = "md" | "sm" | "big";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/**
 * Button — mirrors the `.btn` family in the Blueprint prototypes.
 * Variants: primary (teal), ghost (outline), red (destructive/emergency),
 * amber (caution). Sizes: md (default), sm (compact), big (patient-facing).
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "cp-btn",
        variant === "ghost" && "cp-btn--ghost",
        variant === "red" && "cp-btn--red",
        variant === "amber" && "cp-btn--amber",
        size === "sm" && "cp-btn--sm",
        size === "big" && "cp-btn--big",
        className,
      )}
      {...rest}
    />
  );
}
