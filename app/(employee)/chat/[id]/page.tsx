import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Hash, Lock, Megaphone, SendHorizontal, Users, Video } from "lucide-react";
import { employeePage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { DEFAULT_TZ, fmtDate, fmtTime, meetUrl, splitPost, todayIn } from "@/lib/util";
import { ActionForm } from "@/components/action-form";
import { AttachInput } from "@/components/attach-input";
import { Attachment } from "@/components/attachment";
import { Avatar } from "@/components/avatar";
import { CallButton } from "@/components/call-button";
import { markRead, sendMessage } from "../../actions";

export const metadata = { title: "Chat" };

function Body({ text, mine }: { text: string; mine: boolean }) {
  const call = text.match(/https:\/\/meet\.jit\.si\/\S+/);
  if (call)
    return (
      <a href={call[0]} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-1 font-medium">
        <span className={`grid size-8 place-items-center rounded-full ${mine ? "bg-primary-fg/15" : "bg-surface"}`}><Video className="size-4" /></span>
        <span>Video call started<span className="block text-xs font-normal opacity-70">Tap to join</span></span>
      </a>
    );
  return (
    <p className="break-words whitespace-pre-wrap">
      {text.split(/(https?:\/\/\S+)/g).map((part, i) =>
        i % 2 ? <a key={i} href={part} target="_blank" rel="noreferrer" className="underline underline-offset-2">{part}</a> : part,
      )}
    </p>
  );
}

const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TZ }).format(new Date(iso));

function Day({ day }: { day: string }) {
  return (
    <li className="my-4 flex items-center gap-3 text-xs font-medium text-muted" role="separator">
      <span className="h-px flex-1 bg-line" />
      {day === todayIn() ? "Today" : fmtDate(day)}
      <span className="h-px flex-1 bg-line" />
    </li>
  );
}

type Msg = { id: string; body: string | null; attachment_path: string | null; created_at: string; sender_id: string | null; sender: { full_name: string; avatar_url: string | null } | null };

export default async function Channel({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  const me = await employeePage();
  const sb = db();
  const [{ data: channels }, { data }] = await Promise.all([
    sb.rpc("my_channels"),
    sb.from("messages").select("id, body, attachment_path, created_at, sender_id, sender:employees(full_name, avatar_url)").eq("channel_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  const channel = (channels as { id: string; type: string; name: string | null; announcements: boolean; avatar_url: string | null }[] | null)?.find((c) => c.id === id);
  if (!channel) notFound();
  await markRead(id);
  const messages = (data ?? []) as unknown as Msg[];
  const name = channel.name ?? "Unnamed";

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4">
        <Link href="/chat" className="btn btn-ghost btn-icon md:hidden" title="Back" aria-label="Back to conversations"><ArrowLeft /></Link>
        {channel.announcements ? (
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-fg"><Megaphone className="size-4" /></span>
        ) : channel.type === "dm" ? (
          <Avatar name={name} src={channel.avatar_url} size="size-9" />
        ) : (
          <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-muted">{channel.type === "department" ? <Users className="size-4" /> : <Hash className="size-4" />}</span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{name}</h2>
          <p className="text-xs text-muted">
            {channel.announcements ? "Company-wide, posted by admins and managers" : channel.type === "dm" ? "Direct message" : channel.type === "department" ? "Department channel" : "Group"}
          </p>
        </div>
        {!channel.announcements && <CallButton channelId={id} url={meetUrl(id)} />}
      </header>

      <ol className="flex min-h-0 flex-1 flex-col-reverse gap-1 overflow-y-auto px-4 py-4 md:px-6">
        {channel.announcements && messages.map((m) => {
          const [title, text] = splitPost(m.body ?? "");
          const auto = !m.sender_id;
          return (
            <li key={m.id} className="mx-auto mt-3 w-full max-w-2xl">
              {auto ? (
                <div className="flex items-center gap-2 rounded-xl bg-surface-2/70 px-3 py-2 text-sm text-muted">
                  <Bot className="size-4 shrink-0" /> <span className="flex-1">{text}</span>
                  <span className="text-[11px] tabular-nums">{fmtDate(m.created_at.slice(0, 10))}</span>
                </div>
              ) : (
                <div className="rounded-2xl border border-line border-l-4 border-l-primary bg-surface p-4">
                  {title && <h3 className="font-semibold">{title}</h3>}
                  <p className={`text-sm whitespace-pre-wrap ${title ? "mt-1 text-muted" : ""}`}>{text}</p>
                  {m.attachment_path && <Attachment id={m.id} path={m.attachment_path} chip="bg-surface-2" />}
                  <p className="mt-2 text-xs text-muted">{m.sender?.full_name ?? "Admin"} · {fmtDate(m.created_at.slice(0, 10))} {fmtTime(m.created_at)}</p>
                </div>
              )}
            </li>
          );
        })}
        {!channel.announcements && messages.map((m, i) => {
          const mine = m.sender_id === me.id;
          const older = messages[i + 1];
          const first = !older || older.sender_id !== m.sender_id; // first of a run (list is newest-first)
          const who = m.sender?.full_name ?? "Former employee";
          const day = dayOf(m.created_at);
          const newDay = !older || dayOf(older.created_at) !== day;
          return (
            <Fragment key={m.id}>
            <li className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""} ${first || newDay ? "mt-3" : ""} ${i === 0 ? "rise" : ""}`}>
              {!mine && (first || newDay ? <Avatar name={who} src={m.sender?.avatar_url} size="size-7 text-[11px]" /> : <span className="w-7 shrink-0" />)}
              <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                {!mine && (first || newDay) && <span className="mb-1 ml-1 text-xs font-medium text-muted">{who}</span>}
                <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${mine ? "rounded-br-md bg-primary text-primary-fg" : "rounded-bl-md bg-surface-2"}`}>
                  {m.body && <Body text={m.body} mine={mine} />}
                  {m.attachment_path && <Attachment id={m.id} path={m.attachment_path} chip={mine ? "bg-primary-fg/15" : "bg-surface"} />}
                  <div className={`mt-0.5 text-right text-[10px] tabular-nums ${mine ? "opacity-70" : "text-muted"}`}>{fmtTime(m.created_at)}</div>
                </div>
              </div>
            </li>
            {newDay && <Day day={day} />}
            </Fragment>
          );
        })}
        {!messages.length && <li className="empty m-auto"><Hash />No messages yet. Say hello.</li>}
      </ol>

      {channel.announcements ? (
        me.role === "manager" || me.role === "hr" ? (
          <div className="flex justify-center border-t border-line p-3">
            <Link href={me.role === "hr" ? "/hr/announcements" : "/admin/announcements"} className="btn btn-primary"><Megaphone /> Post an announcement</Link>
          </div>
        ) : (
          <p className="flex items-center justify-center gap-2 border-t border-line p-4 text-sm text-muted">
            <Lock className="size-4" /> Only admins, managers and HR post here. Questions? Use Report an issue.
          </p>
        )
      ) : (
      <ActionForm action={sendMessage} className="flex flex-wrap items-center gap-1 px-3 pb-3 md:px-6 md:pb-4">
        <input type="hidden" name="channel_id" value={id} />
        <div className="flex w-full items-center gap-1 rounded-xl border border-line bg-surface p-1 pl-1.5 transition focus-within:border-text/40 focus-within:ring-3 focus-within:ring-text/10">
          <AttachInput name="attachment" />
          <input name="body" autoComplete="off" aria-label={`Message ${name}`} placeholder={`Message ${name}`} className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm placeholder:text-muted focus:outline-none" />
          <button className="btn btn-primary btn-icon" title="Send" aria-label="Send"><SendHorizontal /></button>
        </div>
      </ActionForm>
      )}
    </>
  );
}
