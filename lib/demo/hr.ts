"use client";
// HR portal demo state (all keys prefixed "hr:"). HR works for one office: Pune HQ (o1).
import { EMPLOYEES, HOLIDAYS, OFFICES, daysFrom, today, type DemoEmployee } from "./data";
import { useCheckins, useLeave } from "./shared";
import { useDemo } from "./store";

export const HR_OFFICE = "o1";
export const HR_OFFICE_ROW = OFFICES.find((o) => o.id === HR_OFFICE)!;

export type HrEmp = DemoEmployee & { active: boolean; exit_date: string | null };
export const useHrEmployees = () => useDemo<HrEmp[]>("hr:employees", () => EMPLOYEES.map((e) => ({ ...e, active: true, exit_date: null })));
// People who have attendance: active, in HR's office, not admin
export const isStaff = (e: HrEmp) => e.active && e.office_id === HR_OFFICE && e.role !== "admin";

// ---- attendance ----
export type AttRow = { id: string; employee_id: string; date: string; in: string; out: string | null; mode: "office" | "wfh"; note?: string; src: "hr" | "checkin" };
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const attId = (emp: string, date: string) => `${emp}:${date}`;

export function derive(r: AttRow) {
  const o = HR_OFFICE_ROW;
  const hours = r.out ? Math.round(((mins(r.out) - mins(r.in)) / 60) * 10) / 10 : null;
  return { late: mins(r.in) > mins(o.work_start) + o.grace_min, early: !!r.out && mins(r.out) < mins(o.work_end), hours };
}

// Deterministic sample: last 60 days for Pune staff
function seedAttendance(): AttRow[] {
  const holidays = new Set(HOLIDAYS.filter((h) => !h.office_id || h.office_id === HR_OFFICE).map((h) => h.date));
  const skip = new Set([attId("e4", daysFrom(-3)), attId("e5", daysFrom(-2)), attId("e4", daysFrom(-20)), attId("e7", daysFrom(-6)), attId("e7", daysFrom(-5)), attId("e4", today()), attId("e7", today())]);
  const out: AttRow[] = [];
  EMPLOYEES.filter((e) => e.office_id === HR_OFFICE && e.role !== "admin").forEach((e, ei) => {
    for (let n = -60; n <= 0; n++) {
      const date = daysFrom(n);
      const dow = new Date(date + "T00:00:00Z").getUTCDay();
      if (dow === 0 || dow === 6 || holidays.has(date) || date < e.joined_on || skip.has(attId(e.id, date))) continue;
      const h = Math.abs((ei + 3) * 7919 + (n + 100) * 104729) % 1000;
      if (h < 60) continue; // absent
      const inM = 560 + (h % 45);
      const outM = n === 0 ? null : 1095 + ((h * 7) % 55);
      out.push({ id: attId(e.id, date), employee_id: e.id, date, in: hhmm(inM), out: outM === null ? null : hhmm(outM), mode: h % 11 < 2 ? "wfh" : "office", src: "hr" });
    }
  });
  return out;
}
export const useHrAttendance = () => useDemo<AttRow[]>("hr:attendance", seedAttendance);

const isoHHMM = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
// HR rows + today's live check-ins from the employee workspace (HR rows win)
export function useAllAttendance() {
  const [hr, setHr] = useHrAttendance();
  const [checkins] = useCheckins();
  const live: AttRow[] = checkins
    .filter((c) => !hr.some((r) => r.id === attId(c.employee_id, c.date)))
    .map((c) => ({ id: attId(c.employee_id, c.date), employee_id: c.employee_id, date: c.date, in: isoHHMM(c.in_at), out: c.out_at ? isoHHMM(c.out_at) : null, mode: c.mode, src: "checkin" as const }));
  return { rows: [...hr, ...live], setHr };
}

// Approved leave covering a date (for "on leave")
export function useLeaveOn() {
  const [leave] = useLeave();
  return (emp: string, date: string) => leave.some((l) => l.status === "approved" && l.employee_id === emp && l.from <= date && l.to >= date);
}

// ---- salaries / payroll ----
export type Salary = { id: string; employee_id: string; annual_ctc: number; effective_from: string; note: string };
export const useSalaries = () =>
  useDemo<Salary[]>("hr:salaries", () => [
    ...EMPLOYEES.map((e) => ({ id: `s-${e.id}`, employee_id: e.id, annual_ctc: e.id === "e4" ? Math.round(e.ctc / 1.1) : e.ctc, effective_from: e.joined_on, note: "Joining salary" })),
    { id: "s-e4b", employee_id: "e4", annual_ctc: EMPLOYEES.find((e) => e.id === "e4")!.ctc, effective_from: daysFrom(-90), note: "Annual increment" },
  ]);
export const currentCtc = (sals: Salary[], emp: string) => [...sals].filter((s) => s.employee_id === emp && s.effective_from <= today()).sort((a, b) => a.effective_from.localeCompare(b.effective_from)).at(-1);

// Per-line deductions entered by HR, keyed `${runId}:${employeeId}`
export type LineEdit = { lop_days: number; tds: number; other: number };
export const useLineEdits = () => useDemo<Record<string, LineEdit>>("hr:lines", () => ({}));

// Review info on leave decisions (reviewer + note), keyed by leave id
export const useReviews = () => useDemo<Record<string, { by: string; note: string }>>("hr:reviews", () => ({}));

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
