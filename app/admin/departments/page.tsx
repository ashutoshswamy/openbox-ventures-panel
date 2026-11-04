import Link from "next/link";
import { adminPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { Building2, Check, Plus, Settings2, Trash2, TriangleAlert, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/shell";
import { deleteDepartment, saveDepartment } from "../actions";

export const metadata = { title: "Departments" };

export default async function Departments() {
  await adminPage();
  const sb = db();
  const [{ data: offices }, { data: depts }, { data: staff }] = await Promise.all([
    sb.from("offices").select("id, name").order("name"),
    sb.from("departments").select("id, name, office_id").order("name"),
    sb.from("employees").select("department_id, office_id").eq("active", true).or("role.is.null,role.neq.admin"),
  ]);
  const headcount = (id: string) => staff?.filter((s) => s.department_id === id).length ?? 0;

  return (
    <>
      <PageHeader title="Departments" sub="Each department gets its own chat channel automatically." />
      <div className="max-w-5xl">
        {offices?.map((o) => {
          const rows = depts?.filter((d) => d.office_id === o.id) ?? [];
          const here = staff?.filter((s) => s.office_id === o.id) ?? [];
          const unassigned = here.filter((s) => !s.department_id).length;
          return (
            <section key={o.id} aria-label={`${o.name} departments`} className="grid gap-x-12 gap-y-5 border-t border-line py-8 first:border-t-0 first:pt-0 lg:grid-cols-[15rem_1fr]">
              <div>
                <h2 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Building2 className="size-4" /></span>
                  <span className="min-w-0 truncate">{o.name}</span>
                </h2>
                <p className="mt-2 text-sm text-muted tabular-nums">{rows.length} {rows.length === 1 ? "department" : "departments"}, {here.length} {here.length === 1 ? "person" : "people"}</p>
                {unassigned > 0 && <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-amber"><TriangleAlert className="size-3.5 shrink-0" />{unassigned} without a department</p>}
                <Link href={`/admin/offices?office=${o.id}`} className="btn btn-ghost -ml-3 mt-2"><Settings2 /> Office settings</Link>
              </div>

              <div className="grid content-start gap-2 sm:grid-cols-2">
                {rows.map((d) => (
                  <div key={d.id} className="group/row flex items-center gap-1 rounded-xl border border-line bg-surface py-1 pr-1 pl-1 transition-colors focus-within:border-text/40 hover:border-text/25">
                    <ActionForm action={saveDepartment} keep success="Department renamed" className="flex min-w-0 flex-1 items-center gap-1">
                      <input type="hidden" name="id" value={d.id} />
                      <input name="name" defaultValue={d.name} required aria-label={`Rename ${d.name}`} className="input h-9 border-transparent bg-transparent font-medium focus:bg-surface" />
                      <button className="btn btn-ghost btn-icon shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within/row:opacity-100 [@media(pointer:coarse)]:opacity-100" title="Save name" aria-label={`Save name for ${d.name}`}><Check /></button>
                    </ActionForm>
                    <span className="badge shrink-0 tabular-nums" title="Active employees"><Users /> {headcount(d.id)}</span>
                    <ActionForm action={deleteDepartment} success="Department deleted" confirm={`Delete ${d.name}? Its chat channel is deleted too.`}>
                      <input type="hidden" name="id" value={d.id} />
                      <button className="btn btn-ghost btn-icon text-muted hover:text-red" title="Delete" aria-label={`Delete ${d.name}`}><Trash2 /></button>
                    </ActionForm>
                  </div>
                ))}
                <ActionForm action={saveDepartment} success="Department added" className={`flex gap-2 rounded-xl border border-dashed border-line p-1 transition-colors focus-within:border-text/40 ${rows.length ? "" : "sm:col-span-2"}`}>
                  <input type="hidden" name="office_id" value={o.id} />
                  <input name="name" required placeholder={rows.length ? "New department" : `First department in ${o.name}`} aria-label={`New department in ${o.name}`} className="input h-9 border-transparent bg-transparent" />
                  <button className="btn btn-primary h-9 shrink-0"><Plus /> Add</button>
                </ActionForm>
              </div>
            </section>
          );
        })}
        {!offices?.length && <p className="card empty"><Building2 /> Create an office first, then add its departments here.</p>}
      </div>
    </>
  );
}
