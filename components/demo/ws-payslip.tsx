"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { PrintButton } from "@/components/print-button";
import { breakdown, daysIn, inr, monthLabel } from "@/lib/payroll";
import { fmtDate } from "@/lib/util";
import { EMPLOYEES, dept, office } from "@/lib/demo/data";
import { usePayroll } from "@/lib/demo/shared";

// Printable payslip, computed from the employee's CTC. No shell.
export function DemoPayslip({ id }: { id: string }) {
  const [runs] = usePayroll();
  const [runId, empId] = id.split("_");
  const run = runs.find((r) => r.id === runId);
  const e = EMPLOYEES.find((x) => x.id === empId);
  if (!run || !e) return <main className="mx-auto max-w-3xl px-4 py-8"><p className="empty card">Payslip not found.</p><Link href="/demo/workspace/payslips" className="btn btn-ghost mt-4"><ArrowLeft /> Back</Link></main>;

  const p = breakdown(e.ctc, { month: Number(run.month.slice(5, 7)), daysInMonth: daysIn(Number(run.month.slice(0, 4)), Number(run.month.slice(5, 7))) });
  const earnings: [string, number][] = [["Basic", p.basic], ["HRA", p.hra], ["Special allowance", p.special]];
  const deductions: [string, number][] = (
    [["Provident fund", p.employee_pf], ["ESI", p.employee_esi], ["Professional tax", p.pt], [`Loss of pay (${p.lop_days} d)`, p.lop_amount], ["TDS", p.tds], ["Other deductions", p.other_deductions]] as [string, number][]
  ).filter(([, v]) => v !== 0);
  const totalDed = deductions.reduce((s, [, v]) => s + v, 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between gap-2 print:hidden">
        <Link href="/demo/workspace/payslips" className="btn btn-ghost"><ArrowLeft /> Back</Link>
        <PrintButton />
      </div>
      <article className="card space-y-6 p-8 print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-line pb-5">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div>
              <div className="text-lg font-semibold tracking-tight">Open Box Ventures LLP</div>
              <div className="text-sm text-muted">Payslip for {monthLabel(run.month)}</div>
            </div>
          </div>
          {run.status !== "approved" && <span className="badge badge-amber">Draft - sheet not approved</span>}
        </header>

        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          {[["Employee", e.name], ["Employee code", e.code], ["Designation", e.designation], ["Department", dept(e.department_id)?.name], ["Office", office(e.office_id)?.name], ["Joined", fmtDate(e.joined_on)]].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v || "-"}</dd></div>
          ))}
        </dl>

        <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          {([["Earnings", earnings, p.gross], ["Deductions", deductions, totalDed]] as const).map(([title, rows, total]) => (
            <table key={title} className="table self-start">
              <thead><tr><th>{title}</th><th className="text-right">Amount</th></tr></thead>
              <tbody className="tabular-nums">
                {rows.map(([k, v]) => <tr key={k}><td>{k}</td><td className="text-right">{inr(v)}</td></tr>)}
                {!rows.length && <tr><td className="text-muted">None</td><td /></tr>}
              </tbody>
              <tfoot className="tabular-nums"><tr className="font-semibold"><td className="px-3 pt-3">Total</td><td className="px-3 pt-3 text-right">{inr(total)}</td></tr></tfoot>
            </table>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 print:border print:border-line">
          <span className="font-medium">Net pay</span>
          <span className="text-xl font-semibold tabular-nums">{inr(p.net)}</span>
        </div>
        <p className="text-xs text-muted">
          Employer contributions (part of CTC, not paid out): PF {inr(p.employer_pf)} · ESI {inr(p.employer_esi)}.
          Computer-generated payslip, no signature required.
        </p>
      </article>
    </main>
  );
}
