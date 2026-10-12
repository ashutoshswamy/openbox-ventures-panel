"use client";

import { useEffect, useState } from "react";
import { Users, X } from "lucide-react";
import { Avatar } from "@/components/avatar";

// Header button + a panel that slides in from the right edge of the chat (the chat section is `relative overflow-hidden`).
export function MemberList({ names, me }: { names: string[]; me: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`btn btn-icon ${open ? "bg-surface-2" : ""}`} title="Members" aria-label={`${open ? "Hide" : "Show"} ${names.length} members`}><Users /></button>
      <aside
        inert={!open}
        aria-label="Members"
        className={`absolute top-16 right-0 bottom-0 z-20 flex w-64 max-w-full flex-col border-l border-line bg-surface shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex h-12 shrink-0 items-center justify-between px-4">
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Members · {names.length}</h3>
          <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-icon" aria-label="Close members"><X /></button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {names.map((n) => (
            <li key={n} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
              <Avatar name={n} size="size-8 text-xs" />
              <span className="truncate font-medium">{n}</span>
              {n === me && <span className="text-xs text-muted">(you)</span>}
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
