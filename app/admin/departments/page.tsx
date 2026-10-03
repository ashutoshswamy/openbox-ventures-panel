import { adminPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { Building2, Network, Pencil, Plus, Trash2, Users } from "lucide-react";
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
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      {offices?.map((o) => (
        <section key={o.id} className="card">
          <h2 className="h2"><Building2 /> {o.name}</h2>
          <ul className="mb-4 divide-y divide-line">
            {depts?.filter((d) => d.office_id === o.id).map((d) => (
              <li key={d.id} className="flex items-center gap-2 py-2">
                <Network className="size-4 shrink-0 text-muted" />
                <ActionForm action={saveDepartment} keep className="flex flex-1 items-center gap-1">
                  <input type="hidden" name="id" value={d.id} />
                  <input name="name" defaultValue={d.name} required aria-label="Department name" className="input border-transparent bg-transparent font-medium hover:border-line" />
                  <button className="btn btn-ghost btn-icon" title="Rename"><Pencil /></button>
                </ActionForm>
                <span className="badge"><Users /> {headcount(d.id)}</span>
                <ActionForm action={deleteDepartment} confirm={`Delete ${d.name}? Its chat channel is deleted too.`}>
                  <input type="hidden" name="id" value={d.id} />
                  <button className="btn btn-ghost btn-icon btn-danger" title="Delete"><Trash2 /></button>
                </ActionForm>
              </li>
            ))}
          </ul>
          <ActionForm action={saveDepartment} className="flex gap-2">
            <input type="hidden" name="office_id" value={o.id} />
            <input name="name" required placeholder="New department name" className="input" />
            <button className="btn btn-primary"><Plus /> Add</button>
          </ActionForm>
        </section>
      ))}
      {!offices?.length && <p className="card empty lg:col-span-2"><Building2 /> Create an office first, then add its departments here.</p>}
    </div>
    </>
  );
}
