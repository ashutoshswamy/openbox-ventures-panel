"use client";

import { KeyRound, Lock } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { unlockDms } from "@/app/chat/actions";

// Sidebar stand-in for "All direct messages" until the admin re-enters their password.
export function DmLock() {
  return (
    <details className="mb-5 rounded-lg">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-text"><Lock className="size-3.5" /> All direct messages (locked)</summary>
      <ActionForm action={unlockDms} className="mt-2 space-y-2 px-1">
        <p className="px-1.5 text-xs text-muted">Enter your account password to see everyone&apos;s DMs.</p>
        <div className="flex gap-1.5">
          <input type="password" name="password" required autoComplete="current-password" aria-label="Account password" className="input h-9 min-w-0 flex-1" />
          <button className="btn btn-primary h-9" title="Unlock" aria-label="Unlock"><KeyRound /></button>
        </div>
      </ActionForm>
    </details>
  );
}
