"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HOLIDAYS, dept, today } from "@/lib/demo/data";
import { HR_OFFICE, derive, isStaff, useAllAttendance, useHrEmployees, useLeaveOn } from "@/lib/demo/hr";
import { workingDays } from "@/lib/payroll";
import { PageHeader } from "../../_parts";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export default function Analytics() {
  const t = today();
  const [month, setMonth] = useState(t.slice(0, 7));
  const [emps] = useHrEmployees();
  const { rows } = useAllAttendance();
  const onLeave = useLeaveOn();

  const from = `${month}-01`;
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const to = end < t ? end : t;
  const hols = new Set(HOLIDAYS.filter((h) => !h.office_id || h.office_id === HR_OFFICE).map((h) => h.date));
  const all = workingDays(from, to, [1, 2, 3, 4, 5], hols);

  const stats = emps.filter(isStaff).sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
    const days = all.filter((d) => d >= p.joined_on && (!p.exit_date || d <= p.exit_date));
    const mine = rows.filter((r) => r.employee_id === p.id && r.date >= from && r.date <= to);
    const leave = days.filter((d) => onLeave(p.id, d) && !mine.some((r) => r.date === d)).length;
    const hours = mine.map((r) => derive(r).hours ?? 0).filter((h) => h > 0);
    return {
      id: p.id, name: p.name, dept: dept(p.department_id)?.name ?? "No department", expected: days.length - leave, present: mine.length, leave,
      wfh: mine.filter((r) => r.mode === "wfh").length, late: mine.filter((r) => derive(r).late).length, early: mine.filter((r) => derive(r).early).length, hours,
    };
  });
  type Stat = (typeof stats)[number];
  const sum = (k: "expected" | "present" | "wfh" | "late" | "leave") => stats.reduce((s, x) => s + x[k], 0);
  const present = sum("present");
  const absentOf = (s: Stat) => Math.max(0, s.expected - s.present);

  const dates: string[] = [];
  for (let d = Date.parse(from + "T00:00:00Z"); d <= Date.parse(to + "T00:00:00Z"); d += 864e5) dates.push(new Date(d).toISOString().slice(0, 10));
  const head = stats.length;
  const ids = new Set(stats.map((s) => s.id));
  const daily = dates.map((d) => {
    const day = rows.filter((r) => r.date === d && ids.has(r.employee_id));
    return { d, n: day.length, late: day.filter((r) => derive(r).late).length };
  });

  const byDept = new Map<string, Stat[]>();
  for (const s of stats) byDept.set(s.dept, [...(byDept.get(s.dept) ?? []), s]);
  const depts = [...byDept].map(([name, xs]) => ({ dept: name, people: xs.length, rate: pct(xs.reduce((s, x) => s + x.present, 0), xs.reduce((s, x) => s + x.expected, 0)), late: xs.reduce((s, x) => s + x.late, 0) })).sort((a, b) => a.rate - b.rate);

  const tiles: [string, string, string?][] = [
    ["Attendance rate", `${pct(present, sum("expected"))}%`, `${present} of ${sum("expected")} expected days`],
    ["Late check-ins", String(sum("late")), `${pct(sum("late"), present)}% of check-ins`],
    ["Work from home", `${pct(sum("wfh"), present)}%`, `${sum("wfh")} days`],
    ["Average day", `${avg(stats.flatMap((s) => s.hours)).toFixed(1)} h`, `${sum("leave")} leave days taken`],
  ];

  return (
    <>
      <PageHeader title="Attendance analytics" sub={new Date(from + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" }) + ` · ${head} people`}>
        <Link href="/demo/hr/attendance" className="btn btn-ghost"><ArrowLeft /> Attendance</Link>
      </PageHeader>
      <div className="space-y-6">
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => e.preventDefault()}>
          <input type="month" value={month} max={t.slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="input w-auto" />
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
          <div className="flex h-40 items-end gap-0.5" role="img" aria-label="Share of people checked in each day">
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
