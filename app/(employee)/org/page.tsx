import { employeePage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { OrgChart, type OrgPerson } from "@/components/org-chart";
import { PageHeader } from "@/components/shell";

export const metadata = { title: "Org chart" };

export default async function Org() {
  await employeePage();
  const { data } = await db()
    .from("employees")
    .select("id, full_name, designation, avatar_url, reports_to, role, department:departments(name)")
    .eq("active", true)
    .order("full_name");
  return (
    <>
      <PageHeader title="Org chart" sub="Who reports to whom" />
      <OrgChart people={(data ?? []) as unknown as OrgPerson[]} />
    </>
  );
}
