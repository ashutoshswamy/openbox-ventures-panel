import Link from "next/link";
import { ArrowRight, CalendarDays, ClockAlert, LogOut, UserPlus, Users } from "lucide-react";
import { hrPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { todayIn } from "@/lib/util";
import { onShift, shiftDay } from "@/lib/calendar";
import { PageHeader } from "@/components/shell";

export const metadata = { title: "Overview" };

const OPEN = "(approved,rejected,cancelled)";

export default async function HrHome() {
  const me = await hrPage();
  const sb = db(); // RLS scopes everything to HR's office
  const today = todayIn();
  const monthStart = today.slice(0, 8) + "01";
  const in30 = new Date(Date.parse(today) + 30 * 864e5).toISOString().slice(0, 10);
  const head = { count: "exact", head: true } as const;
  const staff = () => sb.from("employees").select("id", head).eq("active", true).not("clerk_user_id", "is", null).or("role.is.null,role.neq.admin");

  const [{ count: headcount }, { count: joiners }, { count: exits }, { count: leave }, { count: regs }, { data: att }, { data: onLeave }] = await Promise.all([
    staff(),
    staff().gte("joined_on", monthStart),
    staff().gte("exit_date", today).lte("exit_date", in30),
    sb.from("leave_requests").select("id", head).not("status", "in", OPEN).neq("employee_id", me.id),
    sb.from("regularizations").select("id", head).eq("status", "pending").neq("employee_id", me.id),
    sb.from("attendance_report").select("employee_id, date, check_in_at, check_out_at").in("date", [today, shiftDay(today, -1)]),
    sb.from("leave_requests").select("employee_id").eq("status", "approved").lte("start_date", today).gte("end_date", today),
  ]);
  const present = new Set(att?.filter((a) => onShift(a, today)).map((a) => a.employee_id));
  const away = new Set(onLeave?.map((l) => l.employee_id).filter((id) => !present.has(id)));
  const notIn = Math.max(0, (headcount ?? 0) - present.size - away.size);

  const queues = [
    { href: "/hr/leave", label: "Open leave requests", n: leave, icon: CalendarDays },
    { href: "/hr/attendance", label: "Pending regularizations", n: regs, icon: ClockAlert },
  ];
  const people = [
    { href: "/hr/employees", label: "Active headcount", n: headcount, icon: Users },
    { href: "/hr/employees", label: "Joined this month", n: joiners, icon: UserPlus },
    { href: "/hr/employees", label: "Exits in 30 days", n: exits, icon: LogOut },
  ];

  return (
    <>
      <PageHeader title="HR overview" sub={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
      <div className="space-y-8">
        <Link href="/hr/attendance" className="group block" aria-label="Open today's attendance">
          <p className="max-w-2xl text-2xl leading-snug font-semibold tracking-[-0.02em] text-balance md:text-[28px]">
            <span className="tabular-nums">{present.size}</span> of <span className="tabular-nums">{headcount ?? 0}</span> people are in.{" "}
            <span className="text-muted">{notIn > 0 ? `${notIn} haven't checked in` : "Everyone has checked in"}{away.size > 0 && `, ${away.size} on leave`}.</span>
          </p>
          <div className="mt-5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${present.size} present, ${away.size} on leave, ${notIn} not checked in`}>
            {[[present.size, "bg-green"], [away.size, "bg-amber"], [notIn, "bg-line"]].map(([n, bar]) => (headcount && n ? <div key={bar as string} className={bar as string} style={{ width: `${((n as number) / headcount) * 100}%` }} /> : null))}
          </div>
        </Link>

        <section>
          <h2 className="h2">Waiting on you</h2>
          <ul className="card divide-y divide-line p-0">
            {queues.map(({ href, label, n, icon: Icon }) => (
              <li key={label}>
                <Link href={href} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/60">
                  <Icon className={`size-4 shrink-0 ${n ? "text-amber" : "text-muted"}`} />
                  <span className="flex-1 text-sm">{label}</span>
                  <span className={`badge ${n ? "badge-amber" : ""} tabular-nums`}>{n ?? 0}</span>
                  <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="h2">People</h2>
          <div className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface">
            {people.map(({ href, label, n, icon: Icon }) => (
              <Link key={label} href={href} className="px-5 py-4 transition-colors first:rounded-l-2xl last:rounded-r-2xl hover:bg-surface-2/60">
                <dl>
                  <dt className="flex items-center gap-1.5 text-xs text-muted"><Icon className="size-3.5" /> {label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{n ?? 0}</dd>
                </dl>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
