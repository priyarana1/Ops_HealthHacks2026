"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/ui/Brand";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { clsx } from "@/lib/clsx";
import { api } from "@/components/client-api";

type Role = "Nurse" | "Hospitalist" | "Patient";

/**
 * Provider sign-in. Mirrors ProviderApp.html: role-segmented control where the
 * Patient role is blocked (patients use their mobile link instead). Credentials are
 * checked by the server, which sets an HttpOnly session cookie.
 */
export default function SignInPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("Nurse");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<"bad" | "patient" | "server" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (role === "Patient") return setError("patient");
    if (!email || !password) return setError("bad");
    setBusy(true);
    setError(null);
    try {
      await api("auth/signin", "POST", { email, password });
    } catch (e) {
      const text = (e as Error).message;
      setMessage(text);
      setBusy(false);
      return setError(/invalid sign-in/i.test(text) ? "bad" : "server");
    }
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
        <p className="muted">Clinical staff access.</p>

        {error === "bad" && (
          <Banner tone="red" icon="alert">
            Email or password not recognized.
          </Banner>
        )}
        {error === "server" && (
          <Banner tone="red" icon="alert">
            {message || "Sign-in is unavailable. Try again."}
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
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
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
          onKeyDown={(e) => e.key === "Enter" && signIn()}
          autoComplete="current-password"
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

        <Button style={{ width: "100%", marginTop: 10 }} onClick={signIn} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <p className="muted" style={{ fontSize: 13, margin: "14px 0 0" }}>
          Use your ClearPath provider account. Pick Patient to see the blocked state.
        </p>
      </div>
    </div>
  );
}
