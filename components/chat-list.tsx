"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Building2, ChevronRight, Globe, Hash, Megaphone, Pin, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";

export type Row = {
  id: string; type: "dm" | "group" | "department" | "office" | "global"; name: string | null; unread: number; announcements: boolean; avatar_url: string | null;
  office_id: string | null; office_name: string | null;
};
export type Section = { title: string; rows: Row[]; nest?: boolean }; // nest: office row on top, its departments collapsed beneath

const Badge = ({ n }: { n: number }) => n > 0 ? <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] leading-5 font-semibold text-primary-fg tabular-nums">{n}</span> : null;

function Icon({ c }: { c: Row }) {
  if (c.announcements) return <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-fg"><Megaphone className="size-4" /></span>;
  if (c.type === "dm") return <Avatar name={c.name ?? "?"} src={c.avatar_url} size="size-7 text-[11px]" />;
  return (
    <span className="grid size-7 place-items-center rounded-lg bg-surface-2 text-muted">
      {c.type === "department" ? <Users className="size-4" /> : c.type === "office" ? <Building2 className="size-4" /> : c.type === "global" ? <Globe className="size-4" /> : <Hash className="size-4" />}
    </span>
  );
}

// Pins live in this browser (localStorage), not the database.
// ponytail: per-device pins; add a pinned_chats table if they should follow people across devices.
export function ChatList({ sections, meId }: { sections: Section[]; meId: string }) {
  const active = useSelectedLayoutSegment();
  const key = `pinned-chats:${meId}`;
  const [pins, setPins] = useState<string[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    try { setPins(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch {}
  }, [key]);
  const toggle = (id: string) => {
    const next = pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id];
    setPins(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  };

  const label = (c: Row) => c.name ?? "Unnamed";
  // inside a nested office the "Office / " prefix is redundant; pinned rows keep it
  const full = (c: Row) => (c.type === "department" && c.office_name ? `${c.office_name} / ${label(c)}` : label(c));

  function Item({ c, name, indent }: { c: Row; name: string; indent?: boolean }) {
    const pinned = pins.includes(c.id);
    return (
      <div className={`group relative ${indent ? "ml-5" : ""}`}>
        <Link
          href={`/chat/${c.id}`}
          aria-current={active === c.id ? "page" : undefined}
          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 pr-9 text-sm transition-colors ${active === c.id ? "bg-surface shadow-[0_1px_2px_rgb(24_24_27/0.06)] ring-1 ring-line" : "hover:bg-surface-2"}`}
        >
          <Icon c={c} />
          <span className={`flex-1 truncate ${c.unread ? "font-semibold" : ""}`}>{name}</span>
          <Badge n={c.unread} />
        </Link>
        <button
          type="button"
          onClick={() => toggle(c.id)}
          title={pinned ? "Unpin" : "Pin to top"}
          aria-label={pinned ? `Unpin ${name}` : `Pin ${name}`}
          aria-pressed={pinned}
          className={`absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text focus-visible:opacity-100 ${pinned ? "text-primary opacity-100" : "opacity-0 group-hover:opacity-100 max-md:opacity-60"}`}
        >
          <Pin className={`size-3.5 ${pinned ? "fill-current" : ""}`} />
        </button>
      </div>
    );
  }

  function Nested({ rows }: { rows: Row[] }) {
    const offices = [...new Map(rows.map((r) => [r.office_id ?? r.office_name ?? r.id, r.office_name])).entries()];
    return offices.map(([k, officeName]) => {
      const group = rows.filter((r) => (r.office_id ?? r.office_name ?? r.id) === k);
      const head = group.find((r) => r.type === "office");
      const kids = group.filter((r) => r !== head);
      if (!head) return kids.map((c) => <Item key={c.id} c={c} name={full(c)} />);
      const expanded = open.has(head.id) || kids.some((c) => c.id === active);
      return (
        <div key={head.id}>
          <div className="flex items-center">
            {kids.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(head.id)) n.delete(head.id); else n.add(head.id); return n; })}
                aria-expanded={expanded}
                aria-label={`${expanded ? "Collapse" : "Expand"} ${officeName ?? "office"} departments`}
                className="grid size-6 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2"
              >
                <ChevronRight className={`size-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
              </button>
            )}
            <div className={`min-w-0 flex-1 ${kids.length ? "" : "ml-6"}`}><Item c={head} name={label(head)} /></div>
          </div>
          {expanded && kids.map((c) => <Item key={c.id} c={c} name={label(c)} indent />)}
          {!expanded && kids.some((c) => c.unread) && <p className="ml-8 text-xs font-medium text-primary">{kids.reduce((n, c) => n + c.unread, 0)} unread in departments</p>}
        </div>
      );
    });
  }

  const all = sections.flatMap((s) => s.rows);
  const pinned = pins.map((id) => all.find((r) => r.id === id)).filter((r): r is Row => !!r);

  return (
    <>
      {pinned.length > 0 && (
        <div className="mb-5">
          <div className="mb-1.5 px-2.5 text-xs font-medium text-muted">Pinned</div>
          {pinned.map((c) => <Item key={c.id} c={c} name={c.type === "dm" ? label(c) : full(c)} />)}
        </div>
      )}
      {sections.map((s) => {
        const rows = s.rows.filter((r) => !pins.includes(r.id));
        if (!rows.length) return null;
        return (
          <div key={s.title} className="mb-5">
            <div className="mb-1.5 px-2.5 text-xs font-medium text-muted">{s.title}</div>
            {s.nest ? <Nested rows={rows} /> : rows.map((c) => <Item key={c.id} c={c} name={label(c)} />)}
          </div>
        );
      })}
    </>
  );
}
