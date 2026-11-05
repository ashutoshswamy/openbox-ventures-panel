import { Briefcase, Check, Download, Eye, EyeOff, Mail, Phone, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/supabase";
import { JOB_TYPES } from "@/lib/jobs";
import { fmtDate } from "@/lib/util";
import { ActionForm } from "./action-form";
import { PageHeader } from "./shell";
import { deleteJob, saveJob, setApplicationStatus, setJobOpen } from "@/app/admin/actions";

type App = { id: string; name: string; email: string; phone: string | null; note: string | null; status: string; created_at: string };
type Job = { id: string; title: string; department: string | null; location: string | null; type: keyof typeof JOB_TYPES; description: string; open: boolean; created_at: string; applications: App[] };

const STATUS: Record<string, string> = { new: "badge-blue", shortlisted: "badge-amber", hired: "badge-green", rejected: "badge-red" };

// Shared by /admin/jobs and /hr/jobs. The page does the role check; RLS (can_hire) backs it up.
export async function JobsBoard() {
  const { data } = await db()
    .from("jobs")
    .select("*, applications:job_applications(id, name, email, phone, note, status, created_at)")
    .order("created_at", { ascending: false });
  const jobs = (data ?? []) as Job[];

  return (
    <>
      <PageHeader title="Jobs" sub={<>Open roles show on the public <a href="/careers" target="_blank" className="underline">careers page</a>. Applicants don&apos;t need an account.</>} />
      <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="card lg:sticky lg:top-6">
          <h2 className="h2"><Plus /> Post a job</h2>
          <ActionForm action={saveJob} success="Job posted" className="space-y-3">
            <label className="field">Title<input name="title" required maxLength={200} className="input" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">Department<input name="department" maxLength={100} className="input" /></label>
              <label className="field">Location<input name="location" maxLength={100} placeholder="e.g. Remote" className="input" /></label>
            </div>
            <label className="field">Type
              <select name="type" className="input">{Object.entries(JOB_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <label className="field">Description<textarea name="description" required rows={8} maxLength={10000} placeholder="About the role, responsibilities, requirements" className="input" /></label>
            <button className="btn btn-primary"><Plus /> Post job</button>
          </ActionForm>
        </section>

        <section className="space-y-4">
          {jobs.map((j) => (
            <article key={j.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{j.title}</h3>
                  <p className="text-sm text-muted">{[j.department, j.location, JOB_TYPES[j.type]].filter(Boolean).join(" · ")} · posted {fmtDate(j.created_at.slice(0, 10))}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${j.open ? "badge-green" : ""}`}>{j.open ? "Open" : "Closed"}</span>
                  <ActionForm action={setJobOpen} success={false}>
                    <input type="hidden" name="id" value={j.id} />
                    <input type="hidden" name="open" value={String(!j.open)} />
                    <button className="btn btn-ghost btn-icon size-8" title={j.open ? "Close applications" : "Reopen"} aria-label={j.open ? "Close job" : "Reopen job"}>{j.open ? <EyeOff /> : <Eye />}</button>
                  </ActionForm>
                  <ActionForm action={deleteJob} success="Job deleted" confirm={`Delete "${j.title}" and its ${j.applications.length} application(s)?`}>
                    <input type="hidden" name="id" value={j.id} />
                    <button className="btn btn-ghost btn-icon btn-danger size-8" title="Delete" aria-label="Delete job"><Trash2 /></button>
                  </ActionForm>
                </div>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium">{j.applications.length} applicant{j.applications.length === 1 ? "" : "s"}</summary>
                <ul className="mt-3 divide-y divide-line/70">
                  {j.applications.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((a) => (
                    <li key={a.id} className="py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <b className="font-medium">{a.name}</b>
                        <span className={`badge ${STATUS[a.status]}`}>{a.status}</span>
                        <span className="text-xs text-muted">{fmtDate(a.created_at.slice(0, 10))}</span>
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
                        <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 hover:text-text"><Mail className="size-3.5" />{a.email}</a>
                        {a.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3.5" />{a.phone}</span>}
                        <a href={`/files/resume/${a.id}`} className="inline-flex items-center gap-1 hover:text-text"><Download className="size-3.5" />Resume</a>
                      </p>
                      {a.note && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-2/70 p-3 text-sm">{a.note}</p>}
                      <ActionForm action={setApplicationStatus} success={false} keep className="mt-2 flex flex-wrap gap-2">
                        <input type="hidden" name="id" value={a.id} />
                        {["new", "shortlisted", "rejected", "hired"].filter((s) => s !== a.status).map((s) => (
                          <button key={s} name="status" value={s} className="btn text-xs"><Check /> {s}</button>
                        ))}
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
          {!jobs.length && <p className="card empty"><Briefcase /> No jobs yet. Post the first one.</p>}
        </section>
      </div>
    </>
  );
}
