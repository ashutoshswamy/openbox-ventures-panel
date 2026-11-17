"use client";

import { useTransition } from "react";
import { Mail } from "lucide-react";
import { sileo } from "sileo";
import { sendCompletionLink } from "@/app/admin/actions";

// One click: emails the employee a "complete your details" link via Resend.
export function CompletionLink({ id, missing }: { id: string; missing: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn" disabled={pending} data-loading={pending ? "" : undefined} onClick={() => start(async () => {
      const r: Awaited<ReturnType<typeof sendCompletionLink>> = await sendCompletionLink(id).catch(() => ({ error: "Something went wrong. Try again." }));
      if (r.error) return void sileo.error({ title: "Couldn't send email", description: r.error });
      sileo.success({ title: "Email sent" });
    })}>
      <Mail /> Email link to complete {missing}
    </button>
  );
}
