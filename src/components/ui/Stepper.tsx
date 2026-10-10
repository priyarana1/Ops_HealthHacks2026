import { clsx } from "@/lib/clsx";
import { Check } from "lucide-react";

/** Stepper — the 5-step discharge wizard progress indicator from ProviderApp.html.
 *  Completed steps show a check; the current step is marked aria-current. */
export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="cp-stepper" role="list" aria-label="Discharge steps">
      {steps.map((label, i) => {
        const state = i === current ? "on" : i < current ? "done" : "todo";
        return (
          <div
            key={label}
            role="listitem"
            className={clsx("cp-step", state === "on" && "cp-step--on", state === "done" && "cp-step--done")}
            aria-current={state === "on" ? "step" : undefined}
          >
            <b>{i < current ? <Check size={14} aria-hidden="true" /> : i + 1}</b>
            {label}
          </div>
        );
      })}
    </div>
  );
}
