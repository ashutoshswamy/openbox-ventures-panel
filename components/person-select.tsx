"use client";

import { useEffect, useRef, useState } from "react";

type Opt = { id: string; label: string };

// Searchable replacement for a <select> of people. Submits the chosen id under `name` via a hidden input.
// `empty` adds a first "no one" choice (id ""). `submitOnPick` re-submits the surrounding form (for AutoForm filters).
export function PersonSelect({ name, options, defaultValue = "", empty, placeholder = "Search…", required, submitOnPick, className = "input", ariaLabel }: {
  name: string; options: Opt[]; defaultValue?: string | null; empty?: string; placeholder?: string; required?: boolean; submitOnPick?: boolean; className?: string; ariaLabel?: string;
}) {
  const all = empty != null ? [{ id: "", label: empty }, ...options] : options;
  const labelOf = (id: string) => all.find((o) => o.id === id)?.label ?? "";
  const [id, setId] = useState(defaultValue ?? "");
  const [q, setQ] = useState<string | null>(null); // null = not typing, show the chosen label
  const [open, setOpen] = useState(false);
  const hidden = useRef<HTMLInputElement>(null);
  const text = useRef<HTMLInputElement>(null);
  const shown = q === null ? labelOf(id) : q;
  const list = q ? all.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : all;

  useEffect(() => { text.current?.setCustomValidity(required && !id ? "Pick a person from the list" : ""); }, [id, required]);

  const pick = (o: Opt) => {
    setId(o.id); setQ(null); setOpen(false);
    if (hidden.current) hidden.current.value = o.id; // set now so requestSubmit below reads it
    if (submitOnPick) hidden.current?.form?.requestSubmit();
  };

  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { setOpen(false); setQ(null); } }}>
      <input ref={hidden} type="hidden" name={name} defaultValue={id} />
      <input
        ref={text} value={shown} placeholder={placeholder} aria-label={ariaLabel} required={required} autoComplete="off" role="combobox" aria-expanded={open} aria-controls="person-options"
        className={className}
        onFocus={(e) => { setOpen(true); e.currentTarget.select(); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); if (list[0]) pick(list[0]); }
          if (e.key === "Escape") { setOpen(false); setQ(null); }
        }}
      />
      {open && (
        <ul className="absolute z-30 mt-1 max-h-60 min-w-full overflow-y-auto rounded-lg border border-line bg-surface p-1 text-sm shadow-lg" role="listbox" id="person-options">
          {list.map((o) => (
            <li key={o.id || "none"}>
              <button type="button" role="option" aria-selected={o.id === id} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)}
                className={`block w-full truncate rounded px-2.5 py-1.5 text-left hover:bg-surface-2 ${o.id === id ? "font-semibold" : ""}`}>{o.label}</button>
            </li>
          ))}
          {!list.length && <li className="px-2.5 py-1.5 text-muted">No match</li>}
        </ul>
      )}
    </div>
  );
}
