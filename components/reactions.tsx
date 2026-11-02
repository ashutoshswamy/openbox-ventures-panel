"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Plus, SmilePlus } from "lucide-react";
import { react } from "@/app/(employee)/actions";

const EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
// Full emoji list: the web component loads on demand, in the current theme.
function Full({ onPick }: { onPick: (e: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let el: HTMLElement | undefined;
    const pick = (ev: Event) => onPick((ev as CustomEvent).detail.unicode);
    import("emoji-picker-element").then(() => {
      el = document.createElement("emoji-picker");
      el.setAttribute("data-source", "/emoji-en.json"); // self-hosted: the CSP blocks the default CDN
      el.className = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      el.addEventListener("emoji-click", pick);
      ref.current?.append(el);
    });
    return () => { el?.removeEventListener("emoji-click", pick); el?.remove(); };
  }, [onPick]);
  return <div ref={ref} />;
}

type R = { emoji: string; employee_id: string };

// Reaction chips under a bubble + a picker button. Click a chip or emoji to toggle mine; server refresh (live) confirms.
export function Reactions({ id, channelId, reactions, meId, mine, canReact }: { id: string; channelId: string; reactions: R[]; meId: string; mine: boolean; canReact: boolean }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [, start] = useTransition();
  const [list, toggle] = useOptimistic(reactions, (cur, e: string) =>
    cur.some((r) => r.emoji === e && r.employee_id === meId) ? cur.filter((r) => !(r.emoji === e && r.employee_id === meId)) : [...cur, { emoji: e, employee_id: meId }]);
  const go = (e: string) => {
    setOpen(false);
    setFull(false);
    start(async () => { toggle(e); await react(id, e, channelId); });
  };
  const counts = [...new Set(list.map((r) => r.emoji))].map((e) => ({ e, n: list.filter((r) => r.emoji === e).length, me: list.some((r) => r.emoji === e && r.employee_id === meId) })).filter((c) => c.n);
  return (
    <>
      {counts.length > 0 && (
        <div className={`-mt-1.5 flex flex-wrap gap-1 ${mine ? "justify-end pr-2" : "pl-2"}`}>
          {counts.map((c) => (
            <button key={c.e} type="button" disabled={!canReact} onClick={() => go(c.e)} aria-pressed={c.me} aria-label={`${c.e} ${c.n}`} title={c.me ? "Click to remove your reaction" : "Click to react too"}
              className={`cursor-pointer rounded-full border px-1.5 py-0.5 text-xs leading-none transition-colors ${c.me ? "border-primary bg-primary/10 hover:bg-red-soft" : "border-line bg-surface hover:bg-surface-2"}`}>
              {c.e} {c.n > 1 && <span className="tabular-nums">{c.n}</span>}
            </button>
          ))}
        </div>
      )}
      {canReact && (
        <span className={`absolute -top-3 ${mine ? "left-2" : "right-2"}`}>
          <button type="button" onClick={() => setOpen(!open)} title="React" aria-label="React" aria-expanded={open} className="btn btn-icon size-6 rounded-full border border-line bg-surface opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-60">
            <SmilePlus className="size-3.5" />
          </button>
          {open && full && <span className={`absolute top-full z-10 mt-1 ${mine ? "left-0" : "right-0"}`}><Full onPick={go} /></span>}
          {open && !full && (
            <span role="menu" className={`absolute top-full z-10 mt-1 flex gap-0.5 rounded-full border border-line bg-surface p-1 shadow-lg ${mine ? "left-0" : "right-0"}`}>
              {EMOJI.map((e) => <button key={e} type="button" role="menuitemcheckbox" onClick={() => go(e)} aria-checked={list.some((r) => r.emoji === e && r.employee_id === meId)} className={`rounded-full px-1.5 py-1 text-base hover:bg-surface-2 ${list.some((r) => r.emoji === e && r.employee_id === meId) ? "bg-primary/10" : ""}`}>{e}</button>)}
              <button type="button" role="menuitem" onClick={() => setFull(true)} aria-label="More emoji" className="rounded-full px-1.5 py-1 hover:bg-surface-2"><Plus className="size-4" /></button>
            </span>
          )}
        </span>
      )}
    </>
  );
}
