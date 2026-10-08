import { redirect } from "next/navigation";
import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { pendingCounts } from "@/lib/pending";
import { Shell } from "@/components/shell";
import type { NavLink } from "@/components/nav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const me = await staffPage();
  if (me.role === "hr") redirect("/hr");
  const admin = me.role === "admin";
  const pending = await pendingCounts(db(), me.id);

  const links: NavLink[] = [
    ["/admin", "Overview", "overview"],
    ["/admin/todos", "To-do", "todos"],
    ["/admin/employees", "Employees", "employees"],
    ["/admin/org", "Org chart", "org"],
    ...(admin ? ([["/admin/offices", "Offices", "offices"], ["/admin/departments", "Departments", "departments"]] as NavLink[]) : []),
    ["/admin/attendance", "Attendance", "attendance", pending.regularizations],
    ["/admin/leave", "Leave", "approvals", pending.leave],
    ["/admin/announcements", "Announcements", "announcements"],
  ];
  if (admin) {
    links.push(["/admin/payroll", "Payroll", "payroll"]);
    const { count } = await db().from("issues").select("id", { count: "exact", head: true }).eq("status", "open");
    links.push(["/admin/issues", "Issues", "issues", count ?? 0]);
  }
  const switchTo = admin ? undefined : { href: "/", label: "My workspace" };

  return (
    <Shell panel={admin ? "Admin" : "Manager"} links={links} switchTo={switchTo} user={{ name: me.full_name, role: me.role, avatar: me.avatar_url }}>
      {children}
    </Shell>
  );
}
