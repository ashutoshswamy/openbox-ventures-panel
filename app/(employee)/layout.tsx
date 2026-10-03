import { employeePage } from "@/lib/me";
import { Shell } from "@/components/shell";
import type { NavLink } from "@/components/nav";

export default async function EmployeeLayout({ children }: LayoutProps<"/">) {
  const me = await employeePage();

  const links: NavLink[] = [
    ["/", "Dashboard", "dashboard"],
    ["/attendance", "Attendance", "attendance"],
    ["/leave", "Leave", "leave"],
    ["/chat", "Chat", "chat"],
    ["/directory", "Directory", "directory"],
    ["/profile", "My details", "profile"],
    ["/support", "Report an issue", "support"],
  ];
  if (me.role === "manager") links.push(["/admin", "Manager panel", "switch"]);

  return (
    <Shell panel="Workspace" links={links} user={{ name: me.full_name, role: me.role, avatar: me.avatar_url }}>
      {children}
    </Shell>
  );
}
