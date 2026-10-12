"use client";
import { useState } from "react";
import { Ban, ChevronDown, ClipboardList, MailCheck, RotateCw, Save, Search, Send, ShieldCheck, UserCheck, UserPlus, Users, UserX } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader, useAdm } from "@/components/demo/adm-ui";
import { useDepts, useEmps, useOffices, type AdmEmp } from "@/lib/demo/admin";
import type { DemoRole } from "@/lib/demo/data";
import { newId } from "@/lib/demo/store";
import { fmtDate, str } from "@/lib/util";

const ROLES: [DemoRole, string][] = [["employee", "Employee"], ["manager", "Manager (department head)"], ["hr", "HR (office)"], ["admin", "Admin"]];

function Fields({ e, offices, depts, people }: { e?: AdmEmp; offices: { id: string; name: string }[]; depts: { id: string; name: string; office_id: string }[]; people?: AdmEmp[] }) {
  const r = e?.role;
  return (
    <>
      <label className="field">Full name<input name="full_name" required defaultValue={e?.name} className="input" /></label>
      {!e && <label className="field">Email<input name="email" type="email" required className="input" /></label>}
      {e && !e.invited && (
        <label className="field">Role
          <select name="role" defaultValue={r} className="input">{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
      )}
      {r === "admin" ? (
        <p className="self-end text-sm text-muted sm:col-span-2">Admins have no office, department or attendance. Change the role to place them in the workforce.</p>
      ) : (
        <>
          <label className="field">Office
            <select name="office_id" defaultValue={e?.office_id ?? ""} className="input">
              <option value="">-</option>
              {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="dept field">Department (sets office)
            <select name="department_id" defaultValue={e?.department_id ?? ""} className="input">
              <option value="">-</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{offices.find((o) => o.id === d.office_id)?.name} / {d.name}</option>)}
            </select>
          </label>
          <label className="field">Designation<input name="designation" defaultValue={e?.designation ?? ""} className="input" /></label>
          {e && people && (
            <label className="field">Reports to
              <select name="reports_to" defaultValue={e.reports_to ?? ""} className="input">
                <option value="">-</option>
                {people.filter((p) => p.id !== e.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          {e && <label className="field">Joined on<input name="joined_on" type="date" defaultValue={e.joined_on} className="input" /></label>}
          {e && <label className="field">Exit date<input name="exit_date" type="date" defaultValue={e.exit_date ?? ""} className="input" /></label>}
        </>
      )}
    </>
  );
}

// ponytail: fake personal details derived from the demo employee
function Details({ e }: { e: AdmEmp }) {
  const rows: [string, string][] = [
    ["Date of birth", "14 Mar 1996"], ["Gender", "-"], ["Mobile", e.phone], ["Personal email", e.email.replace("@openboxventures.in", "@example.com")],
    ["Emergency contact", "Family member (Parent) · +91 98200 99999"], ["Current address", "Sample address, 12 Demo Lane"],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className={k.includes("address") ? "sm:col-span-2" : ""}><dt className="text-xs text-muted">{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

const STATUS = { Inactive: ["", Ban], Invited: ["badge-blue", MailCheck] } as const;

export default function Employees() {
  const { me, isAdmin, log } = useAdm();
  const [all, setEmps] = useEmps();
  const [offices] = useOffices();
  const [depts] = useDepts();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");

  const scope = all.filter((e) => isAdmin || e.office_id === me.office_id);
  const counts = { all: scope.length, active: scope.filter((p) => p.active).length, inactive: scope.filter((p) => !p.active).length };
  const emps = scope
    .filter((e) => status === "all" || e.active === (status === "active"))
    .filter((e) => !q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const managers = scope.filter((p) => p.active);
  const name = (list: { id: string; name: string }[], id: string | null) => list.find((x) => x.id === id)?.name;
  const patch = (id: string, p: Partial<AdmEmp>) => setEmps((l) => l.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const place = (fd: FormData) => {
    const d = depts.find((x) => x.id === str(fd, "department_id"));
    return { department_id: d?.id ?? null, office_id: d?.office_id ?? str(fd, "office_id") ?? "" };
  };

  const invite = async (fd: FormData) => {
    const email = str(fd, "email")?.toLowerCase();
    if (!email) return "Email required";
    if (all.some((e) => e.email === email)) return "That email already exists";
    const n = str(fd, "full_name")!;
    setEmps((l) => [...l, {
      id: newId(), code: `OBV${String(l.length + 1).padStart(3, "0")}`, name: n, email, role: "employee", designation: str(fd, "designation") ?? "",
      reports_to: null, joined_on: new Date().toISOString().slice(0, 10), ctc: 0, phone: "-", exit_date: null, active: true, invited: true, ...place(fd),
    }]);
    log("Added employee", n);
  };
  const save = async (e: AdmEmp, fd: FormData) => {
    const role = (str(fd, "role") as DemoRole | null) ?? e.role;
    if (e.id === me.id && role !== "admin") return "You can't remove your own admin role";
    patch(e.id, {
      name: str(fd, "full_name") ?? e.name, role, designation: str(fd, "designation") ?? "", reports_to: str(fd, "reports_to"),
      joined_on: str(fd, "joined_on") ?? e.joined_on, exit_date: str(fd, "exit_date"), ...place(fd),
    });
    log("Updated employee", e.name);
  };
  const setActive = async (e: AdmEmp, active: boolean) => {
    if (e.id === me.id && !active) return "You can't deactivate yourself";
    patch(e.id, { active });
    log(active ? "Reactivated employee" : "Deactivated employee", e.name);
  };

  const waiting = 0;
  return (
    <>
      <PageHeader title="Employees" sub={`${emps.length} people${waiting ? ` · ${waiting} waiting for a role` : ""}`} />
      <div className="max-w-5xl space-y-6">
        {isAdmin && (
          <details className="card group">
            <summary className="flex cursor-pointer items-center gap-3 font-semibold">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-fg"><UserPlus className="size-4" /></span>
              Invite an employee
              <ChevronDown className="ml-auto size-5 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <ActionForm action={invite} success="Invite sent (demo: no email is sent)" className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
              <Fields offices={offices} depts={depts} />
              <p className="text-xs text-muted sm:col-span-2">They get an email invitation. After signing up they wait on a &quot;no role yet&quot; screen until you assign a role here.</p>
              <div><button className="btn btn-primary"><Send /> Send invite</button></div>
            </ActionForm>
          </details>
        )}

        <nav className="flex gap-2">
          {([["all", "All"], ["active", "Active"], ["inactive", "Deactivated"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setStatus(k)} className={`btn ${status === k ? "btn-primary" : ""}`}>
              {label} <span className="opacity-70">{counts[k]}</span>
            </button>
          ))}
        </nav>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="input pl-9" />
        </div>

        <ul className="card divide-y divide-line p-0">
          {emps.map((e) => {
            const st = !e.active ? "Inactive" : e.invited ? "Invited" : null;
            const StatusIcon = st ? STATUS[st][1] : null;
            return (
              <li key={e.id}>
                <details className={`group ${e.active ? "" : "opacity-60"}`}>
                  <summary className={`flex items-center gap-3 px-5 py-4 ${isAdmin ? "cursor-pointer hover:bg-surface-2/50" : ""}`}>
                    <Avatar name={e.name} src={null} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2">
                        <span className="font-semibold">{e.name}</span>
                        <span className="truncate text-sm text-muted">{e.email}</span>
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {[e.code, e.designation, name(depts, e.department_id), name(offices, e.office_id)].filter(Boolean).join(" · ") || "No office or department"}
                        {e.exit_date && ` · Exit ${fmtDate(e.exit_date)}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      {!e.invited && e.role !== "employee" && <span className="badge badge-teal capitalize"><ShieldCheck /> {e.role}</span>}
                      {st && StatusIcon && <span className={`badge ${STATUS[st][0]}`}><StatusIcon /> {st}</span>}
                    </span>
                    {isAdmin && <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />}
                  </summary>
                  {isAdmin && (
                    <div className="space-y-4 bg-surface-2/40 px-5 py-5">
                      {!e.invited && e.role !== "admin" && (
                        <section className="rounded-xl border border-line bg-surface p-4">
                          <h3 className="eyebrow mb-3 flex items-center gap-1.5"><ClipboardList className="size-3.5" /> Personal details</h3>
                          <Details e={e} />
                        </section>
                      )}
                      <ActionForm action={(fd) => save(e, fd)} keep success="Saved" className="grid gap-4 sm:grid-cols-2">
                        <Fields e={e} offices={offices} depts={depts} people={managers} />
                        <div className="sm:col-span-2"><button className="btn btn-primary"><Save /> Save changes</button></div>
                      </ActionForm>
                      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                        {e.invited && e.active && (
                          <ActionForm action={async () => {}} success="Invite resent"><button className="btn"><RotateCw /> Resend invite</button></ActionForm>
                        )}
                        <ActionForm action={() => setActive(e, !e.active)} confirm={e.active ? `Deactivate ${e.name}? They will be signed out and blocked.` : undefined}>
                          {e.active ? <button className="btn btn-ghost btn-danger"><UserX /> Deactivate</button> : <button className="btn"><UserCheck /> Reactivate</button>}
                        </ActionForm>
                      </div>
                    </div>
                  )}
                </details>
              </li>
            );
          })}
          {!emps.length && <li className="empty"><Users /> No employees found.</li>}
        </ul>
      </div>
    </>
  );
}
