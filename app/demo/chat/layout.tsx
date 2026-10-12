"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Building2, Globe, Hash, History, Megaphone, SquarePen, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DemoShell } from "@/components/demo-shell";
import { OFFICES } from "@/lib/demo/data";
import { chName, dmName, isMember, useChannels, type Channel } from "@/lib/demo/chat";
import { useDemoRole } from "@/lib/demo/store";
import { useRole } from "@/lib/demo/use-role";

type Row = { c: Channel; name: string };

function Group({ title, rows }: { title: string; rows: Row[] }) {
  const open = useSelectedLayoutSegment();
  if (!rows.length) return null;
  return (
    <div className="mb-5">
      <div className="mb-1.5 px-2.5 text-xs font-medium text-muted">{title}</div>
      {rows.map(({ c, name }) => {
        const active = open === c.id;
        return (
          <Link
            key={c.id}
            href={`/demo/chat/${c.id}`}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${active ? "bg-surface shadow-[0_1px_2px_rgb(24_24_27/0.06)] ring-1 ring-line" : "hover:bg-surface-2"}`}
          >
            {c.announcements ? (
              <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-fg"><Megaphone className="size-4" /></span>
            ) : c.type === "dm" ? (
              <Avatar name={name} size="size-7 text-[11px]" />
            ) : (
              <span className="grid size-7 place-items-center rounded-lg bg-surface-2 text-muted">
                {c.type === "department" ? <Users className="size-4" /> : c.type === "office" ? <Building2 className="size-4" /> : c.type === "global" ? <Globe className="size-4" /> : <Hash className="size-4" />}
              </span>
            )}
            <span className={`flex-1 truncate ${c.unread ? "font-semibold" : ""}`}>{name}</span>
            {c.unread > 0 && <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] leading-5 font-semibold text-primary-fg tabular-nums">{c.unread}</span>}
          </Link>
        );
      })}
    </div>
  );
}

function Inner({ children, admin }: { children: React.ReactNode; admin: boolean }) {
  const { me } = useRole(admin ? "admin" : "workspace");
  const [channels] = useChannels();
  const open = useSelectedLayoutSegment();
  const row = (c: Channel): Row => ({ c, name: chName(c, me.id) });
  const mine = channels.filter((c) => isMember(c, me.id));
  const others = admin ? channels.filter((c) => !isMember(c, me.id)) : [];
  const officeRows = mine.filter((r) => r.type === "office" || r.type === "department").sort((a, b) => Number(b.type === "office") - Number(a.type === "office"));
  const offices = OFFICES.filter((o) => officeRows.some((r) => r.office_id === o.id));

  return (
    <div className="card flex h-[calc(100dvh-10rem)] min-h-96 overflow-hidden p-0 md:h-[calc(100dvh-12rem)] lg:h-[calc(100dvh-5rem)]">
      <aside className={`min-h-0 flex-col border-line bg-surface-2/40 md:flex md:w-72 md:border-r ${open ? "hidden" : "flex flex-1 md:flex-none"}`}>
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <h1 className="text-lg font-semibold tracking-tight">Chat</h1>
          <div className="flex gap-1">
            <Link href="/demo/chat/calls" className="btn btn-icon" title="Call history" aria-label="Call history"><History /></Link>
            <Link href="/demo/chat/new" className="btn btn-icon" title="New conversation" aria-label="New conversation"><SquarePen /></Link>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <Group title="Company" rows={mine.filter((r) => r.announcements || r.type === "global").map(row)} />
          {offices.map((o) => <Group key={o.id} title={o.name} rows={officeRows.filter((r) => r.office_id === o.id).map(row)} />)}
          <Group title="Groups" rows={mine.filter((r) => r.type === "group").map(row)} />
          <Group title="Direct messages" rows={mine.filter((r) => r.type === "dm").map(row)} />
          <Group title="All group chats (view only)" rows={others.filter((r) => r.type !== "dm" && !r.announcements && r.type !== "global").map((c) => ({ c, name: c.type === "department" ? `${OFFICES.find((o) => o.id === c.office_id)?.name} / ${c.name}` : c.name ?? "Unnamed" }))} />
          <Group title="All direct messages (view only)" rows={others.filter((r) => r.type === "dm").map((c) => ({ c, name: dmName(c, "") }))} />
          {!mine.length && <p className="px-3 py-6 text-sm text-muted">No conversations yet. Start one from the pencil above.</p>}
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">{children}</section>
    </div>
  );
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [picked] = useDemoRole();
  const admin = picked === "admin";
  return <DemoShell section={admin ? "admin" : "workspace"}><Inner admin={admin}>{children}</Inner></DemoShell>;
}
