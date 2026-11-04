"use client";

import { useEffect, useRef, useState } from "react";
import { Keyboard, X } from "lucide-react";

const mac = () => /Mac|iPhone|iPad/.test(navigator.platform);
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

// Global shortcuts + a help dialog. "/" search, "[" sidebar, "?" this list. Pressed keys flash on every <kbd> hint on screen.
export function KeyboardHints() {
  const dlg = useRef<HTMLDialogElement>(null);
  const [cmd, setCmd] = useState("Ctrl");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- platform is only known in the browser
    setCmd(mac() ? "⌘" : "Ctrl");
    const flash = (k: string) => document.querySelectorAll(`kbd[data-k="${k}"]`).forEach((el) => { el.classList.remove("kbd-press"); void (el as HTMLElement).offsetWidth; el.classList.add("kbd-press"); });
    const key = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) return flash("k"); // search opens itself (components/search.tsx)
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector("dialog[open]")) return;
      if (e.key === "/") { e.preventDefault(); flash("k"); flash("/"); document.querySelector<HTMLElement>('[aria-keyshortcuts*="Control+K"]')?.click(); }
      else if (e.key === "[") { flash("["); document.querySelector<HTMLElement>('[aria-label="Collapse or expand sidebar"]')?.click(); }
      else if (e.key === "?") { e.preventDefault(); dlg.current?.showModal(); }
    };
    const open = () => dlg.current?.showModal();
    addEventListener("keydown", key);
    addEventListener("open-shortcuts", open);
    return () => { removeEventListener("keydown", key); removeEventListener("open-shortcuts", open); };
  }, []);

  const rows: [string[], string][] = [[[cmd, "K"], "Search people, pages and chats"], [["/"], "Search (same thing)"], [["["], "Collapse or expand the sidebar"], [["?"], "Show this list"], [["Esc"], "Close a dialog or search"]];
  return (
    <dialog ref={dlg} aria-label="Keyboard shortcuts" onClick={(e) => e.target === dlg.current && dlg.current.close()} className="m-auto w-[min(26rem,92vw)] rounded-2xl border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <Keyboard className="size-4 text-muted" /><h2 className="flex-1 font-semibold">Keyboard shortcuts</h2>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={() => dlg.current?.close()}><X /></button>
      </div>
      <ul className="divide-y divide-line px-5 text-sm">
        {rows.map(([keys, what]) => (
          <li key={what} className="flex items-center justify-between gap-4 py-3">
            <span>{what}</span>
            <span className="flex shrink-0 gap-1">{keys.map((k) => <kbd key={k} className="kbd">{k}</kbd>)}</span>
          </li>
        ))}
      </ul>
      <p className="px-5 pt-1 pb-4 text-xs text-muted">Shortcuts pause while you are typing in a field.</p>
    </dialog>
  );
}

export function ShortcutsButton() {
  return <button type="button" className="btn btn-ghost btn-icon" aria-label="Keyboard shortcuts (?)" onClick={() => dispatchEvent(new Event("open-shortcuts"))}><Keyboard /></button>;
}
