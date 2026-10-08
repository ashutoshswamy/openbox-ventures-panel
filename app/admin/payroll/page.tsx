import Link from "next/link";
import { redirect } from "next/navigation";
import { Calculator, ChevronDown, FilePlus2, IndianRupee, LockOpen, Plus, Wallet } from "lucide-react";
import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate, todayIn } from "@/lib/util";
import { breakdown, daysIn, inr, monthLabel, STATUS_TONE } from "@/lib/payroll";
import { ActionForm } from "@/components/action-form";
import { BankForm, maskAcct } from "@/components/bank-form";
import { PageHeader } from "@/components/shell";
import { SalaryBreakdown } from "@/components/salary-breakdown";
import { addSalary, createRun } from "./actions";
import { allowBankEdit } from "@/app/profile/bank-actions";

export const metadata = { title: "Payroll" };

export default async function Payroll({ searchParams }: PageProps<"/admin/payroll">) {
  const me = await staffPage();
  if (me.role !== "admin" && me.role !== "hr") redirect("/admin"); // managers: no payroll
  const admin = me.role === "admin";
  const sp = await searchParams;
  const sb = db();
  const today = todayIn();

  let emps = sb.from("employees").select("id, full_name, designation, office_id").eq("active", true).or("role.is.null,role.neq.admin").neq("id", me.id).order("full_name");
  if (!admin && me.office_id) emps = emps.eq("office_id", me.office_id);
  const [{ data: runs }, { data: offices }, { data: people }, { data: sals }, { data: banks }] = await Promise.all([
    sb.from("payroll_runs").select("id, month, status, office:offices(name)").order("month", { ascending: false }),
    sb.from("offices").select("id, name").order("name"),
    emps,
    sb.from("employee_salaries").select("*").order("effective_from"),
    sb.from("employee_bank").select("*"),
  ]);

  // calculator (GET form, computed on the server)
  const ctc = Number(sp.ctc) || 0;
  const cm = String(sp.cmonth || today.slice(0, 7));
  const [cy, cmo] = cm.split("-").map(Number);
  const calc = ctc > 0 ? breakdown(ctc, { month: cmo, daysInMonth: daysIn(cy, cmo), lopDays: Number(sp.lop) || 0, tds: Number(sp.tds) || 0, other: Number(sp.other) || 0 }) : null;

  return (
    <>
      <PageHeader title="Payroll" sub="Salaries, increments, bank details and monthly salary sheets" />
      <div className="space-y-6">
        <section className="card">
          <h2 className="h2"><Wallet /> Salary sheets</h2>
          <ActionForm action={createRun} success="Draft sheet created" className="mb-4 flex flex-wrap items-end gap-2">
            <label className="field">Month<input type="month" name="month" required defaultValue={today.slice(0, 7)} className="input w-auto" /></label>
            {admin && (
              <label className="field">Office
                <select name="office_id" className="input w-auto">
                  <option value="">All offices</option>
                  {offices?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
            )}
            <button className="btn btn-primary"><FilePlus2 /> Generate draft</button>
          </ActionForm>
          {runs?.length ? (
            <table className="table">
              <thead><tr><th>Month</th><th>Scope</th><th>Status</th><th /></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{monthLabel(r.month)}</td>
                    <td>{(r.office as unknown as { name: string } | null)?.name ?? "All offices"}</td>
                    <td><span className={`badge ${STATUS_TONE[r.status as keyof typeof STATUS_TONE]}`}>{r.status}</span></td>
                    <td className="text-right"><Link href={`payroll/${r.id}`} className="btn">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="empty">No salary sheets yet.</p>}
        </section>

        <section className="card">
          <h2 className="h2"><IndianRupee /> Salaries</h2>
          {people?.length ? (
            <ul className="divide-y divide-line">
              {people.map((p) => {
                const hist = sals?.filter((s) => s.employee_id === p.id) ?? [];
                const cur = [...hist].reverse().find((s) => s.effective_from <= today);
                const bank = banks?.find((b) => b.employee_id === p.id);
                return (
                  <li key={p.id} className="py-3">
                    <details className="group">
                      <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{p.full_name}</div>
                          <div className="text-sm text-muted">{p.designation ?? ""}</div>
                        </div>
                        <div className="text-right text-sm tabular-nums">
                          {cur ? <><div className="font-medium">{inr(Number(cur.annual_ctc))} / yr</div><div className="text-muted">since {fmtDate(cur.effective_from)}</div></> : <span className="text-muted">No salary</span>}
                        </div>
                        {bank?.edit_requested_at && <span className="badge badge-amber">Bank edit requested</span>}
                        <div className="w-28 text-sm text-muted tabular-nums">{bank ? maskAcct(bank.account_number) : "No bank details"}</div>
                        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-4 grid gap-6 lg:grid-cols-2">
                        <div className="space-y-4">
                          {!!hist.length && (
                            <table className="table">
                              <thead><tr><th>Effective</th><th className="text-right">Annual CTC</th><th className="text-right">Change</th><th>Note</th></tr></thead>
                              <tbody>
                                {[...hist].reverse().map((s, i, a) => {
                                  const prev = a[i + 1];
                                  const pct = prev ? ((Number(s.annual_ctc) - Number(prev.annual_ctc)) / Number(prev.annual_ctc)) * 100 : null;
                                  return (
                                    <tr key={s.id}>
                                      <td>{fmtDate(s.effective_from)}</td>
                                      <td className="text-right tabular-nums">{inr(Number(s.annual_ctc))}</td>
                                      <td className="text-right tabular-nums">{pct === null ? "-" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}</td>
                                      <td className="text-muted">{s.note}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                          <ActionForm action={addSalary} success="Saved" className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="employee_id" value={p.id} />
                            <label className="field">Annual CTC (₹)<input name="annual_ctc" type="number" min="1" step="0.01" required className="input w-40" /></label>
                            <label className="field">Effective from<input name="effective_from" type="date" required defaultValue={today} className="input w-auto" /></label>
                            <label className="field min-w-40 flex-1">Note<input name="note" placeholder={hist.length ? "Increment, promotion…" : "Joining salary"} className="input" /></label>
                            <button className="btn btn-primary"><Plus /> {hist.length ? "Add increment" : "Set salary"}</button>
                          </ActionForm>
                        </div>
                        <div className="space-y-4">
                          {bank && (bank.employee_can_edit ? (
                            <p className="text-sm text-muted"><LockOpen className="mr-1 inline size-3.5" />Unlocked: {p.full_name.split(" ")[0]} can change their bank details once.</p>
                          ) : (
                            <ActionForm action={allowBankEdit} success="Unlocked" className="flex flex-wrap items-center gap-3">
                              <input type="hidden" name="employee_id" value={p.id} />
                              <button className={`btn ${bank.edit_requested_at ? "btn-primary" : ""}`}><LockOpen /> Allow employee to edit</button>
                              {bank.edit_requested_at && <span className="text-sm text-muted">Requested {fmtDate(bank.edit_requested_at.slice(0, 10))}</span>}
                            </ActionForm>
                          ))}
                          <BankForm bank={bank} employeeId={p.id} />
                        </div>
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
          <form className="flex flex-wrap items-end gap-2">
            <label className="field">Annual CTC (₹)<input name="ctc" type="number" min="1" step="0.01" required defaultValue={ctc || ""} className="input w-40" /></label>
            <label className="field">Month<input type="month" name="cmonth" defaultValue={cm} className="input w-auto" /></label>
            <label className="field">LOP days<input name="lop" type="number" min="0" step="0.5" defaultValue={sp.lop ? String(sp.lop) : ""} className="input w-24" /></label>
            <label className="field">TDS<input name="tds" type="number" min="0" defaultValue={sp.tds ? String(sp.tds) : ""} className="input w-28" /></label>
            <label className="field">Other deductions<input name="other" type="number" min="0" defaultValue={sp.other ? String(sp.other) : ""} className="input w-28" /></label>
            <button className="btn">Calculate</button>
          </form>
          {calc && <div className="mt-4 max-w-md"><SalaryBreakdown p={calc} /></div>}
        </section>
      </div>
    </>
  );
}
