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
