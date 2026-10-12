"use client";
import Link from "next/link";
import { useState } from "react";
import { CircleCheckBig, CircleDot, FileText, Inbox, LifeBuoy, Mail, MessageCircle, Search, Send, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { OrgChart, type OrgPerson } from "@/components/org-chart";
import { Secret } from "@/components/secret";
import { breakdown, daysIn, inr, monthLabel } from "@/lib/payroll";
import { fmtDate } from "@/lib/util";
import { EMPLOYEES, OFFICES, dept, office, today } from "@/lib/demo/data";
import { newId } from "@/lib/demo/store";
import { useIssues, usePayroll } from "@/lib/demo/shared";
import { useRole } from "@/lib/demo/use-role";
import { PageHeader } from "./ws-common";

export function WorkspaceDirectory() {
  const { me } = useRole("workspace");
  const [q, setQ] = useState("");
  const [off, setOff] = useState("");
  const term = q.trim().toLowerCase();
  // admins are reached via Report an issue
  const people = EMPLOYEES.filter((p) => p.role !== "admin" && (!off || p.office_id === off) && (!term || p.name.toLowerCase().includes(term) || p.email.toLowerCase().includes(term)));

  return (
    <>
      <PageHeader title="Directory" sub={`${people.length} people`} />
      <div className="space-y-6">
        <form className="flex flex-wrap gap-2" onSubmit={(e) => e.preventDefault()}>
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className="input pl-9" />
          </div>
          <select value={off} onChange={(e) => setOff(e.target.value)} className="input w-auto">
            <option value="">All offices</option>
            {OFFICES.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </form>
        {people.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {people.map((p) => {
              const d = dept(p.department_id)?.name;
              const o = office(p.office_id)?.name;
              return (
                <li key={p.id} className="card flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} size="size-12" />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{p.name}</div>
                      <div className="truncate text-sm text-muted">{p.designation}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {d && <span className="badge badge-teal">{d}</span>}
                    {o && <span className="badge">{o}</span>}
                  </div>
                  <div className="mt-auto flex gap-2">
                    <a href={`mailto:${p.email}`} className="btn flex-1" title={p.email}><Mail /> Email</a>
                    {p.id !== me.id && <Link href="/demo/chat" className="btn flex-1"><MessageCircle /> Message</Link>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty card"><Users /> No one matches that search.</p>
        )}
      </div>
    </>
  );
}

export function WorkspaceOrg() {
  const people: OrgPerson[] = EMPLOYEES.map((e) => ({
    id: e.id, full_name: e.name, designation: e.designation, avatar_url: null, reports_to: e.reports_to, role: e.role,
    department: e.department_id ? { name: dept(e.department_id)!.name } : null,
  }));
  return (
    <>
      <PageHeader title="Org chart" sub="Who reports to whom" />
      <OrgChart people={people} />
    </>
  );
}

// Own payslips from approved payroll runs of my office. Payslip id = "<run id>_<employee id>".
export function WorkspacePayslips() {
  const { me } = useRole("workspace");
  const [runs] = usePayroll();
  const slips = runs
    .filter((r) => r.status === "approved" && r.office_id === me.office_id)
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((r) => ({ id: `${r.id}_${me.id}`, month: r.month, pay: breakdown(me.ctc, { month: Number(r.month.slice(5, 7)), daysInMonth: daysIn(Number(r.month.slice(0, 4)), Number(r.month.slice(5, 7))) }) }));

  return (
    <>
      <PageHeader title="Payslips" sub="Monthly payslips once HR's salary sheet is approved." />
      <section className="card overflow-x-auto">
        {!slips.length ? <p className="text-sm text-muted">No payslips yet.</p> : (
          <Secret block label="payslip amounts">
            <table className="table">
              <thead><tr><th>Month</th><th className="text-right">Gross</th><th className="text-right">Net pay</th><th /></tr></thead>
              <tbody className="tabular-nums">
                {slips.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{monthLabel(s.month)}</td>
                    <td className="text-right">{inr(s.pay.gross)}</td>
                    <td className="text-right font-semibold">{inr(s.pay.net)}</td>
                    <td className="text-right"><Link href={`/demo/payslip/${s.id}`} className="btn btn-ghost"><FileText /> View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secret>
        )}
      </section>
    </>
  );
}

export function WorkspaceSupport() {
  const { me } = useRole("workspace");
  const [all, set] = useIssues();
  const issues = all.filter((i) => i.employee_id === me.id).sort((a, b) => b.created.localeCompare(a.created));

  return (
    <>
      <PageHeader title="Report an issue" sub="Questions or problems for the admin team. You'll see their reply here." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="card h-fit">
          <h2 className="h2"><LifeBuoy /> New report</h2>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              set((c) => [{ id: newId(), employee_id: me.id, title: String(fd.get("subject")).trim(), body: String(fd.get("body")).trim(), status: "open", created: today() }, ...c]);
              e.currentTarget.reset();
            }}
          >
            <label className="field">Subject<input name="subject" required maxLength={200} placeholder="e.g. Can't check in from the office" className="input" /></label>
            <label className="field">Details<textarea name="body" required rows={6} placeholder="What happened, and what did you expect?" className="input" /></label>
            <button className="btn btn-primary"><Send /> Send to admins</button>
          </form>
        </section>

        <section className="space-y-4">
          <h2 className="h2"><Inbox /> My reports</h2>
          {issues.map((i) => (
            <article key={i.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{i.title}</h3>
                  <p className="text-xs text-muted">Sent {fmtDate(i.created)}</p>
                </div>
                {i.status === "open" ? (
                  <span className="badge badge-amber"><CircleDot /> Open</span>
                ) : (
                  <span className="badge badge-green"><CircleCheckBig /> Resolved</span>
                )}
              </div>
              <p className="mt-3 text-sm whitespace-pre-wrap text-muted">{i.body}</p>
            </article>
          ))}
          {!issues.length && <p className="card empty"><Inbox /> Nothing reported yet.</p>}
        </section>
      </div>
    </>
  );
}
