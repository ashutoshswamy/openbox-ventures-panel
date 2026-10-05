import { clerkClient } from "@clerk/nextjs/server";
import { staffPage, type Role } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate } from "@/lib/util";
import { Ban, ChevronDown, ClipboardList, Hourglass, MailCheck, RotateCw, Save, Search, Send, ShieldCheck, UserCheck, UserPlus, Users, UserX } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/shell";
import { inviteEmployee, resendInvite, setActive, updateEmployee } from "../actions";

export const metadata = { title: "Employees" };

type Emp = {
  id: string; email: string; full_name: string; clerk_user_id: string | null; office_id: string | null;
  department_id: string | null; designation: string | null; joined_on: string | null; active: boolean; avatar_url: string | null;
};
type Opt = { id: string; name: string; office_id?: string };

function Fields({ e, r, offices, depts }: { e?: Emp; r?: Role | null; offices: Opt[]; depts: Opt[] }) {
  const officeName = (id?: string) => offices.find((o) => o.id === id)?.name;
  return (
    <>
      <label className="field">Full name<input name="full_name" required defaultValue={e?.full_name} className="input" /></label>
      {!e && <label className="field">Email<input name="email" type="email" required className="input" /></label>}
      {e?.clerk_user_id && (
        <label className="field">Role
          <select name="role" defaultValue={r ?? ""} className="input">
            <option value="">Not assigned (no access)</option>
            <option value="employee">Employee</option>
            <option value="manager">Manager (office head)</option>
            <option value="hr">HR (office)</option>
            <option value="admin">Admin</option>
          </select>
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
      <label className="field">Department (sets office)
        <select name="department_id" defaultValue={e?.department_id ?? ""} className="input">
          <option value="">-</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{officeName(d.office_id)} / {d.name}</option>)}
        </select>
      </label>
      <label className="field">Designation<input name="designation" defaultValue={e?.designation ?? ""} className="input" /></label>
      {e && <label className="field">Joined on<input name="joined_on" type="date" defaultValue={e.joined_on ?? ""} className="input" /></label>}
      </>
      )}
    </>
  );
}

type Profile = {
  employee_id: string; date_of_birth: string; gender: string | null; phone: string; personal_email: string | null; blood_group: string | null;
  current_address: string; permanent_address: string | null; emergency_name: string; emergency_relation: string; emergency_phone: string;
};

function Details({ p }: { p?: Profile }) {
  if (!p) return <p className="flex items-center gap-2 text-sm text-amber"><ClipboardList className="size-4" /> Hasn&apos;t filled in their personal details yet.</p>;
  const rows: [string, React.ReactNode][] = [
    ["Date of birth", fmtDate(p.date_of_birth)],
    ["Gender", p.gender],
    ["Mobile", <a key="m" href={`tel:${p.phone}`} className="hover:text-primary">{p.phone}</a>],
    ["Personal email", p.personal_email],
    ["Blood group", p.blood_group],
    ["Emergency contact", `${p.emergency_name} (${p.emergency_relation}) · ${p.emergency_phone}`],
    ["Current address", p.current_address],
    ["Permanent address", p.permanent_address],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className={k.includes("address") ? "sm:col-span-2" : ""}>
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="whitespace-pre-wrap">{v || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function Employees({ searchParams }: PageProps<"/admin/employees">) {
  const me = await staffPage();
  const isAdmin = me.role === "admin";
  const { q } = await searchParams;
  const sb = db();
  let query = sb.from("employees").select("*").order("active", { ascending: false }).order("full_name");
  if (!isAdmin) query = query.eq("office_id", me.office_id ?? "");
  if (q) query = query.ilike("full_name", `%${String(q).replace(/[%,()]/g, "")}%`);
  const [{ data: emps }, { data: offices }, { data: depts }] = await Promise.all([
    query,
    sb.from("offices").select("id, name").order("name"),
    sb.from("departments").select("id, name, office_id").order("name"),
  ]);

  // Roles live in Clerk publicMetadata of joined users.
  // ponytail: single page of 500 users; paginate past that.
  const linked = (emps ?? []).flatMap((e: Emp) => (e.clerk_user_id ? [e.clerk_user_id] : []));
  const [users, { data: profiles }] = await Promise.all([
    linked.length ? (await clerkClient()).users.getUserList({ userId: linked, limit: 500 }) : { data: [] },
    isAdmin ? sb.from("employee_profiles").select("*") : { data: [] },
  ]);
  const profileOf = (id: string) => (profiles as Profile[] | null)?.find((p) => p.employee_id === id);
  const roleOf = (e: Emp) => (users.data.find((u) => u.id === e.clerk_user_id)?.publicMetadata?.role as Role | undefined) ?? null;
  const name = (list: Opt[] | null, id: string | null) => list?.find((x) => x.id === id)?.name;

  const waiting = (emps ?? []).filter((e: Emp) => e.active && e.clerk_user_id && !roleOf(e)).length;
  const STATUS = {
    Inactive: ["", Ban],
    Invited: ["badge-blue", MailCheck],
    "Needs role": ["badge-amber", Hourglass],
  } as const;

  return (
    <>
      <PageHeader title="Employees" sub={`${emps?.length ?? 0} people${waiting ? ` · ${waiting} waiting for a role` : ""}`} />
      <div className="max-w-5xl space-y-6">
        {isAdmin && (
          <details className="card group">
            <summary className="flex cursor-pointer items-center gap-3 font-semibold">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-fg"><UserPlus className="size-4" /></span>
              Invite an employee
              <ChevronDown className="ml-auto size-5 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <ActionForm action={inviteEmployee} className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
              <Fields offices={offices ?? []} depts={depts ?? []} />
              <p className="text-xs text-muted sm:col-span-2">They get an email invitation. After signing up they wait on a &quot;no role yet&quot; screen until you assign a role here.</p>
              <div><button className="btn btn-primary"><Send /> Send invite</button></div>
            </ActionForm>
          </details>
        )}

        <form className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q as string} placeholder="Search by name" className="input pl-9" />
        </form>

        <ul className="card divide-y divide-line p-0">
          {emps?.map((e: Emp) => {
            const r = roleOf(e);
            const status = !e.active ? "Inactive" : !e.clerk_user_id ? "Invited" : !r ? "Needs role" : null;
            const StatusIcon = status ? STATUS[status][1] : null;
            return (
              <li key={e.id}>
                <details className={`group ${e.active ? "" : "opacity-60"}`}>
                  <summary className={`flex items-center gap-3 px-5 py-4 ${isAdmin ? "cursor-pointer hover:bg-surface-2/50" : ""}`}>
                    <Avatar name={e.full_name} src={e.avatar_url} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2">
                        <span className="font-semibold">{e.full_name}</span>
                        <span className="truncate text-sm text-muted">{e.email}</span>
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {[e.designation, name(depts, e.department_id), name(offices, e.office_id)].filter(Boolean).join(" · ") || "No office or department"}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      {r && r !== "employee" && <span className="badge badge-teal capitalize"><ShieldCheck /> {r}</span>}
                      {status && StatusIcon && <span className={`badge ${STATUS[status][0]}`}><StatusIcon /> {status}</span>}
                    </span>
                    {isAdmin && <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />}
                  </summary>
                  {isAdmin && (
                    <div className="space-y-4 bg-surface-2/40 px-5 py-5">
                      {e.clerk_user_id && r !== "admin" && (
                        <section className="rounded-xl border border-line bg-surface p-4">
                          <h3 className="eyebrow mb-3 flex items-center gap-1.5"><ClipboardList className="size-3.5" /> Personal details</h3>
                          <Details p={profileOf(e.id)} />
                        </section>
                      )}
                      <ActionForm action={updateEmployee} keep success="Saved" className="grid gap-4 sm:grid-cols-2">
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="old_role" value={r ?? ""} />
                        <Fields e={e} r={r} offices={offices ?? []} depts={depts ?? []} />
                        <div className="sm:col-span-2"><button className="btn btn-primary"><Save /> Save changes</button></div>
                      </ActionForm>
                      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                        {!e.clerk_user_id && e.active && (
                          <ActionForm action={resendInvite}>
                            <input type="hidden" name="email" value={e.email} />
                            <button className="btn"><RotateCw /> Resend invite</button>
                          </ActionForm>
                        )}
                        <ActionForm action={setActive} confirm={e.active ? `Deactivate ${e.full_name}? They will be signed out and blocked.` : undefined}>
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="active" value={String(!e.active)} />
                          {e.active ? <button className="btn btn-ghost btn-danger"><UserX /> Deactivate</button> : <button className="btn"><UserCheck /> Reactivate</button>}
                        </ActionForm>
                      </div>
                    </div>
                  )}
                </details>
              </li>
            );
          })}
          {!emps?.length && <li className="empty"><Users /> No employees found.</li>}
        </ul>
      </div>
    </>
  );
}
