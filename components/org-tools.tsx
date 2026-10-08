"use client";

import { useRef, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Search } from "lucide-react";

// Toolbar over the org canvas: find a person (dims the rest, unfolds their path, scrolls to them), fold/unfold all.
// Works on the server-rendered tree through data-name / <details>, so the chart itself stays a server component.
export function OrgTools({ summary, children }: { summary: string; children: React.ReactNode }) {
  const canvas = useRef<HTMLDivElement>(null);
  const [miss, setMiss] = useState(false);

  const find = (q: string) => {
    const root = canvas.current;
    if (!root) return;
    const term = q.trim().toLowerCase();
    root.toggleAttribute("data-searching", !!term);
    let first: HTMLElement | null = null;
    for (const card of root.querySelectorAll<HTMLElement>(".org-card")) {
      const hit = !!term && (card.dataset.name ?? "").includes(term);
      card.toggleAttribute("data-hit", hit);
      if (hit) {
        for (let d = card.closest("details"); d; d = d.parentElement?.closest("details") ?? null) d.open = true;
        first ??= card;
      }
    }
    setMiss(!!term && !first);
    first?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest", inline: "center" });
  };
  const all = (open: boolean) => canvas.current?.querySelectorAll("details").forEach((d) => (d.open = open));

  return (
    <div className="org-canvas">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface/80 px-3 py-2.5 backdrop-blur">
        <label className="relative min-w-48 flex-1 sm:max-w-72">
          <span className="sr-only">Find a person</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
          <input type="search" placeholder="Find a person" onChange={(e) => find(e.target.value)} aria-invalid={miss} className="input h-9 pl-8" />
        </label>
        {miss && <span className="text-xs text-muted" role="status">No one by that name</span>}
        <span className="ml-auto hidden text-xs text-muted sm:inline">{summary}</span>
        <button type="button" onClick={() => all(true)} className="btn btn-ghost h-9" title="Expand all"><ChevronsUpDown /> <span className="hidden md:inline">Expand all</span></button>
        <button type="button" onClick={() => all(false)} className="btn btn-ghost h-9" title="Collapse all"><ChevronsDownUp /> <span className="hidden md:inline">Collapse all</span></button>
      </div>
      <div ref={canvas} className="overflow-x-auto">{children}</div>
    </div>
  );
}
