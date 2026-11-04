"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const C = "group-data-[collapsed=true]/shell";

// Desktop only. Flips data-collapsed on the shell (CSS does the rest) and remembers it in a cookie so the server renders it the same next time.
export function SidebarToggle() {
  const flip = (e: React.MouseEvent<HTMLButtonElement>) => {
    const shell = e.currentTarget.closest<HTMLElement>("[data-shell]");
    if (!shell) return;
    const next = shell.dataset.collapsed !== "true";
    shell.dataset.collapsed = String(next);
    document.cookie = `sidebar=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <button type="button" onClick={flip} className="btn btn-ghost btn-icon hidden lg:inline-flex" aria-label="Collapse or expand sidebar" title="Collapse or expand sidebar ( [ )">
      <PanelLeftClose className={`${C}:hidden`} />
      <PanelLeftOpen className={`hidden ${C}:block`} />
    </button>
  );
}
