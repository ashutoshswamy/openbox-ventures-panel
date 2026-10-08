import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { DEFAULT_TZ, fmtDate, fmtTime, todayIn } from "@/lib/util";
import { Building2, Check, ClockAlert, Download, House, Palmtree, Pencil, Plus, Save, Trash2, TriangleAlert, UserX, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/shell";
import { deleteAttendance, reviewRegularization, saveAttendance } from "../actions";

export const metadata = { title: "Attendance" };

const hhmm = (iso: string | null, tz: string) =>
  iso ? new Date(iso).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }) : "";

export default async function AdminAttendance({ searchParams }: PageProps<"/admin/attendance">) {
  const me = await staffPage();
  const sp = await searchParams;
  const date = String(sp.date ?? todayIn());
  const office = me.role === "admin" ? (sp.office ? String(sp.office) : null) : me.office_id;
  const sb = db();

  let emps = sb.from("employees").select("id, full_name, office_id, avatar_url").eq("active", true).not("clerk_user_id", "is", null).or("role.is.null,role.neq.admin").order("full_name");
  if (office) emps = emps.eq("office_id", office);
  const [{ data: people }, { data: offices }, { data: rows }, { data: leaves }, { data: regs }] = await Promise.all([
    emps,
    sb.from("offices").select("id, name, timezone").order("name"),
    sb.from("attendance_report").select("*").eq("date", date),
    sb.from("leave_requests").select("employee_id, type:leave_types(name)").eq("status", "approved").lte("start_date", date).gte("end_date", date),
    sb.from("regularizations").select("*, employee:employees!regularizations_employee_id_fkey(full_name, avatar_url, office_id)").eq("status", "pending").neq("employee_id", me.id).order("date"),
  ]);
  const canReview = me.role === "hr" || me.role === "admin"; // review_regularization() enforces this too
  const tzOf = (officeId: string | null) => offices?.find((o) => o.id === officeId)?.timezone ?? DEFAULT_TZ;
  const recOf = (id: string) => rows?.find((r) => r.employee_id === id);
  const leaveOf = (id: string) => leaves?.find((l) => l.employee_id === id);

  const present = people?.filter((p) => recOf(p.id)).length ?? 0;
  const onLeave = people?.filter((p) => !recOf(p.id) && leaveOf(p.id)).length ?? 0;

  return (
    <>
    <PageHeader title="Attendance" sub={`${present} present · ${onLeave} on leave · ${(people?.length ?? 0) - present - onLeave} not checked in`} />
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-2">
        <input type="date" name="date" defaultValue={date} className="input w-auto" />
        {me.role === "admin" && (
          <select name="office" defaultValue={office ?? ""} className="input w-auto">
            <option value="">All offices</option>
            {offices?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <button className="btn">Show</button>
      </form>

      {!!regs?.length && (
        <section className="card">
          <h2 className="h2"><ClockAlert /> Regularization requests</h2>
          <ul className="divide-y divide-line">
            {regs.map((r) => {
              const tz = tzOf(r.employee?.office_id ?? null);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={r.employee?.full_name ?? "?"} src={r.employee?.avatar_url} size="size-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{r.employee?.full_name}</div>
                    <div className="text-sm text-muted tabular-nums">
                      {fmtDate(r.date)} · {r.mode === "wfh" ? "Home" : "Office"} · {fmtTime(r.check_in_at, tz)} - {fmtTime(r.check_out_at, tz)}
                    </div>
                    <div className="text-sm">{r.reason}</div>
                  </div>
                  {canReview ? (
                    <ActionForm action={reviewRegularization} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <input name="review_note" placeholder="Note (optional)" className="input w-auto min-w-40" />
                      <button name="status" value="rejected" className="btn btn-danger"><X /> Reject</button>
                      <button name="status" value="approved" className="btn btn-primary"><Check /> Approve</button>
                    </ActionForm>
                  ) : (
                    <span className="badge badge-amber">Waiting for HR</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Employee</th><th>Status</th><th>In</th><th>Out</th><th>Hours</th><th></th></tr></thead>
          <tbody>
            {people?.map((p) => {
              const r = recOf(p.id);
              const l = leaveOf(p.id);
              const tz = tzOf(p.office_id);
              return (
                <tr key={p.id}>
                  <td><span className="flex items-center gap-2.5 font-medium"><Avatar name={p.full_name} src={p.avatar_url} size="size-8 text-xs" /> {p.full_name}</span></td>
                  <td>
                    <span className="flex flex-wrap gap-1">
                      {r ? (r.mode === "wfh" ? <span className="badge badge-blue"><House /> Home</span> : <span className="badge badge-green"><Building2 /> Office</span>)
                        : l ? <span className="badge badge-amber"><Palmtree /> {(l.type as { name?: string } | null)?.name ?? "Leave"}</span>
                        : <span className="badge badge-red"><UserX /> Not in</span>}
                      {r?.late && <span className="badge badge-amber"><TriangleAlert /> Late</span>}
                      {r?.early_leave && <span className="badge">Left early</span>}
                    </span>
                  </td>
                  <td className="tabular-nums">{fmtTime(r?.check_in_at, tz)}</td>
                  <td className="tabular-nums">{fmtTime(r?.check_out_at, tz)}</td>
                  <td className="tabular-nums">{r?.hours ?? "-"}</td>
                  <td className="text-right">
                    {p.id !== me.id && (
                      <details className="group inline-block text-left">
                        <summary className="btn btn-ghost btn-icon cursor-pointer" title={r ? "Edit entry" : "Add entry"}>{r ? <Pencil /> : <Plus />}</summary>
                        <div className="mt-2 w-[26rem] max-w-[80vw] space-y-3 rounded-xl border border-line bg-surface-2/50 p-4">
                          <ActionForm action={saveAttendance} keep className="flex flex-wrap gap-2">
                            {r ? <input type="hidden" name="id" value={r.id} /> : <input type="hidden" name="employee_id" value={p.id} />}
                            <input type="hidden" name="date" value={date} />
                            <input type="hidden" name="timezone" value={tz} />
                            <select name="mode" defaultValue={r?.mode ?? "office"} className="input w-auto">
                              <option value="office">Office</option><option value="wfh">WFH</option>
                            </select>
                            <input type="time" name="check_in" required defaultValue={hhmm(r?.check_in_at, tz)} className="input w-auto" />
                            <input type="time" name="check_out" defaultValue={hhmm(r?.check_out_at, tz)} className="input w-auto" />
                            <input name="note" placeholder="Note" defaultValue={r?.note ?? ""} className="input w-auto flex-1" />
                            <button className="btn btn-primary"><Save /> Save</button>
                          </ActionForm>
                          {r && (
                            <ActionForm action={deleteAttendance} confirm="Delete this attendance entry?">
                              <input type="hidden" name="id" value={r.id} />
                              <button className="btn btn-ghost btn-danger"><Trash2 /> Delete entry</button>
                            </ActionForm>
                          )}
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="h2"><Download /> Export to CSV</h2>
        <form action="/admin/attendance/export" className="flex flex-wrap gap-2">
          <input type="date" name="from" required defaultValue={date.slice(0, 8) + "01"} className="input w-auto" />
          <input type="date" name="to" required defaultValue={date} className="input w-auto" />
          {office && <input type="hidden" name="office" value={office} />}
          <button className="btn"><Download /> Download</button>
        </form>
      </section>
    </div>
    </>
  );
}
