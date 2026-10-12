// Employee-workspace demo helpers: seeded attendance history, leave balances, day counting.
import { HOLIDAYS, LEAVE_TYPES, daysFrom, type Office } from "./data";
import type { Attendance, LeaveReq } from "./shared";
import { DEFAULT_TZ } from "@/lib/util";
import { workingDays } from "@/lib/payroll";

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const hm = new Intl.DateTimeFormat("en-GB", { timeZone: DEFAULT_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const clockMin = (iso: string) => toMin(hm.format(new Date(iso)));
export const isoAt = (date: string, hhmm: string) => `${date}T${hhmm}:00+05:30`;

// ~3 weeks of deterministic past attendance for an employee (weekdays only, a few gaps, some WFH / late days)
export function history(empId: string): Attendance[] {
  const seed = [...empId].reduce((n, c) => n + c.charCodeAt(0), 0);
  const out: Attendance[] = [];
  for (let n = -1; n >= -24; n--) {
    const date = daysFrom(n);
    const dow = new Date(date + "T00:00:00Z").getUTCDay();
    const h = (seed * 7 + n * n * 13 + 5) % 17;
    if (dow === 0 || dow === 6 || h === 0) continue;
    const inM = 9 * 60 + 15 + ((h * 7) % 40); // 09:15 - 09:55
    const outM = 18 * 60 + 20 + ((h * 11) % 50);
    const t = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    out.push({ employee_id: empId, date, in_at: isoAt(date, t(inM)), out_at: isoAt(date, t(outM)), mode: h % 5 === 0 ? "wfh" : "office" });
  }
  return out;
}

export function derive(a: Attendance, off?: Office) {
  const start = toMin(off?.work_start ?? "09:30");
  const end = toMin(off?.work_end ?? "18:30");
  const grace = off?.grace_min ?? 15;
  const late = a.mode === "office" && clockMin(a.in_at) > start + grace;
  const early_leave = !!a.out_at && clockMin(a.out_at) < end;
  const hours = a.out_at ? Math.round(((Date.parse(a.out_at) - Date.parse(a.in_at)) / 36e5) * 100) / 100 : null;
  return { late, early_leave, hours };
}

export function balances(reqs: LeaveReq[], empId: string) {
  return LEAVE_TYPES.map((t) => {
    const mine = reqs.filter((r) => r.employee_id === empId && r.type_id === t.id);
    const sum = (f: (r: LeaveReq) => boolean) => mine.filter(f).reduce((s, r) => s + r.days, 0);
    const used = sum((r) => r.status === "approved");
    const pending = sum((r) => r.status === "pending" || r.status === "manager_approved");
    return { ...t, used, pending, balance: t.entitled - used - pending };
  });
}

export function leaveDays(from: string, to: string, half: boolean, officeId: string | null) {
  if (half) return 0.5;
  const hol = new Set(HOLIDAYS.filter((h) => !h.office_id || h.office_id === officeId).map((h) => h.date));
  return workingDays(from, to, [1, 2, 3, 4, 5], hol).length;
}
