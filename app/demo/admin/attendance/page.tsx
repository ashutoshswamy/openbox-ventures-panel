"use client";
import { useState } from "react";
import Link from "next/link";
import { Building2, ChartColumn, Check, ClockAlert, Download, House, Palmtree, Pencil, Plus, Save, Trash2, TriangleAlert, UserX, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader, useAdm } from "@/components/demo/adm-ui";
import { csv, download, useAttendance, useOffices } from "@/lib/demo/admin";
import { LEAVE_TYPES, emp, today } from "@/lib/demo/data";
import { useLeave, useRegularizations } from "@/lib/demo/shared";
import { fmtDate, fmtTime, str, zonedIso } from "@/lib/util";

const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "");

export default function AdminAttendance() {
  const { me, isAdmin, staff, inScope, log } = useAdm();
  const [offices] = useOffices();
  const { rows, upsert, remove } = useAttendance();
  const [leaves] = useLeave();
  const [regs, setRegs] = useRegularizations();
  const [date, setDate] = useState(today());
  const [officeSel, setOfficeSel] = useState("");
  const [from, setFrom] = useState(today().slice(0, 8) + "01");
  const [to, setTo] = useState(today());
  const office = isAdmin ? officeSel || null : me.office_id;

  const people = staff.filter((p) => !p.invited && (!office || p.office_id === office)).sort((a, b) => a.name.localeCompare(b.name));
  const recOf = (id: string, d = date) => rows.find((r) => r.employee_id === id && r.date === d);
  const leaveOf = (id: string) => leaves.find((l) => l.employee_id === id && l.status === "approved" && l.from <= date && l.to >= date);
  const pendingRegs = regs.filter((r) => r.status === "pending" && r.employee_id !== me.id && (isAdmin || inScope(emp(r.employee_id))));

  const present = people.filter((p) => recOf(p.id)).length;
  const onLeave = people.filter((p) => !recOf(p.id) && leaveOf(p.id)).length;

  const review = async (id: string, status: "approved" | "rejected") => {
    const r = regs.find((x) => x.id === id)!;
    setRegs((l) => l.map((x) => (x.id === id ? { ...x, status } : x)));
    if (status === "approved") {
      upsert({ employee_id: r.employee_id, date: r.date, in_at: zonedIso(r.date, r.check_in), out_at: r.check_out ? zonedIso(r.date, r.check_out) : null, mode: "office" });
    }
    log(status === "approved" ? "Approved regularization" : "Rejected regularization", emp(r.employee_id).name);
  };

  const exportCsv = () => {
    const ids = new Set(staff.filter((p) => !office || p.office_id === office).map((p) => p.id));
    const data = rows.filter((r) => ids.has(r.employee_id) && r.date >= from && r.date <= to).sort((a, b) => a.date.localeCompare(b.date) || emp(a.employee_id).name.localeCompare(emp(b.employee_id).name));
    download(`attendance_${from}_${to}.csv`, csv([["Date", "Employee", "Mode", "In", "Out", "Hours", "Late"], ...data.map((r) => [r.date, emp(r.employee_id).name, r.mode, hhmm(r.in_at), hhmm(r.out_at), r.hours, r.late ? "Yes" : ""])]));
  };

  return (
    <>
      <PageHeader title="Attendance" sub={`${present} present · ${onLeave} on leave · ${people.length - present - onLeave} not checked in`}>
        <Link href="/demo/admin/attendance/analytics" className="btn"><ChartColumn /> Analytics</Link>
      </PageHeader>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="input w-auto" />
          {isAdmin && (
            <select value={officeSel} onChange={(e) => setOfficeSel(e.target.value)} className="input w-auto">
              <option value="">All offices</option>
              {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>

        {!!pendingRegs.length && (
          <section className="card">
            <h2 className="h2"><ClockAlert /> Regularization requests</h2>
            <ul className="divide-y divide-line">
              {pendingRegs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={emp(r.employee_id).name} src={null} size="size-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{emp(r.employee_id).name}</div>
                    <div className="text-sm text-muted tabular-nums">{fmtDate(r.date)} · Office · {r.check_in} - {r.check_out || "-"}</div>
                    <div className="text-sm">{r.reason}</div>
                  </div>
                  {isAdmin ? (
                    <ActionForm action={async (fd) => review(r.id, fd.get("status") as "approved" | "rejected")} className="flex flex-wrap gap-2">
                      <input name="review_note" placeholder="Note (optional)" className="input w-auto min-w-40" />
                      <button name="status" value="rejected" className="btn btn-danger"><X /> Reject</button>
                      <button name="status" value="approved" className="btn btn-primary"><Check /> Approve</button>
                    </ActionForm>
                  ) : (
                    <span className="badge badge-amber">Waiting for HR</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Employee</th><th>Status</th><th>In</th><th>Out</th><th>Hours</th><th></th></tr></thead>
            <tbody>
              {people.map((p) => {
                const r = recOf(p.id);
                const l = leaveOf(p.id);
                return (
                  <tr key={p.id}>
                    <td><span className="flex items-center gap-2.5 font-medium"><Avatar name={p.name} src={null} size="size-8 text-xs" /> {p.name}</span></td>
                    <td>
                      <span className="flex flex-wrap gap-1">
                        {r ? (r.mode === "wfh" ? <span className="badge badge-blue"><House /> Home</span> : <span className="badge badge-green"><Building2 /> Office</span>)
                          : l ? <span className="badge badge-amber"><Palmtree /> {LEAVE_TYPES.find((t) => t.id === l.type_id)?.name ?? "Leave"}</span>
                          : <span className="badge badge-red"><UserX /> Not in</span>}
                        {r?.late && <span className="badge badge-amber"><TriangleAlert /> Late</span>}
                        {r?.early_leave && <span className="badge">Left early</span>}
                      </span>
                    </td>
                    <td className="tabular-nums">{fmtTime(r?.in_at)}</td>
                    <td className="tabular-nums">{fmtTime(r?.out_at)}</td>
                    <td className="tabular-nums">{r?.hours ?? "-"}</td>
                    <td className="text-right">
                      {p.id !== me.id && (
                        <details className="group inline-block text-left">
                          <summary className="btn btn-ghost btn-icon cursor-pointer" title={r ? "Edit entry" : "Add entry"}>{r ? <Pencil /> : <Plus />}</summary>
                          <div className="mt-2 w-[26rem] max-w-[80vw] space-y-3 rounded-xl border border-line bg-surface-2/50 p-4">
                            <ActionForm
                              action={async (fd) => {
                                const inT = str(fd, "check_in");
                                if (!inT) return "Check-in time required";
                                const outT = str(fd, "check_out");
                                upsert({ employee_id: p.id, date, in_at: zonedIso(date, inT), out_at: outT ? zonedIso(date, outT) : null, mode: fd.get("mode") === "wfh" ? "wfh" : "office", note: str(fd, "note") ?? undefined });
                                log("Edited attendance", `${p.name}, ${fmtDate(date)}`);
                              }}
                              keep className="flex flex-wrap gap-2"
                            >
                              <select name="mode" defaultValue={r?.mode ?? "office"} className="input w-auto">
                                <option value="office">Office</option><option value="wfh">WFH</option>
                              </select>
                              <input type="time" name="check_in" required defaultValue={hhmm(r?.in_at ?? null)} className="input w-auto" />
                              <input type="time" name="check_out" defaultValue={hhmm(r?.out_at ?? null)} className="input w-auto" />
                              <input name="note" placeholder="Note" defaultValue={r?.note ?? ""} className="input w-auto flex-1" />
                              <button className="btn btn-primary"><Save /> Save</button>
                            </ActionForm>
                            {r && (
                              <ActionForm action={async () => { remove(p.id, date); log("Deleted attendance", `${p.name}, ${fmtDate(date)}`); }} confirm="Delete this attendance entry?">
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
          <div className="flex flex-wrap gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-auto" />
            <button className="btn" onClick={exportCsv}><Download /> Download</button>
          </div>
        </section>
      </div>
    </>
  );
}
