import { Bot, Megaphone, Send, Trash2 } from "lucide-react";
import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate, fmtTime, splitPost } from "@/lib/util";
import { ActionForm } from "@/components/action-form";
import { AttachInput } from "@/components/attach-input";
import { Attachment } from "@/components/attachment";
import { PageHeader } from "@/components/shell";
import { deleteAnnouncement, saveAnnouncement } from "../actions";

export const metadata = { title: "Announcements" };

type Post = { id: string; body: string; attachment_path: string | null; created_at: string; sender: { full_name: string } | null; sender_id: string | null };

export default async function Announcements() {
  const me = await staffPage();
  const sb = db();
  const { data: ch } = await sb.from("channels").select("id").eq("announcements", true).maybeSingle();
  const { data } = ch
    ? await sb.from("messages").select("id, body, attachment_path, created_at, sender_id, sender:employees(full_name)").eq("channel_id", ch.id).order("created_at", { ascending: false }).limit(50)
    : { data: [] };
  const posts = (data ?? []) as unknown as Post[];

  return (
    <>
      <PageHeader title="Announcements" sub="Posts go to the Announcements channel in everyone's chat. Admins, managers and automated updates post there." />
      <div className="max-w-3xl space-y-6">
        <section className="card">
          <ActionForm action={saveAnnouncement} className="space-y-4">
            <input name="title" required placeholder="Headline" className="input h-11 text-base font-medium" />
            <textarea name="body" required rows={4} placeholder="What does everyone need to know?" className="input" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="-ml-2 flex items-center gap-2"><AttachInput name="attachment" /></span>
              <button className="btn btn-primary"><Send /> Post to everyone</button>
            </div>
          </ActionForm>
        </section>

        {posts.map((p) => {
          const [title, text] = splitPost(p.body);
          const auto = !p.sender_id;
          return (
            <article key={p.id} className="card">
              <div className="flex items-start gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${auto ? "bg-surface-2 text-muted" : "bg-primary-soft text-primary"}`}>
                  {auto ? <Bot className="size-4" /> : <Megaphone className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  {title && <h2 className="font-semibold">{title}</h2>}
                  <p className={`text-sm whitespace-pre-wrap ${title ? "mt-1 text-muted" : ""}`}>{text}</p>
                  {p.attachment_path && <Attachment id={p.id} path={p.attachment_path} chip="bg-surface-2" />}
                  <p className="mt-2 text-xs text-muted">
                    {auto ? "Automated" : p.sender?.full_name} · {fmtDate(p.created_at.slice(0, 10))} {fmtTime(p.created_at)}
                  </p>
                </div>
                {(me.role === "admin" || p.sender_id === me.id) && <ActionForm action={deleteAnnouncement} confirm="Delete this post for everyone?">
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn btn-ghost btn-icon btn-danger" title="Delete"><Trash2 /></button>
                </ActionForm>}
              </div>
            </article>
          );
        })}
        {!posts.length && <p className="card empty"><Megaphone /> Nothing posted yet.</p>}
      </div>
    </>
  );
}
