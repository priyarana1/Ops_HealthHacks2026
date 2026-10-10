import { PatientApp } from "@/components/patient/PatientApp";

/**
 * Patient portal, reached via a secure per-plan link: /p/<token>.
 *
 * In production the token would be validated server-side and gate access to the
 * approved plan (with OTP). In this demo the token is accepted and the OTP step
 * (code 418203) runs client-side against synthetic data. No PHI is stored client-side.
 */
export default async function PatientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // Token is awaited to match the real route contract; unused in the mock.
  await params;
  return <PatientApp />;
}
