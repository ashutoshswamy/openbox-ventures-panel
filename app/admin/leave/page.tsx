import Link from "next/link";
import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { LEAVE_TONE, fmtDate } from "@/lib/util";
import { CalendarCheck2, CalendarRange, Check, FileText, History, Settings2, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/shell";
import { reviewLeave } from "../actions";

export const metadata = { title: "Leave requests" };

type Req = {
  id: string; employee_id: string; start_date: string; end_date: string; days: number; half_day: boolean;
  reason: string | null; doc_path: string | null; status: string; review_note: string | null; leave_type_id: string;
  manager_note: string | null;
  employee: { full_name: string; avatar_url: string | null; role: string | null; office_id: string | null; department_id: string | null } | null;
  type: { name: string } | null; reviewer: { full_name: string } | null; manager: { full_name: string } | null;
};

const sel = "*, employee:employees!leave_requests_employee_id_fkey(full_name, avatar_url, role, office_id, department_id), reviewer:employees!leave_requests_reviewed_by_fkey(full_name), manager:employees!leave_requests_manager_reviewed_by_fkey(full_name), type:leave_types(name)";

const dates = (r: Req) => `${fmtDate(r.start_date)}${r.end_date !== r.start_date ? ` - ${fmtDate(r.end_date)}` : ""}${r.half_day ? " (half)" : ""}`;

export default async function AdminLeave() {
  const me = await staffPage();
  const sb = db();
  const year = `${new Date().getFullYear()}-01-01`;
  const [{ data: pending }, { data: recent }, { data: balances }, { data: heads }, { data: taken }] = await Promise.all([
    sb.from("leave_requests").select(sel).in("status", ["pending", "manager_approved"]).neq("employee_id", me.id).order("start_date"),
    sb.from("leave_requests").select(sel).not("status", "in", "(pending,manager_approved)").order("created_at", { ascending: false }).limit(30),
    sb.from("leave_balances").select("employee_id, leave_type_id, balance"),
    sb.from("employees").select("id, role, office_id, department_id").in("role", ["manager", "branch_head"]).eq("active", true),
    sb.from("leave_requests").select("employee_id, days").eq("status", "approved").gte("start_date", year),
  ]);
  // someone can give step 1: branch head of the office, or (employee leave) their department manager
  const hasFirst = (r: Req) => r.employee?.role !== "branch_head" && !!heads?.some((h) => h.id !== r.employee_id && h.office_id === r.employee?.office_id
    && (h.role === "branch_head" || (h.role === "manager" && r.employee?.role === "employee" && h.department_id === r.employee?.department_id)));
  const takenDays = (r: Req) => taken?.filter((t) => t.employee_id === r.employee_id).reduce((n, t) => n + Number(t.days), 0) ?? 0;
  // mirrors review_leave(): who may act on a request right now
  const canAct = (r: Req) => {
    const er = r.employee?.role;
    if (me.role === "admin") return true;
    if (me.role === "manager" || me.role === "branch_head")
      return r.status === "pending" && er !== "hr" && er !== "branch_head" && (me.role === "branch_head" || er !== "manager");
    if (er === "hr") return false;
    return r.status === "manager_approved" || !hasFirst(r);
  };
  const final = me.role !== "manager" && me.role !== "branch_head";
  const actionable = pending?.filter(canAct).length ?? 0;
  const bal = (r: Req) => balances?.find((b) => b.employee_id === r.employee_id && b.leave_type_id === r.leave_type_id)?.balance;

  return (
    <>
      <PageHeader title="Leave requests" sub={`${actionable} waiting for your review`}>
        {me.role === "admin" && <Link href="/admin/leave/policy" className="btn"><Settings2 /> Policy & holidays</Link>}
      </PageHeader>

      <div className="space-y-6">
        <section className="space-y-4">
          {pending?.map((r: Req) => (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-start gap-4">
                <Avatar name={r.employee?.full_name ?? "?"} src={r.employee?.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{r.employee?.full_name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                    <span className="badge badge-teal">{r.type?.name}</span>
                    <span className="flex items-center gap-1"><CalendarRange className="size-3.5" /> {dates(r)}</span>
                    <span className="tabular-nums">{Number(r.days)} day{Number(r.days) === 1 ? "" : "s"}</span>
                    <span className={`badge ${LEAVE_TONE[r.status]}`}>
                      {r.status === "pending" ? "Waiting for manager" : `Manager approved by ${r.manager?.full_name ?? "manager"} - needs HR`}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted">Available</div>
                  <div className="text-xl font-semibold tabular-nums">{bal(r) != null ? Number(bal(r)) : "-"}</div>
                </div>
              </div>
              {me.role === "hr" && (
                <div className="mt-3 text-sm text-muted">
                  HR details: {Number(takenDays(r))} day{takenDays(r) === 1 ? "" : "s"} taken this year
                  {r.manager_note && <> · Manager note: <span className="text-text">{r.manager_note}</span></>}
                </div>
              )}
              {(r.reason || r.doc_path) && (
                <div className="mt-4 rounded-xl bg-surface-2/70 p-3 text-sm">
                  {r.reason && <p className="whitespace-pre-wrap">{r.reason}</p>}
                  {r.doc_path && <a href={`/files/leave/${r.id}`} target="_blank" className="mt-1 inline-flex items-center gap-1.5 font-medium text-primary"><FileText className="size-4" /> View document</a>}
                </div>
              )}
              {canAct(r) && (
              <ActionForm action={reviewLeave} className="mt-4 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={r.id} />
                <input name="review_note" placeholder="Add a note (optional)" className="input w-auto min-w-48 flex-1" />
                <button name="status" value="rejected" className="btn btn-danger"><X /> Reject</button>
                <button name="status" value="approved" className="btn btn-primary"><Check /> {final ? "Final approve" : "Approve"}</button>
              </ActionForm>
              )}
            </div>
          ))}
          {!pending?.length && <p className="card empty"><CalendarCheck2 /> You&apos;re all caught up. No requests to review.</p>}
        </section>

        <section className="card overflow-x-auto">
          <h2 className="h2"><History /> Recent decisions</h2>
          <table className="table">
            <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Reviewed by</th></tr></thead>
            <tbody>
              {recent?.map((r: Req) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.employee?.full_name}</td><td>{r.type?.name}</td><td>{dates(r)}</td><td className="tabular-nums">{Number(r.days)}</td>
                  <td><span className={`badge capitalize ${LEAVE_TONE[r.status]}`}>{r.status.replace("_", " ")}</span></td>
                  <td className="text-sm text-muted">{r.reviewer?.full_name ?? "-"}{r.review_note && <span className="block text-xs">{r.review_note}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recent?.length && <p className="empty"><History /> No decisions yet.</p>}
        </section>
      </div>
    </>
  );
}
