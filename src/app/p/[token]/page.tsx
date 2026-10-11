import { PatientApp } from "@/components/patient/PatientApp";
import { PatientPortal } from "@/components/patient/PatientPortal";
import { DEMO_PLAN_ID } from "@/mocks/discharges";

/**
 * Patient portal, reached via a secure per-plan link: /p/<token>.
 *
 * Real links are validated server-side; the patient enters the 6-digit code from their care team
 * and then sees their clinician-approved plan. The Eleanor demo link keeps the sample walkthrough
 * (demo code 418203, synthetic data, no server calls).
 */
export default async function PatientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return token === DEMO_PLAN_ID ? <PatientApp /> : <PatientPortal token={token} />;
}
