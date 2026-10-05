import { employeePage } from "@/lib/me";
import { Shell } from "@/components/shell";
import type { NavLink } from "@/components/nav";

export default async function EmployeeLayout({ children }: LayoutProps<"/">) {
  const me = await employeePage();

  const links: NavLink[] = [
    ["/", "Dashboard", "dashboard"],
    ["/todos", "To-do", "todos"],
    ["/attendance", "Attendance", "attendance"],
    ["/leave", "Leave", "leave"],
    ["/chat", "Chat", "chat"],
    ["/directory", "Directory", "directory"],
    ["/profile", "My details", "profile"],
    ["/support", "Report an issue", "support"],
  ];
  const switchTo = me.role === "manager" || me.role === "hr" ? { href: "/admin", label: me.role === "hr" ? "HR panel" : "Manager panel" } : undefined;

  return (
    <Shell panel="Workspace" links={links} switchTo={switchTo} user={{ name: me.full_name, role: me.role, avatar: me.avatar_url }}>
      {children}
    </Shell>
  );
}
