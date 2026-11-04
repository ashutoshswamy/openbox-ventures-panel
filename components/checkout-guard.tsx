"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const todIn = (tz: string) => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()); return toMin(p); };
const LATER = 30 * 60_000; // after "Not yet", ask again in 30 minutes

// While you are still checked in after the workday has ended: a reminder modal (now, and again every 30 minutes), plus the browser's own
// "leave site?" prompt if you close or reload the tab. Browsers do not allow a custom modal while a tab is closing, so that last one is theirs.
export function CheckoutGuard({ checkedIn, start, end, tz }: { checkedIn: boolean; start: string; end: string; tz: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // past the end of the workday. Overnight shifts (end before start): only in the gap after the shift, not when arriving a little early for the next one
  const after = () => { const t = todIn(tz), s = toMin(start), e = toMin(end); return s < e ? t >= e : t >= e && t < s - 120; };

  useEffect(() => {
    if (!checkedIn) return;
    const tick = () => {
      let last = 0;
      try { last = Number(sessionStorage.getItem("checkout-nudge") ?? 0); } catch {}
      if (after() && Date.now() - last > LATER) setOpen(true);
    };
    const first = setTimeout(tick, 800);
    const id = setInterval(tick, 30_000);
    const leave = (e: BeforeUnloadEvent) => { if (after()) { e.preventDefault(); e.returnValue = ""; } };
    addEventListener("beforeunload", leave);
    return () => { clearTimeout(first); clearInterval(id); removeEventListener("beforeunload", leave); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- after() only reads the props below
  }, [checkedIn, start, end, tz]);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && checkedIn && !d.open) d.showModal();
    if ((!open || !checkedIn) && d.open) d.close();
  }, [open, checkedIn]);

  const later = () => { try { sessionStorage.setItem("checkout-nudge", String(Date.now())); } catch {} setOpen(false); };
  if (!checkedIn) return null;
  const endLabel = new Date(`1970-01-01T${end}:00`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return (
    <dialog ref={dlg} aria-label="Check out reminder" onClose={() => setOpen(false)} className="m-auto w-[min(26rem,92vw)] rounded-2xl border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]">
      <div className="p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-soft text-amber"><LogOut className="size-5" /></span>
        <h2 className="mt-4 text-lg font-semibold">Make sure you have checked out</h2>
        <p className="mt-2 text-sm text-muted">Your workday ended at {endLabel} and you are still checked in. Check out before you close the site so your hours are recorded correctly.</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {path === "/" ? <button type="button" className="btn btn-primary" onClick={later}>Check out below</button> : <Link href="/" className="btn btn-primary" onClick={later}>Go to check out</Link>}
          <button type="button" className="btn btn-ghost" onClick={later}>Not yet</button>
        </div>
      </div>
    </dialog>
  );
}
