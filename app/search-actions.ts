"use server";

import { requireMe } from "@/lib/me";
import { db } from "@/lib/supabase";

export type Hit = { href: string; label: string; sub?: string; kind: "Person" | "Chat" | "To-do" };

// Global search (Cmd+K). RLS decides what each person can find.
export async function search(q: string): Promise<Hit[]> {
  const me = await requireMe();
  const term = q.replace(/[%,()"\\*]/g, "").trim().slice(0, 80); // keep PostgREST filter syntax out
  if (term.length < 2) return [];
  const sb = db();
  const like = `%${term}%`;
  const [{ data: people }, { data: chats }, { data: todos }] = await Promise.all([
    sb.from("employees").select("full_name, email, employee_code, designation").eq("active", true)
      .or(`full_name.ilike.${like},alias_name.ilike.${like},email.ilike.${like},employee_code.ilike.${like},designation.ilike.${like}`).order("full_name").limit(6),
    sb.rpc("my_channels").ilike("name", like).limit(5),
    sb.from("todos").select("title, done_at").eq("owner_id", me.id).ilike("title", like).limit(4),
  ]);
  const admin = me.role === "admin";
  return [
    ...(people ?? []).map((p): Hit => ({
      kind: "Person", label: p.full_name, sub: [p.employee_code, p.designation, p.email].filter(Boolean).join(" · "),
      href: `${admin ? "/admin/employees" : "/directory"}?q=${encodeURIComponent(p.full_name)}`,
    })),
    ...((chats ?? []) as { id: string; name: string; type: string }[]).map((c): Hit => ({ kind: "Chat", label: c.name, sub: c.type === "dm" ? "Direct message" : c.type === "group" ? "Group" : c.type === "department" ? "Department channel" : "Channel", href: `/chat/${c.id}` })),
    ...(todos ?? []).map((t): Hit => ({ kind: "To-do", label: t.title, sub: t.done_at ? "Done" : "Open", href: admin ? "/admin/todos" : "/todos" })),
  ];
}
