import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { eachDay, isoDow, monthRange, shiftMonth } from "@/lib/calendar";

export type Tone = "green" | "blue" | "amber" | "red" | "muted";
export type CalLine = { text: string; tone?: Tone };
export type CalCell = { lines?: CalLine[]; off?: boolean; href?: string };

const CHIP: Record<Tone, string> = { green: "bg-green-soft text-green", blue: "bg-blue-soft text-blue", amber: "bg-amber-soft text-amber", red: "bg-red-soft text-red", muted: "bg-surface-2 text-muted" };
const DOT: Record<Tone, string> = { green: "bg-green", blue: "bg-blue", amber: "bg-amber", red: "bg-red", muted: "bg-muted/60" };
const MAX = 3; // chips per day before "+n more"

// Monday-first month grid. Presentational: the page decides what each day shows. A cell with href is a link (e.g. to that day's list).
// Phones show colour dots instead of text chips; the legend explains them.
export function MonthCalendar({
  month, cells, today, selected, params = {}, legend,
}: {
  month: string;
  cells: Record<string, CalCell>;
  today?: string;
  selected?: string;
  params?: Record<string, string>; // other query params to keep on the prev / next links
  legend?: [Tone, string][];
}) {
  const { from, to } = monthRange(month);
  const days = eachDay(from, to);
  const link = (m: string) => "?" + new URLSearchParams({ ...params, month: m });
  const label = new Date(from + "T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{label}</h3>
        <div className="flex gap-1">
          <Link href={link(shiftMonth(month, -1))} className="btn btn-icon" aria-label="Previous month"><ChevronLeft /></Link>
          {today && <Link href={link(today.slice(0, 7))} className="btn h-9 px-3 text-sm">Today</Link>}
          <Link href={link(shiftMonth(month, 1))} className="btn btn-icon" aria-label="Next month"><ChevronRight /></Link>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line text-xs">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="bg-surface-2 py-1.5 text-center font-medium text-muted">{d}</div>)}
        {Array.from({ length: isoDow(from) - 1 }, (_, i) => <div key={`b${i}`} className="bg-surface-2/40" />)}
        {days.map((d) => {
          const c = cells[d] ?? {};
          const lines = c.lines ?? [];
          const body = (
            <>
              <span className={`inline-grid size-6 place-items-center rounded-full tabular-nums ${d === today ? "bg-primary font-semibold text-primary-fg" : "text-muted"}`}>{Number(d.slice(8))}</span>
              <span className="mt-1 hidden flex-col gap-0.5 sm:flex">
                {lines.slice(0, MAX).map((l, i) => <span key={i} className={`truncate rounded px-1.5 py-0.5 ${CHIP[l.tone ?? "muted"]}`} title={l.text}>{l.text}</span>)}
                {lines.length > MAX && <span className="px-1.5 text-muted">+{lines.length - MAX} more</span>}
              </span>
              <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                {lines.slice(0, 6).map((l, i) => <span key={i} className={`size-1.5 rounded-full ${DOT[l.tone ?? "muted"]}`} />)}
              </span>
            </>
          );
          const cls = `block min-h-14 p-1.5 sm:min-h-24 ${c.off ? "bg-surface-2/60" : "bg-surface"} ${d === selected ? "ring-2 ring-primary ring-inset" : ""}`;
          return c.href ? <Link key={d} href={c.href} className={`${cls} hover:bg-surface-2`} aria-label={`${d}: ${lines.map((l) => l.text).join(", ") || "nothing"}`}>{body}</Link> : <div key={d} className={cls}>{body}</div>;
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
