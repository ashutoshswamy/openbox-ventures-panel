"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calculator, ChevronDown, FilePlus2, IndianRupee, Plus, Wallet } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Secret } from "@/components/secret";
import { SalaryBreakdown } from "@/components/salary-breakdown";
import { PageHeader, useAdm } from "@/components/demo/adm-ui";
import { runLines, useLineEdits, useOffices, useSalaries } from "@/lib/demo/admin";
import { today as todayFn } from "@/lib/demo/data";
import { usePayroll } from "@/lib/demo/shared";
import { newId } from "@/lib/demo/store";
import { breakdown, daysIn, inr, monthLabel, STATUS_TONE } from "@/lib/payroll";
import { fmtDate, str } from "@/lib/util";

export default function Payroll() {
  const { isAdmin, emps, log } = useAdm();
  const router = useRouter();
  const [runs, setRuns] = usePayroll();
  const [offices] = useOffices();
  const [sals, setSals] = useSalaries();
  const [edits] = useLineEdits();
  const today = todayFn();
  const [calc, setCalc] = useState<ReturnType<typeof breakdown> | null>(null);

  useEffect(() => { if (!isAdmin) router.replace("/demo/admin"); }, [isAdmin, router]); // managers: no payroll
  if (!isAdmin) return null;
  const people = emps.filter((e) => e.active && !e.invited && e.role !== "admin").sort((a, b) => a.name.localeCompare(b.name));

  const createRun = async (fd: FormData) => {
    const ym = str(fd, "month");
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "Pick a month";
    const office_id = str(fd, "office_id") ?? "";
    const run = { id: newId(), month: ym + "-01", office_id, status: "draft" as const };
    if (runs.some((r) => r.month === run.month && r.office_id === office_id)) return "A salary sheet for that month and office already exists";
    if (!runLines(run, emps, sals, edits).length) return "No employee in scope has a salary yet";
    setRuns((l) => [run, ...l]);
    log("Created salary sheet", `${monthLabel(run.month)}, ${offices.find((o) => o.id === office_id)?.name ?? "all offices"}`);
  };

  return (
    <>
      <PageHeader title="Payroll" sub="Salaries, increments, bank details and monthly salary sheets" />
      <div className="space-y-6">
        <section className="card">
          <h2 className="h2"><Wallet /> Salary sheets</h2>
          <ActionForm action={createRun} success="Draft sheet created" className="mb-4 flex flex-wrap items-end gap-2">
            <label className="field">Month<input type="month" name="month" required defaultValue={today.slice(0, 7)} className="input w-auto" /></label>
            <label className="field">Office
              <select name="office_id" className="input w-auto">
                <option value="">All offices</option>
                {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <button className="btn btn-primary"><FilePlus2 /> Generate draft</button>
          </ActionForm>
          {runs.length ? (
            <table className="table">
              <thead><tr><th>Month</th><th>Scope</th><th>Status</th><th /></tr></thead>
              <tbody>
                {[...runs].sort((a, b) => b.month.localeCompare(a.month)).map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{monthLabel(r.month)}</td>
                    <td>{offices.find((o) => o.id === r.office_id)?.name ?? "All offices"}</td>
                    <td><span className={`badge ${STATUS_TONE[r.status]}`}>{r.status}</span></td>
                    <td className="text-right"><Link href={`/demo/admin/payroll/${r.id}`} className="btn">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="empty">No salary sheets yet.</p>}
        </section>

        <section className="card">
          <h2 className="h2"><IndianRupee /> Salaries</h2>
          {people.length ? (
            <ul className="divide-y divide-line">
              {people.map((p) => {
                const hist = [...(sals[p.id] ?? [])].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
                const cur = [...hist].reverse().find((s) => s.effective_from <= today);
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
                        <div className="w-28 text-sm text-muted tabular-nums">Bank on file</div>
                        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-4 space-y-4">
                        {!!hist.length && (
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
                        )}
                        <ActionForm
                          action={async (fd) => {
                            const ctc = Number(str(fd, "annual_ctc"));
                            if (!(ctc > 0)) return "Enter the annual CTC";
                            setSals((m) => ({ ...m, [p.id]: [...(m[p.id] ?? []), { id: newId(), annual_ctc: ctc, effective_from: str(fd, "effective_from") ?? today, note: str(fd, "note") ?? "" }] }));
                            log("Changed salary", p.name);
                          }}
                          success="Saved" className="flex flex-wrap items-end gap-2"
                        >
                          <label className="field">Annual CTC (₹)<input name="annual_ctc" type="number" min="1" step="0.01" required className="input w-40" /></label>
                          <label className="field">Effective from<input name="effective_from" type="date" required defaultValue={today} className="input w-auto" /></label>
                          <label className="field min-w-40 flex-1">Note<input name="note" placeholder={hist.length ? "Increment, promotion…" : "Joining salary"} className="input" /></label>
                          <button className="btn btn-primary"><Plus /> {hist.length ? "Add increment" : "Set salary"}</button>
                        </ActionForm>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : <p className="empty">No employees.</p>}
        </section>

        <section className="card">
          <h2 className="h2"><Calculator /> Salary calculator</h2>
          <ActionForm
            action={async (fd) => {
              const ctc = Number(str(fd, "ctc"));
              if (!(ctc > 0)) { setCalc(null); return "Enter the annual CTC"; }
              const [cy, cmo] = (str(fd, "cmonth") ?? today.slice(0, 7)).split("-").map(Number);
              setCalc(breakdown(ctc, { month: cmo, daysInMonth: daysIn(cy, cmo), lopDays: Number(str(fd, "lop")) || 0, tds: Number(str(fd, "tds")) || 0, other: Number(str(fd, "other")) || 0 }));
            }}
            keep className="flex flex-wrap items-end gap-2"
          >
            <label className="field">Annual CTC (₹)<input name="ctc" type="number" min="1" step="0.01" required className="input w-40" /></label>
            <label className="field">Month<input type="month" name="cmonth" defaultValue={today.slice(0, 7)} className="input w-auto" /></label>
            <label className="field">LOP days<input name="lop" type="number" min="0" step="0.5" className="input w-24" /></label>
            <label className="field">TDS<input name="tds" type="number" min="0" className="input w-28" /></label>
            <label className="field">Other deductions<input name="other" type="number" min="0" className="input w-28" /></label>
            <button className="btn">Calculate</button>
          </ActionForm>
          {calc && <div className="mt-4 max-w-md"><SalaryBreakdown p={calc} /></div>}
        </section>
      </div>
    </>
  );
}
