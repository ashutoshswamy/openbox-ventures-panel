"use client";
import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Download, Pencil, Save, Send, Trash2, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Secret } from "@/components/secret";
import { PageHeader, useAdm } from "@/components/demo/adm-ui";
import { csv, download, runLines, useLineEdits, useOffices, useRunNotes, useSalaries } from "@/lib/demo/admin";
import { usePayroll } from "@/lib/demo/shared";
import { inr, monthLabel, STATUS_TONE } from "@/lib/payroll";
import { str } from "@/lib/util";

const SUMS = ["basic", "hra", "special", "gross", "employee_pf", "employee_esi", "pt", "lop_amount", "tds", "other_deductions", "net"] as const;

export default function Sheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isAdmin, emps, log } = useAdm();
  const router = useRouter();
  const [runs, setRuns] = usePayroll();
  const [offices] = useOffices();
  const [sals] = useSalaries();
  const [edits, setEdits] = useLineEdits();
  const [notes, setNotes] = useRunNotes();
  const run = runs.find((r) => r.id === id);
  useEffect(() => { if (!isAdmin) router.replace("/demo/admin"); }, [isAdmin, router]);
  if (!isAdmin) return null;
  if (!run) return <p className="card empty">Salary sheet not found. <Link href="/demo/admin/payroll" className="btn">Back to payroll</Link></p>;

  const rows = runLines(run, emps, sals, edits);
  const total = (k: (typeof SUMS)[number]) => rows.reduce((s, l) => s + l[k], 0);
  const draft = run.status === "draft";
  const office = offices.find((o) => o.id === run.office_id)?.name ?? "All offices";
  const label = `${monthLabel(run.month)}, ${office}`;
  const setStatus = (status: typeof run.status) => setRuns((l) => l.map((r) => (r.id === id ? { ...r, status } : r)));

  const exportCsv = () =>
    download(`salary_${run.month.slice(0, 7)}.csv`, csv([["Employee", ...SUMS], ...rows.map((l) => [l.name, ...SUMS.map((k) => l[k])])]));

  return (
    <>
      <PageHeader title={`Salary sheet · ${monthLabel(run.month)}`} sub={<>{office} · <span className={`badge ${STATUS_TONE[run.status]}`}>{run.status}</span></>}>
        <Link href="/demo/admin/payroll" className="btn btn-ghost"><ArrowLeft /> Payroll</Link>
        <button className="btn" onClick={exportCsv}><Download /> CSV</button>
      </PageHeader>
      <div className="space-y-6">
        {draft && notes[id] && <p className="error">Sent back by admin: {notes[id]}</p>}

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
                    <td className="font-medium">{l.name}</td>
                    {SUMS.map((k) => <td key={k} className={`text-right ${k === "net" ? "font-semibold" : ""}`}>{inr(l[k])}{k === "lop_amount" && l.lop_days > 0 ? <span className="block text-xs text-muted">{l.lop_days} d</span> : null}</td>)}
                    {draft && (
                      <td className="text-right">
                        <details className="inline-block text-left">
                          <summary className="btn btn-ghost btn-icon cursor-pointer" title="Edit"><Pencil /></summary>
                          <ActionForm
                            action={async (fd) => setEdits((m) => ({ ...m, [id]: { ...m[id], [l.id]: { lop: Number(str(fd, "lop_days")) || 0, tds: Number(str(fd, "tds")) || 0, other: Number(str(fd, "other_deductions")) || 0 } } }))}
                            keep className="absolute z-10 mt-1 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3 shadow-lg"
                          >
                            <label className="field">LOP days<input name="lop_days" type="number" min="0" step="0.5" defaultValue={l.ed.lop} className="input w-24" /></label>
                            <label className="field">TDS<input name="tds" type="number" min="0" step="0.01" defaultValue={l.ed.tds} className="input w-28" /></label>
                            <label className="field">Other<input name="other_deductions" type="number" min="0" step="0.01" defaultValue={l.ed.other} className="input w-28" /></label>
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
              <ActionForm action={async () => { setStatus("submitted"); setNotes((n) => ({ ...n, [id]: "" })); log("Submitted payroll", label); }} confirm="Submit this sheet to admin for approval? You can't edit it after."><button className="btn btn-primary"><Send /> Submit for approval</button></ActionForm>
              <ActionForm action={async () => { setRuns((l) => l.filter((r) => r.id !== id)); log("Deleted salary sheet", label); router.push("/demo/admin/payroll"); }} confirm="Delete this draft sheet?"><button className="btn btn-danger"><Trash2 /> Delete draft</button></ActionForm>
            </>
          )}
          {run.status === "submitted" && (
            <ActionForm
              action={async (fd) => {
                if (fd.get("decision") === "reject") {
                  const note = str(fd, "note");
                  if (!note) return "Add a note when sending a sheet back";
                  setStatus("draft"); setNotes((n) => ({ ...n, [id]: note })); log("Sent back payroll", label);
                } else { setStatus("approved"); log("Approved payroll", label); }
              }}
              className="flex flex-wrap gap-2"
            >
              <input name="note" placeholder="Note (required to reject)" className="input w-auto min-w-56" />
              <button name="decision" value="reject" className="btn btn-danger"><X /> Send back</button>
              <button name="decision" value="approve" className="btn btn-primary"><Check /> Approve</button>
            </ActionForm>
          )}
          {run.status === "approved" && <span className="badge badge-green">Approved and locked</span>}
        </div>
      </div>
    </>
  );
}
