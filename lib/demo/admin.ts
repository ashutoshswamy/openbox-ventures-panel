"use client";
// Admin/manager panel demo state + sample data (keys prefixed "adm:").
import { DEPARTMENTS, EMPLOYEES, HOLIDAYS, LEAVE_TYPES, OFFICES, daysFrom, emp, today, type DemoEmployee, type Department, type Holiday, type Office } from "./data";
import { useCheckins, type Attendance } from "./shared";
import { useDemo } from "./store";
import { zonedIso } from "@/lib/util";
import { breakdown, daysIn, type Pay } from "@/lib/payroll";

export type AdmEmp = DemoEmployee & { active: boolean; invited?: boolean; exit_date: string | null };
export const useEmps = () => useDemo<AdmEmp[]>("adm:emps", () => EMPLOYEES.map((e) => ({ ...e, active: true, exit_date: null })));

export type AdmOffice = Office & { timezone: string; lat: number | null; lng: number | null; work_days: number[] };
export const useOffices = () =>
  useDemo<AdmOffice[]>("adm:offices", () =>
    OFFICES.map((o, i) => ({ ...o, timezone: "Asia/Kolkata", lat: i ? 12.9784 : 18.5596, lng: i ? 77.6408 : 73.7868, work_days: [1, 2, 3, 4, 5] })));
export const useDepts = () => useDemo<Department[]>("adm:depts", () => [...DEPARTMENTS]);

export type AdmLeaveType = { id: string; name: string; paid: boolean; yearly_quota: number; accrual: "yearly" | "monthly"; carry_forward_max: number; allow_half_day: boolean; doc_required_after_days: number | null; active: boolean };
export const useLeaveTypes = () =>
  useDemo<AdmLeaveType[]>("adm:ltypes", () =>
    LEAVE_TYPES.map((t) => ({ id: t.id, name: t.name, paid: true, yearly_quota: t.entitled, accrual: "yearly", carry_forward_max: t.id === "lt3" ? 5 : 0, allow_half_day: true, doc_required_after_days: t.id === "lt2" ? 2 : null, active: true })));
export const useHolidays = () => useDemo<Holiday[]>("adm:holidays", () => [...HOLIDAYS]);

// Leave decisions: id -> who/note (LeaveReq itself has no reviewer fields)
export const useLeaveReviews = () => useDemo<Record<string, { by: string; note: string }>>("adm:leaverev", () => ({ l2: { by: "e3", note: "" }, l5: { by: "e2", note: "Get well soon" } }));

// Salary history per employee id
export type Salary = { id: string; annual_ctc: number; effective_from: string; note: string };
export const useSalaries = () =>
  useDemo<Record<string, Salary[]>>("adm:sal", () => Object.fromEntries(EMPLOYEES.filter((e) => e.role !== "admin").map((e) => [e.id, [{ id: "s" + e.id, annual_ctc: e.ctc, effective_from: e.joined_on, note: "Joining salary" }]])));
// Per-run, per-employee editable deductions
export type LineEdit = { lop: number; tds: number; other: number };
export const useLineEdits = () => useDemo<Record<string, Record<string, LineEdit>>>("adm:plines", () => ({}));
export const useRunNotes = () => useDemo<Record<string, string>>("adm:runnotes", () => ({}));

export type Chat = { id: string; name: string; members: string[] };
export const useChats = () => useDemo<Chat[]>("adm:chats", () => [{ id: "c1", name: "Leadership", members: ["e2", "e3", "e8"] }, { id: "c2", name: "Diwali party planning", members: ["e4", "e5", "e6", "e7"] }]);

// ---- attendance ----
const h = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const isWeekend = (d: string) => [0, 6].includes(new Date(d + "T00:00:00Z").getUTCDay());
export type AttRec = Attendance & { note?: string };
const seedAttendance = (): AttRec[] => {
  const out: AttRec[] = [];
  const live = new Set(["e1", "e2", "e3", "e4"]); // the people you can "be": their today comes from real check-ins
  for (const e of EMPLOYEES) {
    if (e.role === "admin") continue;
    const o = OFFICES.find((x) => x.id === e.office_id)!;
    for (let n = -14; n <= 0; n++) {
      const date = daysFrom(n);
      if (isWeekend(date) || (n === 0 && live.has(e.id)) || HOLIDAYS.some((x) => x.date === date)) continue;
      const k = h(e.id + date);
      if (k % 11 === 0) continue; // absent
      const start = Number(o.work_start.slice(0, 2)) * 60 + Number(o.work_start.slice(3));
      const inM = start - 10 + (k % 40) + (k % 7 === 0 ? 25 : 0);
      const outM = start + 9 * 60 - 10 + ((k >> 3) % 50) - (k % 13 === 0 ? 90 : 0);
      out.push({
        employee_id: e.id, date, in_at: zonedIso(date, hhmm(inM)), out_at: n === 0 ? null : zonedIso(date, hhmm(outM)),
        mode: k % 5 === 0 ? "wfh" : "office",
      });
    }
  }
  return out;
};
const useAttStore = () => useDemo<AttRec[]>("adm:att", seedAttendance);

export type AttRow = AttRec & { late: boolean; early_leave: boolean; hours: number | null };
const mins = (iso: string) => {
  const [a, b] = new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
  return a * 60 + b;
};
export function derive(a: AttRec): AttRow {
  const o = OFFICES.find((x) => x.id === emp(a.employee_id).office_id)!;
  const start = Number(o.work_start.slice(0, 2)) * 60 + Number(o.work_start.slice(3));
  const end = Number(o.work_end.slice(0, 2)) * 60 + Number(o.work_end.slice(3));
  return {
    ...a,
    late: mins(a.in_at) > start + o.grace_min,
    early_leave: !!a.out_at && mins(a.out_at) < end - 30,
    hours: a.out_at ? Math.round(((Date.parse(a.out_at) - Date.parse(a.in_at)) / 36e5) * 100) / 100 : null,
  };
}

// All attendance records (past sample + real check-ins) with derived flags, plus edit helpers.
export function useAttendance() {
  const [past, setPast] = useAttStore();
  const [live, setLive] = useCheckins();
  const rows = [...past, ...live].map(derive);
  const has = (list: AttRec[], id: string, date: string) => list.some((r) => r.employee_id === id && r.date === date);
  const upsert = (rec: AttRec) => {
    const put = (l: AttRec[]) => (has(l, rec.employee_id, rec.date) ? l.map((r) => (r.employee_id === rec.employee_id && r.date === rec.date ? rec : r)) : [...l, rec]);
    if (has(live, rec.employee_id, rec.date) || (!has(past, rec.employee_id, rec.date) && rec.date === today())) setLive(put);
    else setPast(put);
  };
  const remove = (id: string, date: string) => {
    const not = (r: AttRec) => !(r.employee_id === id && r.date === date);
    setPast((l) => l.filter(not));
    setLive((l) => l.filter(not));
  };
  return { rows, upsert, remove };
}

export const download = (name: string, text: string, type = "text/csv") => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};
export const csv = (rows: (string | number | null)[][]) => rows.map((r) => r.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");

// Salary sheet lines, computed live: active non-admins in the run's office (or all) that have a salary effective by month end.
// ponytail: default LOP is 0 (the real app derives it from absences); edit per line while the sheet is a draft.
export function runLines(run: { id: string; month: string; office_id: string }, emps: AdmEmp[], sal: Record<string, Salary[]>, edits: Record<string, Record<string, LineEdit>>) {
  const [y, m] = run.month.split("-").map(Number);
  const last = `${run.month.slice(0, 8)}${String(daysIn(y, m)).padStart(2, "0")}`;
  return emps
    .filter((e) => e.active && !e.invited && e.role !== "admin" && (!run.office_id || e.office_id === run.office_id))
    .flatMap((e) => {
      const cur = [...(sal[e.id] ?? [])].filter((x) => x.effective_from <= last).sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
      if (!cur) return [];
      const ed = edits[run.id]?.[e.id] ?? { lop: 0, tds: 0, other: 0 };
      return [{ id: e.id, name: e.name, ed, ...breakdown(cur.annual_ctc, { month: m, daysInMonth: daysIn(y, m), lopDays: ed.lop, tds: ed.tds, other: ed.other }) } as Pay & { id: string; name: string; ed: LineEdit }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
