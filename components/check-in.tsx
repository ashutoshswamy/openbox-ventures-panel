"use client";

import { useState, useTransition } from "react";
import { sileo } from "sileo";
import { useRouter } from "next/navigation";
import { Building2, CircleCheckBig, House, LogOut } from "lucide-react";
import { checkIn, checkOut } from "@/app/(employee)/actions";

function position(): Promise<GeolocationCoordinates> {
  return new Promise((ok, fail) =>
    navigator.geolocation.getCurrentPosition((p) => ok(p.coords), () => fail(new Error("Allow location access to check in from the office")), {
      enableHighAccuracy: true,
      timeout: 15000,
    }),
  );
}

export type ReportKind = "daily" | "weekly" | "monthly";
const REPORT_LABEL: Record<ReportKind, string> = {
  daily: "What did you work on today?",
  weekly: "Weekly summary: what did you get done this week?",
  monthly: "Monthly summary: what did you get done this month?",
};

export function CheckIn({ status, due = [], canWfh = true }: { status: "none" | "in" | "out"; due?: ReportKind[]; canWfh?: boolean }) {
  const [reporting, setReporting] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null); // which button shows the spinner

  // ok = toast title on success, fail = toast title on error. Errors name the problem in the description.
  const run = (key: string, ok: { title: string; description: string }, fail: string, fn: () => Promise<string | void | null>) =>
    start(async () => {
      setBusy(key);
      try {
        const err = (await fn()) || null;
        if (err) {
          sileo.error({ title: fail, description: err });
          if (err.includes("required to check out")) router.refresh(); // office just turned reports on: reload which ones are due
        } else sileo.success(ok);
      } catch (e) {
        sileo.error({ title: fail, description: (e as Error).message });
      }
      setBusy(null);
    });
  const clock = () => new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const spin = (k: string) => (busy === k && pending ? { "data-loading": "" } : {});

  if (status === "out")
    return (
      <p className="pop flex items-center gap-2 text-sm font-medium text-green">
        <CircleCheckBig className="size-5" /> Day complete
      </p>
    );

  // office needs work reports: collect them before the check-out goes through
  if (status === "in" && reporting)
    return (
      <form
        className="flex w-full flex-col gap-3 lg:w-96"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run("out", { title: "Checked out", description: `${clock()}. Your report was saved.` }, "Couldn't check out", () => checkOut(Object.fromEntries(due.map((k) => [k, String(fd.get(k) ?? "")]))));
        }}
      >
        {due.map((k) => (
          <label key={k} className="field">{REPORT_LABEL[k]}
            <textarea name={k} required maxLength={5000} rows={k === "daily" ? 3 : 4} className="input" placeholder="Tasks done, progress, blockers..." />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary h-11 px-5" disabled={pending} {...spin("out")}><LogOut /> Submit & check out</button>
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setReporting(false)}>Cancel</button>
        </div>
      </form>
    );

  return (
    <div className="flex flex-col gap-2 lg:items-end">
      <div className="flex flex-wrap gap-2">
        {status === "none" ? (
          <>
            <button className="btn btn-primary h-11 px-5" disabled={pending} {...spin("office")} onClick={() => run("office", { title: "Checked in", description: `${clock()} at the office. Have a good day.` }, "Couldn't check in", async () => {
              const c = await position();
              return checkIn("office", c.latitude, c.longitude);
            })}>
              {canWfh ? <><Building2 /> Check in at office</> : <><Building2 /> Check in</>}
            </button>
            {canWfh && <button className="btn h-11 px-5" disabled={pending} {...spin("wfh")} onClick={() => run("wfh", { title: "Checked in", description: `${clock()} from home. Have a good day.` }, "Couldn't check in", async () => {
              const c = await position().catch(() => null);
              return checkIn("wfh", c?.latitude, c?.longitude);
            })}>
              <House /> Work from home
            </button>}
          </>
        ) : (
          <button className="btn btn-primary h-11 px-5" disabled={pending} {...spin("out")} onClick={() => (due.length ? setReporting(true) : run("out", { title: "Checked out", description: `${clock()}. See you tomorrow.` }, "Couldn't check out", () => checkOut()))}>
            <LogOut /> Check out
          </button>
        )}
      </div>
    </div>
  );
}
