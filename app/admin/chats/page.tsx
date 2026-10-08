import { adminPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { ChevronDown, Hash, MessagesSquare, Plus, Save, Trash2, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/shell";
import { deleteChat, saveChat } from "../actions";

export const metadata = { title: "Chats" };

type Person = { id: string; full_name: string; avatar_url: string | null; office: { name: string } | null };

function Members({ people, picked }: { people: Person[]; picked?: Set<string> }) {
  return (
    <fieldset className="field sm:col-span-2">
      <legend className="mb-2">Who can chat here</legend>
      <div className="max-h-72 overflow-y-auto rounded-lg border border-line bg-surface p-1">
        {people.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm font-normal transition-colors hover:bg-surface-2 has-checked:bg-primary-soft">
            <input type="checkbox" name="members" value={p.id} defaultChecked={picked?.has(p.id)} className="size-4 accent-primary" />
            <Avatar name={p.full_name} src={p.avatar_url} size="size-7 text-[11px]" />
            <span className="flex-1">{p.full_name}</span>
            {p.office && <span className="text-xs text-muted">{p.office.name}</span>}
          </label>
        ))}
        {!people.length && <p className="px-2.5 py-4 text-sm text-muted">No employees have joined yet.</p>}
      </div>
    </fieldset>
  );
}

export default async function Chats() {
  await adminPage();
  const sb = db();
  const [{ data: people }, { data: chats }] = await Promise.all([
    sb.from("employees").select("id, full_name, avatar_url, office:offices(name)").eq("active", true).not("clerk_user_id", "is", null).or("role.is.null,role.neq.admin").order("full_name"),
    // ponytail: admin-made chats = created by any admin; employees' own groups stay out of this list
    sb.from("channels").select("id, name, creator:employees!channels_created_by_fkey(role), members:channel_members(employee_id)").eq("type", "group").eq("announcements", false).order("name"),
  ]);
  const ppl = (people ?? []) as unknown as Person[];
  const mine = ((chats ?? []) as unknown as { id: string; name: string; creator: { role: string | null } | null; members: { employee_id: string }[] }[])
    .filter((c) => c.creator?.role === "admin");

  return (
    <>
      <PageHeader title="Chats" sub="Group chats you set up. Members see them in their Chat; you pick who's in." />
      <div className="max-w-3xl space-y-6">
        <details className="card group" open={!mine.length}>
          <summary className="flex cursor-pointer items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-fg"><Plus className="size-4" /></span>
            New chat
            <ChevronDown className="ml-auto size-5 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <ActionForm action={saveChat} className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
            <label className="field sm:col-span-2">Chat name<input name="name" required maxLength={100} className="input" /></label>
            <Members people={ppl} />
            <div><button className="btn btn-primary"><Plus /> Create chat</button></div>
          </ActionForm>
        </details>

        {mine.map((c) => (
          <details key={c.id} className="card group">
            <summary className="flex cursor-pointer items-center gap-3 font-semibold">
              <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted"><Hash className="size-4" /></span>
              {c.name}
              <span className="badge ml-auto"><Users /> {c.members.length}</span>
              <ChevronDown className="size-5 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <ActionForm action={saveChat} keep success="Saved" className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
              <input type="hidden" name="id" value={c.id} />
              <label className="field sm:col-span-2">Chat name<input name="name" required maxLength={100} defaultValue={c.name} className="input" /></label>
              <Members people={ppl} picked={new Set(c.members.map((m) => m.employee_id))} />
              <div><button className="btn btn-primary"><Save /> Save</button></div>
            </ActionForm>
            <ActionForm action={deleteChat} confirm={`Delete ${c.name}? All its messages are deleted too.`} className="mt-3">
              <input type="hidden" name="id" value={c.id} />
              <button className="btn btn-danger"><Trash2 /> Delete chat</button>
            </ActionForm>
          </details>
        ))}
        {!mine.length && <p className="card empty"><MessagesSquare /> No chats yet. Create one above.</p>}
      </div>
    </>
  );
}
