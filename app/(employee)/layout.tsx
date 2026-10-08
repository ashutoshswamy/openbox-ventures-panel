import { employeePage } from "@/lib/me";
import { employeeNav } from "@/lib/nav";
import { Shell } from "@/components/shell";

export default async function EmployeeLayout({ children }: LayoutProps<"/">) {
  const me = await employeePage();
  return (
    <Shell {...employeeNav(me)} user={{ id: me.id, name: me.full_name, role: me.role, avatar: me.avatar_url }}>
      {children}
    </Shell>
  );
}
