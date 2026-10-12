"use client";
import { useState } from "react";
import { Building2, CalendarX2, ClockAlert, House, Send, TriangleAlert } from "lucide-react";
import { LEAVE_TONE, fmtDate, fmtTime } from "@/lib/util";
import { isoAt, derive, history } from "@/lib/demo/workspace";
import { office, today } from "@/lib/demo/data";
import { newId } from "@/lib/demo/store";
import { useCheckins, useRegularizations } from "@/lib/demo/shared";
import { useRole } from "@/lib/demo/use-role";
import { Notice, PageHeader, type Msg } from "./ws-common";
import { Today } from "./ws-today";

const REG_LIMIT = 5;

export function WorkspaceAttendance() {
  const { me } = useRole("workspace");
  const [checkins] = useCheckins();
  const [allRegs, setRegs] = useRegularizations();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [msg, setMsg] = useState<Msg>(null);
  const off = office(me.office_id);

  const rows = [...history(me.id), ...checkins.filter((c) => c.employee_id === me.id)]
    .filter((a) => a.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((a) => ({ ...a, ...derive(a, off) }));
  const regs = allRegs.filter((r) => r.employee_id === me.id && r.date.startsWith(month));
  const regUsed = regs.filter((r) => r.status === "pending" || r.status === "approved").length;
  const stats = [
    ["Days present", rows.length],
    ["In office", rows.filter((r) => r.mode === "office").length],
    ["From home", rows.filter((r) => r.mode === "wfh").length],
    ["Late arrivals", rows.filter((r) => r.late).length],
  ] as const;

  const request = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get("date")), check_in = String(fd.get("check_in")), check_out = String(fd.get("check_out"));
    const used = allRegs.filter((r) => r.employee_id === me.id && r.date.slice(0, 7) === date.slice(0, 7) && r.status !== "rejected").length;
    if (date > today()) return setMsg({ ok: false, text: "Can't regularize a future date" });
    if (check_out <= check_in) return setMsg({ ok: false, text: "Check-out must be after check-in" });
    if (used >= REG_LIMIT) return setMsg({ ok: false, text: `Only ${REG_LIMIT} regularizations a month` });
    if (allRegs.some((r) => r.employee_id === me.id && r.date === date && r.status !== "rejected")) return setMsg({ ok: false, text: "Already requested for that date" });
    setRegs((c) => [{ id: newId(), employee_id: me.id, date, reason: String(fd.get("reason")).trim(), check_in, check_out, status: "pending" }, ...c]);
    setMsg({ ok: true, text: "Request sent to HR" });
    e.currentTarget.reset();
  };

  return (
    <>
      <PageHeader title="Attendance" sub="Check in each day and review your history." />
      <div className="space-y-6">
        <Today me={me} />

        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="h2 mb-0">History</h2>
            <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <input type="month" value={month} max={today().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="input w-auto" />
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
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Date</th><th>Where</th><th>In</th><th>Out</th><th>Hours</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.date}>
                      <td className="font-medium">{fmtDate(r.date)}</td>
                      <td>
                        <span className={`badge ${r.mode === "wfh" ? "badge-blue" : "badge-green"}`}>
                          {r.mode === "wfh" ? <><House /> Home</> : <><Building2 /> Office</>}
                        </span>
                      </td>
                      <td className="tabular-nums">{fmtTime(r.in_at)}</td>
                      <td className="tabular-nums">{fmtTime(r.out_at)}</td>
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
          <form onSubmit={request} className="mb-6 grid gap-4 sm:grid-cols-4">
            <label className="field">Date<input type="date" name="date" required max={today()} className="input" /></label>
            <label className="field">Where
              <select name="mode" className="input"><option value="office">Office</option><option value="wfh">Home</option></select>
            </label>
            <label className="field">In<input type="time" name="check_in" required className="input" /></label>
            <label className="field">Out<input type="time" name="check_out" required className="input" /></label>
            <label className="field sm:col-span-3">Reason<input name="reason" required maxLength={500} placeholder="Forgot to check in, network issue..." className="input" /></label>
            <div className="flex items-end"><button className="btn btn-primary w-full"><Send /> Request</button></div>
            <div className="sm:col-span-4"><Notice msg={msg} /></div>
          </form>
          {!!regs.length && (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Date</th><th>In</th><th>Out</th><th>Reason</th><th>Status</th></tr></thead>
                <tbody>
                  {regs.sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{fmtDate(r.date)}</td>
                      <td className="tabular-nums">{fmtTime(isoAt(r.date, r.check_in))}</td>
                      <td className="tabular-nums">{fmtTime(isoAt(r.date, r.check_out))}</td>
                      <td className="text-sm">{r.reason}</td>
                      <td><span className={`badge capitalize ${LEAVE_TONE[r.status]}`}>{r.status}</span></td>
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
