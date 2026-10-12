"use client";
import { newId } from "@/lib/demo/store";
import { useRole } from "@/lib/demo/use-role";
import { useAudit } from "@/lib/demo/shared";
import { useEmps } from "@/lib/demo/admin";

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

// Acting person + scope (admin: everyone, manager: own department) + audit logger
export function useAdm() {
  const { role, me } = useRole("admin");
  const [emps] = useEmps();
  const [, setAudit] = useAudit();
  const isAdmin = role === "admin";
  const inScope = (e: { department_id: string | null }) => isAdmin || e.department_id === me.department_id;
  const staff = emps.filter((e) => e.active && e.role !== "admin" && inScope(e));
  const log = (action: string, target: string) => setAudit((l) => [{ id: newId(), at: new Date().toISOString(), actor: me.id, action, target }, ...l]);
  return { role, me, isAdmin, emps, inScope, staff, log };
}
