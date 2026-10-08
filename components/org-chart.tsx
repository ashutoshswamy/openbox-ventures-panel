import { ChevronDown, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { OrgTools } from "@/components/org-tools";

export type OrgPerson = { id: string; full_name: string; designation: string | null; avatar_url: string | null; reports_to: string | null; role: string | null; department: { name: string } | null };

// Each top-level team gets a hue that runs down its whole branch (wires, card accent, avatar ring),
// so a team is traceable by colour. Existing palette tokens, so dark mode comes for free.
const HUES = ["var(--blue)", "var(--green)", "var(--amber)", "var(--red)"];

function Card({ p, depth, direct, team }: { p: OrgPerson; depth: number; direct?: number; team?: number }) {
  return (
    <div data-name={p.full_name.toLowerCase()} className={`org-card ${depth === 0 ? "org-root" : ""}`} style={{ "--d": Math.min(depth, 6) } as React.CSSProperties}>
      <span className="org-avatar"><Avatar name={p.full_name} src={p.avatar_url} size="size-12 text-base" /></span>
      <div className="w-full min-w-0">
        <div className="truncate text-sm font-semibold tracking-tight">{p.full_name}</div>
        <div className="org-sub truncate text-xs">{p.designation ?? "No designation"}</div>
      </div>
      {(p.department || direct) && (
        <div className="flex w-full items-center justify-center gap-1.5">
          {p.department && <span className="org-chip truncate">{p.department.name}</span>}
          {!!direct && (
            <span className="org-chip shrink-0" title={`${direct} direct report${direct === 1 ? "" : "s"}, ${team} in team`}>
              <Users className="size-3" /> {team}
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
  const next = { hue: 0 }; // top-level teams get HUES in order

  // size = people in this subtree, levels = its depth
  const node = (p: OrgPerson, depth: number): { el: React.ReactNode; size: number; levels: number } => {
    seen.add(p.id);
    const sub = (kids.get(p.id) ?? []).filter((k) => !seen.has(k.id)).map((k) => node(k, depth + 1));
    const size = sub.reduce((n, s) => n + s.size, 0);
    const style = depth === 1 ? ({ "--hue": HUES[next.hue++ % HUES.length] } as React.CSSProperties) : undefined;
    return {
      size: size + 1,
      levels: 1 + Math.max(0, ...sub.map((s) => s.levels)),
      el: (
        <li key={p.id} style={style}>
          {sub.length ? (
            <details open className="org-team">
              <summary aria-label={`${p.full_name}, ${sub.length} direct report${sub.length === 1 ? "" : "s"}`}><Card p={p} depth={depth} direct={sub.length} team={size} /></summary>
              <ul>{sub.map((s) => s.el)}</ul>
            </details>
          ) : <Card p={p} depth={depth} />}
        </li>
      ),
    };
  };

  if (!roots.length) return <p className="empty"><Users /> No people yet. Set &quot;Reports to&quot; on employees to build the chart.</p>;
  if (anyLines) {
    const built = roots.map((p) => node(p, 0));
    const tree = built.map((b) => b.el);
    const levels = Math.max(...built.map((b) => b.levels));
    const managers = kids.size;
    return (
      <OrgTools summary={`${staff.length} people, ${managers} manager${managers === 1 ? "" : "s"}, ${levels} level${levels === 1 ? "" : "s"}`}>
        <div className="org mx-auto w-max min-w-full px-6 pt-10 pb-10"><ul>{tree}</ul></div>
      </OrgTools>
    );
  }

  // ponytail: no reporting lines set anywhere → flat grouping by department
  const groups = new Map<string, OrgPerson[]>();
  for (const p of roots) groups.set(p.department?.name ?? "No department", [...(groups.get(p.department?.name ?? "No department") ?? []), p]);
  return (
    <div className="space-y-10">
      {[...groups].map(([dept, list], i) => (
        <section key={dept} style={{ "--hue": HUES[i % HUES.length] } as React.CSSProperties}>
          <h2 className="mb-6 flex items-baseline gap-2 text-[15px] font-semibold tracking-tight">{dept}<span className="text-sm font-normal text-muted">{list.length}</span></h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-x-4 gap-y-10 pt-6">
            {list.map((p) => <li key={p.id} className="flex justify-center"><Card p={{ ...p, department: null }} depth={1} /></li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}
