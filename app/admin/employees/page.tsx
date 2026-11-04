import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { staffPage, type Role } from "@/lib/me";
import { adminDb, db } from "@/lib/supabase";
import { fmtDate } from "@/lib/util";
import { Ban, ChevronDown, ClipboardList, Hourglass, MailCheck, RotateCw, Save, Search, Send, ShieldCheck, UserCheck, UserCog, UserPlus, Users, UserX } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { AutoForm } from "@/components/auto-form";
import { Pager } from "@/components/pager";
import { pageOf } from "@/lib/calendar";
import { PageHeader } from "@/components/shell";
import { PersonSelect } from "@/components/person-select";
import { editPersonalDetails, inviteEmployee, resendInvite, setActive, updateEmployee } from "../actions";

export const metadata = { title: "Employees" };

type Emp = {
  id: string; email: string; full_name: string; clerk_user_id: string | null; office_id: string | null;
  department_id: string | null; designation: string | null; joined_on: string | null; active: boolean; avatar_url: string | null;
  employee_code: string | null; alias_name: string | null; exit_date: string | null; reports_to: string | null; work_mode?: "office" | "wfh";
};
type Opt = { id: string; name: string; office_id?: string };

function Fields({ e, r, offices, depts, people }: { e?: Emp; r?: Role | null; offices: Opt[]; depts: Opt[]; people?: Opt[] }) {
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
            <option value="manager">Manager (department head)</option>
            <option value="branch_head">Branch head (all departments)</option>
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
      <label className="dept field">Department (sets office)
        <select name="department_id" defaultValue={e?.department_id ?? ""} className="input">
          <option value="">-</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{officeName(d.office_id)} / {d.name}</option>)}
        </select>
      </label>
      <label className="field">Designation<input name="designation" defaultValue={e?.designation ?? ""} className="input" /></label>
      <label className="field">Where do they work?
        <select name="work_mode" defaultValue={e?.work_mode ?? "office"} className="input">
          <option value="office">In office (one Check in button, location required)</option>
          <option value="wfh">Work from home (can check in from office or home)</option>
        </select>
      </label>
      {e && people && (
        <label className="field">Reports to
          <PersonSelect name="reports_to" defaultValue={e.reports_to} empty="-" options={people.filter((p) => p.id !== e.id).map((p) => ({ id: p.id, label: p.name }))} />
        </label>
      )}
      <label className="field">Joining date<input name="joined_on" type="date" defaultValue={e?.joined_on ?? ""} className="input" /></label>
      {!e && <label className="field">Annual CTC (₹)<input name="annual_ctc" type="number" min="1" step="any" inputMode="decimal" placeholder="Optional, can be added later in Payroll" className="input" /></label>}
      {e && <label className="field">Exit date<input name="exit_date" type="date" defaultValue={e.exit_date ?? ""} className="input" /></label>}
      </>
      )}
    </>
  );
}

type Profile = {
  employee_id: string; date_of_birth: string; gender: string | null; phone: string; personal_email: string | null; blood_group: string | null;
  current_address: string; permanent_address: string | null; emergency_name: string; emergency_relation: string; emergency_phone: string;
  company: string | null; lgoob_alias: string | null; lgoob_email: string | null; fusion_alias: string | null; fusion_email: string | null;
};

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Admin/HR edit of someone's personal details. Every save needs a reason (goes to the audit log).
function Details({ e, p }: { e: Emp; p?: Profile }) {
  if (!p) return <p className="flex items-center gap-2 text-sm text-amber"><ClipboardList className="size-4" /> Hasn&apos;t filled in their personal details yet.</p>;
  return (
    <ActionForm action={editPersonalDetails} keep success="Saved" className="company grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={e.id} />
      <label className="field">Full name<input name="full_name" required defaultValue={e.full_name} className="input" /></label>
      <label className="field">Alias name<input name="alias_name" maxLength={60} defaultValue={e.alias_name ?? ""} className="input" /></label>
      <label className="field">Date of birth<input type="date" name="date_of_birth" required defaultValue={p.date_of_birth} className="input" /></label>
      <label className="field">Gender
        <select name="gender" defaultValue={p.gender ?? ""} className="input">
          <option value="">-</option>
          {GENDERS.map((g) => <option key={g}>{g}</option>)}
        </select>
      </label>
      <label className="field">Mobile<input type="tel" name="phone" required defaultValue={p.phone} className="input" /></label>
      <label className="field">Personal email<input type="email" name="personal_email" defaultValue={p.personal_email ?? ""} className="input" /></label>
      <label className="field">Blood group
        <select name="blood_group" defaultValue={p.blood_group ?? ""} className="input">
          <option value="">-</option>
          {BLOOD.map((b) => <option key={b}>{b}</option>)}
        </select>
      </label>
      <div className="field" role="radiogroup" aria-label="Company">
        <span>Company</span>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {[["lgoob", "LGOOB"], ["fusion", "Fusion Freights"], ["both", "Both"]].map(([v, l]) => (
            <label key={v} className="check"><input type="radio" name="company" value={v} required defaultChecked={p.company === v} /> {l}</label>
          ))}
        </div>
      </div>
      <label className="lg field">LGOOB alias name<input name="lgoob_alias" maxLength={60} defaultValue={p.lgoob_alias ?? ""} className="input" /></label>
      <label className="lg field">LGOOB email<input type="email" name="lgoob_email" defaultValue={p.lgoob_email ?? ""} className="input" /></label>
      <label className="ff field">Fusion Freights alias name<input name="fusion_alias" maxLength={60} defaultValue={p.fusion_alias ?? ""} className="input" /></label>
      <label className="ff field">Fusion Freights email<input type="email" name="fusion_email" defaultValue={p.fusion_email ?? ""} className="input" /></label>
      <label className="field sm:col-span-2">Current address<textarea name="current_address" required rows={2} defaultValue={p.current_address} className="input" /></label>
      <label className="field sm:col-span-2">Permanent address<textarea name="permanent_address" rows={2} defaultValue={p.permanent_address ?? ""} className="input" /></label>
      <label className="field">Emergency contact name<input name="emergency_name" required defaultValue={p.emergency_name} className="input" /></label>
      <label className="field">Relationship<input name="emergency_relation" required defaultValue={p.emergency_relation} className="input" /></label>
      <label className="field">Emergency phone<input type="tel" name="emergency_phone" required defaultValue={p.emergency_phone} className="input" /></label>
      <label className="field sm:col-span-2">Reason for the change
        <input name="reason" required minLength={5} maxLength={500} placeholder="e.g. Employee sent a corrected ID by email" className="input" />
      </label>
      <div className="sm:col-span-2"><button className="btn btn-primary"><Save /> Save details</button></div>
    </ActionForm>
  );
}

const SIZE = 25;

export default async function Employees({ searchParams }: PageProps<"/admin/employees">) {
  const me = await staffPage();
  const isAdmin = me.role === "admin";
  const canEdit = isAdmin || me.role === "hr"; // personal details; HR is limited to their office by the query below
  const { q, status: st, access: ac, role: rl, page: pg } = await searchParams;
  const { page, from, to } = pageOf(pg, SIZE);
  const status = st === "active" || st === "inactive" ? st : "all";
  const access = ac === "invited" || ac === "accepted" ? ac : "all"; // invited = email sent, not signed up yet; accepted = signed up
  const ROLES = ["employee", "manager", "branch_head", "hr", "admin", "none"] as const; // none = signed up, no role assigned yet
  const role = ROLES.find((x) => x === rl) ?? "all";
  const sb = db();
  let query = sb.from("employees").select("*", { count: "exact" }).order("active", { ascending: false }).order("full_name").range(from, to);
  if (!isAdmin) query = query.eq("office_id", me.office_id ?? "");
  if (status !== "all") query = query.eq("active", status === "active");
  if (access === "invited") query = query.is("clerk_user_id", null);
  if (access === "accepted") query = query.not("clerk_user_id", "is", null);
  if (role === "none") query = query.not("clerk_user_id", "is", null).is("role", null);
  else if (role !== "all") query = query.eq("role", role);
  if (q) query = query.ilike("full_name", `%${String(q).replace(/[%,()]/g, "")}%`);
  let everyoneQ = sb.from("employees").select("id, name:full_name, active, clerk_user_id").order("full_name");
  if (!isAdmin) everyoneQ = everyoneQ.eq("office_id", me.office_id ?? "");
  const [{ data: emps, count: total }, { data: offices }, { data: depts }, { data: everyone }] = await Promise.all([
    query,
    sb.from("offices").select("id, name").order("name"),
    sb.from("departments").select("id, name, office_id").order("name"),
    everyoneQ, // all rows in scope, for counts + "Reports to"
  ]);
  const counts = { all: everyone?.length ?? 0, active: everyone?.filter((p) => p.active).length ?? 0, inactive: everyone?.filter((p) => !p.active).length ?? 0 };
  const accessCounts = { all: counts.all, invited: everyone?.filter((p) => !p.clerk_user_id).length ?? 0, accepted: everyone?.filter((p) => p.clerk_user_id).length ?? 0 };
  const managers = (everyone ?? []).filter((p) => p.active);
  // link that changes one filter and keeps the others (an empty value drops that filter)
  const keep = (over: Record<string, string>) => `?${new URLSearchParams(Object.entries({ ...(q ? { q: String(q) } : {}), ...(status !== "all" ? { status } : {}), ...(access !== "all" ? { access } : {}), ...(role !== "all" ? { role } : {}), ...over }).filter(([, v]) => v))}`;

  // Roles live in Clerk publicMetadata of joined users.
  // ponytail: single page of 500 users; paginate past that.
  const linked = (emps ?? []).flatMap((e: Emp) => (e.clerk_user_id ? [e.clerk_user_id] : []));
  const [users, { data: profiles }] = await Promise.all([
    linked.length ? (await clerkClient()).users.getUserList({ userId: linked, limit: 500 }) : { data: [] },
    canEdit ? adminDb().from("employee_profiles").select("*").in("employee_id", (emps ?? []).map((e: Emp) => e.id)) : { data: [] }, // server key: RLS hides profiles from HR
  ]);
  const profileOf = (id: string) => (profiles as Profile[] | null)?.find((p) => p.employee_id === id);
  const roleOf = (e: Emp) => (users.data.find((u) => u.id === e.clerk_user_id)?.publicMetadata?.role as Role | undefined) ?? null;
  const name = (list: Opt[] | null, id: string | null) => list?.find((x) => x.id === id)?.name;
  const detail = (e: Emp) => [e.designation, name(depts, e.department_id), name(offices, e.office_id)].filter(Boolean).join(" · ");

  const waiting = (emps ?? []).filter((e: Emp) => e.active && e.clerk_user_id && !roleOf(e)).length;
  const STATUS = {
    Inactive: ["", Ban],
    Invited: ["badge-blue", MailCheck],
    "Needs role": ["badge-amber", Hourglass],
  } as const;

  return (
    <>
      <PageHeader title="Employees" sub={`${total ?? 0} people${waiting ? ` · ${waiting} waiting for a role` : ""}`} />
      <div className="space-y-5">
        {isAdmin && (
          <details className="card group p-0">
            <summary className="flex cursor-pointer items-center gap-3 rounded-2xl px-5 py-4 transition-colors hover:bg-surface-2/60">
              <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-fg"><UserPlus className="size-4" /></span>
              <span className="leading-tight">
                <span className="block font-semibold">Invite an employee</span>
                <span className="block text-sm text-muted">Send an email invite and assign a role after they sign up.</span>
              </span>
              <ChevronDown className="ml-auto size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <ActionForm action={inviteEmployee} className="grid gap-4 border-t border-line px-5 py-5 sm:grid-cols-2">
              <Fields offices={offices ?? []} depts={depts ?? []} />
              <p className="text-xs text-muted sm:col-span-2">They get an email invitation. After signing up they wait on a &quot;no role yet&quot; screen until you assign a role here.</p>
              <div><button className="btn btn-primary"><Send /> Send invite</button></div>
            </ActionForm>
          </details>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <nav aria-label="Filter by status" className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
              {([["all", "All"], ["active", "Active"], ["inactive", "Deactivated"]] as const).map(([k, label]) => (
                <Link key={k} href={keep({ status: k === "all" ? "" : k })} aria-current={status === k ? "page" : undefined}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-colors ${status === k ? "bg-surface font-medium text-text shadow-[0_1px_2px_rgb(24_24_27/0.08)]" : "text-muted hover:text-text"}`}>
                  {label} <span className="text-xs tabular-nums opacity-70">{counts[k]}</span>
                </Link>
              ))}
            </nav>
            <nav aria-label="Filter by invite" className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
              {([["all", "Everyone"], ["invited", "Invited"], ["accepted", "Accepted"]] as const).map(([k, label]) => (
                <Link key={k} href={keep({ access: k === "all" ? "" : k })} aria-current={access === k ? "page" : undefined}
                  title={k === "invited" ? "Invite sent, not signed up yet" : k === "accepted" ? "Signed up" : undefined}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-colors ${access === k ? "bg-surface font-medium text-text shadow-[0_1px_2px_rgb(24_24_27/0.08)]" : "text-muted hover:text-text"}`}>
                  {label} <span className="text-xs tabular-nums opacity-70">{accessCounts[k]}</span>
                </Link>
              ))}
            </nav>
            <AutoForm className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {status !== "all" && <input type="hidden" name="status" value={status} />}
              {access !== "all" && <input type="hidden" name="access" value={access} />}
              <select name="role" defaultValue={role === "all" ? "" : role} aria-label="Filter by role" className="input w-auto">
                <option value="">All roles</option>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="branch_head">Branch head</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
                <option value="none">Needs a role</option>
              </select>
              <span className="relative block w-full sm:w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                <input name="q" defaultValue={q as string} placeholder="Search by name" aria-label="Search by name" className="input pl-9" />
              </span>
            </AutoForm>
          </div>
        </div>

        <ul className="card divide-y divide-line p-0">
          {emps?.map((e: Emp) => {
            const r = roleOf(e);
            const status = !e.active ? "Inactive" : !e.clerk_user_id ? "Invited" : !r ? "Needs role" : null;
            const StatusIcon = status ? STATUS[status][1] : null;
            return (
              <li key={e.id}>
                <details className={`group ${e.active ? "" : "opacity-60"}`}>
                  <summary className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${canEdit ? "cursor-pointer hover:bg-surface-2/60" : ""}`}>
                    <Avatar name={e.full_name} src={e.avatar_url} size="size-11" />
                    <span className="min-w-0 flex-1 leading-snug md:flex-none md:basis-72">
                      <span className="block truncate font-semibold">
                        {e.full_name}
                        {e.alias_name && <span className="ml-1.5 font-normal text-muted">({e.alias_name})</span>}
                      </span>
                      <span className="block truncate text-sm text-muted">{e.email}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted md:hidden">{detail(e) || "No office or department"}</span>
                    </span>
                    <span className="hidden min-w-0 flex-1 leading-snug md:block">
                      <span className="block truncate text-sm">{e.designation || <span className="text-muted">No designation</span>}</span>
                      <span className="block truncate text-xs text-muted">
                        {[name(depts, e.department_id), name(offices, e.office_id)].filter(Boolean).join(" / ") || "No office or department"}
                        {e.employee_code && <span className="tabular-nums"> · {e.employee_code}</span>}
                        {e.exit_date && ` · Exit ${fmtDate(e.exit_date)}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      {r && r !== "employee" && <span className="badge badge-teal capitalize"><ShieldCheck /> {r.replace("_", " ")}</span>}
                      {status && StatusIcon && <span className={`badge ${STATUS[status][0]}`}><StatusIcon /> {status}</span>}
                    </span>
                    {canEdit && <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />}
                  </summary>
                  {canEdit && (
                    <div className="space-y-4 border-t border-line bg-surface-2/50 px-5 py-5">
                      {e.clerk_user_id && r !== "admin" && (
                        <section className="rounded-xl border border-line bg-surface p-4">
                          <h3 className="h2"><ClipboardList /> Personal details</h3>
                          <Details e={e} p={profileOf(e.id)} />
                        </section>
                      )}
                      {isAdmin && <>
                      <section className="rounded-xl border border-line bg-surface p-4">
                      <h3 className="h2"><UserCog /> Role and placement</h3>
                      <ActionForm action={updateEmployee} keep success="Saved" className="grid gap-4 sm:grid-cols-2">
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="old_role" value={r ?? ""} />
                        <Fields e={e} r={r} offices={offices ?? []} depts={depts ?? []} people={managers} />
                        <div className="sm:col-span-2"><button className="btn btn-primary"><Save /> Save changes</button></div>
                      </ActionForm>
                      </section>
                      <div className="flex flex-wrap items-center justify-end gap-2">
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
                      </>}
                    </div>
                  )}
                </details>
              </li>
            );
          })}
          {!emps?.length && (
            <li className="empty py-12">
              <Users />
              {q || status !== "all" ? "No one matches these filters." : "No employees yet."}
              {(q || status !== "all") && <Link href="?" className="btn mt-1">Clear filters</Link>}
            </li>
          )}
        </ul>
        <Pager page={page} total={total ?? 0} size={SIZE} />
      </div>
    </>
  );
}
