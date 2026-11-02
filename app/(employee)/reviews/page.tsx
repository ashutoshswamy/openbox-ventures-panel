import { ClipboardCheck } from "lucide-react";
import { employeePage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { RATINGS, fmtDate } from "@/lib/util";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/shell";
import { selfReview } from "../actions";

export const metadata = { title: "My reviews" };

export default async function MyReviews() {
  const me = await employeePage();
  const { data } = await db()
    .from("reviews")
    .select("*, cycle:review_cycles(name, period_start, period_end, status, created_at)")
    .eq("employee_id", me.id);
  const rows = (data ?? []).sort((a, b) => b.cycle.created_at.localeCompare(a.cycle.created_at));

  return (
    <>
      <PageHeader title="Performance reviews" sub="Describe your work for the period, then read your manager's feedback." />
      <div className="max-w-3xl space-y-6">
        {rows.length ? rows.map((r) => {
          const open = r.cycle.status === "open";
          return (
            <section key={r.id} className="card space-y-4">
              <div>
                <h2 className="h2 mb-0">{r.cycle.name} <span className={`badge ${open ? "badge-green" : ""}`}>{r.cycle.status}</span></h2>
                <p className="text-sm text-muted">{fmtDate(r.cycle.period_start)} to {fmtDate(r.cycle.period_end)}</p>
              </div>
              {open && !r.mgr_at ? (
                <ActionForm action={selfReview} keep success="Saved. You can edit until your manager rates you." className="space-y-4">
                  <input type="hidden" name="id" value={r.id} />
                  <label className="field">How would you rate yourself?
                    <select name="rating" required defaultValue={r.self_rating ?? ""} className="input">
                      <option value="" disabled>Choose</option>
                      {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} · {RATINGS[n]}</option>)}
                    </select>
                  </label>
                  <label className="field">Achievements, challenges, goals
                    <textarea name="comments" required rows={6} maxLength={5000} defaultValue={r.self_comments ?? ""} className="input" />
                  </label>
                  <button className="btn btn-primary"><ClipboardCheck /> {r.self_at ? "Update" : "Submit"} self-review</button>
                </ActionForm>
              ) : (
                r.self_comments && <p className="text-sm"><b>You ({RATINGS[r.self_rating ?? 0]}):</b> <span className="whitespace-pre-wrap">{r.self_comments}</span></p>
              )}
              {r.mgr_at ? (
                <div className="rounded-xl bg-surface-2/70 p-4 text-sm">
                  <p className="mb-1 font-medium">Manager rating: {r.mgr_rating} · {RATINGS[r.mgr_rating ?? 0]}</p>
                  <p className="whitespace-pre-wrap">{r.mgr_comments}</p>
                </div>
              ) : r.self_at && <p className="text-sm text-muted">Waiting for your manager.</p>}
            </section>
          );
        }) : <p className="empty"><ClipboardCheck /> No review cycle includes you yet.</p>}
      </div>
    </>
  );
}
