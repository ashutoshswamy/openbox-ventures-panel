"use client";
import { OrgChart, type OrgPerson } from "@/components/org-chart";
import { dept } from "@/lib/demo/data";
import { useHrEmployees } from "@/lib/demo/hr";
import { PageHeader } from "../_parts";

export default function Org() {
  const [emps] = useHrEmployees();
  const people: OrgPerson[] = emps
    .filter((e) => e.active)
    .map((e) => ({ id: e.id, full_name: e.name, designation: e.designation, avatar_url: null, reports_to: e.reports_to, role: e.role, department: dept(e.department_id) ? { name: dept(e.department_id)!.name } : null }));
  return (
    <>
      <PageHeader title="Org chart" sub="Who reports to whom" />
      <OrgChart people={people} />
    </>
  );
}
