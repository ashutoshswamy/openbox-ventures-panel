"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Reply, X } from "lucide-react";

type Target = { id: string; who: string; text: string };
const Ctx = createContext<{ target: Target | null; set: (t: Target | null) => void }>({ target: null, set: () => {} });

// Holds "which message am I replying to" between the message list (buttons) and the composer (preview + hidden field).
export function ReplyProvider({ children }: { children: React.ReactNode }) {
  const [target, set] = useState<Target | null>(null);
  return <Ctx.Provider value={{ target, set }}>{children}</Ctx.Provider>;
}

export function ReplyButton(t: Target) {
  const { set } = useContext(Ctx);
  return (
    <button type="button" onClick={() => set(t)} title="Reply" aria-label={`Reply to ${t.who}`} className="btn btn-ghost btn-icon mb-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-60">
      <Reply className="size-4" />
    </button>
  );
}

// Inside the send form: quoted preview + reply_to field. Cleared when the form resets (after a send).
export function ReplyField() {
  const { target, set } = useContext(Ctx);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    const clear = () => set(null);
    form?.addEventListener("reset", clear);
    return () => form?.removeEventListener("reset", clear);
  }, [set]);
  useEffect(() => {
    if (target) ref.current?.closest("form")?.querySelector<HTMLInputElement>("input[name=body]")?.focus();
  }, [target]);
  return (
    <div ref={ref} className="w-full empty:hidden">
      {target && (
        <div className="mb-1 flex items-center gap-2 rounded-xl border-l-4 border-l-primary bg-surface-2 px-3 py-2 text-xs">
          <input type="hidden" name="reply_to" value={target.id} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-semibold">{target.who}</div>
            <div className="truncate text-muted">{target.text}</div>
          </div>
          <button type="button" onClick={() => set(null)} className="btn btn-ghost btn-icon" aria-label="Cancel reply"><X className="size-4" /></button>
        </div>
      )}
    </div>
  );
}
