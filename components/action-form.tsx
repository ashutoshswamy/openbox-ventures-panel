"use client";

import { useState, useTransition } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

// Form bound to a server action returning an error string (or nothing on success).
// Keeps inputs on error, resets on success.
export function ActionForm({
  action,
  confirm: confirmText,
  keep,
  success,
  className,
  children,
}: {
  action: (fd: FormData) => Promise<string | void | null>;
  confirm?: string;
  keep?: boolean; // don't clear inputs after success (edit forms)
  success?: string; // shown after a successful submit
  className?: string;
  children: React.ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      // inert (not a <fieldset> wrapper) blocks input while saving and keeps children direct, so space-y-* works
      inert={pending}
      aria-busy={pending}
      className={`${className ?? ""} ${pending ? "opacity-60" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmText && !confirm(confirmText)) return;
        const form = e.currentTarget;
        const fd = new FormData(form, (e.nativeEvent as SubmitEvent).submitter); // keeps clicked button's name/value
        start(async () => {
          // thrown = auth / rate limit / crash (message hidden in production builds)
          const err = await action(fd).catch(() => "Something went wrong, or too many requests. Wait a moment and try again.");
          setError(err || null);
          setOk(!err);
          if (!err && !keep) form.reset();
        });
      }}
    >
      {children}
      {error && <p className="error"><CircleAlert className="size-4 shrink-0" /> {error}</p>}
      {ok && success && <p className="col-span-full flex basis-full items-center gap-1.5 text-sm text-green"><CircleCheck className="size-4" /> {success}</p>}
    </form>
  );
}
