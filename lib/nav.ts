import "server-only";
import type { Assigned } from "./me";
import { db } from "./supabase";
import { pendingCounts } from "./pending";
import type { NavLink } from "@/components/nav";

// Shell props per panel. Shared by the panel layouts and /chat (which admins and the workforce both use).

export function employeeNav(me: Assigned) {
  const links: NavLink[] = [
    ["/", "Dashboard", "dashboard"],
    ["/todos", "To-do", "todos"],
    ["/attendance", "Attendance", "attendance"],
    ["/leave", "Leave", "leave"],
    ["/chat", "Chat", "chat"],
    ["/directory", "Directory", "directory"],
    ["/org", "Org chart", "org"],
    ["/profile", "My details", "profile"],
    ["/support", "Report an issue", "support"],
  ];
  const switchTo = me.role === "manager" || me.role === "branch_head" || me.role === "hr" ? me.role === "hr" ? { href: "/hr", label: "HR portal" } : { href: "/admin", label: "Manager panel" } : undefined;
  return { panel: "Workspace", links, switchTo };
}

export async function adminNav(me: Assigned) {
  const admin = me.role === "admin";
  const sb = db();
  const [pending, { count: issues }] = await Promise.all([
    pendingCounts(sb, me.id),
    admin ? sb.from("issues").select("id", { count: "exact", head: true }).eq("status", "open") : { count: 0 },
  ]);
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
    links.push(["/chat", "Chat", "chat"]);
    links.push(["/admin/chats", "Group chats", "chat"]);
    links.push(["/admin/payroll", "Payroll", "payroll"]);
    links.push(["/admin/issues", "Issues", "issues", issues ?? 0]);
  }
  const switchTo = admin ? undefined : { href: "/", label: "My workspace" };
  return { panel: admin ? "Admin" : me.role === "branch_head" ? "Branch head" : "Manager", links, switchTo };
}
