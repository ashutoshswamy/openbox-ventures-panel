"use client";
import { CircleAlert, CircleCheckBig } from "lucide-react";

// Copy of PageHeader from components/shell.tsx (that file imports Clerk).
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

export type Msg = { ok: boolean; text: string } | null;
export function Notice({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return msg.ok ? (
    <p className="flex items-center gap-2 text-sm text-green"><CircleCheckBig className="size-4" /> {msg.text}</p>
  ) : (
    <p className="error"><CircleAlert className="size-4" /> {msg.text}</p>
  );
}
