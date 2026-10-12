"use client";
import { useState } from "react";
import Link from "next/link";
import { Building2, ChartColumn, Check, ClockAlert, Download, House, Palmtree, Pencil, Plus, Save, Trash2, TriangleAlert, UserX, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { LEAVE_TYPES, emp, today } from "@/lib/demo/data";
import { HR_OFFICE, attId, derive, downloadCsv, isStaff, useAllAttendance, useHrEmployees, type AttRow } from "@/lib/demo/hr";
import { useLeave, useRegularizations } from "@/lib/demo/shared";
import { useRole } from "@/lib/demo/use-role";
import { fmtDate } from "@/lib/util";
import { PageHeader, useLog } from "../_parts";

export default function HrAttendance() {
  const { me } = useRole("hr");
  const [date, setDate] = useState(today());
  const [from, setFrom] = useState(today().slice(0, 8) + "01");
  const [emps] = useHrEmployees();
  const [leave] = useLeave();
  const [regs, setRegs] = useRegularizations();
  const { rows, setHr } = useAllAttendance();
  const log = useLog();

  const people = emps.filter(isStaff).sort((a, b) => a.name.localeCompare(b.name));
  const recOf = (id: string) => rows.find((r) => r.employee_id === id && r.date === date);
  const leaveOf = (id: string) => leave.find((l) => l.status === "approved" && l.employee_id === id && l.from <= date && l.to >= date);
  const present = people.filter((p) => recOf(p.id)).length;
  const onLeave = people.filter((p) => !recOf(p.id) && leaveOf(p.id)).length;
  const pendingRegs = regs.filter((r) => r.status === "pending" && r.employee_id !== me.id && emp(r.employee_id).office_id === HR_OFFICE);

  const review = (id: string, approved: boolean) => {
    const r = regs.find((x) => x.id === id)!;
    setRegs((l) => l.map((x) => (x.id === id ? { ...x, status: approved ? "approved" : "rejected" } : x)));
    if (approved) {
      const row: AttRow = { id: attId(r.employee_id, r.date), employee_id: r.employee_id, date: r.date, in: r.check_in, out: r.check_out, mode: "office", src: "hr" };
      setHr((l) => [...l.filter((x) => x.id !== row.id), row]);
    }
    log(approved ? "Approved regularization" : "Rejected regularization", emp(r.employee_id).name);
  };
  const save = (employee_id: string, fd: FormData) => {
    const row: AttRow = { id: attId(employee_id, date), employee_id, date, in: String(fd.get("check_in")), out: String(fd.get("check_out") || "") || null, mode: fd.get("mode") === "wfh" ? "wfh" : "office", note: String(fd.get("note") || ""), src: "hr" };
    setHr((l) => [...l.filter((x) => x.id !== row.id), row]);
    log("Edited attendance", emp(employee_id).name);
  };
  const exportCsv = () => {
    const ids = new Set(people.map((p) => p.id));
    downloadCsv(`attendance-${from}-${date}.csv`, [
      ["Employee", "Date", "Mode", "In", "Out", "Hours", "Late"],
      ...rows.filter((r) => ids.has(r.employee_id) && r.date >= from && r.date <= date).sort((a, b) => a.date.localeCompare(b.date)).map((r) => [emp(r.employee_id).name, r.date, r.mode, r.in, r.out ?? "", derive(r).hours ?? "", derive(r).late ? "yes" : ""]),
    ]);
  };

  return (
    <>
      <PageHeader title="Attendance" sub={`${present} present · ${onLeave} on leave · ${people.length - present - onLeave} not checked in`}>
        <Link href="/demo/hr/attendance/analytics" className="btn"><ChartColumn /> Analytics</Link>
      </PageHeader>
      <div className="space-y-6">
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => e.preventDefault()}>
          <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} className="input w-auto" />
        </form>

        {!!pendingRegs.length && (
          <section className="card">
            <h2 className="h2"><ClockAlert /> Regularization requests</h2>
            <ul className="divide-y divide-line">
              {pendingRegs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={emp(r.employee_id).name} size="size-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{emp(r.employee_id).name}</div>
                    <div className="text-sm text-muted tabular-nums">{fmtDate(r.date)} · Office · {r.check_in} - {r.check_out}</div>
                    <div className="text-sm">{r.reason}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-danger" onClick={() => review(r.id, false)}><X /> Reject</button>
                    <button className="btn btn-primary" onClick={() => review(r.id, true)}><Check /> Approve</button>
                  </div>
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
                const d = r && derive(r);
                return (
                  <tr key={p.id}>
                    <td><span className="flex items-center gap-2.5 font-medium"><Avatar name={p.name} size="size-8 text-xs" /> {p.name}</span></td>
                    <td>
                      <span className="flex flex-wrap gap-1">
                        {r ? (r.mode === "wfh" ? <span className="badge badge-blue"><House /> Home</span> : <span className="badge badge-green"><Building2 /> Office</span>)
                          : l ? <span className="badge badge-amber"><Palmtree /> {LEAVE_TYPES.find((t) => t.id === l.type_id)?.name ?? "Leave"}</span>
                          : <span className="badge badge-red"><UserX /> Not in</span>}
                        {d?.late && <span className="badge badge-amber"><TriangleAlert /> Late</span>}
                        {d?.early && <span className="badge">Left early</span>}
                      </span>
                    </td>
                    <td className="tabular-nums">{r?.in ?? "-"}</td>
                    <td className="tabular-nums">{r?.out ?? "-"}</td>
                    <td className="tabular-nums">{d?.hours ?? "-"}</td>
                    <td className="text-right">
                      {p.id !== me.id && (
                        <details className="group inline-block text-left">
                          <summary className="btn btn-ghost btn-icon cursor-pointer" title={r ? "Edit entry" : "Add entry"}>{r ? <Pencil /> : <Plus />}</summary>
                          <div className="mt-2 w-[26rem] max-w-[80vw] space-y-3 rounded-xl border border-line bg-surface-2/50 p-4">
                            <form key={r?.id + (r?.in ?? "")} className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); save(p.id, new FormData(e.currentTarget)); }}>
                              <select name="mode" defaultValue={r?.mode ?? "office"} className="input w-auto"><option value="office">Office</option><option value="wfh">WFH</option></select>
                              <input type="time" name="check_in" required defaultValue={r?.in ?? ""} className="input w-auto" />
                              <input type="time" name="check_out" defaultValue={r?.out ?? ""} className="input w-auto" />
                              <input name="note" placeholder="Note" defaultValue={r?.note ?? ""} className="input w-auto flex-1" />
                              <button className="btn btn-primary"><Save /> Save</button>
                            </form>
                            {r?.src === "hr" && (
                              <button className="btn btn-ghost btn-danger" onClick={() => confirm("Delete this attendance entry?") && (setHr((x) => x.filter((y) => y.id !== r.id)), log("Deleted attendance", p.name))}><Trash2 /> Delete entry</button>
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
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); exportCsv(); }}>
            <input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto" />
            <input type="date" required value={date} readOnly className="input w-auto" title="Uses the date selected above" />
            <button className="btn"><Download /> Download</button>
          </form>
        </section>
      </div>
    </>
  );
}
