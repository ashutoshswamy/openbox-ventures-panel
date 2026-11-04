import { Circle, CircleCheck, ListTodo, Plus, Send, Trash2 } from "lucide-react";
import type { Me } from "@/lib/me";
import { PersonSelect } from "@/components/person-select";
import { db } from "@/lib/supabase";
import { fmtDate, todayIn } from "@/lib/util";
import { addTodo, deleteTodo, toggleTodo } from "@/app/todo-actions";
import { ActionForm } from "./action-form";
import { Avatar } from "./avatar";
import { PageHeader } from "./shell";

type Todo = {
  id: string; owner_id: string; title: string; due_on: string | null; done_at: string | null; assigned_by: string | null;
  assigner: { full_name: string } | null; owner: { full_name: string; avatar_url: string | null } | null;
};
const cols = "id, owner_id, title, due_on, done_at, assigned_by, assigner:employees!todos_assigned_by_fkey(full_name), owner:employees!todos_owner_id_fkey(full_name, avatar_url)";

const dueLabel = (d: string, today: string) => {
  if (d === today) return "Today";
  if (d === new Date(Date.parse(today) + 864e5).toISOString().slice(0, 10)) return "Tomorrow";
  return fmtDate(d);
};

function Row({ t, showOwner }: { t: Todo; showOwner?: boolean }) {
  const today = todayIn();
  const overdue = !t.done_at && !!t.due_on && t.due_on < today;
  const canDelete = !t.assigned_by || t.assigned_by === t.owner_id || showOwner;
  return (
    <li className="group flex items-center gap-3 py-2.5">
      <ActionForm action={toggleTodo} keep>
        <input type="hidden" name="id" value={t.id} />
        <button name="done" value={t.done_at ? "0" : "1"} title={t.done_at ? "Mark not done" : "Mark done"} aria-label={`${t.done_at ? "Reopen" : "Complete"}: ${t.title}`} className="grid size-6 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:text-text">
          {t.done_at ? <CircleCheck className="size-5 text-green" /> : <Circle className="size-5" />}
        </button>
      </ActionForm>
      {showOwner && t.owner && <Avatar name={t.owner.full_name} src={t.owner.avatar_url} size="size-7 text-[11px]" />}
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] leading-snug break-words ${t.done_at ? "text-muted line-through" : ""}`}>{t.title}</p>
        {(showOwner || t.assigner) && <p className="text-xs text-muted">{showOwner ? t.owner?.full_name : `From ${t.assigner!.full_name}`}</p>}
      </div>
      {t.due_on && !t.done_at && (
        <span className={`shrink-0 text-xs tabular-nums ${overdue ? "font-medium text-red" : t.due_on === today ? "font-medium text-amber" : "text-muted"}`}>{dueLabel(t.due_on, today)}</span>
      )}
      {canDelete && (
        <ActionForm action={deleteTodo} confirm={t.assigned_by ? "Withdraw this task?" : undefined}>
          <input type="hidden" name="id" value={t.id} />
          <button className="btn btn-ghost btn-icon btn-danger h-7 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100" title="Delete" aria-label={`Delete: ${t.title}`}><Trash2 /></button>
        </ActionForm>
      )}
    </li>
  );
}

function List({ todos, showOwner, empty }: { todos: Todo[]; showOwner?: boolean; empty: string }) {
  const today = todayIn();
  const open = todos.filter((t) => !t.done_at);
  const done = todos.filter((t) => t.done_at);
  const groups = [
    { label: "Overdue", tone: "text-red", items: open.filter((t) => t.due_on && t.due_on < today) },
    { label: "Today", tone: "", items: open.filter((t) => t.due_on === today) },
    { label: "Upcoming", tone: "", items: open.filter((t) => t.due_on && t.due_on > today) },
    { label: "Whenever", tone: "", items: open.filter((t) => !t.due_on) },
  ].filter((g) => g.items.length);
  return (
    <>
      {groups.length ? (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label}>
              <h3 className={`mb-1 flex items-baseline gap-2 border-b border-line pb-2 text-sm font-semibold ${g.tone}`}>{g.label}<span className="font-normal text-muted tabular-nums">{g.items.length}</span></h3>
              <ul className="divide-y divide-line/60">{g.items.map((t) => <Row key={t.id} t={t} showOwner={showOwner} />)}</ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="empty"><ListTodo /> {empty}</p>
      )}
      {!!done.length && (
        <details className="mt-6">
          <summary className="cursor-pointer py-1 text-sm text-muted hover:text-text">Completed ({done.length})</summary>
          <ul className="mt-1 divide-y divide-line/60">{done.map((t) => <Row key={t.id} t={t} showOwner={showOwner} />)}</ul>
        </details>
      )}
    </>
  );
}

// Personal list for everyone; `assign` (admins, managers) adds the assign form + "Assigned by me".
export async function TodoPage({ me, assign }: { me: Me; assign?: boolean }) {
  const sb = db();
  // ponytail: done items kept forever, newest 100 rows shown; add "clear done" if lists get long
  const [{ data: mine }, assigned, people] = await Promise.all([
    sb.from("todos").select(cols).eq("owner_id", me.id).order("done_at", { ascending: false, nullsFirst: true }).order("due_on", { nullsFirst: false }).order("created_at").limit(100),
    assign
      ? sb.from("todos").select(cols).eq("assigned_by", me.id).neq("owner_id", me.id).order("done_at", { ascending: false, nullsFirst: true }).order("due_on", { nullsFirst: false }).limit(100)
      : null,
    assign
      ? (() => {
          const q = sb.from("employees").select("id, full_name").eq("active", true).in("role", ["employee", "manager", "branch_head", "hr"]).neq("id", me.id).order("full_name");
          if (me.role === "admin") return q;
          return me.role === "manager" ? q.eq("office_id", me.office_id ?? "").eq("department_id", me.department_id ?? "") : q.eq("office_id", me.office_id ?? "");
        })()
      : null,
  ]);

  const list = (mine ?? []) as unknown as Todo[];
  const today = todayIn();
  const openCount = list.filter((t) => !t.done_at).length;
  const lateCount = list.filter((t) => !t.done_at && t.due_on && t.due_on < today).length;
  const sub = !list.length ? "Nothing yet" : !openCount ? "All done" : `${openCount} open${lateCount ? `, ${lateCount} overdue` : ""}`;

  return (
    <>
      <PageHeader title="To-do" sub={sub} />
      <div className={assign ? "grid items-start gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]" : "max-w-2xl"}>
        <div>
          <ActionForm action={addTodo} className="mb-8 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2 pl-4 transition focus-within:border-text/40 focus-within:ring-3 focus-within:ring-text/10 sm:flex-nowrap">
            <label className="sr-only" htmlFor="new-task">New task</label>
            <input id="new-task" name="title" required maxLength={300} autoComplete="off" placeholder="Add a task" aria-label="Add a task" className="h-10 min-w-0 flex-1 basis-full bg-transparent text-[15px] outline-none placeholder:text-muted sm:basis-auto" />
            <label className="sr-only" htmlFor="new-due">Due date</label>
            <input id="new-due" type="date" name="due_on" min={today} className="input h-10 w-auto min-w-0 border-transparent bg-surface-2 text-muted" />
            <button className="btn btn-primary h-10"><Plus /> Add</button>
          </ActionForm>
          <List todos={list} empty="Nothing on your list. Add the first task above." />
        </div>

        {assign && (
          <aside className="space-y-10 lg:sticky lg:top-6">
            <section>
              <h2 className="h2">Assign a task</h2>
              <ActionForm action={addTodo} success="Task assigned" className="space-y-4 rounded-2xl border border-line bg-surface p-5">
                <label className="field">Assign to
                  <PersonSelect name="owner_id" required placeholder="Search for a person" options={(people?.data ?? []).map((p) => ({ id: p.id, label: p.full_name }))} />
                </label>
                <label className="field">Task<input name="title" required maxLength={300} placeholder="What should they do?" className="input" /></label>
                <div className="flex items-end justify-between gap-3">
                  <label className="field flex-1">Due<input type="date" name="due_on" min={today} className="input" /></label>
                  <button className="btn btn-primary"><Send /> Assign</button>
                </div>
              </ActionForm>
            </section>
            <section>
              <h2 className="h2">Assigned by me</h2>
              <List todos={(assigned?.data ?? []) as unknown as Todo[]} showOwner empty="No tasks handed out." />
            </section>
          </aside>
        )}
      </div>
    </>
  );
}
