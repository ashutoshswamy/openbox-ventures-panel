"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { sileo } from "sileo";
import { sendCompletionLink } from "@/app/admin/actions";

// Creates a fresh "complete your details" link, emails it when mail is set up, and shows it to copy.
export function CompletionLink({ id, missing }: { id: string; missing: string }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-2">
      <button type="button" className="btn" disabled={pending} data-loading={pending ? "" : undefined} onClick={() => start(async () => {
        const r: Awaited<ReturnType<typeof sendCompletionLink>> = await sendCompletionLink(id).catch(() => ({ error: "Something went wrong. Try again." }));
        if (r.error) return void sileo.error({ title: "Couldn't create link", description: r.error });
        setUrl(r.url!);
        sileo.success({ title: r.emailed ? "Link emailed" : "Link ready", description: r.emailed ? undefined : "Email isn't set up, copy it and send it to them." });
      })}>
        <Link2 /> Send link to complete {missing}
      </button>
      {url && (
        <div className="flex items-center gap-2">
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Completion link" className="input h-9 flex-1 text-xs" />
          <button type="button" className="btn btn-icon" aria-label="Copy link" onClick={() => navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
            {copied ? <Check /> : <Copy />}
          </button>
        </div>
      )}
    </div>
  );
}
