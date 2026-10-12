"use client";

import { useEffect, useRef, useState } from "react";

// Text input with @name autocomplete. Tags are stored as plain "@Full Name" in the body (rendered highlighted by the chat page).
export function MentionInput({ name, people, className, ...rest }: { name: string; people: string[] } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "value" | "onChange">) {
  const [value, setValue] = useState("");
  const [at, setAt] = useState<{ start: number; q: string } | null>(null);
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = ref.current?.form;
    const clear = () => { setValue(""); setAt(null); };
    form?.addEventListener("reset", clear);
    return () => form?.removeEventListener("reset", clear);
  }, []);

  const matches = at ? people.filter((p) => p.toLowerCase().includes(at.q.toLowerCase())).slice(0, 6) : [];

  function detect(v: string, caret: number) {
    const m = /(?:^|\s)@([^@\n]{0,30})$/.exec(v.slice(0, caret));
    setAt(m ? { start: caret - m[1].length - 1, q: m[1] } : null);
    setSel(0);
  }

  function pick(p: string) {
    if (!at) return;
    const el = ref.current!;
    const end = at.start + 1 + at.q.length;
    const next = `${value.slice(0, at.start)}@${p} ${value.slice(end)}`;
    setValue(next);
    setAt(null);
    const pos = at.start + p.length + 2;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos); });
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        {...rest}
        ref={ref}
        name={name}
        value={value}
        className={`w-full ${className ?? ""}`}
        onChange={(e) => { setValue(e.target.value); detect(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
        onKeyDown={(e) => {
          if (!matches.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % matches.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s - 1 + matches.length) % matches.length); }
          else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(matches[sel]); }
          else if (e.key === "Escape") setAt(null);
        }}
        onBlur={() => setTimeout(() => setAt(null), 120)}
      />
      {matches.length > 0 && (
        <ul role="listbox" className="absolute bottom-full left-0 z-10 mb-2 w-64 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg">
          {matches.map((p, i) => (
            <li key={p} role="option" aria-selected={i === sel}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(p); }} className={`w-full truncate rounded-lg px-2.5 py-1.5 text-left text-sm ${i === sel ? "bg-primary-soft text-primary" : "hover:bg-surface-2"}`}>@{p}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
