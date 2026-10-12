"use client";
import { useState } from "react";
import Link from "next/link";
import { Calculator, ChevronDown, FilePlus2, IndianRupee, Plus, Wallet } from "lucide-react";
import { SalaryBreakdown } from "@/components/salary-breakdown";
import { Secret } from "@/components/secret";
import { today } from "@/lib/demo/data";
import { HR_OFFICE, HR_OFFICE_ROW, currentCtc, isStaff, useHrEmployees, useSalaries } from "@/lib/demo/hr";
import { usePayroll } from "@/lib/demo/shared";
import { newId } from "@/lib/demo/store";
import { useRole } from "@/lib/demo/use-role";
import { breakdown, daysIn, inr, monthLabel, STATUS_TONE } from "@/lib/payroll";
import { fmtDate } from "@/lib/util";
import { PageHeader, useLog } from "../_parts";

export default function Payroll() {
  const { me } = useRole("hr");
  const [runs, setRuns] = usePayroll();
  const [emps] = useHrEmployees();
  const [sals, setSals] = useSalaries();
  const log = useLog();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [err, setErr] = useState("");
  const [calcIn, setCalcIn] = useState<Record<string, string>>({});
  const [calc, setCalc] = useState<ReturnType<typeof breakdown> | null>(null);

  const mine = runs.filter((r) => r.office_id === HR_OFFICE).sort((a, b) => b.month.localeCompare(a.month));
  const people = emps.filter((e) => isStaff(e) && e.id !== me.id);

  return (
    <>
      <PageHeader title="Payroll" sub="Salaries, increments, bank details and monthly salary sheets" />
      <div className="space-y-6">
        <section className="card">
          <h2 className="h2"><Wallet /> Salary sheets</h2>
          <form
            className="mb-4 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const m = month + "-01";
              if (mine.some((r) => r.month === m)) return setErr("A sheet for this month already exists");
              setErr("");
              setRuns((l) => [{ id: newId(), month: m, office_id: HR_OFFICE, status: "draft" }, ...l]);
              log("Created salary sheet", `${HR_OFFICE_ROW.name}, ${monthLabel(m)}`);
            }}
          >
            <label className="field">Month<input type="month" required value={month} onChange={(e) => setMonth(e.target.value)} className="input w-auto" /></label>
            <button className="btn btn-primary"><FilePlus2 /> Generate draft</button>
            {err && <p className="error">{err}</p>}
          </form>
          {mine.length ? (
            <table className="table">
              <thead><tr><th>Month</th><th>Scope</th><th>Status</th><th /></tr></thead>
              <tbody>
                {mine.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{monthLabel(r.month)}</td>
                    <td>{HR_OFFICE_ROW.name}</td>
                    <td><span className={`badge ${STATUS_TONE[r.status]}`}>{r.status}</span></td>
                    <td className="text-right"><Link href={`/demo/hr/payroll/${r.id}`} className="btn">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="empty">No salary sheets yet.</p>}
        </section>

        <section className="card">
          <h2 className="h2"><IndianRupee /> Salaries</h2>
          <ul className="divide-y divide-line">
            {people.map((p) => {
              const hist = sals.filter((s) => s.employee_id === p.id).sort((a, b) => a.effective_from.localeCompare(b.effective_from));
              const cur = currentCtc(sals, p.id);
              return (
                <li key={p.id} className="py-3">
                  <details className="group">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-sm text-muted">{p.designation}</div>
                      </div>
                      <div className="text-right text-sm tabular-nums">
                        {cur ? <><div className="font-medium"><Secret label="salary">{inr(cur.annual_ctc)}</Secret> / yr</div><div className="text-muted">since {fmtDate(cur.effective_from)}</div></> : <span className="text-muted">No salary</span>}
                      </div>
                      <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-4 space-y-4">
                      <Secret block label="salary history">
                        <table className="table">
                          <thead><tr><th>Effective</th><th className="text-right">Annual CTC</th><th className="text-right">Change</th><th>Note</th></tr></thead>
                          <tbody>
                            {[...hist].reverse().map((s, i, a) => {
                              const prev = a[i + 1];
                              const pct = prev ? ((s.annual_ctc - prev.annual_ctc) / prev.annual_ctc) * 100 : null;
                              return (
                                <tr key={s.id}>
                                  <td>{fmtDate(s.effective_from)}</td>
                                  <td className="text-right tabular-nums">{inr(s.annual_ctc)}</td>
                                  <td className="text-right tabular-nums">{pct === null ? "-" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}</td>
                                  <td className="text-muted">{s.note}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </Secret>
                      <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          setSals((l) => [...l, { id: newId(), employee_id: p.id, annual_ctc: Number(fd.get("annual_ctc")), effective_from: String(fd.get("effective_from")), note: String(fd.get("note") ?? "") }]);
                          log("Added salary", p.name);
                          e.currentTarget.reset();
                        }}
                      >
                        <label className="field">Annual CTC (₹)<input name="annual_ctc" type="number" min="1" step="0.01" required className="input w-40" /></label>
                        <label className="field">Effective from<input name="effective_from" type="date" required defaultValue={today()} className="input w-auto" /></label>
                        <label className="field min-w-40 flex-1">Note<input name="note" placeholder="Increment, promotion…" className="input" /></label>
                        <button className="btn btn-primary"><Plus /> Add increment</button>
                      </form>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          {!people.length && <p className="empty">No employees.</p>}
        </section>

        <section className="card">
          <h2 className="h2"><Calculator /> Salary calculator</h2>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const [y, m] = String(fd.get("cmonth") || today().slice(0, 7)).split("-").map(Number);
              setCalcIn(Object.fromEntries([...fd].map(([k, v]) => [k, String(v)])));
              setCalc(breakdown(Number(fd.get("ctc")), { month: m, daysInMonth: daysIn(y, m), lopDays: Number(fd.get("lop")) || 0, tds: Number(fd.get("tds")) || 0, other: Number(fd.get("other")) || 0 }));
            }}
          >
            <label className="field">Annual CTC (₹)<input name="ctc" type="number" min="1" step="0.01" required defaultValue={calcIn.ctc} className="input w-40" /></label>
            <label className="field">Month<input type="month" name="cmonth" defaultValue={calcIn.cmonth ?? today().slice(0, 7)} className="input w-auto" /></label>
            <label className="field">LOP days<input name="lop" type="number" min="0" step="0.5" defaultValue={calcIn.lop} className="input w-24" /></label>
            <label className="field">TDS<input name="tds" type="number" min="0" defaultValue={calcIn.tds} className="input w-28" /></label>
            <label className="field">Other deductions<input name="other" type="number" min="0" defaultValue={calcIn.other} className="input w-28" /></label>
            <button className="btn">Calculate</button>
          </form>
          {calc && <div className="mt-4 max-w-md"><SalaryBreakdown p={calc} /></div>}
        </section>
      </div>
    </>
  );
}
