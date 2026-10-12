"use client";
import { Megaphone, Send, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader, useAdm } from "@/components/demo/adm-ui";
import { emp, today } from "@/lib/demo/data";
import { useAnnouncements } from "@/lib/demo/shared";
import { newId } from "@/lib/demo/store";
import { fmtDate, str } from "@/lib/util";

export default function Announcements() {
  const { me, isAdmin, log } = useAdm();
  const [posts, setPosts] = useAnnouncements();
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHeader title="Announcements" sub="Posts go to the Announcements channel in everyone's chat. Admins, managers and automated updates post there." />
      <div className="max-w-3xl space-y-6">
        <section className="card">
          <ActionForm
            action={async (fd) => {
              const title = str(fd, "title"), body = str(fd, "body");
              if (!title || !body) return "Add a headline and a message";
              setPosts((l) => [{ id: newId(), title, body, date: today(), author: me.id }, ...l]);
              log("Posted announcement", title);
            }}
            className="space-y-4"
          >
            <input name="title" required placeholder="Headline" className="input h-11 text-base font-medium" />
            <textarea name="body" required rows={4} placeholder="What does everyone need to know?" className="input" />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button className="btn btn-primary"><Send /> Post to everyone</button>
            </div>
          </ActionForm>
        </section>

        {sorted.map((p) => (
          <article key={p.id} className="card">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Megaphone className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{p.title}</h2>
                <p className="mt-1 text-sm whitespace-pre-wrap text-muted">{p.body}</p>
                <p className="mt-2 text-xs text-muted">{emp(p.author).name} · {fmtDate(p.date)}</p>
              </div>
              {(isAdmin || p.author === me.id) && (
                <button className="btn btn-ghost btn-icon btn-danger" title="Delete" onClick={() => { if (confirm("Delete this post for everyone?")) { setPosts((l) => l.filter((x) => x.id !== p.id)); log("Deleted announcement", p.title); } }}><Trash2 /></button>
              )}
            </div>
          </article>
        ))}
        {!sorted.length && <p className="card empty"><Megaphone /> Nothing posted yet.</p>}
      </div>
    </>
  );
}
