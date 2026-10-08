import { Avatar } from "@/components/avatar";

export type OrgPerson = { id: string; full_name: string; designation: string | null; avatar_url: string | null; reports_to: string | null; role: string | null; department: { name: string } | null };

// Nested <ul> tree, CSS-only connectors (see .org in globals.css).
// Roots = active non-admins with no (active) manager. Cycles are blocked in the DB; `seen` guards anyway.
export function OrgChart({ people }: { people: OrgPerson[] }) {
  const staff = people.filter((p) => p.role !== "admin");
  const ids = new Set(staff.map((p) => p.id));
  const kids = new Map<string, OrgPerson[]>();
  for (const p of staff) if (p.reports_to && ids.has(p.reports_to)) kids.set(p.reports_to, [...(kids.get(p.reports_to) ?? []), p]);
  const roots = staff.filter((p) => !p.reports_to || !ids.has(p.reports_to));
  const anyLines = kids.size > 0;
  const seen = new Set<string>();

  const node = (p: OrgPerson) => {
    seen.add(p.id);
    const sub = (kids.get(p.id) ?? []).filter((k) => !seen.has(k.id));
    return (
      <li key={p.id}>
        <div className="org-card">
          <Avatar name={p.full_name} src={p.avatar_url} size="size-9" />
          <div className="min-w-0 text-left">
            <div className="truncate text-sm font-semibold">{p.full_name}</div>
            <div className="truncate text-xs text-muted">{p.designation ?? "-"}</div>
          </div>
        </div>
        {sub.length > 0 && <ul>{sub.map(node)}</ul>}
      </li>
    );
  };

  if (!roots.length) return <p className="empty">No people yet.</p>;
  if (anyLines) return <div className="org overflow-x-auto pb-4"><ul>{roots.map(node)}</ul></div>;

  // ponytail: no reporting lines set anywhere → flat grouping by department
  const groups = new Map<string, OrgPerson[]>();
  for (const p of roots) groups.set(p.department?.name ?? "No department", [...(groups.get(p.department?.name ?? "No department") ?? []), p]);
  return (
    <div className="space-y-6">
      {[...groups].map(([dept, list]) => (
        <section key={dept}>
          <h2 className="eyebrow mb-3">{dept}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => <li key={p.id} className="org-card">
              <Avatar name={p.full_name} src={p.avatar_url} size="size-9" />
              <div className="min-w-0"><div className="truncate text-sm font-semibold">{p.full_name}</div><div className="truncate text-xs text-muted">{p.designation ?? "-"}</div></div>
            </li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}
