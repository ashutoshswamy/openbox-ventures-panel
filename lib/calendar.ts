// Date helpers for month views. All dates are "YYYY-MM-DD" strings, computed in UTC so they never shift with the viewer's timezone.
export const validMonth = (v: unknown, fallback: string) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v)) ? String(v) : fallback);

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}

export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

export type View = "day" | "week" | "month";

export function validDay(v: unknown, fallback: string) {
  const s = String(v), t = Date.parse(s + "T00:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(t) && new Date(t).toISOString().slice(0, 10) === s ? s : fallback;
}

export const shiftDay = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

export function viewRange(view: View, at: string) {
  if (view === "day") return { from: at, to: at };
  if (view === "week") { const from = shiftDay(at, 1 - isoDow(at)); return { from, to: shiftDay(from, 6) }; }
  return monthRange(at.slice(0, 7));
}

export const shiftView = (view: View, at: string, n: number) => (view === "month" ? shiftMonth(at.slice(0, 7), n) + "-01" : shiftDay(at, n * (view === "week" ? 7 : 1)));

// ?view=day|week|month&at=YYYY-MM-DD (legacy ?month=YYYY-MM still works) → the visible range
export function calView(sp: { view?: unknown; at?: unknown; month?: unknown }, fallback: string) {
  const view: View = sp.view === "day" || sp.view === "week" ? sp.view : "month";
  const at = validDay(sp.at, validMonth(sp.month, "") ? `${sp.month}-01` : fallback);
  return { view, at, ...viewRange(view, at) };
}

// inclusive; empty when end < start
export function eachDay(start: string, end: string) {
  const out: string[] = [];
  for (let t = Date.parse(start + "T00:00:00Z"); t <= Date.parse(end + "T00:00:00Z"); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

// days of [start, end] that fall inside [from, to]
export const daysWithin = (start: string, end: string, from: string, to: string) => eachDay(start < from ? from : start, end > to ? to : end);

// ISO weekday: 1 = Mon … 7 = Sun
export function isoDow(date: string) {
  const d = new Date(date + "T00:00:00Z").getUTCDay();
  return d === 0 ? 7 : d;
}

// ?page=N → { page, from, to } for supabase .range(from, to)
export function pageOf(v: unknown, size: number) {
  const page = Math.max(1, Math.floor(Number(v)) || 1);
  return { page, from: (page - 1) * size, to: page * size - 1 };
}
