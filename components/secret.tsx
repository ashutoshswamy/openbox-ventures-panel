"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Hidden-by-default value with an eye toggle (shoulder-surfing guard, not access control: RLS decides who gets the data).
// block: wraps a whole table/section, with the toggle above it.
export function Secret({ children, label = "salary", block }: { children: React.ReactNode; label?: string; block?: boolean }) {
  const [show, setShow] = useState(false);
  const toggle = (
    <button type="button" onClick={() => setShow(!show)} aria-pressed={show} aria-label={`${show ? "Hide" : "Show"} ${label}`} title={`${show ? "Hide" : "Show"} ${label}`} className="btn btn-ghost btn-icon size-7 align-middle">
      {show ? <EyeOff /> : <Eye />}
    </button>
  );
  if (block) return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm text-muted">{toggle} {show ? `Hide ${label}` : `${label[0].toUpperCase() + label.slice(1)} hidden`}</div>
      {show && children}
    </div>
  );
  return <span className="inline-flex items-center gap-1">{show ? children : <span aria-label={`${label} hidden`}>₹ ••••••</span>}{toggle}</span>;
}
