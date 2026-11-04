"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Zone = { id: string; name: string; tz: string; where: string };
const ZONES: Zone[] = [
  { id: "in", name: "India", tz: "Asia/Kolkata", where: "Chandigarh · Mohali · Dharamshala · Pune" },
  { id: "pt", name: "Pacific", tz: "America/Los_Angeles", where: "California, Washington, Oregon, Nevada" },
  { id: "mt", name: "Mountain", tz: "America/Denver", where: "Colorado, Utah, Wyoming, Montana, New Mexico, Idaho" },
  { id: "az", name: "Arizona", tz: "America/Phoenix", where: "Arizona (no daylight saving)" },
  { id: "ct", name: "Central", tz: "America/Chicago", where: "Texas, Illinois, Minnesota, Missouri, Louisiana, Oklahoma, Kansas" },
  { id: "et", name: "Eastern", tz: "America/New_York", where: "New York, Florida, Georgia, Ohio, Pennsylvania, Virginia, Carolinas" },
  { id: "ak", name: "Alaska", tz: "America/Anchorage", where: "Alaska" },
  { id: "hi", name: "Hawaii", tz: "Pacific/Honolulu", where: "Hawaii" },
];
const OPEN = [9, 18]; // working hours used for the "good time to call" dot

// UTC offset of a zone at an instant, in minutes
function offset(at: Date, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(at).map((x) => [x.type, Number(x.value)]));
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at.getTime() / 1000) * 1000) / 6e4;
}
// wall-clock time in a zone → the real instant (two passes handle daylight saving)
function instant(date: string, time: string, tz: string) {
  const [y, m, d] = date.split("-").map(Number), [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - offset(new Date(guess), tz) * 6e4;
  return new Date(guess - offset(new Date(first), tz) * 6e4);
}
const fmt = (at: Date, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: tz, ...o }).format(at);
const hourIn = (at: Date, tz: string) => Number(fmt(at, tz, { hour: "numeric", hourCycle: "h23" }));
const gap = (m: number) => { const a = Math.abs(m), h = Math.floor(a / 60), r = a % 60; return `${h}h${r ? ` ${r}m` : ""}`; };

export function Clocks() {
  const [now, setNow] = useState<Date | null>(null);
  const [from, setFrom] = useState("in");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { setDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())); }, []);

  const src = ZONES.find((z) => z.id === from)!;
  const picked = date && time ? instant(date, time, src.tz) : null;
  const ist = now ? offset(now, "Asia/Kolkata") : 0;

  const row = (z: Zone, at: Date, withDate: boolean) => {
    const h = hourIn(at, z.tz), open = h >= OPEN[0] && h < OPEN[1];
    return (
      <li key={z.id} className="flex items-center gap-3 py-2.5 text-sm">
        <span className={`size-2 shrink-0 rounded-full ${open ? "bg-green" : "bg-line"}`} title={open ? "Office hours" : "Outside office hours"} />
        <span className="flex-1 font-medium">{z.name}</span>
        <span className="text-xs text-muted tabular-nums">{withDate && fmt(at, z.tz, { weekday: "short", day: "numeric", month: "short" })}</span>
        <span className="w-20 text-right font-semibold tabular-nums">{fmt(at, z.tz, { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <section aria-label="Live clocks" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ZONES.map((z) => {
          const h = now ? hourIn(now, z.tz) : 12, open = h >= OPEN[0] && h < OPEN[1], day = h >= 6 && h < 18;
          const diff = now ? offset(now, z.tz) - ist : 0;
          return (
            <div key={z.id} className="card flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{z.name}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted">{day ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}{now ? new Intl.DateTimeFormat("en-US", { timeZone: z.tz, timeZoneName: "short" }).format(now).split(" ").pop() : ""}</span>
              </div>
              <div className="text-3xl font-medium tracking-[-0.03em] tabular-nums" suppressHydrationWarning>{now ? fmt(now, z.tz, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) : "--:--"}</div>
              <div className="text-xs text-muted" suppressHydrationWarning>{now ? fmt(now, z.tz, { weekday: "long", day: "numeric", month: "short" }) : ""}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`badge ${open ? "badge-green" : ""}`}>{open ? "Office hours" : "Closed"}</span>
                {z.id !== "in" && now && <span className="text-muted">{gap(diff)} {diff < 0 ? "behind" : "ahead of"} India</span>}
              </div>
              <p className="mt-auto pt-1 text-xs text-muted">{z.where}</p>
            </div>
          );
        })}
      </section>

      <section className="card">
        <h2 className="h2">Time converter</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="field">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-auto" /></label>
          <label className="field">Time<input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input w-auto" /></label>
          <label className="field">In
            <select value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto">{ZONES.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
          </label>
        </div>
        {picked && <ul className="mt-4 divide-y divide-line">{ZONES.map((z) => row(z, picked, true))}</ul>}
        <p className="mt-3 text-xs text-muted">Green dot = {OPEN[0]}:00 to {OPEN[1]}:00 local time. Daylight saving is handled automatically.</p>
      </section>
    </div>
  );
}
