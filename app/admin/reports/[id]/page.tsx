import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Presentation, Save, Trash2 } from "lucide-react";
import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { ActionForm } from "@/components/action-form";
import { PrintButton } from "@/components/print-button";
import { PageHeader } from "@/components/shell";
import { deleteCompiled, saveCompiled } from "../actions";

export const metadata = { title: "Report" };

// Tiny markdown view (#, ##, ###, paragraphs): enough for the printed copy.
function Preview({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm">
      {text.split("\n").map((l, i) =>
        l.startsWith("### ") ? <h3 key={i} className="mt-3 font-medium">{l.slice(4)}</h3>
        : l.startsWith("## ") ? <h2 key={i} className="mt-6 text-lg font-semibold">{l.slice(3)}</h2>
        : l.startsWith("# ") ? <h1 key={i} className="text-2xl font-semibold">{l.slice(2)}</h1>
        : l.trim() ? <p key={i} className="whitespace-pre-wrap">{l}</p> : null,
      )}
    </div>
  );
}

export default async function Compiled({ params }: PageProps<"/admin/reports/[id]">) {
  await staffPage();
  const { id } = await params;
  const { data: r } = await db().from("compiled_reports").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={r.title} sub="Edit the draft, then download or print it.">
          <Link href="/admin/reports" className="btn btn-ghost"><ArrowLeft /> Reports</Link>
          <a className="btn" href={`/admin/reports/${r.id}/export?format=txt`}><Presentation /> PowerPoint outline</a>
          <a className="btn" href={`/admin/reports/${r.id}/export?format=md`}><Download /> Markdown</a>
          <PrintButton />
        </PageHeader>
        <ActionForm action={saveCompiled} keep success="Saved" className="card mb-6 space-y-4">
          <input type="hidden" name="id" value={r.id} />
          <label className="field">Title<input name="title" required maxLength={200} defaultValue={r.title} className="input" /></label>
          <label className="field">Report (# title, ## person or slide, ### date, plain lines are bullets)
            <textarea name="body" required rows={20} defaultValue={r.body} className="input font-mono text-xs" />
          </label>
          <button className="btn btn-primary"><Save /> Save</button>
        </ActionForm>
        <p className="mb-2 text-xs text-muted">PowerPoint: Home → New Slide → Slides from Outline, pick the .txt file.</p>
      </div>
      <section className="card"><Preview text={r.body} /></section>
      <ActionForm action={deleteCompiled} confirm="Delete this report?" className="mt-6 print:hidden">
        <input type="hidden" name="id" value={r.id} />
        <button className="btn btn-ghost btn-danger"><Trash2 /> Delete</button>
      </ActionForm>
    </>
  );
}
