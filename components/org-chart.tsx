import { ChevronDown, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";

export type OrgPerson = { id: string; full_name: string; designation: string | null; avatar_url: string | null; reports_to: string | null; role: string | null; department: { name: string } | null };

// One person. Avatar breaks the top edge so the connector line runs into it. Roots are inverted (ink) cards.
function Card({ p, depth, reports }: { p: OrgPerson; depth: number; reports?: number }) {
  return (
    <div className={`org-card ${depth === 0 ? "org-root" : ""}`} style={{ "--d": Math.min(depth, 6) } as React.CSSProperties}>
      <span className="org-avatar"><Avatar name={p.full_name} src={p.avatar_url} size="size-12 text-base" /></span>
      <div className="w-full min-w-0">
        <div className="truncate text-sm font-semibold tracking-tight">{p.full_name}</div>
        <div className="org-sub truncate text-xs">{p.designation ?? "No designation"}</div>
      </div>
      {(p.department || reports) && (
        <div className="flex w-full items-center justify-center gap-1.5">
          {p.department && <span className="org-chip truncate">{p.department.name}</span>}
          {!!reports && (
            <span className="org-chip shrink-0">
              <Users className="size-3" /> {reports}
              <ChevronDown className="org-chev size-3" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Nested <ul> tree, CSS-only connectors (see .org in globals.css). Teams collapse via native <details>.
// Roots = active non-admins with no (active) manager. Cycles are blocked in the DB; `seen` guards anyway.
export function OrgChart({ people }: { people: OrgPerson[] }) {
  const staff = people.filter((p) => p.role !== "admin");
  const ids = new Set(staff.map((p) => p.id));
  const kids = new Map<string, OrgPerson[]>();
  for (const p of staff) if (p.reports_to && ids.has(p.reports_to)) kids.set(p.reports_to, [...(kids.get(p.reports_to) ?? []), p]);
  const roots = staff.filter((p) => !p.reports_to || !ids.has(p.reports_to));
  const anyLines = kids.size > 0;
  const seen = new Set<string>();

  const node = (p: OrgPerson, depth: number) => {
    seen.add(p.id);
    const sub = (kids.get(p.id) ?? []).filter((k) => !seen.has(k.id));
    return (
      <li key={p.id}>
        {sub.length ? (
          <details open className="org-team">
            <summary aria-label={`${p.full_name}, ${sub.length} direct report${sub.length === 1 ? "" : "s"}`}><Card p={p} depth={depth} reports={sub.length} /></summary>
            <ul>{sub.map((k) => node(k, depth + 1))}</ul>
          </details>
        ) : <Card p={p} depth={depth} />}
      </li>
    );
  };

  if (!roots.length) return <p className="empty"><Users /> No people yet.</p>;
  if (anyLines)
    return (
      <div className="org-canvas">
        <div className="org mx-auto w-max min-w-full px-6 pt-10 pb-8"><ul>{roots.map((p) => node(p, 0))}</ul></div>
      </div>
    );

  // ponytail: no reporting lines set anywhere → flat grouping by department
  const groups = new Map<string, OrgPerson[]>();
  for (const p of roots) groups.set(p.department?.name ?? "No department", [...(groups.get(p.department?.name ?? "No department") ?? []), p]);
  return (
    <div className="space-y-10">
      {[...groups].map(([dept, list]) => (
        <section key={dept}>
          <h2 className="mb-6 flex items-baseline gap-2 text-[15px] font-semibold tracking-tight">{dept}<span className="text-sm font-normal text-muted">{list.length}</span></h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-x-4 gap-y-10 pt-6">
            {list.map((p) => <li key={p.id} className="flex justify-center"><Card p={{ ...p, department: null }} depth={1} /></li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}
