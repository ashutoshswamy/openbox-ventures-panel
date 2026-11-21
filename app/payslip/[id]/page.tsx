import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { pageMe } from "@/lib/me";
import { db } from "@/lib/supabase";
import { PayslipDoc, type PayslipEmp } from "@/components/payslip-doc";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Payslip" };

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
  const e = l.employee as unknown as PayslipEmp;
  const { data: bank, error: bankError } = await db().from("employee_bank")
    .select("bank_name, account_number, pan, uan").eq("employee_id", l.employee_id).maybeSingle();
  if (bankError) throw new Error("Unable to load payslip bank details");
  const back = me.role === "admin" || me.role === "hr" ? `/${me.role === "hr" ? "hr" : "admin"}/payroll/${l.run_id}` : "/payslips";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between gap-2 print:hidden">
        <Link href={back} className="btn btn-ghost"><ArrowLeft /> Back</Link>
        <PrintButton />
      </div>
      <PayslipDoc line={l} run={run} employee={e} bank={bank} />
    </main>
  );
}
