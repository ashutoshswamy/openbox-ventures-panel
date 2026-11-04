"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { tintFor } from "@/components/avatar";
import { initials } from "@/lib/util";

export type Person = { name: string; in?: string; out?: string };

// Calendar chip that opens a modal listing people for that day (present / late / on leave / absent), with check-in and check-out times when known.
export function PeopleChip({ className, label, date, dot, people }: { className: string; label: string; date: string; dot: string; people: Person[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const timed = people.some((p) => p.in);
  const time = (t?: string) => {
    if (!t) return <span className="text-muted">-</span>;
    const [clock, next] = t.split(" (");
    return <>{clock}{next && <span className="mt-0.5 block text-[10px] leading-none text-muted">{next.replace(")", "")}</span>}</>;
  };
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={`${className} w-full cursor-pointer text-left hover:brightness-95`} title={`${label} - click to see who`}>{label}</button>
      <dialog ref={ref} onClick={(e) => e.target === ref.current && ref.current.close()} className="m-auto w-[min(30rem,92vw)] overflow-hidden rounded-2xl border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className={`size-2.5 shrink-0 rounded-full ${dot}`} />
          <div className="min-w-0 flex-1">
            <h3 className="text-base leading-tight font-semibold">{label}</h3>
            <p className="text-xs text-muted">{date}</p>
          </div>
          <button type="button" onClick={() => ref.current?.close()} className="btn btn-ghost btn-icon" aria-label="Close"><X /></button>
        </div>
        {timed && (
          <div className="grid grid-cols-[1fr_5.5rem_6.5rem] gap-3 bg-surface-2/60 px-5 py-2 text-[11px] font-medium tracking-wide text-muted uppercase">
            <span>Employee</span><span className="text-right">Check in</span><span className="text-right">Check out</span>
          </div>
        )}
        <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
          {people.map((p, i) => (
            <li key={i} className={`grid items-center gap-3 px-5 py-2.5 text-sm ${timed ? "grid-cols-[1fr_5.5rem_6.5rem]" : "grid-cols-1"}`}>
              <span className="flex min-w-0 items-center gap-2.5">
                <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${tintFor(p.name)}`}>{initials(p.name)}</span>
                <span className="truncate font-medium">{p.name}</span>
              </span>
              {timed && <><span className="text-right tabular-nums">{time(p.in)}</span><span className="text-right tabular-nums">{time(p.out)}</span></>}
            </li>
          ))}
        </ul>
        <div className="border-t border-line bg-surface-2/60 px-5 py-2 text-xs text-muted">{people.length} {people.length === 1 ? "person" : "people"}</div>
      </dialog>
    </>
  );
}
