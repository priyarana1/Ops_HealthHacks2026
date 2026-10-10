"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/ui/Brand";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { clsx } from "@/lib/clsx";

type Role = "Nurse" | "Hospitalist" | "Patient";

/**
 * Provider sign-in. Mirrors ProviderApp.html: role-segmented control where the
 * Patient role is blocked (patients use their mobile link instead). This is a demo
 * gate — no credentials are transmitted or stored. Any password works except "wrong".
 */
export default function SignInPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("Nurse");
  const [password, setPassword] = useState("correct-horse-battery");
  const [error, setError] = useState<"bad" | "patient" | null>(null);

  function signIn() {
    if (!password || password === "wrong") return setError("bad");
    if (role === "Patient") return setError("patient");
    // Persist the chosen role for the shell greeting (demo only, no PHI).
    try {
      sessionStorage.setItem("cp_role", role);
    } catch {
      /* ignore storage errors */
    }
    router.push("/provider");
  }

  return (
    <div className="cp-login">
      <div className="cp-card">
        <Brand size={30} />
        <h1 style={{ margin: "18px 0 6px" }}>Provider sign-in</h1>
        <p className="muted">Clinical staff access · Demonstration environment.</p>

        {error === "bad" && (
          <Banner tone="red" icon="alert">
            Email or password not recognized.
          </Banner>
        )}
        {error === "patient" && (
          <Banner tone="red" icon="lock">
            Access denied. This portal is for clinical staff. Patients receive a
            secure mobile link.
          </Banner>
        )}

        <label className="cp-label" htmlFor="em">
          Email
        </label>
        <input
          id="em"
          className="cp-input"
          defaultValue="priya.nair@rwjbh.example"
          autoComplete="off"
        />

        <label className="cp-label" htmlFor="pw">
          Password
        </label>
        <input
          id="pw"
          className="cp-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <label className="cp-label">Role</label>
        <div className="cp-seg" role="group" aria-label="Role">
          {(["Nurse", "Hospitalist", "Patient"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              className={clsx(
                role === r && "cp-seg--on",
                r === "Patient" && "cp-seg--dis",
              )}
              aria-pressed={role === r}
              onClick={() => setRole(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          Patients use the mobile link, not this portal.
        </p>

        <Button style={{ width: "100%", marginTop: 10 }} onClick={signIn}>
          Sign in
        </Button>
        <p className="muted" style={{ fontSize: 13, margin: "14px 0 0" }}>
          Prototype: any password works except &quot;wrong&quot;. Pick Patient to
          see the blocked state.
        </p>
      </div>
    </div>
  );
}
