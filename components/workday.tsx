"use client";

import { useEffect, useState } from "react";

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const clock = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

// Live clock + the office workday as a track: now, check-in and check-out plotted on it.
export function Workday({
  tz, start, end, grace, checkIn, checkOut,
}: { tz: string; start: string; end: string; grace: number; checkIn?: string | null; checkOut?: string | null }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, []);

  const s = toMin(start);
  const e = toMin(end);
  const pos = (iso: string | Date) => Math.min(100, Math.max(0, ((toMin(clock(new Date(iso), tz)) - s) / (e - s)) * 100));
  const nowPos = now ? pos(now) : 0;
  const graceAt = ((grace) / (e - s)) * 100;
  const label = !now ? "" : toMin(clock(now, tz)) < s ? "Before work hours" : toMin(clock(now, tz)) > e ? "After work hours" : `${Math.round(nowPos)}% of the workday`;

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="text-6xl font-medium tracking-[-0.04em] tabular-nums" suppressHydrationWarning>
          {now ? clock(now, tz) : "--:--"}
        </span>
        <span className="text-sm text-muted">{label}</span>
      </div>

      <div className="mt-6">
        <div className="relative h-2 rounded-full bg-surface-2">
          {/* grace window */}
          <div className="absolute inset-y-0 left-0 rounded-l-full bg-amber/20" style={{ width: `${graceAt}%` }} />
          {/* elapsed */}
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700" style={{ width: `${nowPos}%` }} />
          {checkIn && <Marker at={pos(checkIn)} label={`In ${clock(new Date(checkIn), tz)}`} />}
          {checkOut && <Marker at={pos(checkOut)} label={`Out ${clock(new Date(checkOut), tz)}`} />}
          {now && <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-primary shadow" style={{ left: `${nowPos}%` }} />}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted tabular-nums">
          <span>{start.slice(0, 5)}</span>
          <span>{end.slice(0, 5)}</span>
        </div>
      </div>
    </div>
  );
}

function Marker({ at, label }: { at: number; label: string }) {
  return (
    <span className="absolute -top-7 -translate-x-1/2" style={{ left: `${at}%` }}>
      <span className="block rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-ink-text tabular-nums">{label}</span>
      <span className="mx-auto block h-3 w-px bg-ink/40" />
    </span>
  );
}
