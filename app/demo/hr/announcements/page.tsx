"use client";
import { useState } from "react";
import { Megaphone, Send, Trash2 } from "lucide-react";
import { emp, today } from "@/lib/demo/data";
import { useAnnouncements } from "@/lib/demo/shared";
import { newId } from "@/lib/demo/store";
import { useRole } from "@/lib/demo/use-role";
import { fmtDate } from "@/lib/util";
import { PageHeader } from "../_parts";

export default function Announcements() {
  const { me } = useRole("hr");
  const [posts, setPosts] = useAnnouncements();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <>
      <PageHeader title="Announcements" sub="Posts go to the Announcements channel in everyone's chat. Admins, managers and automated updates post there." />
      <div className="max-w-3xl space-y-6">
        <section className="card">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setPosts((p) => [{ id: newId(), title: title.trim(), body: body.trim(), date: today(), author: me.id }, ...p]);
              setTitle("");
              setBody("");
            }}
          >
            <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Headline" className="input h-11 text-base font-medium" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4} placeholder="What does everyone need to know?" className="input" />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button className="btn btn-primary"><Send /> Post to everyone</button>
            </div>
          </form>
        </section>

        {posts.map((p) => (
          <article key={p.id} className="card">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Megaphone className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{p.title}</h2>
                <p className="mt-1 text-sm whitespace-pre-wrap text-muted">{p.body}</p>
                <p className="mt-2 text-xs text-muted">{emp(p.author).name} · {fmtDate(p.date)}</p>
              </div>
              {p.author === me.id && (
                <button className="btn btn-ghost btn-icon btn-danger" title="Delete" onClick={() => confirm("Delete this post for everyone?") && setPosts((l) => l.filter((x) => x.id !== p.id))}><Trash2 /></button>
              )}
            </div>
          </article>
        ))}
        {!posts.length && <p className="card empty"><Megaphone /> Nothing posted yet.</p>}
      </div>
    </>
  );
}
