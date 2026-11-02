"use client";

import { useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

// GET filter form that applies itself: text fields after a short pause while typing, selects / dates at once. No button or Enter needed.
// Navigates to the same page with the form's values as ?query; "page" isn't a field, so any change returns to page 1.
export function AutoForm({ children, className, delay = 250 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const go = (form: HTMLFormElement) => {
    const q = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === "string" && v !== "") q.set(k, v);
    start(() => router.replace(q.size ? `${path}?${q}` : path, { scroll: false }));
  };

  return (
    <form
      className={className}
      aria-busy={pending}
      onSubmit={(e) => { e.preventDefault(); clearTimeout(timer.current); go(e.currentTarget); }}
      onChange={(e) => {
        const form = e.currentTarget;
        const t: unknown = e.target;
        const typing = t instanceof HTMLInputElement && ["text", "search", "email", "tel", "number"].includes(t.type);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => go(form), typing ? delay : 0);
      }}
    >
      {children}
    </form>
  );
}
