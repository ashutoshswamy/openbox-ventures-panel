import { Building2, CalendarDays, CalendarX2, ClockAlert, House, Send, TriangleAlert } from "lucide-react";
import { employeePage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { LEAVE_TONE, fmtDate, fmtTime, todayIn } from "@/lib/util";
import { daysWithin, eachDay, isoDow, monthRange, validMonth } from "@/lib/calendar";
import { AutoForm } from "@/components/auto-form";
import { MonthCalendar, type CalCell } from "@/components/month-calendar";
import { ActionForm } from "@/components/action-form";
import { Today } from "@/components/today";
import { PageHeader } from "@/components/shell";
import { requestRegularization } from "../actions";

const REG_LIMIT = 5; // keep in step with request_regularization()

export const metadata = { title: "Attendance" };

export default async function Attendance({ searchParams }: PageProps<"/attendance">) {
  const me = await employeePage();
  const today = todayIn();
  const month = validMonth((await searchParams).month, today.slice(0, 7));
  const { from, to: end } = monthRange(month);
  const sb = db();

  const [{ data: rows }, { data: regs }, { data: office }, { data: holidays }, { data: leaves }, { data: self }] = await Promise.all([
    sb.from("attendance_report").select("*").eq("employee_id", me.id).gte("date", `${month}-01`).lte("date", end).order("date", { ascending: false }),
    sb.from("regularizations").select("*").eq("employee_id", me.id).gte("date", `${month}-01`).lte("date", end).order("date", { ascending: false }),
    me.office_id ? sb.from("offices").select("work_days").eq("id", me.office_id).maybeSingle() : { data: null },
    sb.from("holidays").select("date, name, office_id").gte("date", from).lte("date", end),
    sb.from("leave_requests").select("start_date, end_date, type:leave_types(name)").eq("employee_id", me.id).eq("status", "approved").lte("start_date", end).gte("end_date", from),
    sb.from("employees").select("joined_on").eq("id", me.id).maybeSingle(),
  ]);
  const regUsed = regs?.filter((r) => r.status === "pending" || r.status === "approved").length ?? 0;

  // one cell per day: what happened (or what was expected)
  const workDays = office?.work_days ?? [1, 2, 3, 4, 5];
  const cells: Record<string, CalCell> = {};
  for (const d of eachDay(from, end)) {
    const r = rows?.find((x) => x.date === d);
    const leave = leaves?.find((l) => daysWithin(l.start_date, l.end_date, from, end).includes(d));
    const hol = holidays?.find((h) => h.date === d && (!h.office_id || h.office_id === me.office_id));
    const off = !workDays.includes(isoDow(d));
    if (r) {
      cells[d] = { lines: [
        { text: r.mode === "wfh" ? "Home" : "Office", tone: r.mode === "wfh" ? "blue" : "green" },
        { text: `${fmtTime(r.check_in_at, r.timezone)} - ${r.check_out_at ? fmtTime(r.check_out_at, r.timezone) : "now"}` },
        ...(r.late ? [{ text: "Late", tone: "amber" as const }] : []),
      ] };
    } else if (leave) cells[d] = { lines: [{ text: (leave.type as { name?: string } | null)?.name ?? "Leave", tone: "amber" }] };
    else if (hol) cells[d] = { lines: [{ text: hol.name, tone: "blue" }], off: true };
    else if (off) cells[d] = { off: true };
    else if (d < today && (!self?.joined_on || d >= self.joined_on)) cells[d] = { lines: [{ text: "Absent", tone: "red" }] };
  }

  const stats = [
    ["Days present", rows?.length ?? 0],
    ["In office", rows?.filter((r) => r.mode === "office").length ?? 0],
    ["From home", rows?.filter((r) => r.mode === "wfh").length ?? 0],
    ["Late arrivals", rows?.filter((r) => r.late).length ?? 0],
  ] as const;

  return (
    <>
      <PageHeader title="Attendance" sub="Check in each day and review your history." />
      <div className="space-y-6">
        <Today officeId={me.office_id} />

        <section className="card">
          <h2 className="h2"><CalendarDays /> Calendar</h2>
          <MonthCalendar month={month} cells={cells} today={today} legend={[["green", "Office"], ["blue", "Home / holiday"], ["amber", "Late / leave"], ["red", "Absent"]]} />
        </section>

        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="h2 mb-0">History</h2>
            <AutoForm className="flex gap-2">
              <input type="month" name="month" defaultValue={month} className="input w-auto" />
            </AutoForm>
          </div>
          <dl className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface-2/70 px-4 py-3">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {rows?.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Date</th><th>Where</th><th>In</th><th>Out</th><th>Hours</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{fmtDate(r.date)}</td>
                      <td>
                        <span className={`badge ${r.mode === "wfh" ? "badge-blue" : "badge-green"}`}>
                          {r.mode === "wfh" ? <><House /> Home</> : <><Building2 /> Office</>}
                        </span>
                      </td>
                      <td className="tabular-nums">{fmtTime(r.check_in_at, r.timezone)}</td>
                      <td className="tabular-nums">{fmtTime(r.check_out_at, r.timezone)}</td>
                      <td className="tabular-nums">{r.hours ?? "-"}</td>
                      <td className="space-x-1">
                        {r.late && <span className="badge badge-amber"><TriangleAlert /> Late</span>}
                        {r.early_leave && <span className="badge">Left early</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty"><CalendarX2 /> No attendance recorded this month.</p>
          )}
        </section>

        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="h2 mb-0"><ClockAlert /> Regularization</h2>
            <span className="text-sm text-muted tabular-nums">{regUsed} / {REG_LIMIT} used this month · approved by HR</span>
          </div>
          <ActionForm action={requestRegularization} className="mb-6 grid gap-4 sm:grid-cols-4">
            <label className="field">Date<input type="date" name="date" required max={todayIn()} className="input" /></label>
            <label className="field">Where
              <select name="mode" className="input"><option value="office">Office</option><option value="wfh">Home</option></select>
            </label>
            <label className="field">In<input type="time" name="check_in" required className="input" /></label>
            <label className="field">Out<input type="time" name="check_out" required className="input" /></label>
            <label className="field sm:col-span-3">Reason<input name="reason" required maxLength={500} placeholder="Forgot to check in, network issue..." className="input" /></label>
            <div className="flex items-end"><button className="btn btn-primary w-full"><Send /> Request</button></div>
          </ActionForm>
          {!!regs?.length && (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Date</th><th>In</th><th>Out</th><th>Reason</th><th>Status</th></tr></thead>
                <tbody>
                  {regs.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{fmtDate(r.date)}</td>
                      <td className="tabular-nums">{fmtTime(r.check_in_at)}</td>
                      <td className="tabular-nums">{fmtTime(r.check_out_at)}</td>
                      <td className="text-sm">{r.reason}</td>
                      <td>
                        <span className={`badge capitalize ${LEAVE_TONE[r.status]}`}>{r.status}</span>
                        {r.review_note && <div className="mt-1 text-xs text-muted">{r.review_note}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
