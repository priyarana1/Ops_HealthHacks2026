"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type ToastCtx = (message: string) => void;

const Ctx = createContext<ToastCtx>(() => {});

/** useToast — fire a transient status message. Must be used under <ToastProvider>. */
export function useToast(): ToastCtx {
  return useContext(Ctx);
}

/** ToastProvider — renders a single polite live-region toast at a time. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);

  const show = useCallback((message: string) => setMsg(message), []);

  useEffect(() => {
    if (msg === null) return;
    const t = setTimeout(() => setMsg(null), 3600);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <Ctx.Provider value={show}>
      {children}
      {msg !== null && (
        <div className="cp-toast" role="status">
          {msg}
        </div>
      )}
    </Ctx.Provider>
  );
}
