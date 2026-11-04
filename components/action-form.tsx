"use client";

import { useRef, useTransition } from "react";
import { sileo } from "sileo";

// Form bound to a server action returning an error string (or nothing on success).
// Keeps inputs on error, resets on success. Feedback: the clicked button shows a spinner then a tick, and a toast reports the result.
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
  success?: string | false; // toast after a successful submit (default "Done"); false = silent, for toggles that already show the change
  className?: string;
  children: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  const busy = useRef(false); // inert lands on the next render; this blocks a 2nd submit (e.g. held Enter) before that

  return (
    <form
      // inert (not a <fieldset> wrapper) blocks input while saving and keeps children direct, so space-y-* works
      inert={pending}
      aria-busy={pending}
      className={`${className ?? ""} ${pending ? "cursor-wait opacity-80" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (busy.current || (confirmText && !confirm(confirmText))) return;
        const form = e.currentTarget;
        const fd = new FormData(form, (e.nativeEvent as SubmitEvent).submitter); // keeps clicked button's name/value
        busy.current = true;
        const btn = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        btn?.setAttribute("data-loading", "");
        start(async () => {
          // thrown = auth / rate limit / crash (message hidden in production builds)
          // A server action that calls redirect() rejects its promise on the client (Next hands the redirect to the router): that is a success, not a crash
          let redirected = false;
          const err = await action(fd).catch((e: unknown) => {
            if (String((e as { digest?: unknown })?.digest ?? "").startsWith("NEXT_REDIRECT")) { redirected = true; return null; }
            return "Something went wrong, or too many requests. Wait a moment and try again.";
          });
          btn?.removeAttribute("data-loading");
          if (redirected) { busy.current = false; return; }
          if (err) sileo.error({ title: "Couldn't save", description: err });
          else {
            if (success !== false) sileo.success({ title: success ?? "Done" });
            if (btn) { btn.setAttribute("data-done", ""); setTimeout(() => btn.removeAttribute("data-done"), 1400); }
            if (!keep) form.reset();
          }
          busy.current = false;
        });
      }}
    >
      {children}
    </form>
  );
}
