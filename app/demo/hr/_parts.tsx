"use client";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { useAudit } from "@/lib/demo/shared";
import { newId } from "@/lib/demo/store";
import { useRole } from "@/lib/demo/use-role";

// copy of components/shell PageHeader (that file imports Clerk)
export function PageHeader({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="h1">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

// Append an audit-log entry as the HR user
export function useLog() {
  const { me } = useRole("hr");
  const [, setAudit] = useAudit();
  return (action: string, target: string) => setAudit((a) => [{ id: newId(), at: new Date().toISOString(), actor: me.id, action, target }, ...a]);
}

// Note + Reject / Approve buttons
export function ReviewForm({ approveLabel = "Approve", notePlaceholder = "Add a note (optional)", onDecide }: { approveLabel?: string; notePlaceholder?: string; onDecide: (approved: boolean, note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => e.preventDefault()}>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={notePlaceholder} className="input w-auto min-w-48 flex-1" />
      <button type="button" onClick={() => onDecide(false, note)} className="btn btn-danger"><X /> Reject</button>
      <button type="button" onClick={() => onDecide(true, note)} className="btn btn-primary"><Check /> {approveLabel}</button>
    </form>
  );
}
