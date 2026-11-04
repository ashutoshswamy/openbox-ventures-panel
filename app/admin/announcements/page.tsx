import { Bot, Megaphone, RefreshCw, Send, Trash2 } from "lucide-react";
import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate, fmtTime, splitPost, todayIn } from "@/lib/util";
import { ActionForm } from "@/components/action-form";
import { AttachInput } from "@/components/attach-input";
import { Attachment } from "@/components/attachment";
import { PageHeader } from "@/components/shell";
import { missingReminders } from "@/lib/pending";
import { deleteAnnouncement, saveAnnouncement, syncReminders } from "../actions";

export const metadata = { title: "Announcements" };

type Post = { id: string; body: string; attachment_path: string | null; created_at: string; sender: { full_name: string } | null; sender_id: string | null };

export default async function Announcements() {
  const me = await staffPage();
  const sb = db();
  const { data: ch } = await sb.from("channels").select("id").eq("announcements", true).maybeSingle();
  const { data } = ch
    ? await sb.from("messages").select("id, body, attachment_path, created_at, sender_id, sender:employees!messages_sender_id_fkey(full_name)").eq("channel_id", ch.id).order("created_at", { ascending: false }).limit(50)
    : { data: [] };
  const posts = (data ?? []) as unknown as Post[];
  const missing = await missingReminders().catch(() => 0);

  // newest first, grouped by day
  const today = todayIn();
  const yesterday = new Date(Date.parse(today + "T00:00:00Z") - 864e5).toISOString().slice(0, 10);
  const days: { day: string; posts: Post[] }[] = [];
  for (const p of posts) {
    const day = new Date(p.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    (days.at(-1)?.day === day ? days.at(-1)! : days[days.push({ day, posts: [] }) - 1]).posts.push(p);
  }
  const dayLabel = (d: string) => (d === today ? "Today" : d === yesterday ? "Yesterday" : fmtDate(d));

  return (
    <>
      <PageHeader title="Announcements" sub="Posts go to the Announcements channel in everyone's chat. Admins, managers and automated updates post there." />
      <div className="grid max-w-6xl items-start gap-x-14 gap-y-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section aria-label="Write an announcement" className="lg:sticky lg:top-6">
          <h2 className="mb-3 text-[15px] font-semibold tracking-tight">New announcement</h2>
          <ActionForm action={saveAnnouncement} success="Announcement posted" className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <input name="title" required placeholder="Headline" aria-label="Headline" className="input h-11 text-base font-medium" />
            <textarea name="body" required rows={6} placeholder="What does everyone need to know?" aria-label="Message" className="input" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="-ml-2 flex items-center gap-2"><AttachInput name="attachment" /></span>
              <button className="btn btn-primary"><Send /> Post</button>
            </div>
          </ActionForm>
          <p className="mt-3 text-xs leading-relaxed text-muted">Everyone gets a notification. Birthdays, anniversaries and holiday reminders post here by themselves.</p>
        </section>

        <section aria-label="Posted announcements" className="min-w-0">
          {missing > 0 && (
            <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-amber/40 bg-amber-soft/40 p-3.5">
              <RefreshCw className="size-4 shrink-0 text-amber" />
              <p className="min-w-0 flex-1 text-sm"><b className="font-semibold">Not synced.</b> {missing} birthday, anniversary or holiday reminder{missing === 1 ? "" : "s"} for today {missing === 1 ? "hasn't" : "haven't"} been posted yet.</p>
              <ActionForm action={syncReminders} success="Announcements synced"><button className="btn btn-primary"><RefreshCw /> Sync now</button></ActionForm>
            </div>
          )}

          {days.map(({ day, posts: list }) => (
            <div key={day} className="mb-9 last:mb-0">
              <h2 className="mb-1 border-b border-line pb-2 text-sm font-semibold">{dayLabel(day)}</h2>
              <ul className="divide-y divide-line/70">
                {list.map((p) => {
                  const [title, text] = splitPost(p.body);
                  const auto = !p.sender_id;
                  const canDelete = me.role === "admin" || p.sender_id === me.id;
                  const del = canDelete && (
                    <ActionForm action={deleteAnnouncement} success="Announcement deleted" confirm="Delete this post for everyone?">
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn btn-ghost btn-icon btn-danger size-8" title="Delete" aria-label="Delete announcement"><Trash2 /></button>
                    </ActionForm>
                  );
                  // automated posts stay small: one line, muted
                  if (auto) return (
                    <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm text-muted">
                      <Bot className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1">{text}</span>
                      <span className="shrink-0 text-xs tabular-nums">{fmtTime(p.created_at)}</span>
                      {del}
                    </li>
                  );
                  return (
                    <li key={p.id} className="flex items-start gap-3.5 py-5">
                      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Megaphone className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        {title && <h3 className="text-base font-semibold tracking-tight">{title}</h3>}
                        <p className={`whitespace-pre-wrap ${title ? "mt-1 text-sm leading-relaxed text-muted" : "text-sm"}`}>{text}</p>
                        {p.attachment_path && <div className="mt-2"><Attachment id={p.id} path={p.attachment_path} chip="bg-surface-2" /></div>}
                        <p className="mt-2 text-xs text-muted">{p.sender?.full_name ?? "Open Box Ventures"} at {fmtTime(p.created_at)}</p>
                      </div>
                      {del}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {!posts.length && <p className="empty"><Megaphone /> Nothing posted yet. Your first announcement shows up here.</p>}
        </section>
      </div>
    </>
  );
}
