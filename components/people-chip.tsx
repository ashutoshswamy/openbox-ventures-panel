"use client";

import { useRef } from "react";
import { X } from "lucide-react";

// Calendar chip that opens a modal listing names (e.g. who is in / late / not in on a day).
export function PeopleChip({ className, label, title, names }: { className: string; label: string; title: string; names: string[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={`${className} w-full cursor-pointer text-left hover:brightness-95`} title={`${label} - click to see who`}>{label}</button>
      <dialog ref={ref} onClick={(e) => e.target === ref.current && ref.current.close()} className="m-auto w-[min(24rem,92vw)] rounded-xl border border-line bg-surface p-0 text-text backdrop:bg-black/40">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h3 className="font-semibold">{title}</h3>
          <button type="button" onClick={() => ref.current?.close()} className="btn btn-ghost btn-icon" aria-label="Close"><X /></button>
        </div>
        <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto px-4 text-sm">
          {names.map((n, i) => <li key={i} className="py-2">{n}</li>)}
        </ul>
      </dialog>
    </>
  );
}
