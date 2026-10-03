import { Mail, MessageCircle, Search, Users } from "lucide-react";
import { employeePage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/shell";
import { openDm } from "../actions";

export const metadata = { title: "Directory" };

export default async function Directory({ searchParams }: PageProps<"/directory">) {
  const me = await employeePage();
  const { q, office } = await searchParams;
  const sb = db();
  const term = String(q ?? "").replace(/[%,()"\\*]/g, "").slice(0, 80); // keep PostgREST filter syntax out
  let query = sb
    .from("employees")
    .select("id, full_name, email, designation, avatar_url, office:offices(name), department:departments(name)")
    .eq("active", true)
    .not("clerk_user_id", "is", null)
    .or("role.is.null,role.neq.admin") // admins are reached via Report an issue
    .order("full_name");
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  if (office) query = query.eq("office_id", String(office));
  const [{ data: people }, { data: offices }] = await Promise.all([query, sb.from("offices").select("id, name").order("name")]);

  return (
    <>
      <PageHeader title="Directory" sub={`${people?.length ?? 0} people`} />
      <div className="space-y-6">
      <form className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q as string} placeholder="Search by name or email" className="input pl-9" />
        </div>
        <select name="office" defaultValue={office as string} className="input w-auto">
          <option value="">All offices</option>
          {offices?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <button className="btn">Search</button>
      </form>
      {people?.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => {
            const dept = (p.department as { name?: string } | null)?.name;
            const off = (p.office as { name?: string } | null)?.name;
            return (
              <li key={p.id} className="card flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Avatar name={p.full_name} src={p.avatar_url} size="size-12" />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.full_name}</div>
                    <div className="truncate text-sm text-muted">{p.designation ?? "-"}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dept && <span className="badge badge-teal">{dept}</span>}
                  {off && <span className="badge">{off}</span>}
                </div>
                <div className="mt-auto flex gap-2">
                  <a href={`mailto:${p.email}`} className="btn flex-1" title={p.email}><Mail /> Email</a>
                  {p.id !== me.id && (
                    <ActionForm action={openDm} className="flex-1">
                      <input type="hidden" name="employee_id" value={p.id} />
                      <button className="btn w-full"><MessageCircle /> Message</button>
                    </ActionForm>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty card"><Users /> No one matches that search.</p>
      )}
      </div>
    </>
  );
}
