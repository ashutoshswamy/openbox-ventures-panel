"use client";
import { useState } from "react";
import { Check, CircleCheckBig, CircleDot, Inbox, RotateCcw, Save } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader, useAdm } from "@/components/demo/adm-ui";
import { emp } from "@/lib/demo/data";
import { useIssues } from "@/lib/demo/shared";
import { useDemo } from "@/lib/demo/store";
import { fmtDate, str } from "@/lib/util";

export default function Issues() {
  const { me, log } = useAdm();
  const [all, setIssues] = useIssues();
  const [notes, setNotes] = useDemo<Record<string, { note: string; by: string }>>("adm:issuenotes", () => ({ i2: { note: "Fixed in the latest release.", by: "e1" } }));
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const issues = all.filter((i) => i.status === status).sort((a, b) => (status === "open" ? a.created.localeCompare(b.created) : b.created.localeCompare(a.created)));
  const openCount = all.filter((i) => i.status === "open").length;

  const tab = (s: "open" | "resolved", label: string) => (
    <button onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${status === s ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"}`}>{label}</button>
  );

  return (
    <>
      <PageHeader title="Issues" sub="Reports sent by employees and managers.">
        <div className="flex rounded-xl bg-surface-2 p-1">{tab("open", `Open (${openCount})`)}{tab("resolved", "Resolved")}</div>
      </PageHeader>
      <div className="max-w-4xl space-y-4">
        {issues.map((i) => {
          const r = emp(i.employee_id);
          const n = notes[i.id];
          return (
            <article key={i.id} className="card">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar name={r.name} src={null} />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{i.title}</h2>
                  <p className="text-sm text-muted">
                    {r.name} · {r.designation} · <a href={`mailto:${r.email}`} className="hover:text-text">{r.email}</a> · {fmtDate(i.created)}
                  </p>
                </div>
                {i.status === "open" ? (
                  <span className="badge badge-amber"><CircleDot /> Open</span>
                ) : (
                  <span className="badge badge-green"><CircleCheckBig /> Resolved{n && ` by ${emp(n.by).name}`}</span>
                )}
              </div>
              <p className="mt-4 rounded-xl bg-surface-2/70 p-3 text-sm whitespace-pre-wrap">{i.body}</p>
              <ActionForm
                action={async (fd) => {
                  const next = (fd.get("status") as "open" | "resolved") ?? i.status;
                  setNotes((m) => ({ ...m, [i.id]: { note: str(fd, "admin_note") ?? "", by: me.id } }));
                  if (next !== i.status) {
                    setIssues((l) => l.map((x) => (x.id === i.id ? { ...x, status: next } : x)));
                    log(next === "resolved" ? "Resolved issue" : "Reopened issue", i.title);
                  }
                }}
                keep className="mt-4 space-y-3"
              >
                <textarea name="admin_note" rows={2} defaultValue={n?.note ?? ""} placeholder="Reply to the reporter (optional)" className="input" />
                <div className="flex flex-wrap justify-end gap-2">
                  {i.status === "open" ? (
                    <>
                      <button name="status" value="open" className="btn"><Save /> Save reply</button>
                      <button name="status" value="resolved" className="btn btn-primary"><Check /> Mark resolved</button>
                    </>
                  ) : (
                    <>
                      <button name="status" value="resolved" className="btn"><Save /> Update reply</button>
                      <button name="status" value="open" className="btn"><RotateCcw /> Reopen</button>
                    </>
                  )}
                </div>
              </ActionForm>
            </article>
          );
        })}
        {!issues.length && <p className="card empty"><Inbox /> {status === "open" ? "No open issues. All clear." : "No resolved issues yet."}</p>}
      </div>
    </>
  );
}
