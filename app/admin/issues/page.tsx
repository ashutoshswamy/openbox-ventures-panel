import Link from "next/link";
import { Check, CircleCheckBig, CircleDot, Inbox, RotateCcw, Save } from "lucide-react";
import { adminPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate } from "@/lib/util";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/shell";
import { setIssueStatus } from "../actions";

export const metadata = { title: "Issues" };

type Issue = {
  id: string; subject: string; body: string; status: "open" | "resolved"; admin_note: string | null; created_at: string; resolved_at: string | null;
  reporter: { full_name: string; email: string; designation: string | null; avatar_url: string | null } | null; resolver: { full_name: string } | null;
};

export default async function Issues({ searchParams }: PageProps<"/admin/issues">) {
  await adminPage();
  const status = (await searchParams).status === "resolved" ? "resolved" : "open";
  const sb = db();
  const [{ data }, { count: openCount }] = await Promise.all([
    sb
      .from("issues")
      .select("*, reporter:employees!issues_employee_id_fkey(full_name, email, designation, avatar_url), resolver:employees!issues_resolved_by_fkey(full_name)")
      .eq("status", status)
      .order(status === "open" ? "created_at" : "resolved_at", { ascending: status === "open" })
      .limit(100),
    sb.from("issues").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const issues = (data ?? []) as Issue[];
  const tab = (s: string, label: string) => (
    <Link href={`/admin/issues?status=${s}`} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${status === s ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"}`}>
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader title="Issues" sub="Reports sent by employees and managers.">
        <div className="flex rounded-xl bg-surface-2 p-1">{tab("open", `Open (${openCount ?? 0})`)}{tab("resolved", "Resolved")}</div>
      </PageHeader>
      <div className="max-w-4xl space-y-4">
        {issues.map((i) => (
          <article key={i.id} className="card">
            <div className="flex flex-wrap items-start gap-3">
              <Avatar name={i.reporter?.full_name ?? "?"} src={i.reporter?.avatar_url} />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{i.subject}</h2>
                <p className="text-sm text-muted">
                  {i.reporter?.full_name}{i.reporter?.designation && ` · ${i.reporter.designation}`} ·{" "}
                  <a href={`mailto:${i.reporter?.email}`} className="hover:text-text">{i.reporter?.email}</a> · {fmtDate(i.created_at.slice(0, 10))}
                </p>
              </div>
              {i.status === "open" ? (
                <span className="badge badge-amber"><CircleDot /> Open</span>
              ) : (
                <span className="badge badge-green"><CircleCheckBig /> Resolved{i.resolver && ` by ${i.resolver.full_name}`}</span>
              )}
            </div>
            <p className="mt-4 rounded-xl bg-surface-2/70 p-3 text-sm whitespace-pre-wrap">{i.body}</p>
            <ActionForm action={setIssueStatus} keep className="mt-4 space-y-3">
              <input type="hidden" name="id" value={i.id} />
              <textarea name="admin_note" rows={2} defaultValue={i.admin_note ?? ""} placeholder="Reply to the reporter (optional)" className="input" />
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
        ))}
        {!issues.length && <p className="card empty"><Inbox /> {status === "open" ? "No open issues. All clear." : "No resolved issues yet."}</p>}
      </div>
    </>
  );
}
