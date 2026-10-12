import Link from "next/link";
import { History, SquarePen } from "lucide-react";
import { db } from "@/lib/supabase";
import { dmName } from "@/lib/util";
import { pageMe } from "@/lib/me";
import { adminNav, employeeNav } from "@/lib/nav";
import { Shell } from "@/components/shell";
import { ChatSidebar } from "@/components/live-refresh";
import { ChatList, type Row } from "@/components/chat-list";

// Outside the (employee) group so admins get it too, inside their own panel's shell.
export default async function ChatLayout({ children }: LayoutProps<"/chat">) {
  const me = await pageMe();
  const admin = me.role === "admin";
  const hr = me.role === "hr"; // sees group chats (not messages) to manage members, RLS: hr_read
  const sb = db();
  // one parallel round trip; admins also load every other group / department / office channel and every DM (read-only)
  const [nav, { data }, { data: allGroups }, { data: allDms }] = await Promise.all([
    admin ? adminNav(me) : employeeNav(me),
    sb.rpc("my_channels"),
    admin || hr ? sb.from("channels").select("id, type, name, office:offices(name), department:departments(office:offices(name))").neq("type", "dm").neq("type", "global").eq("announcements", false).order("name") : { data: [] },
    admin ? sb.from("channels").select("id, members:channel_members(employee:employees(full_name))").eq("type", "dm") : { data: [] },
  ]);
  const rows = (data ?? []) as Row[];
  const others = (allGroups ?? [])
    .filter((c) => !rows.some((r) => r.id === c.id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((c: any): Row => ({ id: c.id, type: c.type, name: c.name, unread: 0, announcements: false, avatar_url: null, office_id: null, office_name: c.office?.name ?? c.department?.office?.name ?? null }));
  // named "A & B"
  const dms = (allDms ?? [])
    .filter((c) => !rows.some((r) => r.id === c.id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((c: any): Row => ({ id: c.id, type: "dm", name: dmName(c.members), unread: 0, announcements: false, avatar_url: null, office_id: null, office_name: null }))
    .sort((a, b) => a.name!.localeCompare(b.name!));
  // office channel first, then its departments
  const officeRows = rows.filter((r) => r.type === "office" || r.type === "department").sort((a, b) => Number(b.type === "office") - Number(a.type === "office"));

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
          <ChatList meId={me.id} sections={[
            { title: "Company", rows: rows.filter((r) => r.announcements || r.type === "global") },
            { title: "Offices", rows: officeRows, nest: true },
            { title: "Groups", rows: rows.filter((r) => r.type === "group" && !r.announcements) },
            { title: "Direct messages", rows: rows.filter((r) => r.type === "dm") },
            { title: hr ? "All group chats (manage members)" : "All group chats", rows: others.filter((r) => r.type !== "group"), nest: true },
            { title: "Other group chats", rows: others.filter((r) => r.type === "group") },
            { title: "All direct messages", rows: dms },
          ]} />
          {!rows.length && <p className="px-3 py-6 text-sm text-muted">No conversations yet. Start one from the pencil above.</p>}
        </div>
      </ChatSidebar>
      <section className="flex min-w-0 flex-1 flex-col">{children}</section>
    </div>
    </Shell>
  );
}
