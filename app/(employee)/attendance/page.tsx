import { Building2, CalendarX2, House, TriangleAlert } from "lucide-react";
import { employeePage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate, fmtTime, todayIn } from "@/lib/util";
import { Today } from "@/components/today";
import { PageHeader } from "@/components/shell";

export const metadata = { title: "Attendance" };

export default async function Attendance({ searchParams }: PageProps<"/attendance">) {
  const me = await employeePage();
  const month = String((await searchParams).month ?? todayIn().slice(0, 7));
  const [y, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  const { data: rows } = await db()
    .from("attendance_report")
    .select("*")
    .eq("employee_id", me.id)
    .gte("date", `${month}-01`)
    .lte("date", end)
    .order("date", { ascending: false });

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
        <Today employeeId={me.id} officeId={me.office_id} />

        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="h2 mb-0">History</h2>
            <form className="flex gap-2">
              <input type="month" name="month" defaultValue={month} className="input w-auto" />
              <button className="btn">Show</button>
            </form>
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
      </div>
    </>
  );
}
