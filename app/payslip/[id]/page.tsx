import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { pageMe } from "@/lib/me";
import { db } from "@/lib/supabase";
import { inr, monthLabel } from "@/lib/payroll";
import { fmtDate } from "@/lib/util";
import { Logo } from "@/components/logo";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Payslip" };

type Emp = { full_name: string; employee_code: string | null; designation: string | null; joined_on: string | null; department: { name: string } | null; office: { name: string } | null };

// One payroll line as a printable payslip. RLS decides who sees it: the employee (approved sheets only), HR of the office, admin.
export default async function Payslip({ params }: PageProps<"/payslip/[id]">) {
  const me = await pageMe();
  const { id } = await params;
  const { data: l } = await db()
    .from("payroll_lines")
    .select("*, run:payroll_runs(month, status), employee:employees(full_name, employee_code, designation, joined_on, department:departments(name), office:offices(name))")
    .eq("id", id)
    .maybeSingle();
  if (!l) notFound();
  const run = l.run as unknown as { month: string; status: string };
  const e = l.employee as unknown as Emp;
  const n = (k: string) => Number(l[k]);
  const earnings: [string, number][] = [["Basic", n("basic")], ["HRA", n("hra")], ["Special allowance", n("special")]];
  const deductions: [string, number][] = (
    [["Provident fund", n("employee_pf")], ["ESI", n("employee_esi")], ["Professional tax", n("pt")], [`Loss of pay (${n("lop_days")} d)`, n("lop_amount")], ["TDS", n("tds")], ["Other deductions", n("other_deductions")]] as [string, number][]
  ).filter(([, v]) => v !== 0);
  const totalDed = deductions.reduce((s, [, v]) => s + v, 0);
  const back = me.role === "admin" || me.role === "hr" ? `/${me.role === "hr" ? "hr" : "admin"}/payroll/${l.run_id}` : "/payslips";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between gap-2 print:hidden">
        <Link href={back} className="btn btn-ghost"><ArrowLeft /> Back</Link>
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
          {[["Employee", e.full_name], ["Employee code", e.employee_code], ["Designation", e.designation], ["Department", e.department?.name], ["Office", e.office?.name], ["Joined", e.joined_on && fmtDate(e.joined_on)]].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v || "-"}</dd></div>
          ))}
        </dl>

        <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          {([["Earnings", earnings, n("gross")], ["Deductions", deductions, totalDed]] as const).map(([title, rows, total]) => (
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
          <span className="text-xl font-semibold tabular-nums">{inr(n("net"))}</span>
        </div>
        <p className="text-xs text-muted">
          Employer contributions (part of CTC, not paid out): PF {inr(n("employer_pf"))} · ESI {inr(n("employer_esi"))}.
          Computer-generated payslip, no signature required.
        </p>
      </article>
    </main>
  );
}
