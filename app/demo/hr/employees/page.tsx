"use client";
import { useState } from "react";
import { Ban, ChevronDown, Save, Search, ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DEPARTMENTS, OFFICES, dept, office } from "@/lib/demo/data";
import { HR_OFFICE, useHrEmployees, type HrEmp } from "@/lib/demo/hr";
import { fmtDate } from "@/lib/util";
import { PageHeader, useLog } from "../_parts";

type Status = "all" | "active" | "inactive";

function Form({ e, people, onSave }: { e: HrEmp; people: HrEmp[]; onSave: (patch: Partial<HrEmp>) => void }) {
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        const s = (k: string) => String(fd.get(k) ?? "");
        const d = DEPARTMENTS.find((x) => x.id === s("department_id"));
        onSave({ name: s("name"), office_id: d?.office_id ?? (s("office_id") || e.office_id), department_id: d?.id ?? null, designation: s("designation"), reports_to: s("reports_to") || null, joined_on: s("joined_on") || e.joined_on, exit_date: s("exit_date") || null });
      }}
    >
      <label className="field">Full name<input name="name" required defaultValue={e.name} className="input" /></label>
      <label className="field">Office
        <select name="office_id" defaultValue={e.office_id} className="input">{OFFICES.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      </label>
      <label className="dept field">Department (sets office)
        <select name="department_id" defaultValue={e.department_id ?? ""} className="input">
          <option value="">-</option>
          {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{office(d.office_id)?.name} / {d.name}</option>)}
        </select>
      </label>
      <label className="field">Designation<input name="designation" defaultValue={e.designation} className="input" /></label>
      <label className="field">Reports to
        <select name="reports_to" defaultValue={e.reports_to ?? ""} className="input">
          <option value="">-</option>
          {people.filter((p) => p.id !== e.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="field">Joined on<input name="joined_on" type="date" defaultValue={e.joined_on} className="input" /></label>
      <label className="field">Exit date<input name="exit_date" type="date" defaultValue={e.exit_date ?? ""} className="input" /></label>
      <div className="sm:col-span-2"><button className="btn btn-primary"><Save /> Save changes</button></div>
    </form>
  );
}

export default function Employees() {
  const [all, setAll] = useHrEmployees();
  const log = useLog();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [saved, setSaved] = useState("");
  const scope = all.filter((e) => e.office_id === HR_OFFICE);
  const counts = { all: scope.length, active: scope.filter((e) => e.active).length, inactive: scope.filter((e) => !e.active).length };
  const list = scope.filter((e) => (status === "all" || e.active === (status === "active")) && e.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const patch = (id: string, p: Partial<HrEmp>) => setAll((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));

  return (
    <>
      <PageHeader title="Employees" sub={`${list.length} people`} />
      <div className="max-w-5xl space-y-6">
        <nav className="flex gap-2">
          {([["all", "All"], ["active", "Active"], ["inactive", "Deactivated"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setStatus(k)} className={`btn ${status === k ? "btn-primary" : ""}`}>{label} <span className="opacity-70">{counts[k]}</span></button>
          ))}
        </nav>
        <form className="relative" onSubmit={(e) => e.preventDefault()}>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="input pl-9" />
        </form>

        <ul className="card divide-y divide-line p-0">
          {list.map((e) => (
            <li key={e.id}>
              <details className={`group ${e.active ? "" : "opacity-60"}`}>
                <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 hover:bg-surface-2/50">
                  <Avatar name={e.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="font-semibold">{e.name}</span>
                      <span className="truncate text-sm text-muted">{e.email}</span>
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {[e.code, e.designation, dept(e.department_id)?.name, office(e.office_id)?.name].filter(Boolean).join(" · ")}
                      {e.exit_date && ` · Exit ${fmtDate(e.exit_date)}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap justify-end gap-1">
                    {e.role !== "employee" && <span className="badge badge-teal capitalize"><ShieldCheck /> {e.role}</span>}
                    {!e.active && <span className="badge"><Ban /> Inactive</span>}
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-4 bg-surface-2/40 px-5 py-5">
                  <Form key={e.id + JSON.stringify([e.name, e.designation, e.reports_to, e.exit_date, e.department_id])} e={e} people={all.filter((p) => p.active)} onSave={(p) => { patch(e.id, p); log("Updated employee", e.name); setSaved(e.id); setTimeout(() => setSaved(""), 2000); }} />
                  {saved === e.id && <p className="text-sm text-green">Saved</p>}
                  <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                    {e.active ? (
                      <button className="btn btn-ghost btn-danger" onClick={() => confirm(`Deactivate ${e.name}? They will be signed out and blocked.`) && (patch(e.id, { active: false }), log("Deactivated employee", e.name))}><UserX /> Deactivate</button>
                    ) : (
                      <button className="btn" onClick={() => (patch(e.id, { active: true }), log("Reactivated employee", e.name))}><UserCheck /> Reactivate</button>
                    )}
                  </div>
                </div>
              </details>
            </li>
          ))}
          {!list.length && <li className="empty"><Users /> No employees found.</li>}
        </ul>
      </div>
    </>
  );
}
