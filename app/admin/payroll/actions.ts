"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/me";
import { db } from "@/lib/supabase";
import { str, todayIn } from "@/lib/util";
import { breakdown, daysIn, workingDays } from "@/lib/payroll";

// Payroll is admin + HR only. Every write is a SQL function that re-checks role, scope and status.

async function payrollStaff() {
  const me = await requireStaff();
  if (me.role !== "admin" && me.role !== "hr") throw new Error("Forbidden");
  return me;
}

function done() {
  revalidatePath("/", "layout");
}

const n = (fd: FormData, k: string) => Number(str(fd, k) ?? 0);
const prevDay = (d: string) => new Date(Date.parse(d + "T00:00:00Z") - 864e5).toISOString().slice(0, 10);

// ── Salary ──

export async function addSalary(fd: FormData) {
  await payrollStaff();
  const ctc = n(fd, "annual_ctc");
  if (!(ctc > 0)) return "Enter the annual CTC";
  const { error } = await db().rpc("add_salary", { p_emp: str(fd, "employee_id"), p_ctc: ctc, p_from: str(fd, "effective_from"), p_note: str(fd, "note") });
  if (error) return error.message;
  done();
}

// ── Salary sheet ──

// Draft sheet for a month: one line per active non-admin employee with a salary (HR: own office, admin: chosen office or all).
// LOP days default = approved unpaid leave + absent working days.
// ponytail: absent = working day (office work_days, not a holiday), from joined_on, before today, with no attendance and no approved leave.
// Half-day leave counts as present. Mid-month increments aren't prorated: the salary effective on the last day applies.
export async function createRun(fd: FormData) {
  const me = await payrollStaff();
  const ym = str(fd, "month");
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "Pick a month";
  const month = ym + "-01";
  const [y, mo] = ym.split("-").map(Number);
  const last = `${ym}-${String(daysIn(y, mo)).padStart(2, "0")}`;
  const office = me.role === "admin" ? str(fd, "office_id") : me.office_id;
  if (me.role === "hr" && !office) return "You are not assigned to an office";
  const today = todayIn();
  const sb = db();

  let q = sb.from("employees").select("id, office_id, joined_on, exit_date").eq("active", true).or("role.is.null,role.neq.admin").neq("id", me.id);
  if (office) q = q.eq("office_id", office);
  const { data: emps, error: e1 } = await q;
  if (e1) return e1.message;
  if (!emps?.length) return "No employees in scope";
  const ids = emps.map((e) => e.id);

  const [sal, offs, hol, att, lv] = await Promise.all([
    sb.from("employee_salaries").select("employee_id, annual_ctc, effective_from").in("employee_id", ids).lte("effective_from", last).order("effective_from", { ascending: false }),
    sb.from("offices").select("id, work_days"),
    sb.from("holidays").select("office_id, date").gte("date", month).lte("date", last),
    sb.from("attendance").select("employee_id, date").in("employee_id", ids).gte("date", month).lte("date", last),
    sb.from("leave_requests").select("employee_id, start_date, end_date, half_day, type:leave_types(paid)").in("employee_id", ids).eq("status", "approved").lte("start_date", last).gte("end_date", month),
  ]);
  const err = sal.error ?? offs.error ?? hol.error ?? att.error ?? lv.error;
  if (err) return err.message;

  const lines = [];
  for (const e of emps) {
    const ctc = sal.data?.find((s) => s.employee_id === e.id)?.annual_ctc; // first = latest
    if (!ctc) continue;
    const wd = offs.data?.find((o) => o.id === e.office_id)?.work_days ?? [1, 2, 3, 4, 5];
    const holidays = new Set(hol.data?.filter((h) => !h.office_id || h.office_id === e.office_id).map((h) => h.date));
    const days = (from: string, to: string) => (from <= to ? workingDays(from, to, wd, holidays) : []);
    const mine = lv.data?.filter((l) => l.employee_id === e.id) ?? [];

    let unpaid = 0;
    const onLeave = new Set<string>();
    for (const l of mine) {
      const d = days(l.start_date < month ? month : l.start_date, l.end_date > last ? last : l.end_date);
      d.forEach((x) => onLeave.add(x));
      // type is a to-one join; supabase-js types it loosely
      if ((l.type as unknown as { paid: boolean } | null)?.paid === false) unpaid += d.length * (l.half_day ? 0.5 : 1);
    }
    const present = new Set(att.data?.filter((a) => a.employee_id === e.id).map((a) => a.date));
    const from = e.joined_on && e.joined_on > month ? e.joined_on : month;
    let to = prevDay(today) < last ? prevDay(today) : last; // up to yesterday
    if (e.exit_date && e.exit_date < to) to = e.exit_date;
    const absent = days(from, to).filter((d) => !present.has(d) && !onLeave.has(d)).length;

    const lopDays = unpaid + absent;
    const p = breakdown(Number(ctc), { month: mo, daysInMonth: daysIn(y, mo), lopDays });
    lines.push({ employee_id: e.id, ...p });
  }
  if (!lines.length) return "No employee in scope has a salary yet";

  const { error } = await sb.rpc("create_payroll_run", { p_month: month, p_office: office, p_lines: lines });
  if (error) return error.message;
  done();
}

export async function updateLine(fd: FormData) {
  await payrollStaff();
  const { error } = await db().rpc("update_payroll_line", { p_id: str(fd, "id"), p_lop: n(fd, "lop_days"), p_tds: n(fd, "tds"), p_other: n(fd, "other_deductions") });
  if (error) return error.message;
  done();
}

export async function submitRun(fd: FormData) {
  await payrollStaff();
  const { error } = await db().rpc("submit_payroll_run", { p_id: str(fd, "id") });
  if (error) return error.message;
  done();
}

export async function reviewRun(fd: FormData) {
  const me = await payrollStaff();
  if (me.role !== "admin") throw new Error("Forbidden");
  const { error } = await db().rpc("review_payroll_run", { p_id: str(fd, "id"), p_approve: str(fd, "decision") === "approve", p_note: str(fd, "note") });
  if (error) return error.message;
  done();
}

export async function deleteRun(fd: FormData) {
  await payrollStaff();
  const { error } = await db().rpc("delete_payroll_run", { p_id: str(fd, "id") });
  if (error) return error.message;
  done();
}
