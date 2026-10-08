import Link from "next/link";
import { adminPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { PageHeader } from "@/components/shell";

export const metadata = { title: "Audit log" };

const TABLES: Record<string, string> = {
  employees: "Employee", employee_salaries: "Salary", employee_bank: "Bank details", payroll_runs: "Salary sheet", payroll_lines: "Salary sheet line",
  leave_requests: "Leave", regularizations: "Regularization", leave_types: "Leave type", holidays: "Holiday", offices: "Office", departments: "Department",
};
const TONE = { insert: "badge-green", update: "badge-blue", delete: "badge-red" } as const;
const PAGE = 100;

const val = (v: unknown) => (v == null ? "-" : typeof v === "object" ? JSON.stringify(v) : String(v));
const at = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Row = { id: number; at: string; actor_id: string | null; employee_id: string | null; action: keyof typeof TONE; table_name: string; old: Record<string, unknown> | null; new: Record<string, unknown> | null };

// Written by the audit() trigger (supabase/migrations/…_payslips_and_audit.sql). Newest first, keyset paging on id.
export default async function Audit({ searchParams }: PageProps<"/admin/audit">) {
  await adminPage();
  const sp = await searchParams;
  const table = sp.table && String(sp.table) in TABLES ? String(sp.table) : null;
  const employee = /^[0-9a-f-]{36}$/.test(String(sp.employee ?? "")) ? String(sp.employee) : null;
  const before = Number(sp.before) || null;
  const sb = db();

  let q = sb.from("audit_log").select("*").order("id", { ascending: false }).limit(PAGE);
  if (table) q = q.eq("table_name", table);
  if (employee) q = q.or(`employee_id.eq.${employee},actor_id.eq.${employee}`);
  if (before) q = q.lt("id", before);
  const { data } = await q;
  const rows = (data ?? []) as Row[];
  const ids = [...new Set(rows.flatMap((r) => [r.actor_id, r.employee_id]).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await sb.from("employees").select("id, full_name").in("id", ids) : { data: [] };
  const name = (id: string | null) => (id ? people?.find((p) => p.id === id)?.full_name ?? "Deleted employee" : null);
  const link = (p: Record<string, string | number | null>) => "?" + new URLSearchParams(Object.entries({ table, employee, ...p }).filter(([, v]) => v != null) as [string, string][]);

  return (
    <>
      <PageHeader title="Audit log" sub="Changes to people, pay, leave and org settings. Bank values are never stored." />
      <div className="space-y-6">
        <form className="flex flex-wrap items-center gap-2">
          <select name="table" defaultValue={table ?? ""} className="input w-auto">
            <option value="">Everything</option>
            {Object.entries(TABLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {employee && <input type="hidden" name="employee" value={employee} />}
          <button className="btn">Show</button>
          {(table || employee) && <Link href="/admin/audit" className="btn btn-ghost">Clear</Link>}
          {employee && <span className="text-sm text-muted">Showing {name(employee) ?? "one person"}</span>}
        </form>

        <section className="card overflow-x-auto">
          {!rows.length ? <p className="text-sm text-muted">Nothing logged yet.</p> : (
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>Whose</th><th>Change</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap text-muted tabular-nums">{at(r.at)}</td>
                    <td className="whitespace-nowrap">{r.actor_id ? <Link href={link({ employee: r.actor_id, before: null })} className="hover:underline">{name(r.actor_id)}</Link> : <span className="text-muted">System</span>}</td>
                    <td className="whitespace-nowrap"><span className={`badge ${TONE[r.action]}`}>{r.action}</span> {TABLES[r.table_name] ?? r.table_name}</td>
                    <td className="whitespace-nowrap">{r.employee_id ? <Link href={link({ employee: r.employee_id, before: null })} className="hover:underline">{name(r.employee_id)}</Link> : "-"}</td>
                    <td className="min-w-64 text-xs">
                      {r.action === "update" ? (
                        <ul className="space-y-0.5">
                          {Object.keys(r.new ?? {}).map((k) => (
                            <li key={k} className="break-all"><span className="text-muted">{k}:</span> {val(r.old?.[k])} → <span className="font-medium">{val(r.new?.[k])}</span></li>
                          ))}
                        </ul>
                      ) : (
                        <details><summary className="cursor-pointer text-muted">Record</summary><pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(r.new ?? r.old, null, 1)}</pre></details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        {rows.length === PAGE && <Link href={link({ before: rows[rows.length - 1].id })} className="btn">Older</Link>}
      </div>
    </>
  );
}
