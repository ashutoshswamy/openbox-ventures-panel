import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { workingDays } from "@/lib/payroll";
import { todayIn } from "@/lib/util";
import { PageHeader } from "@/components/shell";

export const metadata = { title: "Attendance analytics" };

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

type Stat = { id: string; name: string; dept: string; expected: number; present: number; wfh: number; late: number; early: number; leave: number; hours: number[] };

// Month view per person / department / day. RLS scopes rows (manager: own dept, branch head + HR: own office).
// ponytail: computed in JS from one month of rows; move to a SQL view if headcount reaches the thousands.
export default async function Analytics({ searchParams }: PageProps<"/admin/attendance/analytics">) {
  const me = await staffPage();
  const sp = await searchParams;
  const today = todayIn();
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) && String(sp.month) <= today.slice(0, 7) ? String(sp.month) : today.slice(0, 7);
  const office = me.role === "admin" ? (sp.office ? String(sp.office) : null) : me.office_id;
  const from = `${month}-01`;
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const to = end < today ? end : today; // only days that have happened
  const sb = db();

  let emps = sb.from("employees").select("id, full_name, office_id, joined_on, exit_date, department:departments(name)").eq("active", true).not("clerk_user_id", "is", null).or("role.is.null,role.neq.admin").order("full_name");
  if (office) emps = emps.eq("office_id", office);
  if (me.role === "manager") emps = emps.eq("department_id", me.department_id ?? ""); // RLS shows them only their department's attendance
  // PostgREST returns at most 1000 rows per request: page through the month
  const att = async () => {
    const all: { employee_id: string; date: string; mode: string; late: boolean; early_leave: boolean; hours: number | null }[] = [];
    for (let i = 0; ; i += 1000) {
      let q = sb.from("attendance_report").select("employee_id, date, mode, late, early_leave, hours").gte("date", from).lte("date", to).order("id").range(i, i + 999);
      if (office) q = q.eq("office_id", office);
      const { data } = await q;
      all.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) return { data: all };
    }
  };
  const [{ data: people }, { data: offices }, { data: rows }, { data: leaves }, { data: hols }] = await Promise.all([
    emps,
    sb.from("offices").select("id, name, work_days").order("name"),
    att(),
    sb.from("leave_requests").select("employee_id, start_date, end_date").eq("status", "approved").lte("start_date", to).gte("end_date", from),
    sb.from("holidays").select("office_id, date").gte("date", from).lte("date", to),
  ]);

  // working days per office (own work_days minus own + company-wide holidays)
  const daysOf = new Map<string | null, string[]>();
  const workDaysFor = (officeId: string | null) => {
    if (!daysOf.has(officeId)) {
      const o = offices?.find((x) => x.id === officeId);
      const h = new Set(hols?.filter((x) => x.office_id === null || x.office_id === officeId).map((x) => x.date));
      daysOf.set(officeId, workingDays(from, to, o?.work_days ?? [1, 2, 3, 4, 5], h));
    }
    return daysOf.get(officeId)!;
  };

  const stats: Stat[] = (people ?? []).map((p) => {
    const days = workDaysFor(p.office_id).filter((d) => (!p.joined_on || d >= p.joined_on) && (!p.exit_date || d <= p.exit_date));
    const mine = rows?.filter((r) => r.employee_id === p.id) ?? [];
    const leaveDays = days.filter((d) => leaves?.some((l) => l.employee_id === p.id && l.start_date <= d && l.end_date >= d) && !mine.some((r) => r.date === d)).length;
    return {
      id: p.id, name: p.full_name, dept: (p.department as unknown as { name: string } | null)?.name ?? "No department",
      expected: days.length - leaveDays, present: mine.length, leave: leaveDays,
      wfh: mine.filter((r) => r.mode === "wfh").length, late: mine.filter((r) => r.late).length, early: mine.filter((r) => r.early_leave).length,
      hours: mine.map((r) => Number(r.hours)).filter((h) => h > 0),
    };
  });
  const sum = (k: "expected" | "present" | "wfh" | "late" | "leave") => stats.reduce((s, x) => s + x[k], 0);
  const present = sum("present");
  const absentOf = (s: Stat) => Math.max(0, s.expected - s.present);

  // daily presence: share of headcount checked in, per calendar day up to today
  const dates: string[] = [];
  for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += 864e5) dates.push(new Date(t).toISOString().slice(0, 10));
  const head = stats.length;
  const daily = dates.map((d) => ({ d, n: rows?.filter((r) => r.date === d).length ?? 0, late: rows?.filter((r) => r.date === d && r.late).length ?? 0 }));

  const byDept = new Map<string, Stat[]>();
  for (const s of stats) byDept.set(s.dept, [...(byDept.get(s.dept) ?? []), s]);
  const depts = [...byDept].map(([dept, xs]) => ({
    dept, people: xs.length,
    rate: pct(xs.reduce((s, x) => s + x.present, 0), xs.reduce((s, x) => s + x.expected, 0)),
    late: xs.reduce((s, x) => s + x.late, 0),
  })).sort((a, b) => a.rate - b.rate);

  const tiles: [string, string, string?][] = [
    ["Attendance rate", `${pct(present, sum("expected"))}%`, `${present} of ${sum("expected")} expected days`],
    ["Late check-ins", String(sum("late")), `${pct(sum("late"), present)}% of check-ins`],
    ["Work from home", `${pct(sum("wfh"), present)}%`, `${sum("wfh")} days`],
    ["Average day", `${avg(stats.flatMap((s) => s.hours)).toFixed(1)} h`, `${sum("leave")} leave days taken`],
  ];
  const base = me.role === "hr" ? "/hr" : "/admin";

  return (
    <>
      <PageHeader title="Attendance analytics" sub={new Date(from + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" }) + ` · ${head} people`}>
        <Link href={`${base}/attendance`} className="btn btn-ghost"><ArrowLeft /> Attendance</Link>
      </PageHeader>
      <div className="space-y-6">
        <form className="flex flex-wrap items-center gap-2">
          <input type="month" name="month" defaultValue={month} max={today.slice(0, 7)} className="input w-auto" />
          {me.role === "admin" && (
            <select name="office" defaultValue={office ?? ""} className="input w-auto">
              <option value="">All offices</option>
              {offices?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <button className="btn">Show</button>
        </form>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map(([k, v, hint]) => (
            <div key={k} className="card">
              <div className="text-sm text-muted">{k}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{v}</div>
              {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
            </div>
          ))}
        </div>

        <section className="card">
          <h2 className="h2">Checked in per day</h2>
          <div className="flex h-40 items-end gap-0.5" role="img" aria-label="Share of people checked in each day; table below has the numbers">
            {daily.map(({ d, n, late }) => (
              <div key={d} title={`${d.slice(8)} ${new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" })}: ${n} of ${head} in (${pct(n, head)}%)${late ? `, ${late} late` : ""}`} className="group flex h-full min-w-1 flex-1 cursor-default items-end">
                <div className="w-full rounded-t-[4px] bg-text/80 transition-colors group-hover:bg-text" style={{ height: `${Math.max(pct(n, head), n ? 2 : 0)}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted tabular-nums"><span>{from.slice(8)}</span><span>{to.slice(8)}</span></div>
        </section>

        {depts.length > 1 && (
          <section className="card overflow-x-auto">
            <h2 className="h2">By department</h2>
            <table className="table">
              <thead><tr><th>Department</th><th className="text-right">People</th><th className="w-1/2">Attendance rate</th><th className="text-right">Late</th></tr></thead>
              <tbody className="tabular-nums">
                {depts.map((d) => (
                  <tr key={d.dept}>
                    <td className="font-medium">{d.dept}</td>
                    <td className="text-right">{d.people}</td>
                    <td><span className="flex items-center gap-2"><span className="h-2 flex-1 rounded-full bg-surface-2"><span className="block h-2 rounded-full bg-text/80" style={{ width: `${d.rate}%` }} /></span><span className="w-10 text-right">{d.rate}%</span></span></td>
                    <td className="text-right">{d.late}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="card overflow-x-auto">
          <h2 className="h2">By person</h2>
          <table className="table">
            <thead><tr><th>Employee</th><th className="text-right">Present</th><th className="text-right">Absent</th><th className="text-right">Leave</th><th className="text-right">WFH</th><th className="text-right">Late</th><th className="text-right">Left early</th><th className="text-right">Avg hours</th></tr></thead>
            <tbody className="tabular-nums">
              {[...stats].sort((a, b) => absentOf(b) - absentOf(a) || b.late - a.late).map((s) => (
                <tr key={s.id}>
                  <td><div className="font-medium">{s.name}</div><div className="text-xs text-muted">{s.dept}</div></td>
                  <td className="text-right">{s.present}<span className="text-muted">/{s.expected}</span></td>
                  <td className="text-right">{absentOf(s) ? <span className="badge badge-red">{absentOf(s)}</span> : 0}</td>
                  <td className="text-right">{s.leave}</td>
                  <td className="text-right">{s.wfh}</td>
                  <td className="text-right">{s.late ? <span className="badge badge-amber">{s.late}</span> : 0}</td>
                  <td className="text-right">{s.early}</td>
                  <td className="text-right">{s.hours.length ? avg(s.hours).toFixed(1) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
