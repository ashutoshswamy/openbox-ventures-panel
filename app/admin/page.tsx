import Link from "next/link";
import { ArrowRight, Building2, Clock, Hourglass, Inbox, Plus, House, Palmtree, UserX } from "lucide-react";
import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { todayIn } from "@/lib/util";
import { onShift, shiftDay } from "@/lib/calendar";
import { pendingCounts } from "@/lib/pending";
import { PageHeader } from "@/components/shell";
import { CountUp } from "@/components/count-up";

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

  const [{ data: people }, { data: rows }, { data: leaves }, { count: pending }, stale, { count: openIssues }] = await Promise.all([
    sb.from("employees").select("id, office_id").eq("active", true).not("clerk_user_id", "is", null).or("role.is.null,role.neq.admin"),
    sb.from("attendance_report").select("employee_id, office_id, date, mode, late, check_in_at, check_out_at").in("date", dates.flatMap((d) => [d, shiftDay(d, -1)])),
    sb.from("leave_requests").select("employee_id, start_date, end_date").eq("status", "approved").lte("start_date", dates.at(-1) ?? todayIn()).gte("end_date", dates[0] ?? todayIn()),
    sb.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending").neq("employee_id", me.id),
    pendingCounts(sb, me.id, 24),
    me.role === "admin" ? sb.from("issues").select("id", { count: "exact", head: true }).eq("status", "open") : { count: 0 },
  ]);

  const stats = (offices ?? []).map((o) => {
    const today = todayIn(o.timezone);
    const staff = people?.filter((p) => p.office_id === o.id) ?? [];
    const att = rows?.filter((r) => r.office_id === o.id && onShift(r, today)) ?? [];
    const leave = staff.filter((p) => !att.some((a) => a.employee_id === p.id) && leaves?.some((l) => l.employee_id === p.id && l.start_date <= today && l.end_date >= today)).length;
    const office = att.filter((a) => a.mode === "office").length;
    const wfh = att.filter((a) => a.mode === "wfh").length;
    return { ...o, total: staff.length, office, wfh, leave, absent: Math.max(0, staff.length - att.length - leave), late: att.filter((a) => a.late).length };
  });
  const sum = (k: "office" | "wfh" | "leave" | "absent" | "late" | "total") => stats.reduce((n, s) => n + s[k], 0);
  const present = sum("office") + sum("wfh");
  const todo = [
    { href: "/admin/leave", icon: Hourglass, n: pending ?? 0, text: "leave requests to review", stale: stale.leave > 0 },
    { href: "/admin/attendance", icon: Clock, n: stale.regularizations, text: "regularizations waiting", stale: true },
    { href: "/admin/issues", icon: Inbox, n: openIssues ?? 0, text: "open issues from the team", stale: false },
  ].filter((t) => t.n > 0);

  return (
    <>
      <PageHeader
        title={me.role === "admin" ? "Today across Open Box Ventures LLP" : `Today at ${offices?.[0]?.name ?? "your office"}`}
        sub={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      />

      <div className="space-y-8">
        <section aria-label="Today at a glance">
          <p className="max-w-2xl text-2xl leading-snug font-semibold tracking-[-0.02em] text-balance md:text-[28px]">
            <CountUp value={present} /> of <CountUp value={sum("total")} /> people are in.{" "}
            <span className="text-muted">
              {sum("absent") > 0 ? <><CountUp value={sum("absent")} /> haven&apos;t checked in</> : "Everyone has checked in"}
              {sum("leave") > 0 && <>, <CountUp value={sum("leave")} /> on leave</>}
              {sum("late") > 0 && <>, <CountUp value={sum("late")} /> late</>}.
            </span>
          </p>
          <div className="meter mt-5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={KINDS.map((k) => `${sum(k.key)} ${k.label.toLowerCase()}`).join(", ")}>
            {KINDS.map(({ key, bar }) => (sum("total") && sum(key) ? <div key={key} className={bar} style={{ width: `${(sum(key) / sum("total")) * 100}%` }} /> : null))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            {KINDS.map(({ key, label, bar }) => (
              <li key={key} className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${bar}`} /><b className="font-semibold text-text tabular-nums"><CountUp value={sum(key)} /></b> {label.toLowerCase()}</li>
            ))}
          </ul>
        </section>

        {todo.length > 0 && (
          <section>
            <h2 className="h2">Waiting on you</h2>
            <ul className="card divide-y divide-line p-0">
              {todo.map(({ href, icon: Icon, n, text, stale: old }) => (
                <li key={text}>
                  <Link href={href} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/60">
                    <Icon className={`size-4 shrink-0 ${old ? "text-amber" : "text-muted"}`} />
                    <span className="flex-1 text-sm"><b className="font-semibold tabular-nums">{n}</b> {text}</span>
                    {old && <span className="badge badge-amber">Over 24 h</span>}
                    <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {stats.length > 0 && (
          <section>
            <h2 className="h2">Offices</h2>
            <ul className="card divide-y divide-line p-0">
              {stats.map((s) => {
                const here = s.office + s.wfh;
                return (
                  <li key={s.id}>
                    <Link href={`/admin/attendance?office=${s.id}`} className="grid gap-x-6 gap-y-3 px-5 py-4 transition-colors hover:bg-surface-2/60 md:grid-cols-[11rem_1fr_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{s.name}</div>
                        <div className="text-xs text-muted tabular-nums">{here} of {s.total} in{s.late > 0 && `, ${s.late} late`}</div>
                      </div>
                      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${here} of ${s.total} in`}>
                        {KINDS.map(({ key, bar }) => (s.total && s[key] ? <div key={key} className={bar} style={{ width: `${(s[key] / s.total) * 100}%` }} /> : null))}
                      </div>
                      <dl className="flex gap-4 text-xs text-muted tabular-nums md:w-56 md:justify-end">
                        {KINDS.map(({ key, label, bar }) => (
                          <div key={key} title={label} className="flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${bar}`} /><dd className="font-semibold text-text"><CountUp value={s[key]} /></dd></div>
                        ))}
                      </dl>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

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
