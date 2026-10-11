"use client";

import { use } from "react";
import EleanorWizard from "@/components/provider/demo/EleanorWizard";
import { DischargeWizard } from "@/components/provider/DischargeWizard";
import { DEMO_PLAN_ID } from "@/mocks/discharges";

/**
 * /provider/discharge/new starts a real discharge; /provider/discharge/<planId> continues one.
 * The Eleanor demo ID keeps the scripted Blueprint walkthrough (sample data, no AI) as a fallback.
 */
export default function DischargePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return id === DEMO_PLAN_ID ? <EleanorWizard /> : <DischargeWizard id={id} />;
}
