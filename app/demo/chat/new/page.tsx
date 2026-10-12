"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageCircle, UsersRound } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { EMPLOYEES } from "@/lib/demo/data";
import { useChannels } from "@/lib/demo/chat";
import { newId, useDemoRole } from "@/lib/demo/store";
import { useRole } from "@/lib/demo/use-role";

export default function NewChat() {
  const [picked] = useDemoRole();
  const admin = picked === "admin";
  const { me } = useRole(admin ? "admin" : "workspace");
  const [channels, setChannels] = useChannels();
  const router = useRouter();
  // admins: one-to-one with anyone, no groups. Everyone else: no admins.
  const people = EMPLOYEES.filter((e) => e.id !== me.id && (admin || e.role !== "admin"));
  const [dm, setDm] = useState(people[0]?.id ?? "");
  const [name, setName] = useState("");
  const [sel, setSel] = useState<string[]>([]);

  function open(members: string[], group?: string) {
    const ex = !group && channels.find((c) => c.type === "dm" && members.every((m) => c.members.includes(m)));
    const id = ex ? ex.id : newId();
    if (!ex) setChannels((cur) => [...cur, { id, type: group ? "group" : "dm", name: group ?? null, announcements: false, office_id: null, members, unread: 0 }]);
    router.push(`/demo/chat/${id}`);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="mx-auto max-w-md space-y-10">
        <Link href="/demo/chat" className="btn btn-ghost -ml-2 md:hidden"><ArrowLeft /> Conversations</Link>
        <div>
          <h2 className="h2"><MessageCircle /> Direct message</h2>
          <form onSubmit={(e) => { e.preventDefault(); open([me.id, dm]); }} className="flex gap-2">
            <select value={dm} onChange={(e) => setDm(e.target.value)} required aria-label="Person" className="input h-10">
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}{admin && p.role === "admin" ? " (admin)" : ""}</option>)}
            </select>
            <button className="btn btn-primary h-10">Open</button>
          </form>
        </div>
        {!admin && <div>
          <h2 className="h2"><UsersRound /> New group</h2>
          <form onSubmit={(e) => { e.preventDefault(); open([me.id, ...sel], name.trim()); }} className="space-y-4">
            <label className="field">Group name<input value={name} onChange={(e) => setName(e.target.value)} required className="input h-10" /></label>
            <fieldset className="field">
              <legend className="mb-2">Members</legend>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-line bg-surface p-1">
                {people.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm font-normal transition-colors hover:bg-surface-2 has-checked:bg-primary-soft">
                    <input type="checkbox" checked={sel.includes(p.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))} className="size-4 accent-primary" />
                    <Avatar name={p.name} size="size-7 text-[11px]" />
                    {p.name}
                  </label>
                ))}
              </div>
              <span className="text-xs font-normal text-muted">Department channels appear automatically.</span>
            </fieldset>
            <button className="btn btn-primary h-10">Create group</button>
          </form>
        </div>}
      </div>
    </div>
  );
}
