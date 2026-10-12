"use client";

import { UserPlus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { addMembers } from "@/app/(employee)/actions";

// Header popover: tick people to add to this group chat.
export function AddMembers({ channelId, people }: { channelId: string; people: { id: string; full_name: string }[] }) {
  return (
    <details className="relative">
      <summary className="btn btn-icon cursor-pointer list-none" title="Add members" aria-label="Add members"><UserPlus /></summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-lg">
        {people.length ? (
          <ActionForm action={addMembers} success="Added" className="space-y-3">
            <input type="hidden" name="channel_id" value={channelId} />
            <div className="max-h-60 overflow-y-auto">
              {people.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2 has-checked:bg-primary-soft">
                  <input type="checkbox" name="members" value={p.id} className="size-4 accent-primary" />
                  {p.full_name}
                </label>
              ))}
            </div>
            <button className="btn btn-primary w-full">Add to chat</button>
          </ActionForm>
        ) : <p className="px-1 py-2 text-sm text-muted">Everyone is already in this chat.</p>}
      </div>
    </details>
  );
}
