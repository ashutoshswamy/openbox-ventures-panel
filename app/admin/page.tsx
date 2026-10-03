import Link from "next/link";
import { ArrowRight, Building2, Hourglass, Inbox, Plus, House, Palmtree, TriangleAlert, UserX } from "lucide-react";
import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { todayIn } from "@/lib/util";
import { PageHeader } from "@/components/shell";

export const metadata = { title: "Overview" };

const KINDS = [
  { key: "office", label: "In office", icon: Building2, bar: "bg-green", tone: "text-green" },
  { key: "wfh", label: "From home", icon: House, bar: "bg-blue", tone: "text-blue" },
  { key: "leave", label: "On leave", icon: Palmtree, bar: "bg-amber", tone: "text-amber" },
  { key: "absent", label: "Not checked in", icon: UserX, bar: "bg-line", tone: "text-muted" },
] as const;

export default async function AdminHome() {
  const me = await staffPage();
  const sb = db();
  let officesQ = sb.from("offices").select("id, name, timezone").order("name");
  if (me.role !== "admin") officesQ = officesQ.eq("id", me.office_id ?? "");
  const { data: offices } = await officesQ;
  const dates = [...new Set(offices?.map((o) => todayIn(o.timezone)) ?? [todayIn()])];

  const [{ data: people }, { data: rows }, { data: leaves }, { count: pending }] = await Promise.all([
    sb.from("employees").select("id, office_id").eq("active", true).not("clerk_user_id", "is", null).or("role.is.null,role.neq.admin"),
    sb.from("attendance_report").select("employee_id, office_id, date, mode, late").in("date", dates),
    sb.from("leave_requests").select("employee_id, start_date, end_date").eq("status", "approved").lte("start_date", dates.at(-1) ?? todayIn()).gte("end_date", dates[0] ?? todayIn()),
    sb.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending").neq("employee_id", me.id),
  ]);
  const { count: openIssues } = me.role === "admin" ? await sb.from("issues").select("id", { count: "exact", head: true }).eq("status", "open") : { count: 0 };

  const stats = (offices ?? []).map((o) => {
    const today = todayIn(o.timezone);
    const staff = people?.filter((p) => p.office_id === o.id) ?? [];
    const att = rows?.filter((r) => r.office_id === o.id && r.date === today) ?? [];
    const leave = staff.filter((p) => !att.some((a) => a.employee_id === p.id) && leaves?.some((l) => l.employee_id === p.id && l.start_date <= today && l.end_date >= today)).length;
    const office = att.filter((a) => a.mode === "office").length;
    const wfh = att.filter((a) => a.mode === "wfh").length;
    return { ...o, total: staff.length, office, wfh, leave, absent: Math.max(0, staff.length - att.length - leave), late: att.filter((a) => a.late).length };
  });
  const sum = (k: "office" | "wfh" | "leave" | "absent" | "late" | "total") => stats.reduce((n, s) => n + s[k], 0);

  return (
    <>
      <PageHeader
        title={me.role === "admin" ? "Today across OpenBox Ventures LLP" : `Today at ${offices?.[0]?.name ?? "your office"}`}
        sub={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {KINDS.map(({ key, label, icon: Icon, tone }) => (
            <div key={key} className="card p-4">
              <div className={`flex items-center gap-2 text-sm ${tone}`}><Icon className="size-4" /> {label}</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{sum(key)}</div>
            </div>
          ))}
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm text-amber"><TriangleAlert className="size-4" /> Late</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{sum("late")}</div>
          </div>
        </div>

        {!!pending && (
          <Link href="/admin/leave" className="card card-link flex items-center gap-4 border-amber/30 bg-amber-soft/40">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-soft text-amber"><Hourglass className="size-5" /></span>
            <span className="flex-1"><b>{pending}</b> leave request{pending > 1 ? "s" : ""} waiting for review</span>
            <ArrowRight className="size-5 text-muted" />
          </Link>
        )}

        {!!openIssues && (
          <Link href="/admin/issues" className="card card-link flex items-center gap-4">
            <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><Inbox className="size-5" /></span>
            <span className="flex-1"><b>{openIssues}</b> open issue{openIssues > 1 ? "s" : ""} reported by the team</span>
            <ArrowRight className="size-5 text-muted" />
          </Link>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {stats.map((s) => (
            <Link key={s.id} href={`/admin/attendance?office=${s.id}`} className="card card-link block">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold"><Building2 className="size-4 text-muted" /> {s.name}</h2>
                <span className="text-sm text-muted">{s.total} people</span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
                {KINDS.map(({ key, bar }) => (s.total && s[key] ? <div key={key} className={bar} style={{ width: `${(s[key] / s.total) * 100}%` }} /> : null))}
              </div>
              <dl className="mt-4 grid grid-cols-4 gap-2">
                {KINDS.map(({ key, label, bar }) => (
                  <div key={key}>
                    <dt className="flex items-center gap-1.5 text-xs text-muted"><span className={`size-2 rounded-full ${bar}`} />{label}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{s[key]}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          ))}
        </div>

        {!offices?.length && (
          <div className="card empty">
            <Building2 />
            {me.role === "admin" ? (
              <>No offices yet.<Link href="/admin/offices" className="btn btn-primary mt-2"><Plus /> Create your first office</Link></>
            ) : (
              "You're not assigned to an office yet. Ask an admin."
            )}
          </div>
        )}
      </div>
    </>
  );
}
