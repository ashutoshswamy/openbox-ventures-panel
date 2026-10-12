import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Building2, Eye, Globe, Hash, Lock, Megaphone, SendHorizontal, Users, Video } from "lucide-react";
import { pageMe } from "@/lib/me";
import { adminDb, db } from "@/lib/supabase";
import { CALL_ENDED, DEFAULT_TZ, dmName, fmtDate, fmtTime, splitPost, todayIn } from "@/lib/util";
import { ActionForm } from "@/components/action-form";
import { AttachInput } from "@/components/attach-input";
import { AddMembers } from "@/components/add-members";
import { MentionInput } from "@/components/mention-input";
import { Attachment } from "@/components/attachment";
import { Avatar } from "@/components/avatar";
import { CallButton, CallCard, Ended } from "@/components/call-button";
import { endCall, markRead, sendMessage } from "@/app/(employee)/actions";

export const metadata = { title: "Chat" };

const callUrl = (text: string) => text.match(/https:\/\/meet\.jit\.si\/\S+/)?.[0];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function Body({ text, mine, channelId, liveCall, myName, sentAt, tags }: { text: string; mine: boolean; channelId: string; liveCall: string | null; myName: string; sentAt: string; tags: RegExp | null }) {
  const call = callUrl(text);
  const icon = <span className={`grid size-8 shrink-0 place-items-center rounded-full ${mine ? "bg-primary-fg/15" : "bg-surface"}`}><Video className="size-4" /></span>;
  if (call && text.startsWith(CALL_ENDED))
    return <p className="flex items-center gap-3 py-1 font-medium">{icon} Ended the video call</p>;
  if (call && call === liveCall)
    return (
      <CallCard url={call} name={myName} startedAt={sentAt} icon={icon} endForm={
        <ActionForm action={endCall}>
          <input type="hidden" name="channel_id" value={channelId} />
          <input type="hidden" name="url" value={call} />
          <button className={`rounded-lg px-2.5 py-1 text-xs font-medium ${mine ? "bg-primary-fg/15" : "bg-surface"}`}>End call</button>
        </ActionForm>
      } />
    );
  if (call) return <Ended icon={icon} />;
  return (
    <p className="break-words whitespace-pre-wrap">
      {text.split(/(https?:\/\/\S+)/g).map((part, i) =>
        i % 2 ? <a key={i} href={part} target="_blank" rel="noreferrer" className="underline underline-offset-2">{part}</a>
          : tags ? part.split(tags).map((t, j) => j % 2 ? <span key={j} className={`rounded px-1 font-medium ${t === `@${myName}` ? "bg-amber-300/40" : mine ? "bg-primary-fg/20" : "bg-primary-soft text-primary"}`}>{t}</span> : t) : part,
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

// Only the newest call can still be live (CallCard then checks who's in it), until someone ends it. Messages are newest-first.
function liveCallOf(messages: Msg[]) {
  const latest = messages.find((m) => m.body && callUrl(m.body));
  if (!latest?.body || latest.body.startsWith(CALL_ENDED)) return null;
  return callUrl(latest.body) ?? null;
}

type Msg = { id: string; body: string | null; attachment_path: string | null; created_at: string; sender_id: string | null; sender: { full_name: string; avatar_url: string | null } | null };

export default async function Channel({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  const me = await pageMe();
  const sb = db();
  const [{ data: channels }, { data }, { data: meta }] = await Promise.all([
    sb.rpc("my_channels"),
    sb.from("messages").select("id, body, attachment_path, created_at, sender_id, sender:employees(full_name, avatar_url)").eq("channel_id", id).order("created_at", { ascending: false }).limit(100),
    sb.from("channels").select("id, type, name, announcements, department_id, office_id, members:channel_members(employee_id, employee:employees(full_name))").eq("id", id).maybeSingle(),
  ]);
  type Ch = { id: string; type: string; name: string | null; announcements: boolean; avatar_url: string | null };
  let channel = (channels as Ch[] | null)?.find((c) => c.id === id);
  // admins read any channel they're not in, DMs between employees included (RLS: admin_read), without joining it
  // HR sees group chats they're not in only to manage who's in them (RLS: hr_read), never their messages
  const viewOnly = !channel && (me.role === "admin" || me.role === "hr");
  if (viewOnly && meta) channel = { ...meta, name: meta.type === "dm" ? dmName(meta.members as never) : meta.name, avatar_url: null };
  if (!channel || !meta) notFound();
  const hrOnly = viewOnly && me.role === "hr";
  // tagging: only people in this chat. Group/DM = its members; department/office = everyone in it; company channels = everyone.
  const members = (meta.members as unknown as { employee_id: string; employee: { full_name: string } | null }[]).filter((m) => m.employee);
  let people = members.map((m) => m.employee!.full_name);
  if (meta.type === "department" || meta.type === "office" || meta.type === "global" || meta.announcements) {
    let q = sb.from("employees").select("full_name").eq("active", true).not("clerk_user_id", "is", null);
    if (meta.type === "department" && !meta.announcements) q = q.eq("department_id", meta.department_id!);
    else if (meta.type === "office" && !meta.announcements) q = q.eq("office_id", meta.office_id!);
    people = ((await q).data ?? []).map((p) => p.full_name);
  }
  people = [...new Set(people)].filter((n) => n !== me.full_name).sort();
  const mention = [...people, me.full_name].sort((a, b) => b.length - a.length); // longest first so "Ann Lee" wins over "Ann"
  const tags = new RegExp(`(@(?:${mention.map(esc).join("|")}))`, "g");
  // admins and HR can add people to a group chat
  const canAdd = (me.role === "admin" || me.role === "hr") && channel.type === "group" && !channel.announcements;
  let addable: { id: string; full_name: string }[] = [];
  if (canAdd) {
    const inChat = new Set(members.map((m) => m.employee_id));
    const { data: all } = await sb.from("employees").select("id, full_name").eq("active", true).not("clerk_user_id", "is", null).or("role.is.null,role.neq.admin").order("full_name");
    addable = (all ?? []).filter((e) => !inChat.has(e.id));
  }
  if (!viewOnly) await markRead(id);
  const messages = (data ?? []) as unknown as Msg[];
  // RLS hides admin rows from everyone else; look up just their name + photo so admin messages show who sent them (never email/phone)
  const hidden = [...new Set(messages.filter((m) => m.sender_id && !m.sender).map((m) => m.sender_id!))];
  if (hidden.length) {
    const { data: rows } = await adminDb().from("employees").select("id, full_name, avatar_url").in("id", hidden);
    const by = new Map((rows ?? []).map((r) => [r.id, r]));
    for (const m of messages) if (m.sender_id && !m.sender) m.sender = by.get(m.sender_id) ?? null;
  }
  const name = channel.name ?? "Unnamed";
  const liveCall = viewOnly ? null : liveCallOf(messages);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4">
        <Link href="/chat" className="btn btn-ghost btn-icon md:hidden" title="Back" aria-label="Back to conversations"><ArrowLeft /></Link>
        {channel.announcements ? (
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-fg"><Megaphone className="size-4" /></span>
        ) : channel.type === "dm" ? (
          <Avatar name={name} src={channel.avatar_url} size="size-9" />
        ) : (
          <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-muted">{channel.type === "department" ? <Users className="size-4" /> : channel.type === "office" ? <Building2 className="size-4" /> : channel.type === "global" ? <Globe className="size-4" /> : <Hash className="size-4" />}</span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{name}</h2>
          <p className="text-xs text-muted">
            {channel.announcements ? "Company-wide, posted by admins and managers" : channel.type === "dm" ? "Direct message" : channel.type === "department" ? "Department channel" : channel.type === "office" ? "Everyone in this office" : channel.type === "global" ? "Everyone in the company" : "Group"}
          </p>
        </div>
        {canAdd && <AddMembers channelId={id} people={addable} />}
        {!viewOnly && !channel.announcements && channel.type !== "global" && <CallButton channelId={id} name={me.full_name} />}
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
                  <p className="mt-2 text-xs text-muted">{m.sender?.full_name ?? "Open Box Ventures"} · {fmtDate(m.created_at.slice(0, 10))} {fmtTime(m.created_at)}</p>
                </div>
              )}
            </li>
          );
        })}
        {!channel.announcements && !hrOnly && messages.map((m, i) => {
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
                  {m.body && <Body tags={tags} text={m.body} mine={mine} channelId={id} liveCall={liveCall} myName={me.full_name} sentAt={m.created_at} />}
                  {m.attachment_path && <Attachment id={m.id} path={m.attachment_path} chip={mine ? "bg-primary-fg/15" : "bg-surface"} />}
                  <div className={`mt-0.5 text-right text-[10px] tabular-nums ${mine ? "opacity-70" : "text-muted"}`}>{fmtTime(m.created_at)}</div>
                </div>
              </div>
            </li>
            {newDay && <Day day={day} />}
            </Fragment>
          );
        })}
        {hrOnly && <li className="empty m-auto"><Users />You can manage who is in this group, but its messages are private to its members.</li>}
        {!hrOnly && !messages.length && <li className="empty m-auto"><Hash />No messages yet. Say hello.</li>}
      </ol>

      {hrOnly ? null : channel.announcements ? (
        me.role === "admin" || me.role === "manager" || me.role === "branch_head" || me.role === "hr" ? (
          <div className="flex justify-center border-t border-line p-3">
            <Link href={me.role === "hr" ? "/hr/announcements" : "/admin/announcements"} className="btn btn-primary"><Megaphone /> Post an announcement</Link>
          </div>
        ) : (
          <p className="flex items-center justify-center gap-2 border-t border-line p-4 text-sm text-muted">
            <Lock className="size-4" /> Only admins, managers, branch heads and HR post here. Questions? Use Report an issue.
          </p>
        )
      ) : (
      <ActionForm action={sendMessage} className="flex flex-wrap items-center gap-1 px-3 pb-3 md:px-6 md:pb-4">
        <input type="hidden" name="channel_id" value={id} />
        <div className="flex w-full items-center gap-1 rounded-xl border border-line bg-surface p-1 pl-1.5 transition focus-within:border-text/40 focus-within:ring-3 focus-within:ring-text/10">
          <AttachInput name="attachment" />
          <MentionInput name="body" people={people} autoComplete="off" aria-label={`Message ${name}`} placeholder={`Message ${name}`} className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm placeholder:text-muted focus:outline-none" />
          <button className="btn btn-primary btn-icon" title="Send" aria-label="Send"><SendHorizontal /></button>
        </div>
        {/* disclosure: admins can read every chat (RLS: admin_read) */}
        {me.role !== "admin" && <p className="flex w-full items-center gap-1.5 px-1 pt-1 text-xs text-muted"><Eye className="size-3.5" /> Admins can view this conversation.</p>}
      </ActionForm>
      )}
    </>
  );
}
