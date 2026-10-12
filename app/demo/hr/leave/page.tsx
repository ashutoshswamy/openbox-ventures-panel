"use client";
import { CalendarCheck2, CalendarRange, History } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { EMPLOYEES, LEAVE_TYPES, emp, today } from "@/lib/demo/data";
import { HR_OFFICE, useReviews } from "@/lib/demo/hr";
import { useLeave, type LeaveReq } from "@/lib/demo/shared";
import { useRole } from "@/lib/demo/use-role";
import { LEAVE_TONE, fmtDate } from "@/lib/util";
import { PageHeader, ReviewForm, useLog } from "../_parts";

const dates = (r: LeaveReq) => `${fmtDate(r.from)}${r.to !== r.from ? ` - ${fmtDate(r.to)}` : ""}`;
const typeName = (id: string) => LEAVE_TYPES.find((t) => t.id === id)?.name;

export default function HrLeave() {
  const { me } = useRole("hr");
  const [leave, setLeave] = useLeave();
  const [reviews, setReviews] = useReviews();
  const log = useLog();
  const mine = leave.filter((l) => emp(l.employee_id).office_id === HR_OFFICE);
  const pending = mine.filter((l) => (l.status === "pending" || l.status === "manager_approved") && l.employee_id !== me.id).sort((a, b) => a.from.localeCompare(b.from));
  const recent = mine.filter((l) => l.status !== "pending" && l.status !== "manager_approved").sort((a, b) => b.applied_on.localeCompare(a.applied_on)).slice(0, 30);
  const year = today().slice(0, 4);

  // someone can give step 1: the department manager (employee leave only)
  const hasFirst = (r: LeaveReq) => {
    const e = emp(r.employee_id);
    return e.role === "employee" && EMPLOYEES.some((h) => h.role === "manager" && h.office_id === e.office_id && h.department_id === e.department_id);
  };
  // mirrors review_leave() for HR: HR leave can't be actioned by HR; otherwise after the manager, or when there is no manager
  const canAct = (r: LeaveReq) => emp(r.employee_id).role !== "hr" && (r.status === "manager_approved" || !hasFirst(r));
  const taken = (id: string, type?: string) => leave.filter((l) => l.status === "approved" && l.employee_id === id && l.from >= `${year}-01-01` && (!type || l.type_id === type)).reduce((n, l) => n + l.days, 0);
  const balance = (r: LeaveReq) => (LEAVE_TYPES.find((t) => t.id === r.type_id)?.entitled ?? 0) - taken(r.employee_id, r.type_id);

  const decide = (r: LeaveReq, approved: boolean, note: string) => {
    setLeave((l) => l.map((x) => (x.id === r.id ? { ...x, status: approved ? "approved" : "rejected" } : x)));
    setReviews((v) => ({ ...v, [r.id]: { by: me.id, note } }));
    log(approved ? "Approved leave" : "Rejected leave", emp(r.employee_id).name);
  };

  return (
    <>
      <PageHeader title="Leave requests" sub={`${pending.filter(canAct).length} waiting for your review`} />
      <div className="space-y-6">
        <section className="space-y-4">
          {pending.map((r) => {
            const e = emp(r.employee_id);
            const t = taken(r.employee_id);
            return (
              <div key={r.id} className="card">
                <div className="flex flex-wrap items-start gap-4">
                  <Avatar name={e.name} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{e.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      <span className="badge badge-teal">{typeName(r.type_id)}</span>
                      <span className="flex items-center gap-1"><CalendarRange className="size-3.5" /> {dates(r)}</span>
                      <span className="tabular-nums">{r.days} day{r.days === 1 ? "" : "s"}</span>
                      <span className={`badge ${LEAVE_TONE[r.status]}`}>
                        {r.status === "pending" ? "Waiting for manager" : `Manager approved by ${e.reports_to ? emp(e.reports_to).name : "manager"} - needs HR`}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted">Available</div>
                    <div className="text-xl font-semibold tabular-nums">{balance(r)}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-muted">HR details: {t} day{t === 1 ? "" : "s"} taken this year</div>
                {r.reason && <div className="mt-4 rounded-xl bg-surface-2/70 p-3 text-sm"><p className="whitespace-pre-wrap">{r.reason}</p></div>}
                {canAct(r) && <ReviewForm approveLabel="Final approve" onDecide={(a, n) => decide(r, a, n)} />}
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
                const v = reviews[r.id];
                return (
                  <tr key={r.id}>
                    <td className="font-medium">{emp(r.employee_id).name}</td><td>{typeName(r.type_id)}</td><td>{dates(r)}</td><td className="tabular-nums">{r.days}</td>
                    <td><span className={`badge capitalize ${LEAVE_TONE[r.status]}`}>{r.status.replace("_", " ")}</span></td>
                    <td className="text-sm text-muted">{v ? emp(v.by).name : "-"}{v?.note && <span className="block text-xs">{v.note}</span>}</td>
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
