import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, Download, Pencil, Save, Send, Trash2, X } from "lucide-react";
import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { inr, monthLabel, STATUS_TONE } from "@/lib/payroll";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/shell";
import { Secret } from "@/components/secret";
import { deleteRun, reviewRun, submitRun, updateLine } from "../actions";

export const metadata = { title: "Salary sheet" };

const SUMS = ["basic", "hra", "special", "gross", "employee_pf", "employee_esi", "pt", "lop_amount", "tds", "other_deductions", "net"] as const;

export default async function Sheet({ params }: PageProps<"/admin/payroll/[id]">) {
  const me = await staffPage();
  if (me.role !== "admin" && me.role !== "hr") redirect("/admin");
  const { id } = await params;
  const sb = db();
  const [{ data: run }, { data: lines }] = await Promise.all([
    sb.from("payroll_runs").select("*, office:offices(name)").eq("id", id).maybeSingle(),
    sb.from("payroll_lines").select("*, employee:employees(full_name)").eq("run_id", id),
  ]);
  if (!run) notFound();
  const rows = (lines ?? []).sort((a, b) => (a.employee?.full_name ?? "").localeCompare(b.employee?.full_name ?? ""));
  const total = (k: (typeof SUMS)[number]) => rows.reduce((s, l) => s + Number(l[k]), 0);
  const draft = run.status === "draft";
  const office = (run.office as unknown as { name: string } | null)?.name ?? "All offices";

  return (
    <>
      <PageHeader title={`Salary sheet · ${monthLabel(run.month)}`} sub={<>{office} · <span className={`badge ${STATUS_TONE[run.status as keyof typeof STATUS_TONE]}`}>{run.status}</span></>}>
        <Link href="." className="btn btn-ghost"><ArrowLeft /> Payroll</Link>
        <a href={`${id}/export`} className="btn"><Download /> CSV</a>
      </PageHeader>
      <div className="space-y-6">
        {draft && run.review_note && <p className="error">Sent back by admin: {run.review_note}</p>}

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
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium"><Link href={`/payslip/${l.id}`} className="hover:underline" title="Payslip">{l.employee?.full_name}</Link></td>
                  {SUMS.map((k) => <td key={k} className={`text-right ${k === "net" ? "font-semibold" : ""}`}>{inr(Number(l[k]))}{k === "lop_amount" && Number(l.lop_days) > 0 ? <span className="block text-xs text-muted">{Number(l.lop_days)} d</span> : null}</td>)}
                  {draft && (
                    <td className="text-right">
                      <details className="inline-block text-left">
                        <summary className="btn btn-ghost btn-icon cursor-pointer" title="Edit"><Pencil /></summary>
                        <ActionForm action={updateLine} keep className="absolute z-10 mt-1 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3 shadow-lg">
                          <input type="hidden" name="id" value={l.id} />
                          <label className="field">LOP days<input name="lop_days" type="number" min="0" step="0.5" defaultValue={Number(l.lop_days)} className="input w-24" /></label>
                          <label className="field">TDS<input name="tds" type="number" min="0" step="0.01" defaultValue={Number(l.tds)} className="input w-28" /></label>
                          <label className="field">Other<input name="other_deductions" type="number" min="0" step="0.01" defaultValue={Number(l.other_deductions)} className="input w-28" /></label>
                          <button className="btn btn-primary"><Save /> Save</button>
                        </ActionForm>
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
              <ActionForm action={submitRun} confirm="Submit this sheet to admin for approval? You can't edit it after."><input type="hidden" name="id" value={id} /><button className="btn btn-primary"><Send /> Submit for approval</button></ActionForm>
              <ActionForm action={deleteRun} confirm="Delete this draft sheet?"><input type="hidden" name="id" value={id} /><button className="btn btn-danger"><Trash2 /> Delete draft</button></ActionForm>
            </>
          )}
          {run.status === "submitted" && me.role === "admin" && (
            <ActionForm action={reviewRun} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={id} />
              <input name="note" placeholder="Note (required to reject)" className="input w-auto min-w-56" />
              <button name="decision" value="reject" className="btn btn-danger"><X /> Send back</button>
              <button name="decision" value="approve" className="btn btn-primary"><Check /> Approve</button>
            </ActionForm>
          )}
          {run.status === "submitted" && me.role !== "admin" && <span className="badge badge-blue">Waiting for admin approval</span>}
          {run.status === "approved" && <span className="badge badge-green">Approved and locked</span>}
        </div>
      </div>
    </>
  );
}
