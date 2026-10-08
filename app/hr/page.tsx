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
    { href: "/hr/leave", label: "Open leave requests", n: leave, icon: CalendarDays },
    { href: "/hr/attendance", label: "Pending regularizations", n: regs, icon: ClockAlert },
  ];

  return (
    <>
      <PageHeader title="HR overview" sub={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map(({ href, label, n, icon: Icon }) => (
            <Link key={label} href={href} className="card card-link p-4">
              <div className="flex items-center gap-2 text-sm text-muted"><Icon className="size-4" /> {label}</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{n ?? 0}</div>
            </Link>
          ))}
        </div>

        <Link href="/hr/attendance" className="card card-link flex items-center gap-4">
          <span className="flex-1">
            Today: <b>{present.size}</b> present · <b>{away.size}</b> on leave · <b>{notIn}</b> not checked in
          </span>
          <ArrowRight className="size-5 text-muted" />
        </Link>
      </div>
    </>
  );
}
