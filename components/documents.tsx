import Link from "next/link";
import { Download, FileText, Trash2 } from "lucide-react";
import { ActionForm } from "./action-form";
import { deleteDocument } from "@/app/admin/actions";
import { fmtDate, todayIn } from "@/lib/util";

export const CATEGORIES: [string, string][] = [
  ["offer_letter", "Offer letter"], ["contract", "Contract"], ["id_proof", "ID proof"], ["address_proof", "Address proof"],
  ["certificate", "Certificate"], ["tax", "Tax"], ["other", "Other"],
];
export type Doc = { id: string; category: string; title: string; expires_on: string | null; created_at: string };

// Documents of one person. canDelete: admin / HR view (the person themselves can only download).
export function DocumentList({ docs, canDelete }: { docs: Doc[]; canDelete?: boolean }) {
  const today = todayIn();
  const soon = new Date(new Date(today).getTime() + 30 * 864e5).toISOString().slice(0, 10);
  if (!docs.length) return <p className="text-sm text-muted">No documents yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {docs.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
          <FileText className="size-4 shrink-0 text-muted" />
          <span className="min-w-0 flex-1 leading-snug">
            <span className="block truncate font-medium">{d.title}</span>
            <span className="block text-xs text-muted">{CATEGORIES.find(([k]) => k === d.category)?.[1]} · added {fmtDate(d.created_at.slice(0, 10))}</span>
          </span>
          {d.expires_on && (
            <span className={`badge ${d.expires_on < today ? "badge-red" : d.expires_on <= soon ? "badge-amber" : ""}`}>
              {d.expires_on < today ? "Expired" : "Expires"} {fmtDate(d.expires_on)}
            </span>
          )}
          <Link href={`/files/doc/${d.id}`} prefetch={false} className="btn btn-ghost"><Download /> Download</Link>
          {canDelete && (
            <ActionForm action={deleteDocument} confirm={`Delete "${d.title}"? This can't be undone.`}>
              <input type="hidden" name="id" value={d.id} />
              <button className="btn btn-ghost btn-danger btn-icon" aria-label={`Delete ${d.title}`}><Trash2 /></button>
            </ActionForm>
          )}
        </li>
      ))}
    </ul>
  );
}
