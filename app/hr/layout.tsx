import { hrPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { pendingCounts } from "@/lib/pending";
import { Shell } from "@/components/shell";
import type { NavLink } from "@/components/nav";

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const me = await hrPage();
  const { leave, regularizations: regs } = await pendingCounts(db(), me.id); // RLS scopes to HR's office

  const links: NavLink[] = [
    ["/hr", "Overview", "overview"],
    ["/hr/todos", "To-do", "todos"],
    ["/hr/employees", "Employees", "employees"],
    ["/hr/attendance", "Attendance", "attendance", regs],
    ["/hr/leave", "Leave", "approvals", leave],
    ["/hr/reviews", "Reviews", "reviews"],
    ["/hr/payroll", "Payroll", "payroll"],
    ["/hr/announcements", "Announcements", "announcements"],
    ["/hr/time-zones", "Time zones", "timezones"],
  ];

  return (
    <Shell panel="HR" links={links} switchTo={{ href: "/", label: "My workspace" }} user={{ id: me.id, name: me.full_name, role: me.role, avatar: me.avatar_url }}>
      {children}
    </Shell>
  );
}
