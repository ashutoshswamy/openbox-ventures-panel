"use client";

import { useState, useTransition } from "react";
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

export function CheckIn({ status }: { status: "none" | "in" | "out" }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<string | void | null>) =>
    start(async () => {
      try {
        setError((await fn()) || null);
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
          <button className="btn btn-primary h-11 px-5" disabled={pending} onClick={() => run(() => checkOut())}>
            <LogOut /> Check out
          </button>
        )}
      </div>
      {error && <p className="error lg:justify-end"><CircleAlert className="size-4" /> {error}</p>}
    </div>
  );
}
