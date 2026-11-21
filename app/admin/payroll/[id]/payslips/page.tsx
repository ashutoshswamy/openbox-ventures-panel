import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { PayslipDoc, type PayslipEmp, type PayslipBank } from "@/components/payslip-doc";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Payslips" };

// Several payslips at once, for printing / saving as one PDF: one employee (checked individually), a chosen few, or everyone in the sheet.
export default async function Payslips({ params, searchParams }: PageProps<"/admin/payroll/[id]/payslips">) {
  const me = await staffPage();
  if (me.role !== "admin" && me.role !== "hr") redirect("/admin");
  const { id } = await params;
  const sp = await searchParams;
  const ids = ([] as string[]).concat(sp.id ?? []).filter(Boolean);

  const sb = db();
  const { data: run } = await sb.from("payroll_runs").select("month, status").eq("id", id).maybeSingle();
  if (!run) notFound();

  let q = sb.from("payroll_lines")
    .select("*, employee:employees(full_name, employee_code, designation, joined_on, department:departments(name), office:offices(name))")
    .eq("run_id", id);
  if (ids.length) q = q.in("id", ids);
  const { data: lines } = await q;
  if (!lines?.length) notFound();
  const rows = [...lines].sort((a, b) => (a.employee?.full_name ?? "").localeCompare(b.employee?.full_name ?? ""));

  const { data: banks } = await sb.from("employee_bank").select("employee_id, bank_name, account_number, pan, uan").in("employee_id", rows.map((l) => l.employee_id));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between gap-2 print:hidden">
        <Link href={`/${me.role}/payroll/${id}`} className="btn btn-ghost"><ArrowLeft /> Salary sheet</Link>
        <PrintButton />
      </div>
      {rows.map((l, i) => (
        <PayslipDoc key={l.id} line={l} run={run} employee={l.employee as unknown as PayslipEmp} bank={(banks?.find((b) => b.employee_id === l.employee_id) ?? null) as PayslipBank} pageBreak={i < rows.length - 1} />
      ))}
    </main>
  );
}
