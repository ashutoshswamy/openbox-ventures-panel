import { CalendarDays, CalendarPlus, FileText, PartyPopper, Send, Upload, X } from "lucide-react";
import { employeePage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { LEAVE_TONE, fmtDate, todayIn } from "@/lib/util";
import { daysWithin, eachDay, isoDow, monthRange, pageOf, validMonth } from "@/lib/calendar";
import { MonthCalendar, type CalCell } from "@/components/month-calendar";
import { Pager } from "@/components/pager";
import { ActionForm } from "@/components/action-form";
import { AttachInput } from "@/components/attach-input";
import { PageHeader } from "@/components/shell";
import { applyLeave, cancelLeave, updateLeaveDoc } from "../actions";

export const metadata = { title: "Leave" };

const SIZE = 10;

export default async function Leave({ searchParams }: PageProps<"/leave">) {
  const me = await employeePage();
  const sp = await searchParams;
  const today = todayIn();
  const month = validMonth(sp.month, today.slice(0, 7));
  const { from, to } = monthRange(month);
  const { page, from: r0, to: r1 } = pageOf(sp.page, SIZE);
  const sb = db();
  const [{ data: balances }, { data: types }, { data: requests, count }, { data: holidays }, { data: monthLeaves }, { data: monthHols }, { data: office }] = await Promise.all([
    sb.from("leave_balances").select("*").eq("employee_id", me.id).order("name"),
    sb.from("leave_types").select("id, name, allow_half_day, doc_required_after_days").eq("active", true).order("name"),
    sb.from("leave_requests").select("*, type:leave_types(name)", { count: "exact" }).eq("employee_id", me.id).order("start_date", { ascending: false }).range(r0, r1),
    sb.from("holidays").select("date, name").gte("date", new Date().toISOString().slice(0, 10)).order("date").limit(8),
    sb.from("leave_requests").select("start_date, end_date, half_day, status, type:leave_types(name)").eq("employee_id", me.id).in("status", ["approved", "pending", "manager_approved"]).lte("start_date", to).gte("end_date", from),
    sb.from("holidays").select("date, name, office_id").gte("date", from).lte("date", to),
    me.office_id ? sb.from("offices").select("work_days").eq("id", me.office_id).maybeSingle() : { data: null },
  ]);

  const workDays = office?.work_days ?? [1, 2, 3, 4, 5];
  const cells: Record<string, CalCell> = {};
  for (const d of eachDay(from, to)) {
    const hol = monthHols?.find((h) => h.date === d && (!h.office_id || h.office_id === me.office_id));
    const lines = [
      ...(hol ? [{ text: hol.name, tone: "blue" as const }] : []),
      ...(monthLeaves ?? []).filter((l) => daysWithin(l.start_date, l.end_date, from, to).includes(d)).map((l) => ({
        text: `${(l.type as { name?: string } | null)?.name ?? "Leave"}${l.half_day ? " (half)" : ""}${l.status === "approved" ? "" : " · pending"}`,
        tone: (l.status === "approved" ? "amber" : "muted") as "amber" | "muted",
      })),
    ];
    cells[d] = { lines, off: !!hol || !workDays.includes(isoDow(d)) };
  }

  return (
    <>
      <PageHeader title="Leave" sub={`Balances for ${new Date().getFullYear()}. Weekly offs and holidays are excluded automatically.`} />
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {balances?.map((b) => (
            <div key={b.leave_type_id} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{b.name}</span>
                {!b.paid && <span className="badge">Unpaid</span>}
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{Number(b.balance)}</div>
              <div className="mt-1 text-xs text-muted tabular-nums">
                of {Number(b.entitled)} · {Number(b.used)} used{Number(b.pending) ? ` · ${Number(b.pending)} pending` : ""}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section className="card">
            <h2 className="h2"><CalendarPlus /> Request leave</h2>
            <ActionForm action={applyLeave} className="grid gap-4 sm:grid-cols-2">
              <label className="field sm:col-span-2">Leave type
                <select name="leave_type_id" required className="input">
                  {types?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.doc_required_after_days != null ? ` - document needed over ${t.doc_required_after_days} days` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">From<input type="date" name="start_date" required className="input" /></label>
              <label className="field">To<input type="date" name="end_date" className="input" /></label>
              <label className="check sm:col-span-2"><input type="checkbox" name="half_day" /> Half day (single date only)</label>
              <label className="field sm:col-span-2">Reason<textarea name="reason" rows={3} className="input" placeholder="Optional" /></label>
              <div className="field sm:col-span-2">Supporting document
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-1"><AttachInput name="doc" bucket="leave-docs" /></div>
              </div>
              <div className="sm:col-span-2"><button className="btn btn-primary"><Send /> Send request</button></div>
            </ActionForm>
          </section>

          <section className="card">
            <h2 className="h2"><PartyPopper /> Upcoming holidays</h2>
            {holidays?.length ? (
              <ul className="space-y-2">
                {holidays.map((h) => {
                  const d = new Date(h.date + "T00:00:00");
                  return (
                    <li key={h.date + h.name} className="flex items-center gap-3">
                      <span className="grid w-12 shrink-0 rounded-lg bg-primary-soft py-1 text-center text-primary">
                        <span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                        <span className="text-lg leading-none font-semibold">{d.getDate()}</span>
                      </span>
                      <span className="text-sm">{h.name}<span className="block text-xs text-muted">{d.toLocaleDateString("en-IN", { weekday: "long" })}</span></span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="empty"><PartyPopper /> No upcoming holidays.</p>
            )}
          </section>
        </div>

        <section className="card">
          <h2 className="h2"><CalendarDays /> Calendar</h2>
          <MonthCalendar month={month} cells={cells} today={today} legend={[["amber", "Approved leave"], ["muted", "Pending approval"], ["blue", "Holiday"]]} />
        </section>

        <section className="card">
          <h2 className="h2"><CalendarDays /> My requests</h2>
          {requests?.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.type?.name}</td>
                      <td>{fmtDate(r.start_date)}{r.end_date !== r.start_date && ` - ${fmtDate(r.end_date)}`}</td>
                      <td className="tabular-nums">{Number(r.days)}</td>
                      <td>
                        <span className={`badge capitalize ${LEAVE_TONE[r.status]}`}>{r.status.replace("_", " ")}</span>
                        {r.doc_path && <a href={`/files/leave/${r.id}`} target="_blank" className="ml-2 inline-flex text-muted hover:text-text" title="Document"><FileText className="size-4" /></a>}
                        {r.review_note && <div className="mt-1 text-xs text-muted">{r.review_note}</div>}
                      </td>
                      <td className="space-y-1 text-right">
                        {r.status !== "rejected" && r.status !== "cancelled" && (
                          <ActionForm action={updateLeaveDoc} className="inline-flex items-center gap-1">
                            <input type="hidden" name="id" value={r.id} />
                            <AttachInput name="doc" bucket="leave-docs" />
                            <button className="btn btn-ghost"><Upload /> {r.doc_path ? "Replace doc" : "Add doc"}</button>
                          </ActionForm>
                        )}
                        {r.status === "pending" && (
                          <ActionForm action={cancelLeave} confirm="Cancel this request?">
                            <input type="hidden" name="id" value={r.id} />
                            <button className="btn btn-ghost btn-danger"><X /> Cancel</button>
                          </ActionForm>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty"><CalendarDays /> You haven&apos;t requested any leave yet.</p>
          )}
          <Pager page={page} total={count ?? 0} size={SIZE} />
        </section>
      </div>
    </>
  );
}
