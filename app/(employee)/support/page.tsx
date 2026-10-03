import { CircleCheckBig, CircleDot, Inbox, LifeBuoy, Send } from "lucide-react";
import { employeePage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate } from "@/lib/util";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/shell";
import { reportIssue } from "../actions";

export const metadata = { title: "Report an issue" };

export default async function Support() {
  const me = await employeePage();
  const { data: issues } = await db()
    .from("issues")
    .select("id, subject, body, status, admin_note, created_at, resolved_at")
    .eq("employee_id", me.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Report an issue" sub="Questions or problems for the admin team. You'll see their reply here." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="card h-fit">
          <h2 className="h2"><LifeBuoy /> New report</h2>
          <ActionForm action={reportIssue} className="space-y-4">
            <label className="field">Subject<input name="subject" required maxLength={200} placeholder="e.g. Can't check in from the office" className="input" /></label>
            <label className="field">Details<textarea name="body" required rows={6} placeholder="What happened, and what did you expect?" className="input" /></label>
            <button className="btn btn-primary"><Send /> Send to admins</button>
          </ActionForm>
        </section>

        <section className="space-y-4">
          <h2 className="h2"><Inbox /> My reports</h2>
          {issues?.map((i) => (
            <article key={i.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{i.subject}</h3>
                  <p className="text-xs text-muted">Sent {fmtDate(i.created_at.slice(0, 10))}</p>
                </div>
                {i.status === "open" ? (
                  <span className="badge badge-amber"><CircleDot /> Open</span>
                ) : (
                  <span className="badge badge-green"><CircleCheckBig /> Resolved</span>
                )}
              </div>
              <p className="mt-3 text-sm whitespace-pre-wrap text-muted">{i.body}</p>
              {i.admin_note && (
                <div className="mt-3 rounded-xl border-l-2 border-primary bg-primary-soft/50 px-3 py-2 text-sm">
                  <span className="eyebrow text-primary">Admin reply</span>
                  <p className="mt-1 whitespace-pre-wrap">{i.admin_note}</p>
                </div>
              )}
            </article>
          ))}
          {!issues?.length && <p className="card empty"><Inbox /> Nothing reported yet.</p>}
        </section>
      </div>
    </>
  );
}
