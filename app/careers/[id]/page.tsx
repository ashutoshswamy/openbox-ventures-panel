import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { adminDb } from "@/lib/supabase";
import { JOB_TYPES } from "@/lib/jobs";
import { ActionForm } from "@/components/action-form";
import { applyForJob } from "../actions";

export async function generateMetadata({ params }: PageProps<"/careers/[id]">) {
  const { id } = await params;
  const { data } = await adminDb().from("jobs").select("title").eq("id", id).eq("open", true).maybeSingle();
  return { title: data?.title ?? "Careers", robots: { index: true, follow: true } };
}

export default async function Job({ params }: PageProps<"/careers/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: j } = await adminDb().from("jobs").select("id, title, department, location, type, description").eq("id", id).eq("open", true).maybeSingle();
  if (!j) notFound();

  return (
    <>
      <Link href="/careers" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> All roles</Link>
      <h1 className="h1">{j.title}</h1>
      <p className="mt-1 text-sm text-muted">{[j.department, j.location, JOB_TYPES[j.type as keyof typeof JOB_TYPES]].filter(Boolean).join(" · ")}</p>
      <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">{j.description}</p>

      <section className="card mt-10">
        <h2 className="h2">Apply for this role</h2>
        <ActionForm action={applyForJob} success="Application sent. Thank you!" className="space-y-4">
          <input type="hidden" name="job_id" value={j.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">Full name<input name="name" required maxLength={200} autoComplete="name" className="input" /></label>
            <label className="field">Email<input name="email" type="email" required maxLength={200} autoComplete="email" className="input" /></label>
          </div>
          <label className="field">Phone (optional)<input name="phone" type="tel" maxLength={40} autoComplete="tel" className="input" /></label>
          <label className="field">Resume (PDF or Word, up to 4 MB)<input name="resume" type="file" required accept=".pdf,.doc,.docx" className="input" /></label>
          <label className="field">Anything else? (optional)<textarea name="note" rows={4} maxLength={3000} className="input" /></label>
          <button className="btn btn-primary"><Send /> Submit application</button>
        </ActionForm>
      </section>
    </>
  );
}
