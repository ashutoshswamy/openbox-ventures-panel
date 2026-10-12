"use client";

import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { addMembers } from "@/app/(employee)/actions";

// Inline section of the members panel: toggle open, tick people to add to this group chat.
export function AddMembers({ channelId, people }: { channelId: string; people: { id: string; full_name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = (name: string) => !needle || name.toLowerCase().includes(needle);
  return (
    <div className="shrink-0 border-b border-line px-2 pb-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn btn-ghost w-full justify-start"><UserPlus /> Add members</button>
      {open && (people.length ? (
        <ActionForm action={addMembers} success="Added" className="mt-2 space-y-2 px-1">
          <input type="hidden" name="channel_id" value={channelId} />
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className="input h-9 pl-8" />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {/* hidden, not removed: ticked people stay ticked (and submitted) while the search changes */}
            {people.map((p) => (
              <label key={p.id} className={`${shown(p.full_name) ? "flex" : "hidden"} cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2 has-checked:bg-primary-soft`}>
                <input type="checkbox" name="members" value={p.id} className="size-4 shrink-0 accent-primary" />
                <span className="truncate">{p.full_name}</span>
              </label>
            ))}
            {!people.some((p) => shown(p.full_name)) && <p className="px-2 py-3 text-sm text-muted">No one matches.</p>}
          </div>
          <button className="btn btn-primary w-full">Add to chat</button>
        </ActionForm>
      ) : <p className="px-3 py-2 text-sm text-muted">Everyone is already in this chat.</p>)}
    </div>
  );
}
