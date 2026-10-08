import { redirect } from "next/navigation";
import { staffPage } from "@/lib/me";
import { adminNav } from "@/lib/nav";
import { Shell } from "@/components/shell";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const me = await staffPage();
  if (me.role === "hr") redirect("/hr");
  return (
    <Shell {...(await adminNav(me))} user={{ id: me.id, name: me.full_name, role: me.role, avatar: me.avatar_url }}>
      {children}
    </Shell>
  );
}
