"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, Building2, Eye, Globe, Hash, Lock, Megaphone, Paperclip, SendHorizontal, Users, Video } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { emp } from "@/lib/demo/data";
import { ANN_ID, REPLIES, chName, isMember, useChannels, useMessages, type Msg } from "@/lib/demo/chat";
import { useAnnouncements } from "@/lib/demo/shared";
import { newId, useDemoRole } from "@/lib/demo/store";
import { useRole } from "@/lib/demo/use-role";
import { DEFAULT_TZ, fmtDate, fmtTime, todayIn } from "@/lib/util";

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

export default function Channel() {
  const { id } = useParams<{ id: string }>();
  const [picked] = useDemoRole();
  const adminSection = picked === "admin";
  const { me, role } = useRole(adminSection ? "admin" : "workspace");
  const [channels, setChannels] = useChannels();
  const [all, setAll] = useMessages();
  const [anns] = useAnnouncements();
  const [text, setText] = useState("");
  const [toast, setToast] = useState(false);
  const channel = channels.find((c) => c.id === id);
  const unread = channel?.unread ?? 0;

  useEffect(() => {
    if (unread) setChannels((cur) => cur.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }, [id, unread, setChannels]);

  if (!channel) notFound();
  const viewOnly = !isMember(channel, me.id);
  const messages = all[id] ?? [];
  const name = chName(channel, me.id);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    const add = (m: Msg) => setAll((cur) => ({ ...cur, [id]: [m, ...(cur[id] ?? [])] }));
    add({ id: newId(), sender_id: me.id, body, created_at: new Date().toISOString() });
    if (channel!.type === "dm") {
      const other = channel!.members.find((m) => m !== me.id);
      if (other) setTimeout(() => add({ id: newId(), sender_id: other, body: REPLIES[Math.floor(Math.random() * REPLIES.length)], created_at: new Date().toISOString() }), 1500);
    }
  }

  function call() {
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4">
        <Link href="/demo/chat" className="btn btn-ghost btn-icon md:hidden" title="Back" aria-label="Back to conversations"><ArrowLeft /></Link>
        {channel.announcements ? (
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-fg"><Megaphone className="size-4" /></span>
        ) : channel.type === "dm" ? (
          <Avatar name={name} size="size-9" />
        ) : (
          <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-muted">{channel.type === "department" ? <Users className="size-4" /> : channel.type === "office" ? <Building2 className="size-4" /> : channel.type === "global" ? <Globe className="size-4" /> : <Hash className="size-4" />}</span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{name}</h2>
          <p className="text-xs text-muted">
            {channel.announcements ? "Company-wide, posted by admins and managers" : channel.type === "dm" ? "Direct message" : channel.type === "department" ? "Department channel" : channel.type === "office" ? "Everyone in this office" : channel.type === "global" ? "Everyone in the company" : "Group"}
          </p>
        </div>
        {toast && <span className="text-xs text-muted" role="status">Calls are disabled in demo</span>}
        {!viewOnly && !channel.announcements && channel.type !== "global" && (
          <button className="btn btn-icon" title="Start video call" aria-label="Start video call" onClick={call}><Video /></button>
        )}
      </header>

      <ol className="flex min-h-0 flex-1 flex-col-reverse gap-1 overflow-y-auto px-4 py-4 md:px-6">
        {id === ANN_ID && anns.map((a) => (
          <li key={a.id} className="mx-auto mt-3 w-full max-w-2xl">
            <div className="rounded-2xl border border-line border-l-4 border-l-primary bg-surface p-4">
              <h3 className="font-semibold">{a.title}</h3>
              <p className="mt-1 text-sm whitespace-pre-wrap text-muted">{a.body}</p>
              <p className="mt-2 text-xs text-muted">{emp(a.author).name} · {fmtDate(a.date)}</p>
            </div>
          </li>
        ))}
        {id !== ANN_ID && messages.map((m, i) => {
          const mine = m.sender_id === me.id;
          const older = messages[i + 1];
          const first = !older || older.sender_id !== m.sender_id;
          const who = m.sender_id ? emp(m.sender_id).name : "Former employee";
          const day = dayOf(m.created_at);
          const newDay = !older || dayOf(older.created_at) !== day;
          return (
            <Fragment key={m.id}>
              <li className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""} ${first || newDay ? "mt-3" : ""} ${i === 0 ? "rise" : ""}`}>
                {!mine && (first || newDay ? <Avatar name={who} size="size-7 text-[11px]" /> : <span className="w-7 shrink-0" />)}
                <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  {!mine && (first || newDay) && <span className="mb-1 ml-1 text-xs font-medium text-muted">{who}</span>}
                  <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${mine ? "rounded-br-md bg-primary text-primary-fg" : "rounded-bl-md bg-surface-2"}`}>
                    <p className="break-words whitespace-pre-wrap">{m.body}</p>
                    <div className={`mt-0.5 text-right text-[10px] tabular-nums ${mine ? "opacity-70" : "text-muted"}`}>{fmtTime(m.created_at)}</div>
                  </div>
                </div>
              </li>
              {newDay && <Day day={day} />}
            </Fragment>
          );
        })}
        {id !== ANN_ID && !messages.length && <li className="empty m-auto"><Hash />No messages yet. Say hello.</li>}
      </ol>

      {channel.announcements ? (
        role === "admin" || role === "manager" || role === "hr" ? (
          <div className="flex justify-center border-t border-line p-3">
            <Link href={role === "hr" ? "/demo/hr/announcements" : "/demo/admin/announcements"} className="btn btn-primary"><Megaphone /> Post an announcement</Link>
          </div>
        ) : (
          <p className="flex items-center justify-center gap-2 border-t border-line p-4 text-sm text-muted">
            <Lock className="size-4" /> Only admins, managers, branch heads and HR post here. Questions? Use Report an issue.
          </p>
        )
      ) : (
        <form onSubmit={send} className="flex flex-wrap items-center gap-1 px-3 pb-3 md:px-6 md:pb-4">
          <div className="flex w-full items-center gap-1 rounded-xl border border-line bg-surface p-1 pl-1.5 transition focus-within:border-text/40 focus-within:ring-3 focus-within:ring-text/10">
            <button type="button" disabled className="btn btn-ghost btn-icon" title="Attachments are not available in demo" aria-label="Attachments are not available in demo"><Paperclip /></button>
            <input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" aria-label={`Message ${name}`} placeholder={`Message ${name}`} className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm placeholder:text-muted focus:outline-none" />
            <button className="btn btn-primary btn-icon" title="Send" aria-label="Send"><SendHorizontal /></button>
          </div>
          {role !== "admin" && <p className="flex w-full items-center gap-1.5 px-1 pt-1 text-xs text-muted"><Eye className="size-3.5" /> Admins can view this conversation.</p>}
        </form>
      )}
    </>
  );
}
