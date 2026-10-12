"use client";
import { Building2, Network, Pencil, Plus, Trash2, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader, useAdm } from "@/components/demo/adm-ui";
import { useDepts, useOffices } from "@/lib/demo/admin";
import { newId } from "@/lib/demo/store";
import { str } from "@/lib/util";

export default function Departments() {
  const { emps, log } = useAdm();
  const [offices] = useOffices();
  const [depts, setDepts] = useDepts();
  const headcount = (id: string) => emps.filter((s) => s.active && s.role !== "admin" && s.department_id === id).length;

  return (
    <>
      <PageHeader title="Departments" sub="Each department gets its own chat channel automatically." />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        {offices.map((o) => (
          <section key={o.id} className="card">
            <h2 className="h2"><Building2 /> {o.name}</h2>
            <ul className="mb-4 divide-y divide-line">
              {depts.filter((d) => d.office_id === o.id).map((d) => (
                <li key={d.id} className="flex items-center gap-2 py-2">
                  <Network className="size-4 shrink-0 text-muted" />
                  <ActionForm
                    action={async (fd) => { setDepts((l) => l.map((x) => (x.id === d.id ? { ...x, name: str(fd, "name")! } : x))); log("Renamed department", d.name); }}
                    keep className="flex flex-1 items-center gap-1"
                  >
                    <input name="name" defaultValue={d.name} required aria-label="Department name" className="input border-transparent bg-transparent font-medium hover:border-line" />
                    <button className="btn btn-ghost btn-icon" title="Rename"><Pencil /></button>
                  </ActionForm>
                  <span className="badge"><Users /> {headcount(d.id)}</span>
                  <ActionForm action={async () => { setDepts((l) => l.filter((x) => x.id !== d.id)); log("Deleted department", d.name); }} confirm={`Delete ${d.name}? Its chat channel is deleted too.`}>
                    <button className="btn btn-ghost btn-icon btn-danger" title="Delete"><Trash2 /></button>
                  </ActionForm>
                </li>
              ))}
            </ul>
            <ActionForm action={async (fd) => { const name = str(fd, "name")!; setDepts((l) => [...l, { id: newId(), office_id: o.id, name }]); log("Added department", name); }} className="flex gap-2">
              <input name="name" required placeholder="New department name" className="input" />
              <button className="btn btn-primary"><Plus /> Add</button>
            </ActionForm>
          </section>
        ))}
        {!offices.length && <p className="card empty lg:col-span-2"><Building2 /> Create an office first, then add its departments here.</p>}
      </div>
    </>
  );
}
