import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { adminPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate } from "@/lib/util";
import { AutoForm } from "@/components/auto-form";
import { PageHeader } from "@/components/shell";

export const metadata = { title: "Audit log" };

const TABLES: Record<string, string> = {
  employees: "Employee", employee_profiles: "Personal details", employee_salaries: "Salary", employee_bank: "Bank details", payroll_runs: "Salary sheet", payroll_lines: "Salary sheet line",
  leave_requests: "Leave", regularizations: "Regularization", leave_types: "Leave type", holidays: "Holiday", offices: "Office", departments: "Department",
};
const TONE = { insert: "badge-green", update: "badge-blue", delete: "badge-red" } as const;
const PAGE = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// "office_id" → "Office", "annual_ctc" → "Annual ctc"
const label = (k: string) => { const s = k.replace(/_id$/, "").replaceAll("_", " "); return s[0].toUpperCase() + s.slice(1); };
const at = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Row = { id: number; at: string; row_id: string | null; actor_id: string | null; employee_id: string | null; action: keyof typeof TONE; table_name: string; reason: string | null; old: Record<string, unknown> | null; new: Record<string, unknown> | null };

// Written by the audit() trigger (supabase/migrations/…_payslips_and_audit.sql). Newest first, 100 per page.
export default async function Audit({ searchParams }: PageProps<"/admin/audit">) {
  await adminPage();
  const sp = await searchParams;
  const table = sp.table && String(sp.table) in TABLES ? String(sp.table) : null;
  const employee = /^[0-9a-f-]{36}$/.test(String(sp.employee ?? "")) ? String(sp.employee) : null;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const sb = db();

  let q = sb.from("audit_log").select("*", { count: "exact" }).order("id", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (table) q = q.eq("table_name", table);
  if (employee) q = q.or(`employee_id.eq.${employee},actor_id.eq.${employee}`);
  const { data, count } = await q;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const rows = (data ?? []) as Row[];
  const ids = [...new Set(rows.flatMap((r) => [r.actor_id, r.employee_id]).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await sb.from("employees").select("id, full_name").in("id", ids) : { data: [] };
  const name = (id: string | null) => (id ? people?.find((p) => p.id === id)?.full_name ?? "Deleted employee" : null);

  // every id that appears inside a change (office, department, manager, leave type, salary sheet…) becomes its name
  const refs = [...new Set(rows.flatMap((r) => [r.old, r.new].flatMap((o) => Object.entries(o ?? {}).filter(([k, v]) => k !== "id" && typeof v === "string" && UUID.test(v)).map(([, v]) => v as string))))];
  const [emps, offs, deps, lts, runs] = refs.length
    ? await Promise.all([
        sb.from("employees").select("id, full_name").in("id", refs),
        sb.from("offices").select("id, name").in("id", refs),
        sb.from("departments").select("id, name").in("id", refs),
        sb.from("leave_types").select("id, name").in("id", refs),
        sb.from("payroll_runs").select("id, month").in("id", refs),
      ])
    : [];
  const known = new Map<string, string>([
    ...(emps?.data ?? []).map((x) => [x.id, x.full_name] as [string, string]),
    ...(offs?.data ?? []).map((x) => [x.id, x.name] as [string, string]),
    ...(deps?.data ?? []).map((x) => [x.id, x.name] as [string, string]),
    ...(lts?.data ?? []).map((x) => [x.id, x.name] as [string, string]),
    ...(runs?.data ?? []).map((x) => [x.id, `Salary sheet ${String(x.month).slice(0, 7)}`] as [string, string]),
  ]);
  const val = (v: unknown): string => {
    if (v == null || v === "") return "-";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (typeof v === "string") {
      if (UUID.test(v)) return `${known.get(v) ?? "Deleted record"} (${v})`; // name first, id in brackets
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtDate(v);
      if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return at(v);
    }
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  };
  // insert / delete: a readable list instead of raw JSON (ids, timestamps and empty values left out)
  const record = (o: Record<string, unknown> | null) => Object.entries(o ?? {}).filter(([k, v]) => k !== "created_at" && v != null && v !== "");
  const link = (p: Record<string, string | number | null>) => "?" + new URLSearchParams(Object.entries({ table, employee, ...p }).filter(([, v]) => v != null) as [string, string][]);

  return (
    <>
      <PageHeader title="Audit log" sub="Changes to people, pay, leave and org settings. Bank values are never stored." />
      <div className="space-y-6">
        <AutoForm className="flex flex-wrap items-center gap-2">
          <select name="table" defaultValue={table ?? ""} className="input w-auto">
            <option value="">Everything</option>
            {Object.entries(TABLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {employee && <input type="hidden" name="employee" value={employee} />}
          {(table || employee) && <Link href="/admin/audit" className="btn btn-ghost">Clear</Link>}
          {employee && <span className="text-sm text-muted">Showing {name(employee) ?? "one person"}</span>}
        </AutoForm>

        <section className="card overflow-x-auto">
          {!rows.length ? <p className="text-sm text-muted">Nothing logged yet.</p> : (
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>Whose</th><th>Change</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap text-muted tabular-nums">{at(r.at)}</td>
                    <td className="whitespace-nowrap">{r.actor_id ? <Link href={link({ employee: r.actor_id, page: null })} className="hover:underline">{name(r.actor_id)} <span className="text-xs text-muted">({r.actor_id})</span></Link> : <span className="text-muted">System</span>}</td>
                    <td className="whitespace-nowrap"><span className={`badge ${TONE[r.action]}`}>{r.action}</span> {TABLES[r.table_name] ?? r.table_name}{r.row_id && <span className="block text-xs text-muted">({r.row_id})</span>}</td>
                    <td className="whitespace-nowrap">{r.employee_id ? <Link href={link({ employee: r.employee_id, page: null })} className="hover:underline">{name(r.employee_id)} <span className="text-xs text-muted">({r.employee_id})</span></Link> : "-"}</td>
                    <td className="min-w-64 text-xs">
                      {r.reason && <p className="mb-1"><span className="text-muted">Reason:</span> {r.reason}</p>}
                      {r.action === "update" ? (
                        <ul className="space-y-0.5">
                          {Object.keys(r.new ?? {}).map((k) => (
                            <li key={k} className="break-words"><span className="text-muted">{label(k)}:</span> {val(r.old?.[k])} → <span className="font-medium">{val(r.new?.[k])}</span></li>
                          ))}
                        </ul>
                      ) : (
                        <details><summary className="cursor-pointer text-muted">Record</summary>
                          <ul className="mt-1 max-w-md space-y-0.5">{record(r.new ?? r.old).map(([k, v]) => <li key={k} className="break-words"><span className="text-muted">{label(k)}:</span> {val(v)}</li>)}</ul>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        {pages > 1 && (
          <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pages">
            {page > 1 ? <Link href={link({ page: page - 1 })} className="btn"><ChevronLeft /> Newer</Link> : <span />}
            <span className="text-muted">Page {page} of {pages} · {count} entries</span>
            {page < pages ? <Link href={link({ page: page + 1 })} className="btn">Older <ChevronRight /></Link> : <span />}
          </nav>
        )}
      </div>
    </>
  );
}
