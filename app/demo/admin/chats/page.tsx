"use client";
import { ChevronDown, Hash, MessagesSquare, Plus, Save, Trash2, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader, useAdm } from "@/components/demo/adm-ui";
import { useChats, useOffices, type Chat } from "@/lib/demo/admin";
import { newId } from "@/lib/demo/store";
import { str } from "@/lib/util";

export default function Chats() {
  const { emps, log } = useAdm();
  const [chats, setChats] = useChats();
  const [offices] = useOffices();
  const people = emps.filter((e) => e.active && !e.invited && e.role !== "admin").sort((a, b) => a.name.localeCompare(b.name));

  const save = async (fd: FormData, c?: Chat) => {
    const name = str(fd, "name");
    if (!name) return "Name required";
    const members = fd.getAll("members").map(String);
    if (!members.length) return "Pick at least one member";
    setChats((l) => (c ? l.map((x) => (x.id === c.id ? { ...x, name, members } : x)) : [...l, { id: newId(), name, members }]));
    log(c ? "Updated group chat" : "Created group chat", name);
  };

  const members = (picked?: string[]) => (
    <fieldset className="field sm:col-span-2">
      <legend className="mb-2">Who can chat here</legend>
      <div className="max-h-72 overflow-y-auto rounded-lg border border-line bg-surface p-1">
        {people.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm font-normal transition-colors hover:bg-surface-2 has-checked:bg-primary-soft">
            <input type="checkbox" name="members" value={p.id} defaultChecked={picked?.includes(p.id)} className="size-4 accent-primary" />
            <Avatar name={p.name} src={null} size="size-7 text-[11px]" />
            <span className="flex-1">{p.name}</span>
            <span className="text-xs text-muted">{offices.find((o) => o.id === p.office_id)?.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <>
      <PageHeader title="Chats" sub="Group chats you set up. Members see them in their Chat; you pick who's in." />
      <div className="max-w-3xl space-y-6">
        <details className="card group" open={!chats.length}>
          <summary className="flex cursor-pointer items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-fg"><Plus className="size-4" /></span>
            New chat
            <ChevronDown className="ml-auto size-5 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <ActionForm action={(fd) => save(fd)} className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
            <label className="field sm:col-span-2">Chat name<input name="name" required maxLength={100} className="input" /></label>
            {members()}
            <div><button className="btn btn-primary"><Plus /> Create chat</button></div>
          </ActionForm>
        </details>

        {chats.map((c) => (
          <details key={c.id} className="card group">
            <summary className="flex cursor-pointer items-center gap-3 font-semibold">
              <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted"><Hash className="size-4" /></span>
              {c.name}
              <span className="badge ml-auto"><Users /> {c.members.length}</span>
              <ChevronDown className="size-5 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <ActionForm action={(fd) => save(fd, c)} keep success="Saved" className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
              <label className="field sm:col-span-2">Chat name<input name="name" required maxLength={100} defaultValue={c.name} className="input" /></label>
              {members(c.members)}
              <div><button className="btn btn-primary"><Save /> Save</button></div>
            </ActionForm>
            <ActionForm action={async () => { setChats((l) => l.filter((x) => x.id !== c.id)); log("Deleted group chat", c.name); }} confirm={`Delete ${c.name}? All its messages are deleted too.`} className="mt-3">
              <button className="btn btn-danger"><Trash2 /> Delete chat</button>
            </ActionForm>
          </details>
        ))}
        {!chats.length && <p className="card empty"><MessagesSquare /> No chats yet. Create one above.</p>}
      </div>
    </>
  );
}
