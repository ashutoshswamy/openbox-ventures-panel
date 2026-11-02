import Link from "next/link";
import { FileText, FilePlus2, Presentation } from "lucide-react";
import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate, todayIn } from "@/lib/util";
import { ActionForm } from "@/components/action-form";
import { AutoForm } from "@/components/auto-form";
import { Pager } from "@/components/pager";
import { PageHeader } from "@/components/shell";
import { pageOf } from "@/lib/calendar";
import { compileReport } from "./actions";

export const metadata = { title: "Work reports" };

type Report = { id: string; kind: string; period_start: string; period_end: string; body: string; employee: { full_name: string; department: { name: string } | null } | null };

const SIZE = 15;
const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);

// What people wrote at check-out. RLS scopes rows: manager = own department, branch head = own office, admin = all.
export default async function Reports({ searchParams }: PageProps<"/admin/reports">) {
  const me = await staffPage();
  const sp = await searchParams;
  const kind = ["daily", "weekly", "monthly"].includes(String(sp.kind)) ? String(sp.kind) : "daily";
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.from)) ? String(sp.from) : ago(7);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.to)) ? String(sp.to) : todayIn();
  const office = me.role === "admin" && sp.office ? String(sp.office) : null;
  const { page, from: r0, to: r1 } = pageOf(sp.page, SIZE);
  const sb = db();

  let q = sb
    .from("work_reports")
    .select("id, kind, period_start, period_end, body, employee:employees!inner(full_name, office_id, department:departments(name))", { count: "exact" })
    .eq("kind", kind).gte("period_start", from).lte("period_end", to)
    .order("period_start", { ascending: false }).range(r0, r1);
  if (office) q = q.eq("employee.office_id", office);
  const [{ data, count }, { data: offices }, { data: saved }] = await Promise.all([
    q,
    me.role === "admin" ? sb.from("offices").select("id, name").order("name") : { data: null },
    sb.from("compiled_reports").select("id, title, kind, period_start, period_end, updated_at").order("updated_at", { ascending: false }).limit(20),
  ]);
  const rows = (data ?? []) as unknown as Report[];

  return (
    <>
      <PageHeader title="Work reports" sub="What the team wrote at check-out. Turn them into a report for slides or PDF." />
      <div className="space-y-6">
        <section className="card">
          <AutoForm className="flex flex-wrap items-end gap-3">
            <label className="field">Type
              <select name="kind" defaultValue={kind} className="input"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
            </label>
            <label className="field">From<input type="date" name="from" defaultValue={from} className="input" /></label>
            <label className="field">To<input type="date" name="to" defaultValue={to} className="input" /></label>
            {offices && (
              <label className="field">Office
                <select name="office" defaultValue={office ?? ""} className="input"><option value="">All</option>{offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              </label>
            )}
          </AutoForm>
        </section>

        <section className="card">
          <h2 className="h2"><FilePlus2 /> Create a report from these {count ?? 0}</h2>
          <ActionForm action={compileReport} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />
            {office && <input type="hidden" name="office" value={office} />}
            <label className="field min-w-64 flex-1">Title<input name="title" maxLength={200} placeholder={`Team ${kind} report, ${fmtDate(from)}`} className="input" /></label>
            <button className="btn btn-primary" disabled={!count}><Presentation /> Create draft</button>
            <p className="basis-full text-xs text-muted">You get an editable draft. Download it as a PowerPoint outline, Markdown, or print to PDF.</p>
          </ActionForm>
        </section>

        {!!saved?.length && (
          <section className="card">
            <h2 className="h2"><FileText /> Your reports</h2>
            <ul className="divide-y divide-line">
              {saved.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/reports/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:text-primary">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-sm text-muted">{s.kind} · {fmtDate(s.period_start)} to {fmtDate(s.period_end)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {rows.length ? (
          <div className="space-y-3">
            {rows.map((r) => (
              <article key={r.id} className="card">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.employee?.full_name}</span>
                  {r.employee?.department && <span className="badge">{r.employee.department.name}</span>}
                  <span className="text-sm text-muted">{r.period_start === r.period_end ? fmtDate(r.period_start) : `${fmtDate(r.period_start)} to ${fmtDate(r.period_end)}`}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{r.body}</p>
              </article>
            ))}
            <Pager page={page} total={count ?? 0} size={SIZE} />
          </div>
        ) : (
          <p className="empty"><FileText /> No {kind} reports in this range. Turn them on per office under Offices.</p>
        )}
      </div>
    </>
  );
}
