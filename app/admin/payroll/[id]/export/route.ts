import { requireStaff } from "@/lib/me";
import { db } from "@/lib/supabase";

const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // block spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const cols = ["basic", "hra", "special", "gross", "employee_pf", "employer_pf", "employee_esi", "employer_esi", "pt", "lop_days", "lop_amount", "tds", "other_deductions", "net"] as const;

// RLS scopes the run and its lines (admin: all, HR: own office).
export async function GET(_: Request, { params }: RouteContext<"/admin/payroll/[id]/export">) {
  const me = await requireStaff();
  if (me.role !== "admin" && me.role !== "hr") return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const sb = db();
  const [{ data: run }, { data: lines }] = await Promise.all([
    sb.from("payroll_runs").select("month").eq("id", id).maybeSingle(),
    sb.from("payroll_lines").select(`employee:employees(full_name, email), ${cols.join(", ")}`).eq("run_id", id),
  ]);
  if (!run || !lines) return new Response("Not found", { status: 404 });
  const rows = lines as unknown as ({ employee: { full_name: string; email: string } | null } & Record<(typeof cols)[number], number>)[];
  const csv = [["employee", "email", ...cols].join(","), ...rows.map((l) => [l.employee?.full_name, l.employee?.email, ...cols.map((c) => l[c])].map(cell).join(","))].join("\n");
  return new Response(csv, { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="payroll_${run.month.slice(0, 7)}.csv"` } });
}
