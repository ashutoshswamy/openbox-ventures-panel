import { staffPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { Shell } from "@/components/shell";
import type { NavLink } from "@/components/nav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const me = await staffPage();
  const admin = me.role === "admin";

  const links: NavLink[] = [
    ["/admin", "Overview", "overview"],
    ["/admin/todos", "To-do", "todos"],
    ["/admin/employees", "Employees", "employees"],
    ...(admin ? ([["/admin/offices", "Offices", "offices"], ["/admin/departments", "Departments", "departments"]] as NavLink[]) : []),
    ["/admin/attendance", "Attendance", "attendance"],
    ["/admin/leave", "Leave", "approvals"],
    ["/admin/announcements", "Announcements", "announcements"],
  ];
  if (admin) {
    const { count } = await db().from("issues").select("id", { count: "exact", head: true }).eq("status", "open");
    links.push(["/admin/issues", "Issues", "issues", count ?? 0]);
  }
  const switchTo = admin ? undefined : { href: "/", label: "My workspace" };

  return (
    <Shell panel={admin ? "Admin" : me.role === "hr" ? "HR" : "Manager"} links={links} switchTo={switchTo} user={{ name: me.full_name, role: me.role, avatar: me.avatar_url }}>
      {children}
    </Shell>
  );
}
