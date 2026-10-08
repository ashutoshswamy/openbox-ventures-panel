import Link from "next/link";
import { ArrowLeft, MessageCircle, UsersRound } from "lucide-react";
import { pageMe } from "@/lib/me";
import { db } from "@/lib/supabase";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { createGroup, openDm } from "@/app/(employee)/actions";

export const metadata = { title: "New conversation" };

export default async function NewChat() {
  const me = await pageMe();
  const admin = me.role === "admin";
  // admins: one-to-one with anyone (admins included), no groups. Everyone else: no admins (they can't be messaged first).
  let q = db().from("employees").select("id, full_name, avatar_url, role").eq("active", true).not("clerk_user_id", "is", null).neq("id", me.id).order("full_name");
  if (!admin) q = q.or("role.is.null,role.neq.admin");
  const { data: people } = await q;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="mx-auto max-w-md space-y-10">
        <Link href="/chat" className="btn btn-ghost -ml-2 md:hidden"><ArrowLeft /> Conversations</Link>
        <div>
          <h2 className="h2"><MessageCircle /> Direct message</h2>
          <ActionForm action={openDm} className="flex gap-2">
            <select name="employee_id" required aria-label="Person" className="input h-10">
              {people?.map((p) => <option key={p.id} value={p.id}>{p.full_name}{admin && p.role === "admin" ? " (admin)" : ""}</option>)}
            </select>
            <button className="btn btn-primary h-10">Open</button>
          </ActionForm>
        </div>
        {!admin && <div>
          <h2 className="h2"><UsersRound /> New group</h2>
          <ActionForm action={createGroup} className="space-y-4">
            <label className="field">Group name<input name="name" required className="input h-10" /></label>
            <fieldset className="field">
              <legend className="mb-2">Members</legend>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-line bg-surface p-1">
                {people?.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm font-normal transition-colors hover:bg-surface-2 has-checked:bg-primary-soft">
                    <input type="checkbox" name="members" value={p.id} className="size-4 accent-primary" />
                    <Avatar name={p.full_name} src={p.avatar_url} size="size-7 text-[11px]" />
                    {p.full_name}
                  </label>
                ))}
                {!people?.length && <p className="px-2.5 py-4 text-sm text-muted">No teammates have joined yet.</p>}
              </div>
              <span className="text-xs font-normal text-muted">Department channels appear automatically.</span>
            </fieldset>
            <button className="btn btn-primary h-10">Create group</button>
          </ActionForm>
        </div>}
      </div>
    </div>
  );
}
