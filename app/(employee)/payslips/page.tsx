import Link from "next/link";
import { FileText } from "lucide-react";
import { employeePage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { inr, monthLabel } from "@/lib/payroll";
import { PageHeader } from "@/components/shell";
import { Secret } from "@/components/secret";

export const metadata = { title: "Payslips" };

// Own lines from approved sheets (RLS: payroll_lines "own" policy).
export default async function Payslips() {
  const me = await employeePage();
  const { data } = await db().from("payroll_lines").select("id, gross, net, run:payroll_runs!inner(month, status)").eq("employee_id", me.id).eq("run.status", "approved");
  const slips = (data ?? []).map((l) => ({ ...l, month: (l.run as unknown as { month: string }).month })).sort((a, b) => b.month.localeCompare(a.month));

  return (
    <>
      <PageHeader title="Payslips" sub="Monthly payslips once HR's salary sheet is approved." />
      <section className="card overflow-x-auto">
        {!slips.length ? <p className="text-sm text-muted">No payslips yet.</p> : (
          <Secret block label="payslip amounts">
            <table className="table">
              <thead><tr><th>Month</th><th className="text-right">Gross</th><th className="text-right">Net pay</th><th /></tr></thead>
              <tbody className="tabular-nums">
                {slips.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{monthLabel(s.month)}</td>
                    <td className="text-right">{inr(Number(s.gross))}</td>
                    <td className="text-right font-semibold">{inr(Number(s.net))}</td>
                    <td className="text-right"><Link href={`/payslip/${s.id}`} className="btn btn-ghost"><FileText /> View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secret>
        )}
      </section>
    </>
  );
}
