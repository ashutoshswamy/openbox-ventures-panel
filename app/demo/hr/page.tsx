"use client";
import Link from "next/link";
import { ArrowRight, CalendarDays, ClockAlert, LogOut, UserPlus, Users } from "lucide-react";
import { today } from "@/lib/demo/data";
import { HR_OFFICE, isStaff, useAllAttendance, useHrEmployees, useLeaveOn } from "@/lib/demo/hr";
import { useLeave, useRegularizations } from "@/lib/demo/shared";
import { useRole } from "@/lib/demo/use-role";
import { PageHeader } from "./_parts";

export default function HrHome() {
  const { me } = useRole("hr");
  const [emps] = useHrEmployees();
  const [leave] = useLeave();
  const [regs] = useRegularizations();
  const { rows } = useAllAttendance();
  const onLeave = useLeaveOn();
  const t = today();
  const in30 = new Date(Date.parse(t) + 30 * 864e5).toISOString().slice(0, 10);
  const staff = emps.filter(isStaff);
  const inOffice = (id: string) => emps.find((e) => e.id === id)?.office_id === HR_OFFICE;
  const present = new Set(rows.filter((r) => r.date === t).map((r) => r.employee_id));
  const away = staff.filter((e) => !present.has(e.id) && onLeave(e.id, t));
  const notIn = Math.max(0, staff.length - present.size - away.length);

  const cards = [
    { href: "/demo/hr/employees", label: "Active headcount", n: staff.length, icon: Users },
    { href: "/demo/hr/employees", label: "Joined this month", n: staff.filter((e) => e.joined_on >= t.slice(0, 8) + "01").length, icon: UserPlus },
    { href: "/demo/hr/employees", label: "Exits in 30 days", n: staff.filter((e) => e.exit_date && e.exit_date >= t && e.exit_date <= in30).length, icon: LogOut },
    { href: "/demo/hr/leave", label: "Open leave requests", n: leave.filter((l) => (l.status === "pending" || l.status === "manager_approved") && l.employee_id !== me.id && inOffice(l.employee_id)).length, icon: CalendarDays },
    { href: "/demo/hr/attendance", label: "Pending regularizations", n: regs.filter((r) => r.status === "pending" && r.employee_id !== me.id && inOffice(r.employee_id)).length, icon: ClockAlert },
  ];

  return (
    <>
      <PageHeader title="HR overview" sub={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map(({ href, label, n, icon: Icon }) => (
            <Link key={label} href={href} className="card card-link p-4">
              <div className="flex items-center gap-2 text-sm text-muted"><Icon className="size-4" /> {label}</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{n}</div>
            </Link>
          ))}
        </div>
        <Link href="/demo/hr/attendance" className="card card-link flex items-center gap-4">
          <span className="flex-1">
            Today: <b>{present.size}</b> present · <b>{away.length}</b> on leave · <b>{notIn}</b> not checked in
          </span>
          <ArrowRight className="size-5 text-muted" />
        </Link>
      </div>
    </>
  );
}
