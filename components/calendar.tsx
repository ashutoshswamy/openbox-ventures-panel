import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PeopleChip } from "@/components/people-chip";
import { eachDay, isoDow, shiftView, viewRange, type View } from "@/lib/calendar";

export type Tone = "green" | "blue" | "amber" | "red" | "muted";
export type CalLine = { text: string; tone?: Tone; people?: string[] }; // people → chip opens a modal listing them
export type CalCell = { lines?: CalLine[]; off?: boolean; href?: string };

const CHIP: Record<Tone, string> = { green: "bg-green-soft text-green", blue: "bg-blue-soft text-blue", amber: "bg-amber-soft text-amber", red: "bg-red-soft text-red", muted: "bg-surface-2 text-muted" };
const DOT: Record<Tone, string> = { green: "bg-green", blue: "bg-blue", amber: "bg-amber", red: "bg-red", muted: "bg-muted/60" };
const MAX = 3; // chips per day in month view before "+n more"
const VIEWS: View[] = ["day", "week", "month"];

// Day / week / month calendar (Monday-first). Presentational: the page decides what each day shows. A cell with href is a link (e.g. to that day's list).
// Month view on phones shows colour dots instead of text chips; the legend explains them. Week and day views always list every line.
export function Calendar({
  view, at, cells, today, selected, params = {}, legend,
}: {
  view: View;
  at: string; // any date inside the visible range
  cells: Record<string, CalCell>;
  today?: string;
  selected?: string;
  params?: Record<string, string>; // other query params to keep on the nav links
  legend?: [Tone, string][];
}) {
  const { from, to } = viewRange(view, at);
  const days = eachDay(from, to);
  const link = (v: View, a: string) => "?" + new URLSearchParams({ ...params, view: v, at: a });
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { ...o, timeZone: "UTC" });
  const label = view === "month" ? fmt(from, { month: "long", year: "numeric" })
    : view === "day" ? fmt(at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : `${fmt(from, { day: "numeric", month: "short" })} - ${fmt(to, { day: "numeric", month: "short", year: "numeric" })}`;
  const noun = view;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{label}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-line p-0.5 text-sm" role="group" aria-label="Calendar view">
            {VIEWS.map((v) => (
              <Link key={v} href={link(v, at)} aria-current={v === view} className={`rounded-md px-3 py-1 capitalize ${v === view ? "bg-primary text-primary-fg" : "text-muted hover:text-text"}`}>{v}</Link>
            ))}
          </div>
          <div className="flex gap-1">
            <Link href={link(view, shiftView(view, at, -1))} className="btn btn-icon" aria-label={`Previous ${noun}`}><ChevronLeft /></Link>
            {today && <Link href={link(view, today)} className="btn h-9 px-3 text-sm">Today</Link>}
            <Link href={link(view, shiftView(view, at, 1))} className="btn btn-icon" aria-label={`Next ${noun}`}><ChevronRight /></Link>
          </div>
        </div>
      </div>
      <div className={`grid gap-px overflow-hidden rounded-xl border border-line bg-line text-xs ${view === "month" ? "grid-cols-7" : view === "week" ? "grid-cols-1 sm:grid-cols-7" : "grid-cols-1"}`}>
        {view === "month" && ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="bg-surface-2 py-1.5 text-center font-medium text-muted">{d}</div>)}
        {view === "month" && Array.from({ length: isoDow(from) - 1 }, (_, i) => <div key={`b${i}`} className="bg-surface-2/40" />)}
        {days.map((d) => {
          const c = cells[d] ?? {};
          const lines = c.lines ?? [];
          const modal = lines.some((l) => l.people); // chips are buttons then, so the cell can't be one big link
          const chip = (l: CalLine, cls: string) => l.people ? <PeopleChip key={l.text} className={cls} label={l.text} title={`${l.text} · ${fmt(d, { day: "numeric", month: "short" })}`} names={l.people} /> : <span key={l.text} className={cls} title={l.text}>{l.text}</span>;
          const numEl = (
            <span className={`inline-grid size-6 place-items-center rounded-full tabular-nums ${d === today ? "bg-primary font-semibold text-primary-fg" : "text-muted"}`}>{Number(d.slice(8))}</span>
          );
          const num = modal && c.href ? <Link href={c.href} className="self-start" aria-label={`Show ${d}`}>{numEl}</Link> : numEl;
          const full = (
            <>
              <span className="flex items-center gap-2 text-muted">{num}{fmt(d, { weekday: view === "day" ? "long" : "short" })}</span>
              <span className="mt-2 flex flex-col gap-1">
                {lines.map((l) => chip(l, `rounded px-2 py-1 ${CHIP[l.tone ?? "muted"]}`))}
                {!lines.length && <span className="text-muted">Nothing</span>}
              </span>
            </>
          );
          const compact = (
            <>
              {num}
              <span className="mt-1 hidden flex-col gap-0.5 sm:flex">
                {lines.slice(0, MAX).map((l) => chip(l, `block truncate rounded px-1.5 py-0.5 ${CHIP[l.tone ?? "muted"]}`))}
                {lines.length > MAX && <span className="px-1.5 text-muted">+{lines.length - MAX} more</span>}
              </span>
              <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                {lines.slice(0, 6).map((l, i) => <span key={i} className={`size-1.5 rounded-full ${DOT[l.tone ?? "muted"]}`} />)}
              </span>
            </>
          );
          const size = view === "month" ? "min-h-14 p-1.5 sm:min-h-24" : view === "week" ? "min-h-16 p-2 sm:min-h-52" : "min-h-40 p-3 text-sm";
          const cls = `block ${size} ${c.off ? "bg-surface-2/60" : "bg-surface"} ${d === selected ? "ring-2 ring-primary ring-inset" : ""}`;
          const body = view === "month" ? compact : full;
          return c.href && !modal ? <Link key={d} href={c.href} className={`${cls} hover:bg-surface-2`} aria-label={`${d}: ${lines.map((l) => l.text).join(", ") || "nothing"}`}>{body}</Link> : <div key={d} className={cls}>{body}</div>;
        })}
      </div>
      {!!legend?.length && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {legend.map(([t, text]) => <li key={text} className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${DOT[t]}`} />{text}</li>)}
        </ul>
      )}
    </div>
  );
}
