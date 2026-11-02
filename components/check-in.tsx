"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, CircleAlert, CircleCheckBig, House, LoaderCircle, LogOut } from "lucide-react";
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

export function CheckIn({ status, due = [] }: { status: "none" | "in" | "out"; due?: ReportKind[] }) {
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<string | void | null>) =>
    start(async () => {
      try {
        const err = (await fn()) || null;
        setError(err);
        if (err?.includes("required to check out")) router.refresh(); // office just turned reports on: reload which ones are due
      } catch (e) {
        setError((e as Error).message);
      }
    });

  if (status === "out")
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-green">
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
          run(() => checkOut(Object.fromEntries(due.map((k) => [k, String(fd.get(k) ?? "")]))));
        }}
      >
        {due.map((k) => (
          <label key={k} className="field">{REPORT_LABEL[k]}
            <textarea name={k} required maxLength={5000} rows={k === "daily" ? 3 : 4} className="input" placeholder="Tasks done, progress, blockers..." />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary h-11 px-5" disabled={pending}><LogOut /> Submit & check out</button>
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setReporting(false)}>Cancel</button>
          {pending && <LoaderCircle className="size-5 animate-spin text-muted" />}
        </div>
        {error && <p className="error"><CircleAlert className="size-4" /> {error}</p>}
      </form>
    );

  return (
    <div className="flex flex-col gap-2 lg:items-end">
      <div className="flex flex-wrap gap-2">
        {pending && <LoaderCircle className="size-5 animate-spin self-center text-muted" />}
        {status === "none" ? (
          <>
            <button className="btn btn-primary h-11 px-5" disabled={pending} onClick={() => run(async () => {
              const c = await position();
              return checkIn("office", c.latitude, c.longitude);
            })}>
              <Building2 /> Check in at office
            </button>
            <button className="btn h-11 px-5" disabled={pending} onClick={() => run(async () => {
              const c = await position().catch(() => null);
              return checkIn("wfh", c?.latitude, c?.longitude);
            })}>
              <House /> Work from home
            </button>
          </>
        ) : (
          <button className="btn btn-primary h-11 px-5" disabled={pending} onClick={() => (due.length ? setReporting(true) : run(() => checkOut()))}>
            <LogOut /> Check out
          </button>
        )}
      </div>
      {error && <p className="error lg:justify-end"><CircleAlert className="size-4" /> {error}</p>}
    </div>
  );
}
