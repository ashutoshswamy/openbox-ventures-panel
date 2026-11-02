import Link from "next/link";
import { ArrowRight, CalendarDays, ClockAlert, LogOut, UserPlus, Users } from "lucide-react";
import { hrPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { todayIn } from "@/lib/util";
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
    sb.from("attendance_report").select("employee_id").eq("date", today),
    sb.from("leave_requests").select("employee_id").eq("status", "approved").lte("start_date", today).gte("end_date", today),
  ]);
  const present = new Set(att?.map((a) => a.employee_id));
  const away = new Set(onLeave?.map((l) => l.employee_id).filter((id) => !present.has(id)));
  const notIn = Math.max(0, (headcount ?? 0) - present.size - away.size);

  const cards = [
    { href: "/hr/employees", label: "Active headcount", n: headcount, icon: Users },
    { href: "/hr/employees", label: "Joined this month", n: joiners, icon: UserPlus },
    { href: "/hr/employees", label: "Exits in 30 days", n: exits, icon: LogOut },
    { href: "/hr/leave", label: "Open leave requests", n: leave, icon: CalendarDays, warn: true },
    { href: "/hr/attendance", label: "Pending regularizations", n: regs, icon: ClockAlert, warn: true },
  ];

  return (
    <>
      <PageHeader title="HR overview" sub={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
      <div className="space-y-6">
        <Link href="/hr/attendance" className="card card-link block rounded-3xl bg-ink p-6 text-ink-text md:p-8">
          <p className="text-sm font-medium opacity-60">Checked in today</p>
          <p className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span className="text-6xl font-semibold tracking-[-0.04em] md:text-7xl">{present.size}</span>
            <span className="text-2xl opacity-50">/ {headcount ?? 0}</span>
          </p>
          <div className="mt-6 flex h-3 gap-0.5 overflow-hidden rounded-full bg-ink-text/10">
            {[[present.size, "bg-green"], [away.size, "bg-amber"], [notIn, "bg-line"]].map(([n, bar]) => (headcount && n ? <div key={bar as string} className={`${bar} first:rounded-l-full last:rounded-r-full`} style={{ width: `${((n as number) / headcount) * 100}%` }} /> : null))}
          </div>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm opacity-70">
            <span><b>{present.size}</b> present</span><span><b>{away.size}</b> on leave</span><span><b>{notIn}</b> not checked in</span>
          </p>
        </Link>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map(({ href, label, n, icon: Icon, warn }) => (
            <Link key={label} href={href} className="card card-link group p-4">
              <span className={`grid size-9 place-items-center rounded-xl ${warn && n ? "bg-amber-soft text-amber" : "bg-primary-soft text-text"}`}><Icon className="size-4" /></span>
              <div className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{n ?? 0}</div>
              <div className="mt-0.5 flex items-center justify-between text-sm text-muted">{label}<ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" /></div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
