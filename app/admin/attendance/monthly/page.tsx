import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { eachDay, isoDow } from "@/lib/calendar";
import { fmtTime, todayIn } from "@/lib/util";
import { AutoForm } from "@/components/auto-form";
import { PageHeader } from "@/components/shell";
import { PersonSelect } from "@/components/person-select";

export const metadata = { title: "Monthly attendance" };

type Code = "P" | "W" | "A" | "L" | "H" | "OFF" | "";
const TONE: Record<Code, string> = {
  P: "bg-green-soft text-green", W: "bg-blue-soft text-blue", A: "bg-red-soft text-red", L: "bg-amber-soft text-amber",
  H: "bg-surface-2 text-muted", OFF: "bg-surface-2 text-muted", "": "",
};
const LEGEND: [Code, string][] = [["P", "Present"], ["W", "Work from home"], ["A", "Absent"], ["L", "Leave"], ["H", "Holiday"], ["OFF", "Off day"]];

// Month grid: one row per person, one column per day, with totals. RLS scopes rows (manager: own dept, branch head + HR: own office).
export default async function Monthly({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await staffPage();
  const sp = await searchParams;
  const today = todayIn();
  const month = /^\d{4}-\d{2}$/.test(String(sp.month)) && String(sp.month) <= today.slice(0, 7) ? String(sp.month) : today.slice(0, 7);
  const office = me.role === "admin" ? (sp.office ? String(sp.office) : null) : me.office_id;
  const emp = sp.emp ? String(sp.emp) : null;
  const dept = sp.dept ? String(sp.dept) : null;
  const from = `${month}-01`;
  const to = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const days = eachDay(from, to);
  const sb = db();

  let emps = sb.from("employees").select("id, full_name, employee_code, office_id, department_id, joined_on, exit_date, office:offices(name), department:departments(name)").eq("active", true).not("clerk_user_id", "is", null).or("role.is.null,role.neq.admin").order("full_name");
  if (office) emps = emps.eq("office_id", office);
  if (me.role === "manager") emps = emps.eq("department_id", me.department_id ?? "");
  else if (dept) emps = emps.eq("department_id", dept);
  // PostgREST returns at most 1000 rows per request: page through the month
  const att = async () => {
    const all: { employee_id: string; date: string; mode: string; late: boolean; check_in_at: string; check_out_at: string | null }[] = [];
    for (let i = 0; ; i += 1000) {
      let q = sb.from("attendance_report").select("employee_id, date, mode, late, check_in_at, check_out_at").gte("date", from).lte("date", to).order("id").range(i, i + 999);
      if (office) q = q.eq("office_id", office);
      const { data } = await q;
      all.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) return all;
    }
  };
  const [{ data: all }, { data: offices }, { data: depts }, rows, { data: leaves }, { data: hols }] = await Promise.all([
    emps,
    sb.from("offices").select("id, name, work_days, timezone").order("name"),
    sb.from("departments").select("id, name, office_id").order("name"),
    att(),
    sb.from("leave_requests").select("employee_id, start_date, end_date").eq("status", "approved").lte("start_date", to).gte("end_date", from),
    sb.from("holidays").select("office_id, date").gte("date", from).lte("date", to),
  ]);
  const people = (all ?? []).filter((p) => !emp || p.id === emp);
  const byEmp = new Map<string, Map<string, (typeof rows)[number]>>();
  for (const r of rows) (byEmp.get(r.employee_id) ?? byEmp.set(r.employee_id, new Map()).get(r.employee_id)!).set(r.date, r);

  const grid = people.map((p) => {
    const o = offices?.find((x) => x.id === p.office_id);
    const tz = o?.timezone ?? undefined;
    const workDays: number[] = o?.work_days ?? [1, 2, 3, 4, 5];
    const hol = new Set(hols?.filter((h) => h.office_id === null || h.office_id === p.office_id).map((h) => h.date));
    const mine = byEmp.get(p.id);
    const tot = { P: 0, L: 0, H: 0, A: 0, OFF: 0 };
    const cells = days.map((d) => {
      const r = mine?.get(d);
      let code: Code = "", tip = "";
      if ((p.joined_on && d < p.joined_on) || (p.exit_date && d > p.exit_date)) code = "";
      else if (r) { code = r.mode === "wfh" ? "W" : "P"; tip = `In ${fmtTime(r.check_in_at, tz)} · Out ${fmtTime(r.check_out_at, tz)}${r.late ? " · Late" : ""}`; tot.P++; }
      else if (hol.has(d)) { code = "H"; tot.H++; }
      else if (!workDays.includes(isoDow(d))) { code = "OFF"; tot.OFF++; }
      else if (leaves?.some((l) => l.employee_id === p.id && l.start_date <= d && l.end_date >= d)) { code = "L"; tot.L++; }
      else if (d < today) { code = "A"; tot.A++; }
      return { d, code, tip, late: !!r?.late };
    });
    return { p, cells, tot };
  });
  const base = me.role === "hr" ? "/hr" : "/admin";

  return (
    <>
      <PageHeader title="Monthly attendance" sub={new Date(from + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" }) + ` · ${people.length} people`}>
        <Link href={`${base}/attendance`} className="btn btn-ghost"><ArrowLeft /> Attendance</Link>
      </PageHeader>
      <div className="space-y-4">
        <AutoForm className="flex flex-wrap items-center gap-2">
          <input type="month" name="month" defaultValue={month} max={today.slice(0, 7)} className="input w-auto" />
          <PersonSelect name="emp" defaultValue={emp} empty="All employees" ariaLabel="Employee" submitOnPick className="input w-56" options={(all ?? []).map((p) => ({ id: p.id, label: p.full_name }))} />
          {me.role === "admin" && (
            <select name="office" defaultValue={office ?? ""} className="input w-auto">
              <option value="">All offices</option>
              {offices?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          {me.role !== "manager" && (
            <select name="dept" defaultValue={dept ?? ""} className="input w-auto" aria-label="Department">
              <option value="">All departments</option>
              {depts?.filter((d) => !office || d.office_id === office).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </AutoForm>

        <section className="card overflow-x-auto p-0">
          <table className="w-max border-separate border-spacing-0 text-xs tabular-nums">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-48 border-b border-line bg-surface-2 px-3 py-2 text-left">Employee</th>
                {days.map((d) => (
                  <th key={d} className={`min-w-9 border-b border-line px-1 py-1.5 text-center font-medium ${isoDow(d) > 5 ? "bg-surface-2/60" : "bg-surface-2"}`}>
                    <div>{Number(d.slice(8))}</div>
                    <div className="font-normal text-muted">{new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" })}</div>
                  </th>
                ))}
                {(["P", "L", "H", "A", "OFF"] as const).map((k) => <th key={k} className="min-w-9 border-b border-l border-line bg-surface-2 px-1 py-2 text-center first:border-l-0">{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {grid.map(({ p, cells, tot }) => (
                <tr key={p.id} className="hover:bg-surface-2/50">
                  <td className="sticky left-0 z-10 border-b border-line bg-surface px-3 py-1.5">
                    <div className="font-medium">{p.full_name}{p.employee_code && <span className="font-normal text-muted"> [{p.employee_code}]</span>}</div>
                    <div className="text-[11px] text-muted">{[(p.department as unknown as { name: string } | null)?.name, (p.office as unknown as { name: string } | null)?.name].filter(Boolean).join(", ")}</div>
                  </td>
                  {cells.map((c) => (
                    <td key={c.d} className="border-b border-line p-0.5 text-center" title={c.tip || undefined}>
                      {c.code && <span className={`block rounded py-1.5 font-medium ${TONE[c.code]} ${c.late ? "ring-1 ring-amber ring-inset" : ""}`}>{c.code === "W" ? "WFH" : c.code}</span>}
                    </td>
                  ))}
                  {([tot.P, tot.L, tot.H, tot.A, tot.OFF]).map((n, i) => <td key={i} className="border-b border-l border-line px-1 text-center font-medium first:border-l-0">{n}</td>)}
                </tr>
              ))}
              {!grid.length && <tr><td className="px-3 py-6 text-muted" colSpan={days.length + 6}>No employees match.</td></tr>}
            </tbody>
          </table>
        </section>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {LEGEND.map(([c, t]) => <li key={c} className="flex items-center gap-1.5"><span className={`rounded px-1.5 py-0.5 font-medium ${TONE[c]}`}>{c === "W" ? "WFH" : c}</span>{t}</li>)}
          <li className="flex items-center gap-1.5"><span className="rounded bg-green-soft px-1.5 py-0.5 font-medium text-green ring-1 ring-amber ring-inset">P</span>Late (hover a day for times)</li>
        </ul>
      </div>
    </>
  );
}
