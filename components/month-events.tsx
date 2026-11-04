import { Cake, CalendarHeart, Medal, Palmtree, UserPlus } from "lucide-react";
import { monthEvents, type MonthEvent } from "@/lib/pending";
import { todayIn } from "@/lib/util";

const KIND: Record<MonthEvent["kind"], { icon: typeof Cake; tone: string }> = {
  birthday: { icon: Cake, tone: "bg-amber-soft text-amber" },
  anniversary: { icon: Medal, tone: "bg-primary-soft text-text" },
  joined: { icon: UserPlus, tone: "bg-green-soft text-green" },
  holiday: { icon: Palmtree, tone: "bg-blue-soft text-blue" },
};

// What is coming up this month: birthdays, work anniversaries, new joiners, holidays.
export async function MonthEvents({ officeId }: { officeId?: string | null }) {
  const events = await monthEvents(officeId);
  const today = todayIn();
  const month = new Date(today + "T00:00:00Z").toLocaleDateString("en-IN", { month: "long", timeZone: "UTC" });
  return (
    <section className="card">
      <h2 className="h2"><CalendarHeart /> Coming up in {month}</h2>
      {events.length ? (
        <ul className="grid gap-x-8 sm:grid-cols-2">
          {events.map((e, i) => {
            const { icon: Icon, tone } = KIND[e.kind];
            const d = new Date(e.date + "T00:00:00Z");
            return (
              <li key={`${e.date}-${i}`} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${tone}`}><Icon className="size-4" /></span>
                <span className="min-w-0 flex-1 text-sm leading-snug">{e.text}</span>
                {e.date === today
                  ? <span className="badge badge-green">Today</span>
                  : <span className="shrink-0 text-xs text-muted tabular-nums">{d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty"><CalendarHeart /> Nothing else coming up this month.</p>
      )}
    </section>
  );
}
