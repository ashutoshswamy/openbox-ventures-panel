"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { LABEL, loadManual, setManual, useMyStatus, useStatus, type Shown, type Status } from "@/lib/presence";

const TONE: Record<Shown, string> = {
  online: "bg-green",
  idle: "bg-amber",
  dnd: "bg-red",
  offline: "bg-muted/60",
};

export function Dot({ s, className = "size-2.5" }: { s: Shown; className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-full ${TONE[s]} ${className}`} />;
}

// Corner badge on an avatar. Own status shows too (you appear online to others while this tab is open).
export function StatusDot({ id }: { id: string }) {
  const s = useStatus(id);
  return (
    <span title={LABEL[s]} className="absolute -right-0.5 -bottom-0.5 grid size-3.5 place-items-center rounded-full bg-surface">
      <Dot s={s} />
    </span>
  );
}

const OPTIONS: [Status, string][] = [
  ["online", "Idle after 5 minutes without activity"],
  ["idle", "Show as away"],
  ["dnd", "No sounds, call rings or notifications"],
];

// Discord-style picker: Online / Idle / Do Not Disturb. No invisible mode.
export function StatusPicker({ compact }: { compact?: boolean }) {
  const mine = useMyStatus();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    loadManual();
    const sync = (e: StorageEvent) => e.key === "presence-status" && loadManual(); // other tabs
    const close = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && ref.current.removeAttribute("open");
    addEventListener("storage", sync);
    addEventListener("pointerdown", close);
    return () => { removeEventListener("storage", sync); removeEventListener("pointerdown", close); };
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary className={`btn btn-ghost list-none ${compact ? "btn-icon" : "h-7 px-2 text-xs"}`} aria-label={`Status: ${LABEL[mine]}`} title="Set status">
        <Dot s={mine} className="size-2.5" />
        {!compact && LABEL[mine]}
      </summary>
      <div className="absolute right-0 bottom-full z-30 mb-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-1 shadow-lg lg:right-auto lg:left-0 max-lg:top-full max-lg:bottom-auto max-lg:mt-2 max-lg:mb-0">
        {OPTIONS.map(([s, hint]) => (
          <button
            key={s}
            type="button"
            onClick={() => { setManual(s); ref.current?.removeAttribute("open"); }}
            className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2"
          >
            <Dot s={s} className="mt-1 size-3" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-sm font-medium">{LABEL[s]}</span>
              <span className="block text-xs text-muted">{hint}</span>
            </span>
            {mine === s && <Check className="mt-0.5 size-4 text-muted" />}
          </button>
        ))}
      </div>
    </details>
  );
}
