"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const MINE = process.env.NEXT_PUBLIC_BUILD_ID;
const CHECK = 60_000; // how often to look for a new deploy
const LATER = 5 * 60_000; // "Later" asks again after this

// Tells people a new version was deployed while they had the site open, and offers a reload.
export function UpdateNotice() {
  const dlg = useRef<HTMLDialogElement>(null);
  const [stale, setStale] = useState(false);
  const snoozed = useRef(0);

  useEffect(() => {
    if (!MINE) return;
    const check = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const { id } = (await r.json()) as { id: string | null };
        if (id && id !== MINE && Date.now() > snoozed.current) setStale(true);
      } catch {} // offline: try again next time
    };
    const id = setInterval(check, CHECK);
    const vis = () => document.visibilityState === "visible" && check(); // coming back to the tab
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, []);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (stale && !d.open) d.showModal();
    if (!stale && d.open) d.close();
  }, [stale]);

  const later = () => { snoozed.current = Date.now() + LATER; setStale(false); };
  return (
    <dialog ref={dlg} aria-label="Update available" onCancel={(e) => { e.preventDefault(); later(); }} className="m-auto w-[min(26rem,92vw)] rounded-2xl border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px]">
      <div className="p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary-soft text-text"><RefreshCw className="size-5" /></span>
        <h2 className="mt-4 text-lg font-semibold">A new version is available</h2>
        <p className="mt-2 text-sm text-muted">Some changes were just deployed. Reload the site to get them. Anything you are typing in a form will be lost, so finish and save first if you need to.</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" className="btn btn-primary" onClick={() => location.reload()}><RefreshCw /> Reload now</button>
          <button type="button" className="btn btn-ghost" onClick={later}>Later</button>
        </div>
      </div>
    </dialog>
  );
}
