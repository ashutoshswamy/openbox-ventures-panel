"use client";

import { useEffect, useMemo, useState } from "react";
import { Moon, Search, Sun, X } from "lucide-react";
import { MAP_VIEWBOX, US_STATES, type UsState, type ZoneId } from "@/lib/us-states";
import { US_CITIES } from "@/lib/us-cities";

type Zone = { id: ZoneId; name: string; tz: string; utc: string; color: string };
const ZONES: Zone[] = [
  { id: "pt", name: "Pacific", tz: "America/Los_Angeles", utc: "UTC-8", color: "#3b82f6" },
  { id: "mt", name: "Mountain", tz: "America/Denver", utc: "UTC-7", color: "#f59e0b" },
  { id: "ct", name: "Central", tz: "America/Chicago", utc: "UTC-6", color: "#10b981" },
  { id: "et", name: "Eastern", tz: "America/New_York", utc: "UTC-5", color: "#ec4899" },
  { id: "ak", name: "Alaska", tz: "America/Anchorage", utc: "UTC-9", color: "#14b8a6" },
  { id: "hi", name: "Hawaii", tz: "Pacific/Honolulu", utc: "UTC-10", color: "#ef4444" },
  { id: "at", name: "Atlantic", tz: "America/Puerto_Rico", utc: "UTC-4", color: "#64748b" },
];
const IN = { name: "India", tz: "Asia/Kolkata" };
const MAIN: ZoneId[] = ["pt", "mt", "ct", "et"];
const zoneOf = (id: ZoneId) => ZONES.find((z) => z.id === id)!;
const TINY = new Set(["DC", "RI", "DE", "CT", "NJ", "MD", "MA", "NH", "VT"]); // too small to label on the map

// Puerto Rico is not drawn on the map, but is searchable and listed
const ALL: (Omit<UsState, "d" | "c"> & { c?: [number, number]; d?: string })[] = [...US_STATES, { id: "72", name: "Puerto Rico", abbr: "PR", zone: "at" as ZoneId, tz: "America/Puerto_Rico" }].sort((a, b) => a.name.localeCompare(b.name));

type Loc = { key: string; title: string; sub: string; tz: string; zone: ZoneId; note?: string; abbr?: string };
const stateLoc = (s: (typeof ALL)[number]): Loc => ({ key: s.abbr, title: s.name, sub: "State", tz: s.tz, zone: s.zone, note: s.note, abbr: s.abbr });
const cityLocs: Loc[] = US_CITIES.map(([name, ab, tz]) => {
  const s = ALL.find((x) => x.abbr === ab)!;
  const t = tz ?? s.tz;
  const zone = ZONES.find((z) => z.tz === t)?.id ?? s.zone;
  return { key: `${name}-${ab}`, title: `${name}, ${ab}`, sub: "City", tz: t, zone, abbr: ab, note: tz ? `Differs from the rest of ${s.name}` : undefined };
});

// UTC offset of a zone at an instant, in minutes
function offset(at: Date, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(at).map((x) => [x.type, Number(x.value)]));
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at.getTime() / 1000) * 1000) / 6e4;
}
// wall-clock time in a zone to the real instant (two passes handle daylight saving)
function instant(date: string, time: string, tz: string) {
  const [y, m, d] = date.split("-").map(Number), [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - offset(new Date(guess), tz) * 6e4;
  return new Date(guess - offset(new Date(first), tz) * 6e4);
}
const gap = (m: number) => { const a = Math.abs(m), h = Math.floor(a / 60), r = a % 60; return `${h}h${r ? ` ${r}m` : ""}`; };
const hourIn = (at: Date, tz: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(at));
const abbrOf = (at: Date, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).format(at).split(" ").pop();
const OPEN = [9, 18]; // working hours behind the "good time to call" dot

export function Clocks() {
  const [now, setNow] = useState<Date | null>(null);
  const [h12, setH12] = useState(true);
  const [times, setTimes] = useState(false);
  const [zoneFilter, setZoneFilter] = useState<ZoneId | null>(null);
  const [hover, setHover] = useState<Loc | null>(null);
  const [sel, setSel] = useState<Loc | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [me, setMe] = useState("Asia/Kolkata");
  const [from, setFrom] = useState("in");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");

  useEffect(() => {
    setMe(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata");
    setDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()));
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (at: Date, tz: string, withSec = false) =>
    new Intl.DateTimeFormat("en-IN", { timeZone: tz, hour: h12 ? "numeric" : "2-digit", minute: "2-digit", ...(withSec ? { second: "2-digit" } : {}), hour12: h12 }).format(at);
  const day = (at: Date, tz: string, long = false) => new Intl.DateTimeFormat("en-IN", { timeZone: tz, weekday: long ? "long" : "short", day: "numeric", month: "short" }).format(at);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return [...ALL.map(stateLoc), ...cityLocs].filter((l) => l.title.toLowerCase().includes(s) || l.abbr?.toLowerCase() === s).slice(0, 8);
  }, [q]);

  const shown = hover ?? sel;
  const ist = now ? offset(now, IN.tz) : 0, mine = now ? offset(now, me) : 0;
  const listed = ALL.filter((s) => !zoneFilter || s.zone === zoneFilter);
  const rows = showAll ? listed : listed.slice(0, 12);
  const zn = shown ? zoneOf(shown.zone) : null;

  const pick = (l: Loc) => { setSel(l); setQ(""); setOpen(false); };

  // converter
  const CONV = [{ id: "in", name: IN.name, tz: IN.tz }, ...ZONES.slice(0, 6).map((z) => ({ id: z.id, name: z.name, tz: z.tz }))];
  const src = CONV.find((z) => z.id === from)!;
  const picked = date && time ? instant(date, time, src.tz) : null;

  return (
    <div className="space-y-6">
      {/* live clocks: also the legend and zone filter */}
      <section aria-label="Live clocks" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[{ k: "me", name: "Your time", tz: me, color: "var(--color-text)" }, { k: "in", name: IN.name, tz: IN.tz, color: "var(--color-muted)" }, ...MAIN.map((id) => { const z = zoneOf(id); return { k: id, name: z.name, tz: z.tz, color: z.color }; })].map((c) => {
          const zid = MAIN.includes(c.k as ZoneId) ? (c.k as ZoneId) : null;
          const on = zid && zoneFilter === zid;
          const inner = (
            <>
              <span className="flex items-center gap-2 text-xs font-medium text-muted"><span className="size-2.5 rounded-full" style={{ background: c.color }} />{c.name}{now && <span className="ml-auto tabular-nums">{abbrOf(now, c.tz)}</span>}</span>
              <span className="mt-1 block text-2xl font-semibold tracking-[-0.03em] tabular-nums" suppressHydrationWarning>{now ? fmt(now, c.tz) : "--:--"}</span>
              <span className="block text-xs text-muted" suppressHydrationWarning>{now ? day(now, c.tz) : ""}</span>
            </>
          );
          return zid ? (
            <button key={c.k} type="button" aria-pressed={!!on} onClick={() => setZoneFilter(on ? null : zid)} className={`card text-left transition ${on ? "ring-2 ring-primary" : "hover:bg-surface-2"}`}>{inner}</button>
          ) : <div key={c.k} className="card">{inner}</div>;
        })}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <section className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="h2 mb-0">US time zone map</h2>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <label className="check"><input type="checkbox" checked={!h12} onChange={(e) => setH12(!e.target.checked)} /> 24-hour</label>
              <label className="check"><input type="checkbox" checked={times} onChange={(e) => setTimes(e.target.checked)} /> Times on map</label>
            </div>
          </div>
          <svg viewBox={MAP_VIEWBOX} role="group" aria-label="Map of US states coloured by time zone" className="h-auto w-full" onMouseLeave={() => setHover(null)}>
            {US_STATES.map((s) => {
              const z = zoneOf(s.zone), dim = zoneFilter && zoneFilter !== s.zone, on = sel?.abbr === s.abbr || hover?.abbr === s.abbr;
              const loc = stateLoc(s);
              return (
                <path
                  key={s.id} d={s.d} role="button" tabIndex={0} aria-label={`${s.name}, ${z.name} time`}
                  fill={z.color} fillOpacity={dim ? 0.12 : on ? 1 : 0.78} stroke="var(--color-surface)" strokeWidth={on ? 2 : 1} strokeLinejoin="round"
                  className="cursor-pointer outline-none transition-[fill-opacity] focus-visible:stroke-[3] focus-visible:stroke-[var(--color-text)]"
                  onMouseEnter={() => setHover(loc)} onFocus={() => setHover(loc)} onBlur={() => setHover(null)}
                  onClick={() => setSel(loc)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(loc); } }}
                />
              );
            })}
            <g className="pointer-events-none select-none" fontSize={times ? 10 : 11} fontWeight={700} textAnchor="middle" fill="#fff" style={{ paintOrder: "stroke", stroke: "rgb(0 0 0 / .35)", strokeWidth: 2.5 }}>
              {US_STATES.filter((s) => !TINY.has(s.abbr) && (!zoneFilter || zoneFilter === s.zone)).map((s) => (
                <text key={s.abbr} x={s.c[0]} y={s.c[1] + (times ? -1 : 4)}>
                  {s.abbr}
                  {times && now && <tspan x={s.c[0]} dy={11} fontWeight={500} fontSize={9}>{fmt(now, s.tz)}</tspan>}
                </text>
              ))}
            </g>
          </svg>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
            {ZONES.map((z) => (
              <li key={z.id}><button type="button" onClick={() => setZoneFilter(zoneFilter === z.id ? null : z.id)} className={`flex items-center gap-1.5 rounded px-1 py-0.5 hover:text-text ${zoneFilter === z.id ? "font-semibold text-text" : ""}`}>
                <span className="size-2.5 rounded-sm" style={{ background: z.color }} />{z.name} ({z.utc})
              </button></li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">States are coloured by their main zone. Click a state or a zone to focus. Puerto Rico is listed below but not drawn.</p>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="card">
            <h2 className="h2">What time is it in…?</h2>
            <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search a state or city" aria-label="Search a state or city" autoComplete="off"
                onKeyDown={(e) => { if (e.key === "Enter" && results[0]) { e.preventDefault(); pick(results[0]); } if (e.key === "Escape") setOpen(false); }}
                className="input pl-9"
              />
              {open && q.trim() && (
                <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-line bg-surface p-1 text-sm shadow-lg" role="listbox">
                  {results.map((l) => (
                    <li key={l.key}><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(l)} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left hover:bg-surface-2">
                      <span className="size-2 rounded-full" style={{ background: zoneOf(l.zone).color }} /><span className="flex-1 truncate">{l.title}</span><span className="text-xs text-muted">{l.sub}</span>
                    </button></li>
                  ))}
                  {!results.length && <li className="px-2.5 py-1.5 text-muted">No match</li>}
                </ul>
              )}
            </div>

            {shown && zn && now ? (
              <div className="mt-4">
                <div className="flex items-start justify-between gap-2">
                  <div><div className="text-lg font-semibold tracking-tight">{shown.title}</div><div className="text-xs text-muted">{zn.name} time · {abbrOf(now, shown.tz)}</div></div>
                  {sel && !hover && <button type="button" className="btn btn-ghost btn-icon" aria-label="Clear" onClick={() => setSel(null)}><X /></button>}
                </div>
                <div className="mt-3 text-5xl font-medium tracking-[-0.04em] tabular-nums" suppressHydrationWarning>{fmt(now, shown.tz, true)}</div>
                <div className="text-sm text-muted">{day(now, shown.tz, true)}</div>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted">UTC offset</dt><dd className="tabular-nums">UTC{offset(now, shown.tz) >= 0 ? "+" : "-"}{gap(offset(now, shown.tz))}</dd>
                  <dt className="text-muted">Daylight saving</dt><dd>{(() => { const y = now.getUTCFullYear(), a = offset(new Date(Date.UTC(y, 0, 15)), shown.tz), b = offset(new Date(Date.UTC(y, 6, 15)), shown.tz); return a === b ? "Not observed" : offset(now, shown.tz) === Math.max(a, b) ? "On now" : "Off now"; })()}</dd>
                  <dt className="text-muted">Vs India</dt><dd>{offset(now, shown.tz) === ist ? "Same time" : `${gap(offset(now, shown.tz) - ist)} ${offset(now, shown.tz) < ist ? "behind" : "ahead"}`}</dd>
                  <dt className="text-muted">Vs you</dt><dd>{offset(now, shown.tz) === mine ? "Same time" : `${gap(offset(now, shown.tz) - mine)} ${offset(now, shown.tz) < mine ? "behind" : "ahead"}`}</dd>
                  <dt className="text-muted">Right now</dt><dd className="flex items-center gap-1.5">{(() => { const h = hourIn(now, shown.tz), o = h >= OPEN[0] && h < OPEN[1]; return <><span className={`size-2 rounded-full ${o ? "bg-green" : "bg-line"}`} />{o ? "Office hours" : "Outside office hours"} {h >= 6 && h < 18 ? <Sun className="size-3.5 text-muted" /> : <Moon className="size-3.5 text-muted" />}</>; })()}</dd>
                </dl>
                {shown.note && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">{shown.note}</p>}
              </div>
            ) : <p className="mt-4 text-sm text-muted">Click a state on the map or search a city to see its time, offset and difference from India.</p>}
          </section>
        </aside>
      </div>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2 mb-0">US time now{zoneFilter && <span className="font-normal text-muted"> · {zoneOf(zoneFilter).name}</span>}</h2>
          {zoneFilter && <button type="button" className="btn btn-ghost" onClick={() => setZoneFilter(null)}><X /> Clear filter</button>}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((s) => (
            <li key={s.abbr}>
              <button type="button" onClick={() => { setSel(stateLoc(s)); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left hover:bg-surface-2">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: zoneOf(s.zone).color }} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.name}</span><span className="block text-xs text-muted">{zoneOf(s.zone).name}</span></span>
                <span className="text-sm font-semibold tabular-nums" suppressHydrationWarning>{now ? fmt(now, s.tz) : "--:--"}</span>
              </button>
            </li>
          ))}
        </ul>
        {listed.length > 12 && <button type="button" className="btn mt-3" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer" : `Show all ${listed.length}`}</button>}
      </section>

      <section className="card">
        <h2 className="h2">Time converter</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="field">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-auto" /></label>
          <label className="field">Time<input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input w-auto" /></label>
          <label className="field">In
            <select value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto">{CONV.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
          </label>
        </div>
        {picked && (
          <ul className="mt-4 divide-y divide-line">
            {CONV.map((z) => { const h = hourIn(picked, z.tz), o = h >= OPEN[0] && h < OPEN[1]; return (
              <li key={z.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className={`size-2 shrink-0 rounded-full ${o ? "bg-green" : "bg-line"}`} title={o ? "Office hours" : "Outside office hours"} />
                <span className="flex-1 font-medium">{z.name}</span>
                <span className="text-xs text-muted tabular-nums">{day(picked, z.tz)}</span>
                <span className="w-20 text-right font-semibold tabular-nums">{fmt(picked, z.tz)}</span>
              </li>
            ); })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">Green dot = {OPEN[0]}:00 to {OPEN[1]}:00 local time. Daylight saving is handled automatically.</p>
      </section>
    </div>
  );
}
