import { ClipboardCheck, Plus, Star } from "lucide-react";
import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { RATINGS, fmtDate } from "@/lib/util";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/shell";
import { closeCycle, rateEmployee, startCycle } from "./actions";

export const metadata = { title: "Performance reviews" };

type Review = {
  id: string; cycle_id: string; employee_id: string;
  self_rating: number | null; self_comments: string | null; self_at: string | null;
  mgr_rating: number | null; mgr_comments: string | null; mgr_at: string | null;
  employee: { full_name: string; designation: string | null } | null;
};

const Rating = ({ n }: { n: number | null }) => (n ? <span className="inline-flex items-center gap-1 tabular-nums"><Star className="size-3.5 text-amber" /> {n}</span> : <span className="text-muted">-</span>);

// Admin / branch head / HR open cycles; whoever manages a person rates them after their self-assessment. RLS scopes the rows.
export default async function Reviews() {
  const me = await staffPage();
  const sb = db();
  const canStart = me.role === "admin" || me.role === "hr" || me.role === "branch_head";
  const [{ data: cycles }, { data: reviews }, { data: offices }] = await Promise.all([
    sb.from("review_cycles").select("*, office:offices(name)").order("created_at", { ascending: false }),
    sb.from("reviews").select("*, employee:employees(full_name, designation)").order("id"),
    me.role === "admin" ? sb.from("offices").select("id, name").order("name") : { data: null },
  ]);
  const all = (reviews ?? []) as unknown as Review[];

  return (
    <>
      <PageHeader title="Performance reviews" sub="Employees self-assess first, then their manager rates them." />
      <div className="space-y-6">
        {canStart && (
          <section className="card">
            <h2 className="h2"><Plus /> Start a review cycle</h2>
            <ActionForm action={startCycle} className="flex flex-wrap items-end gap-3">
              <label className="field min-w-48 flex-1">Name<input name="name" required maxLength={120} placeholder="H1 2027 review" className="input" /></label>
              {offices && (
                <label className="field">Who
                  <select name="office" className="input"><option value="">Everyone</option>{offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                </label>
              )}
              <label className="field">Period start<input type="date" name="start" required className="input" /></label>
              <label className="field">Period end<input type="date" name="end" required className="input" /></label>
              <button className="btn btn-primary">Start</button>
            </ActionForm>
          </section>
        )}

        {cycles?.length ? cycles.map((c) => {
          const rows = all.filter((r) => r.cycle_id === c.id);
          const open = c.status === "open";
          return (
            <section key={c.id} className="card">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="h2 mb-0">{c.name} <span className={`badge ${open ? "badge-green" : ""}`}>{c.status}</span></h2>
                  <p className="text-sm text-muted">{fmtDate(c.period_start)} to {fmtDate(c.period_end)} · {(c.office as { name: string } | null)?.name ?? "All offices"} · {rows.filter((r) => r.mgr_at).length}/{rows.length} rated</p>
                </div>
                {open && (c.created_by === me.id || me.role === "admin") && (
                  <ActionForm action={closeCycle} confirm="Close this cycle? Nobody can edit reviews after.">
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn btn-ghost">Close cycle</button>
                  </ActionForm>
                )}
              </div>
              {rows.length ? (
                <div className="divide-y divide-line">
                  {rows.map((r) => (
                    <details key={r.id} className="group py-3">
                      <summary className="flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-1">
                        <span className="min-w-40 flex-1 font-medium">{r.employee?.full_name}<span className="ml-2 text-sm font-normal text-muted">{r.employee?.designation}</span></span>
                        <span className="text-sm text-muted">Self <Rating n={r.self_rating} /></span>
                        <span className="text-sm text-muted">Manager <Rating n={r.mgr_rating} /></span>
                        <span className={`badge ${r.mgr_at ? "badge-green" : r.self_at ? "badge-amber" : ""}`}>{r.mgr_at ? "Done" : r.self_at ? "Awaiting manager" : "Awaiting self-review"}</span>
                      </summary>
                      <div className="mt-3 space-y-3 text-sm">
                        {r.self_comments && <p><b>Self ({RATINGS[r.self_rating ?? 0]}):</b> <span className="whitespace-pre-wrap">{r.self_comments}</span></p>}
                        {open && r.self_at && r.employee_id !== me.id && (
                          <ActionForm action={rateEmployee} keep success="Saved" className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
                            <input type="hidden" name="id" value={r.id} />
                            <label className="field">Your rating
                              <select name="rating" required defaultValue={r.mgr_rating ?? ""} className="input">
                                <option value="" disabled>Choose</option>
                                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} · {RATINGS[n]}</option>)}
                              </select>
                            </label>
                            <label className="field">Feedback<textarea name="comments" required rows={2} maxLength={5000} defaultValue={r.mgr_comments ?? ""} className="input" /></label>
                            <button className="btn btn-primary"><ClipboardCheck /> {r.mgr_at ? "Update" : "Submit"}</button>
                          </ActionForm>
                        )}
                        {!open && r.mgr_comments && <p><b>Manager ({RATINGS[r.mgr_rating ?? 0]}):</b> <span className="whitespace-pre-wrap">{r.mgr_comments}</span></p>}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No one you manage is in this cycle.</p>
              )}
            </section>
          );
        }) : <p className="empty"><ClipboardCheck /> No review cycles yet.</p>}
      </div>
    </>
  );
}
