"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import { search, type Hit } from "@/app/search-actions";
import type { NavLink } from "./nav";

type Item = { href: string; label: string; sub?: string; kind: Hit["kind"] | "Page" };

// Cmd/Ctrl+K palette: this panel's pages (filtered here) + people, chats, to-dos (server, RLS-scoped).
export function GlobalSearch({ links }: { links: NavLink[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [sel, setSel] = useState(0);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        dialog.current?.showModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => start(async () => setHits(await search(q).catch(() => []))), 200);
    return () => clearTimeout(t);
  }, [q]);

  const term = q.trim().toLowerCase();
  const pages: Item[] = links.filter(([, label]) => !term || label.toLowerCase().includes(term)).map(([href, label]) => ({ href, label, kind: "Page" }));
  const items: Item[] = [...pages, ...(term.length < 2 ? [] : hits)];
  const go = (it: Item | undefined) => {
    if (!it) return;
    dialog.current?.close();
    router.push(it.href);
  };

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="btn btn-ghost w-full justify-start text-muted" aria-keyshortcuts="Control+K Meta+K">
        <SearchIcon /> Search <kbd className="ml-auto hidden rounded border border-line px-1.5 text-[11px] lg:inline">⌘K</kbd>
      </button>
      <dialog
        ref={dialog}
        aria-label="Search"
        onClose={() => { setQ(""); setHits([]); setSel(0); }}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()} // backdrop click
        className="m-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/40"
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <SearchIcon className="size-4 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              if (e.key === "Enter") { e.preventDefault(); go(items[sel]); }
            }}
            placeholder="Search people, chats, to-dos, pages…"
            aria-label="Search"
            role="combobox"
            aria-expanded
            aria-controls="search-results"
            aria-activedescendant={items[sel] ? `hit-${sel}` : undefined}
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {pending && <span className="text-xs text-muted">Searching…</span>}
        </div>
        <ul id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {items.map((it, i) => (
            <li key={it.kind + it.href + it.label} id={`hit-${i}`} role="option" aria-selected={i === sel}>
              <button
                type="button"
                onClick={() => go(it)}
                onMouseMove={() => setSel(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === sel ? "bg-surface-2" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{it.label}</span>
                  {it.sub && <span className="block truncate text-xs text-muted">{it.sub}</span>}
                </span>
                <span className="badge">{it.kind}</span>
              </button>
            </li>
          ))}
          {!items.length && <li className="px-3 py-6 text-center text-sm text-muted">{pending ? "Searching…" : "No results"}</li>}
        </ul>
      </dialog>
    </>
  );
}
