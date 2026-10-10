"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/ui/Brand";
import { Button } from "@/components/ui/Button";
import { LayoutGrid, Plus, User } from "lucide-react";
import { clsx } from "@/lib/clsx";
import type { ReactNode } from "react";

/**
 * Provider portal shell: fixed teal navigation rail + topbar, ported from
 * ProviderApp.html. `active` controls nav highlighting; `crumb` sets the topbar title.
 */
export function ProviderShell({
  active,
  crumb,
  children,
}: {
  active: "dash" | "new";
  crumb: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [role, setRole] = useState("Nurse — Priya Nair, RN");

  useEffect(() => {
    try {
      const r = sessionStorage.getItem("cp_role");
      if (r === "Hospitalist") setRole("Hospitalist — Dr. Alan Lee, MD");
      else if (r === "Nurse") setRole("Nurse — Priya Nair, RN");
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="cp-app">
      <aside className="cp-rail" aria-label="Main navigation">
        <div className="cp-brand">
          <Brand size={28} onDark />
        </div>
        <Link
          href="/provider"
          className={clsx("cp-nav", active === "dash" && "cp-nav--on")}
        >
          <LayoutGrid size={18} aria-hidden="true" />
          <span className="cp-lbl">Dashboard</span>
        </Link>
        <Link
          href="/provider/discharge/ELN-7Q2K"
          className={clsx("cp-nav", active === "new" && "cp-nav--on")}
        >
          <Plus size={18} aria-hidden="true" />
          <span className="cp-lbl">New discharge</span>
        </Link>
        <span className="cp-rail-sp" />
        <small>Synthetic data only</small>
      </aside>
      <div className="cp-main">
        <header className="cp-topbar">
          <h3 id="crumb">{crumb}</h3>
          <span className="cp-topbar-sp" />
          <span className="cp-role">
            <User size={16} aria-hidden="true" />
            <span>Role: {role}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/signin")}
          >
            Sign out
          </Button>
        </header>
        <div className="cp-content">{children}</div>
      </div>
    </div>
  );
}
