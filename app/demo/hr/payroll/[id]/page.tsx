"use client";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Pencil, Save, Send, Trash2 } from "lucide-react";
import { Secret } from "@/components/secret";
import { HR_OFFICE_ROW, currentCtc, downloadCsv, isStaff, useHrEmployees, useLineEdits, useSalaries } from "@/lib/demo/hr";
import { usePayroll } from "@/lib/demo/shared";
import { useRole } from "@/lib/demo/use-role";
import { breakdown, daysIn, inr, monthLabel, STATUS_TONE } from "@/lib/payroll";
import { PageHeader, useLog } from "../../_parts";

const SUMS = ["basic", "hra", "special", "gross", "employee_pf", "employee_esi", "pt", "lop_amount", "tds", "other_deductions", "net"] as const;

export default function Sheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useRole("hr");
  const [runs, setRuns] = usePayroll();
  const [emps] = useHrEmployees();
  const [sals] = useSalaries();
  const [edits, setEdits] = useLineEdits();
  const log = useLog();
  const run = runs.find((r) => r.id === id);
  if (!run) return <p className="card empty">Salary sheet not found. <Link href="/demo/hr/payroll" className="btn">Payroll</Link></p>;

  const [y, m] = [Number(run.month.slice(0, 4)), Number(run.month.slice(5, 7))];
  const rows = emps
    .filter((e) => isStaff(e) && e.id !== me.id)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => {
      const ed = edits[`${id}:${e.id}`] ?? { lop_days: 0, tds: 0, other: 0 };
      return { emp: e, ed, pay: breakdown(currentCtc(sals, e.id)?.annual_ctc ?? e.ctc, { month: m, daysInMonth: daysIn(y, m), lopDays: ed.lop_days, tds: ed.tds, other: ed.other }) };
    });
  const total = (k: (typeof SUMS)[number]) => rows.reduce((s, l) => s + l.pay[k], 0);
  const draft = run.status === "draft";
  const label = monthLabel(run.month);
  const setStatus = (status: "submitted") => setRuns((l) => l.map((r) => (r.id === id ? { ...r, status } : r)));

  return (
    <>
      <PageHeader title={`Salary sheet · ${label}`} sub={<>{HR_OFFICE_ROW.name} · <span className={`badge ${STATUS_TONE[run.status]}`}>{run.status}</span></>}>
        <Link href="/demo/hr/payroll" className="btn btn-ghost"><ArrowLeft /> Payroll</Link>
        <button className="btn" onClick={() => downloadCsv(`salary-${run.month.slice(0, 7)}.csv`, [["Employee", ...SUMS, "LOP days"], ...rows.map((l) => [l.emp.name, ...SUMS.map((k) => l.pay[k]), l.ed.lop_days])])}><Download /> CSV</button>
      </PageHeader>
      <div className="space-y-6">
        <div className="card overflow-x-auto">
          <Secret block label="salary amounts">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th><th className="text-right">Basic</th><th className="text-right">HRA</th><th className="text-right">Special</th><th className="text-right">Gross</th>
                  <th className="text-right">PF</th><th className="text-right">ESI</th><th className="text-right">PT</th><th className="text-right">LOP</th>
                  <th className="text-right">TDS</th><th className="text-right">Other</th><th className="text-right">Net</th>{draft && <th />}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map(({ emp: e, ed, pay }) => (
                  <tr key={e.id}>
                    <td className="font-medium">{e.name}</td>
                    {SUMS.map((k) => <td key={k} className={`text-right ${k === "net" ? "font-semibold" : ""}`}>{inr(pay[k])}{k === "lop_amount" && ed.lop_days > 0 ? <span className="block text-xs text-muted">{ed.lop_days} d</span> : null}</td>)}
                    {draft && (
                      <td className="text-right">
                        <details className="inline-block text-left">
                          <summary className="btn btn-ghost btn-icon cursor-pointer" title="Edit"><Pencil /></summary>
                          <form
                            className="absolute z-10 mt-1 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3 shadow-lg"
                            onSubmit={(ev) => {
                              ev.preventDefault();
                              const fd = new FormData(ev.currentTarget);
                              setEdits((c) => ({ ...c, [`${id}:${e.id}`]: { lop_days: Number(fd.get("lop_days")) || 0, tds: Number(fd.get("tds")) || 0, other: Number(fd.get("other_deductions")) || 0 } }));
                            }}
                          >
                            <label className="field">LOP days<input name="lop_days" type="number" min="0" step="0.5" defaultValue={ed.lop_days} className="input w-24" /></label>
                            <label className="field">TDS<input name="tds" type="number" min="0" step="0.01" defaultValue={ed.tds} className="input w-28" /></label>
                            <label className="field">Other<input name="other_deductions" type="number" min="0" step="0.01" defaultValue={ed.other} className="input w-28" /></label>
                            <button className="btn btn-primary"><Save /> Save</button>
                          </form>
                        </details>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="tabular-nums">
                <tr className="font-semibold">
                  <td>Total ({rows.length})</td>
                  {SUMS.map((k) => <td key={k} className="text-right">{inr(total(k))}</td>)}
                  {draft && <td />}
                </tr>
              </tfoot>
            </table>
          </Secret>
        </div>

        <div className="flex flex-wrap gap-2">
          {draft && (
            <>
              <button className="btn btn-primary" onClick={() => confirm("Submit this sheet to admin for approval? You can't edit it after.") && (setStatus("submitted"), log("Submitted payroll", `${HR_OFFICE_ROW.name}, ${label}`))}><Send /> Submit for approval</button>
              <Link href="/demo/hr/payroll" className="btn btn-danger" onClick={() => confirm("Delete this draft sheet?") ? (setRuns((l) => l.filter((r) => r.id !== id)), log("Deleted payroll draft", label)) : undefined}><Trash2 /> Delete draft</Link>
            </>
          )}
          {run.status === "submitted" && <span className="badge badge-blue">Waiting for admin approval</span>}
          {run.status === "approved" && <span className="badge badge-green">Approved and locked</span>}
        </div>
      </div>
    </>
  );
}
