"use client";
import Link from "next/link";
import { CalendarCheck2, CalendarRange, Check, History, Settings2, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader, useAdm } from "@/components/demo/adm-ui";
import { useLeaveReviews } from "@/lib/demo/admin";
import { LEAVE_TYPES, emp } from "@/lib/demo/data";
import { useLeave, type LeaveReq } from "@/lib/demo/shared";
import { LEAVE_TONE, fmtDate, str } from "@/lib/util";

const dates = (r: LeaveReq) => `${fmtDate(r.from)}${r.to !== r.from ? ` - ${fmtDate(r.to)}` : ""}`;

export default function AdminLeave() {
  const { me, isAdmin, inScope, log } = useAdm();
  const [leaves, setLeaves] = useLeave();
  const [reviews, setReviews] = useLeaveReviews();
  const year = new Date().getFullYear().toString();

  const mine = leaves.filter((r) => r.employee_id !== me.id && (isAdmin || inScope(emp(r.employee_id))));
  const pending = mine.filter((r) => r.status === "pending" || r.status === "manager_approved").sort((a, b) => a.from.localeCompare(b.from));
  const recent = leaves.filter((r) => !["pending", "manager_approved"].includes(r.status) && (isAdmin || inScope(emp(r.employee_id)))).slice().reverse().slice(0, 30);
  // mirrors review_leave(): who may act on a request right now
  const canAct = (r: LeaveReq) => isAdmin || (r.status === "pending" && emp(r.employee_id).role === "employee");
  const actionable = pending.filter(canAct).length;
  const bal = (r: LeaveReq) =>
    (LEAVE_TYPES.find((t) => t.id === r.type_id)?.entitled ?? 0) - leaves.filter((l) => l.employee_id === r.employee_id && l.type_id === r.type_id && l.status === "approved" && l.from.startsWith(year)).reduce((n, l) => n + l.days, 0);

  const decide = async (r: LeaveReq, status: "approved" | "rejected", fd: FormData) => {
    const next = status === "rejected" ? "rejected" : isAdmin ? "approved" : "manager_approved";
    setLeaves((l) => l.map((x) => (x.id === r.id ? { ...x, status: next } : x)));
    setReviews((m) => ({ ...m, [r.id]: { by: me.id, note: str(fd, "review_note") ?? "" } }));
    log(next === "approved" ? "Approved leave" : next === "rejected" ? "Rejected leave" : "Manager-approved leave", emp(r.employee_id).name);
  };

  return (
    <>
      <PageHeader title="Leave requests" sub={`${actionable} waiting for your review`}>
        {isAdmin && <Link href="/demo/admin/leave/policy" className="btn"><Settings2 /> Policy & holidays</Link>}
      </PageHeader>

      <div className="space-y-6">
        <section className="space-y-4">
          {pending.map((r) => {
            const e = emp(r.employee_id);
            return (
              <div key={r.id} className="card">
                <div className="flex flex-wrap items-start gap-4">
                  <Avatar name={e.name} src={null} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{e.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      <span className="badge badge-teal">{LEAVE_TYPES.find((t) => t.id === r.type_id)?.name}</span>
                      <span className="flex items-center gap-1"><CalendarRange className="size-3.5" /> {dates(r)}</span>
                      <span className="tabular-nums">{r.days} day{r.days === 1 ? "" : "s"}</span>
                      <span className={`badge ${LEAVE_TONE[r.status]}`}>
                        {r.status === "pending" ? "Waiting for manager" : `Manager approved by ${(e.reports_to && emp(e.reports_to).name) || "manager"} - needs HR`}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted">Available</div>
                    <div className="text-xl font-semibold tabular-nums">{bal(r)}</div>
                  </div>
                </div>
                {r.reason && (
                  <div className="mt-4 rounded-xl bg-surface-2/70 p-3 text-sm"><p className="whitespace-pre-wrap">{r.reason}</p></div>
                )}
                {canAct(r) && (
                  <ActionForm action={async (fd) => decide(r, (fd.get("status") as "approved" | "rejected") ?? "approved", fd)} className="mt-4 flex flex-wrap gap-2">
                    <input name="review_note" placeholder="Add a note (optional)" className="input w-auto min-w-48 flex-1" />
                    <button name="status" value="rejected" className="btn btn-danger"><X /> Reject</button>
                    <button name="status" value="approved" className="btn btn-primary"><Check /> {isAdmin ? "Final approve" : "Approve"}</button>
                  </ActionForm>
                )}
              </div>
            );
          })}
          {!pending.length && <p className="card empty"><CalendarCheck2 /> You&apos;re all caught up. No requests to review.</p>}
        </section>

        <section className="card overflow-x-auto">
          <h2 className="h2"><History /> Recent decisions</h2>
          <table className="table">
            <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Reviewed by</th></tr></thead>
            <tbody>
              {recent.map((r) => {
                const rv = reviews[r.id];
                return (
                  <tr key={r.id}>
                    <td className="font-medium">{emp(r.employee_id).name}</td><td>{LEAVE_TYPES.find((t) => t.id === r.type_id)?.name}</td><td>{dates(r)}</td><td className="tabular-nums">{r.days}</td>
                    <td><span className={`badge capitalize ${LEAVE_TONE[r.status]}`}>{r.status.replace("_", " ")}</span></td>
                    <td className="text-sm text-muted">{rv ? emp(rv.by).name : "-"}{rv?.note && <span className="block text-xs">{rv.note}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!recent.length && <p className="empty"><History /> No decisions yet.</p>}
        </section>
      </div>
    </>
  );
}
