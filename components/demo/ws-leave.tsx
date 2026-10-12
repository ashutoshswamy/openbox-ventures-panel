"use client";
import { useState } from "react";
import { CalendarDays, CalendarPlus, PartyPopper, Send, X } from "lucide-react";
import { LEAVE_TONE, fmtDate } from "@/lib/util";
import { HOLIDAYS, LEAVE_TYPES, daysFrom, today } from "@/lib/demo/data";
import { newId } from "@/lib/demo/store";
import { useLeave } from "@/lib/demo/shared";
import { useRole } from "@/lib/demo/use-role";
import { balances, leaveDays } from "@/lib/demo/workspace";
import { Notice, PageHeader, type Msg } from "./ws-common";

export function WorkspaceLeave() {
  const { me } = useRole("workspace");
  const [all, set] = useLeave();
  const [msg, setMsg] = useState<Msg>(null);
  const bal = balances(all, me.id);
  const requests = all.filter((r) => r.employee_id === me.id).sort((a, b) => b.from.localeCompare(a.from));
  const holidays = HOLIDAYS.filter((h) => h.date >= today() && (!h.office_id || h.office_id === me.office_id)).slice(0, 8);

  const apply = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const type_id = String(fd.get("leave_type_id"));
    const from = String(fd.get("start_date"));
    const to = String(fd.get("end_date") || from);
    const half = fd.get("half_day") === "on";
    if (to < from) return setMsg({ ok: false, text: "End date is before the start date" });
    if (half && to !== from) return setMsg({ ok: false, text: "Half day is for a single date" });
    const days = leaveDays(from, to, half, me.office_id);
    if (!days) return setMsg({ ok: false, text: "Those dates are all weekly offs or holidays" });
    if (all.some((r) => r.employee_id === me.id && (r.status === "pending" || r.status === "manager_approved" || r.status === "approved") && r.from <= to && r.to >= from))
      return setMsg({ ok: false, text: "You already have leave on those dates" });
    const b = bal.find((x) => x.id === type_id)!;
    if (days > b.balance) return setMsg({ ok: false, text: `Not enough ${b.name.toLowerCase()} balance (${b.balance} left)` });
    set((c) => [{ id: newId(), employee_id: me.id, type_id, from, to, days, reason: String(fd.get("reason") ?? "").trim(), status: "pending", applied_on: today() }, ...c]);
    setMsg({ ok: true, text: "Leave request sent" });
    e.currentTarget.reset();
  };

  return (
    <>
      <PageHeader title="Leave" sub={`Balances for ${new Date().getFullYear()}. Weekly offs and holidays are excluded automatically.`} />
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {bal.map((b) => (
            <div key={b.id} className="card p-4">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">{b.name}</span></div>
              <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{b.balance}</div>
              <div className="mt-1 text-xs text-muted tabular-nums">of {b.entitled} · {b.used} used{b.pending ? ` · ${b.pending} pending` : ""}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section className="card">
            <h2 className="h2"><CalendarPlus /> Request leave</h2>
            <form onSubmit={apply} className="grid gap-4 sm:grid-cols-2">
              <label className="field sm:col-span-2">Leave type
                <select name="leave_type_id" required className="input">
                  {LEAVE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label className="field">From<input type="date" name="start_date" required min={daysFrom(-30)} className="input" /></label>
              <label className="field">To<input type="date" name="end_date" className="input" /></label>
              <label className="check sm:col-span-2"><input type="checkbox" name="half_day" /> Half day (single date only)</label>
              <label className="field sm:col-span-2">Reason<textarea name="reason" rows={3} className="input" placeholder="Optional" /></label>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <button className="btn btn-primary"><Send /> Send request</button>
                <Notice msg={msg} />
              </div>
            </form>
          </section>

          <section className="card">
            <h2 className="h2"><PartyPopper /> Upcoming holidays</h2>
            {holidays.length ? (
              <ul className="space-y-2">
                {holidays.map((h) => {
                  const d = new Date(h.date + "T00:00:00");
                  return (
                    <li key={h.id} className="flex items-center gap-3">
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
          <h2 className="h2"><CalendarDays /> My requests</h2>
          {requests.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{LEAVE_TYPES.find((t) => t.id === r.type_id)?.name}</td>
                      <td>{fmtDate(r.from)}{r.to !== r.from && ` - ${fmtDate(r.to)}`}</td>
                      <td className="tabular-nums">{r.days}</td>
                      <td><span className={`badge capitalize ${LEAVE_TONE[r.status]}`}>{r.status.replace("_", " ")}</span></td>
                      <td className="space-y-1 text-right">
                        {r.status === "pending" && (
                          <button className="btn btn-ghost btn-danger" onClick={() => confirm("Cancel this request?") && set((c) => c.map((x) => (x.id === r.id ? { ...x, status: "cancelled" } : x)))}><X /> Cancel</button>
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
        </section>
      </div>
    </>
  );
}
