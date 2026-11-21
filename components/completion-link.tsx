"use client";

import { useTransition } from "react";
import { Mail, Send } from "lucide-react";
import { sileo } from "sileo";
import { sendCompletionLink, sendCompletionLinkAll } from "@/app/admin/actions";

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

// One click: emails every active employee still missing details/bank, for the signed-in staff's scope.
export function CompletionLinkAll({ count }: { count: number }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn" disabled={pending || !count} data-loading={pending ? "" : undefined} onClick={() => start(async () => {
      const r: Awaited<ReturnType<typeof sendCompletionLinkAll>> = await sendCompletionLinkAll().catch(() => ({ error: "Something went wrong. Try again." }));
      if (r.error) return void sileo.error({ title: "Couldn't send emails", description: r.error });
      sileo.success({ title: `Sent ${r.sent ?? 0} email${r.sent === 1 ? "" : "s"}` });
    })}>
      <Send /> Email everyone with pending details{count ? ` (${count})` : ""}
    </button>
  );
}
