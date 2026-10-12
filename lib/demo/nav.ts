import type { NavLink } from "@/components/nav";
import type { DemoRole } from "./data";

export type Section = "workspace" | "admin" | "hr";
export const SECTION_HOME: Record<Section, string> = { workspace: "/demo/workspace", admin: "/demo/admin", hr: "/demo/hr" };
// Section a role lands in first
export const HOME_OF: Record<DemoRole, string> = { employee: "/demo/workspace", manager: "/demo/workspace", hr: "/demo/workspace", admin: "/demo/admin" };

const W = "/demo/workspace";
export const workspaceLinks: NavLink[] = [
  [W, "Dashboard", "dashboard"],
  [`${W}/todos`, "To-do", "todos"],
  [`${W}/attendance`, "Attendance", "attendance"],
  [`${W}/leave`, "Leave", "leave"],
  ["/demo/chat", "Chat", "chat"],
  [`${W}/directory`, "Directory", "directory"],
  [`${W}/org`, "Org chart", "org"],
  [`${W}/payslips`, "Payslips", "payroll"],
  ["/demo/profile", "My details", "profile"],
  [`${W}/support`, "Report an issue", "support"],
];

export const hrLinks: NavLink[] = [
  ["/demo/hr", "Overview", "overview"],
  ["/demo/hr/todos", "To-do", "todos"],
  ["/demo/hr/employees", "Employees", "employees"],
  ["/demo/hr/org", "Org chart", "org"],
  ["/demo/hr/attendance", "Attendance", "attendance"],
  ["/demo/hr/leave", "Leave", "approvals"],
  ["/demo/hr/announcements", "Announcements", "announcements"],
  ["/demo/hr/payroll", "Payroll", "payroll"],
];

export function adminLinks(role: DemoRole): NavLink[] {
  const admin = role === "admin";
  return [
    ["/demo/admin", "Overview", "overview"],
    ["/demo/admin/todos", "To-do", "todos"],
    ["/demo/admin/employees", "Employees", "employees"],
    ["/demo/admin/org", "Org chart", "org"],
    ...(admin ? ([["/demo/admin/offices", "Offices", "offices"], ["/demo/admin/departments", "Departments", "departments"]] as NavLink[]) : []),
    ["/demo/admin/attendance", "Attendance", "attendance"],
    ["/demo/admin/leave", "Leave", "approvals"],
    ["/demo/admin/announcements", "Announcements", "announcements"],
    ...(admin
      ? ([["/demo/chat", "Chat", "chat"], ["/demo/admin/chats", "Group chats", "chat"], ["/demo/admin/payroll", "Payroll", "payroll"], ["/demo/admin/issues", "Issues", "issues"], ["/demo/admin/audit", "Audit log", "audit"]] as NavLink[])
      : []),
  ];
}

// Sidebar for a section + role, plus the "switch panel" link
export function navFor(section: Section, role: DemoRole) {
  if (section === "workspace") {
    const switchTo = role === "manager" ? { href: "/demo/admin", label: "Manager panel" } : role === "hr" ? { href: "/demo/hr", label: "HR portal" } : undefined;
    return { panel: "Workspace", links: workspaceLinks, switchTo };
  }
  if (section === "hr") return { panel: "HR", links: hrLinks, switchTo: { href: "/demo/workspace", label: "My workspace" } };
  return { panel: role === "admin" ? "Admin" : "Manager", links: adminLinks(role), switchTo: role === "admin" ? undefined : { href: "/demo/workspace", label: "My workspace" } };
}
