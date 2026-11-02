import { adminPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { Building2, Check, Plus, Trash2, Users } from "lucide-react";
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
    sb.from("employees").select("department_id").eq("active", true).or("role.is.null,role.neq.admin"),
  ]);
  const headcount = (id: string) => staff?.filter((s) => s.department_id === id).length ?? 0;

  return (
    <>
      <PageHeader title="Departments" sub="Each department gets its own chat channel automatically." />
      <div className="grid max-w-5xl items-start gap-6 lg:grid-cols-2">
        {offices?.map((o) => {
          const rows = depts?.filter((d) => d.office_id === o.id) ?? [];
          const people = rows.reduce((n, d) => n + headcount(d.id), 0);
          return (
            <section key={o.id} className="card">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Building2 className="size-[18px]" /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold tracking-tight">{o.name}</h2>
                  <p className="text-xs text-muted tabular-nums">{rows.length} {rows.length === 1 ? "department" : "departments"}, {people} {people === 1 ? "person" : "people"}</p>
                </div>
              </div>
              {rows.length ? (
                <ul className="mb-4 divide-y divide-line">
                  {rows.map((d) => (
                    <li key={d.id} className="group/row flex items-center gap-1 py-1.5">
                      <ActionForm action={saveDepartment} keep className="flex min-w-0 flex-1 items-center gap-1">
                        <input type="hidden" name="id" value={d.id} />
                        <input name="name" defaultValue={d.name} required aria-label={`Rename ${d.name}`} className="input border-transparent bg-transparent font-medium hover:border-line" />
                        <button className="btn btn-ghost btn-icon shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within/row:opacity-100 [@media(pointer:coarse)]:opacity-100" title="Save name" aria-label={`Save name for ${d.name}`}><Check /></button>
                      </ActionForm>
                      <span className="badge shrink-0 tabular-nums" title="Active employees"><Users /> {headcount(d.id)}</span>
                      <ActionForm action={deleteDepartment} confirm={`Delete ${d.name}? Its chat channel is deleted too.`}>
                        <input type="hidden" name="id" value={d.id} />
                        <button className="btn btn-ghost btn-icon text-muted hover:text-red" title="Delete" aria-label={`Delete ${d.name}`}><Trash2 /></button>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-4 rounded-xl bg-surface-2/60 px-4 py-6 text-center text-sm text-muted">No departments yet. Add the first one below.</p>
              )}
              <ActionForm action={saveDepartment} className="flex gap-2">
                <input type="hidden" name="office_id" value={o.id} />
                <input name="name" required placeholder={`New department in ${o.name}`} aria-label={`New department in ${o.name}`} className="input" />
                <button className="btn btn-primary shrink-0"><Plus /> Add</button>
              </ActionForm>
            </section>
          );
        })}
        {!offices?.length && <p className="card empty lg:col-span-2"><Building2 /> Create an office first, then add its departments here.</p>}
      </div>
    </>
  );
}
