import Link from "next/link";
import { Building2, Globe, Hash, History, Megaphone, SquarePen, Users } from "lucide-react";
import { db } from "@/lib/supabase";
import { pageMe } from "@/lib/me";
import { adminNav, employeeNav } from "@/lib/nav";
import { Shell } from "@/components/shell";
import { Avatar } from "@/components/avatar";
import { ChannelLink, ChatSidebar } from "@/components/live-refresh";

type Row = {
  id: string; type: "dm" | "group" | "department" | "office" | "global"; name: string | null; unread: number; announcements: boolean; avatar_url: string | null;
  office_id: string | null; office_name: string | null;
};

function Group({ title, rows }: { title: string; rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <div className="mb-5">
      <div className="mb-1.5 px-2.5 text-xs font-medium text-muted">{title}</div>
      {rows.map((c) => (
        <ChannelLink key={c.id} id={c.id}>
          {c.announcements ? (
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-fg"><Megaphone className="size-4" /></span>
          ) : c.type === "dm" ? (
            <Avatar name={c.name ?? "?"} src={c.avatar_url} size="size-7 text-[11px]" />
          ) : (
            <span className="grid size-7 place-items-center rounded-lg bg-surface-2 text-muted">
              {c.type === "department" ? <Users className="size-4" /> : c.type === "office" ? <Building2 className="size-4" /> : c.type === "global" ? <Globe className="size-4" /> : <Hash className="size-4" />}
            </span>
          )}
          <span className={`flex-1 truncate ${c.unread ? "font-semibold" : ""}`}>{c.name ?? "Unnamed"}</span>
          {c.unread > 0 && <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] leading-5 font-semibold text-primary-fg tabular-nums">{c.unread}</span>}
        </ChannelLink>
      ))}
    </div>
  );
}

// Outside the (employee) group so admins get it too, inside their own panel's shell.
export default async function ChatLayout({ children }: LayoutProps<"/chat">) {
  const me = await pageMe();
  const nav = me.role === "admin" ? await adminNav(me) : employeeNav(me);
  const { data } = await db().rpc("my_channels");
  const rows = (data ?? []) as Row[];
  // office channel first, then its departments
  const officeRows = rows.filter((r) => r.type === "office" || r.type === "department").sort((a, b) => Number(b.type === "office") - Number(a.type === "office"));
  const offices = [...new Map(officeRows.map((r) => [r.office_id, r.office_name])).entries()];

  return (
    <Shell {...nav} user={{ id: me.id, name: me.full_name, role: me.role, avatar: me.avatar_url }}>
    <div className="card flex h-[calc(100dvh-10rem)] min-h-96 overflow-hidden p-0 md:h-[calc(100dvh-12rem)] lg:h-[calc(100dvh-5rem)]">
      <ChatSidebar>
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <h1 className="text-lg font-semibold tracking-tight">Chat</h1>
          <div className="flex gap-1">
            <Link href="/chat/calls" className="btn btn-icon" title="Call history" aria-label="Call history"><History /></Link>
            <Link href="/chat/new" className="btn btn-icon" title="New conversation" aria-label="New conversation"><SquarePen /></Link>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <Group title="Company" rows={rows.filter((r) => r.announcements || r.type === "global")} />
          {offices.map(([id, name]) => <Group key={id} title={name ?? "Office"} rows={officeRows.filter((r) => r.office_id === id)} />)}
          <Group title="Groups" rows={rows.filter((r) => r.type === "group" && !r.announcements)} />
          <Group title="Direct messages" rows={rows.filter((r) => r.type === "dm")} />
          {!rows.length && <p className="px-3 py-6 text-sm text-muted">No conversations yet. Start one from the pencil above.</p>}
        </div>
      </ChatSidebar>
      <section className="flex min-w-0 flex-1 flex-col">{children}</section>
    </div>
    </Shell>
  );
}
