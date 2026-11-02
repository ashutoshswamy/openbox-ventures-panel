import { CalendarClock, Circle, CircleCheck, ListTodo, Plus, Send, Trash2, UserRoundPlus } from "lucide-react";
import type { Me } from "@/lib/me";
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

function Row({ t, showOwner }: { t: Todo; showOwner?: boolean }) {
  const today = todayIn();
  const overdue = !t.done_at && t.due_on && t.due_on < today;
  const canDelete = !t.assigned_by || t.assigned_by === t.owner_id || showOwner;
  return (
    <li className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2/70">
      <ActionForm action={toggleTodo} keep>
        <input type="hidden" name="id" value={t.id} />
        <button name="done" value={t.done_at ? "0" : "1"} title={t.done_at ? "Mark not done" : "Mark done"} className="grid size-6 cursor-pointer place-items-center rounded-full text-muted transition hover:text-text">
          {t.done_at ? <CircleCheck className="size-5 text-green" /> : <Circle className="size-5" />}
        </button>
      </ActionForm>
      {showOwner && t.owner && <Avatar name={t.owner.full_name} src={t.owner.avatar_url} size="size-7" />}
      <div className="min-w-0 flex-1">
        <p className={`text-sm break-words ${t.done_at ? "text-muted line-through" : "font-medium"}`}>{t.title}</p>
        {(showOwner || t.assigner) && <p className="text-xs text-muted">{showOwner ? t.owner?.full_name : `From ${t.assigner!.full_name}`}</p>}
      </div>
      {t.due_on && !t.done_at && (
        <span className={`badge ${overdue ? "badge-red" : t.due_on === today ? "badge-amber" : ""}`}><CalendarClock /> {t.due_on === today ? "Today" : fmtDate(t.due_on)}</span>
      )}
      {canDelete && (
        <ActionForm action={deleteTodo} confirm={t.assigned_by ? "Withdraw this task?" : undefined}>
          <input type="hidden" name="id" value={t.id} />
          <button className="btn btn-ghost btn-icon btn-danger h-7 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100" title="Delete"><Trash2 /></button>
        </ActionForm>
      )}
    </li>
  );
}

function Progress({ todos }: { todos: Todo[] }) {
  const done = todos.filter((t) => t.done_at).length;
  const pct = todos.length ? Math.round((done / todos.length) * 100) : 0;
  if (!todos.length) return null;
  return (
    <div className="mb-5">
      <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted tabular-nums"><span>{done} of {todos.length} done</span><span>{pct}%</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-green transition-[width]" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function List({ todos, showOwner, empty }: { todos: Todo[]; showOwner?: boolean; empty: string }) {
  const today = todayIn();
  const open = todos.filter((t) => !t.done_at);
  const done = todos.filter((t) => t.done_at);
  const groups = [
    { label: "Overdue", tone: "text-red", items: open.filter((t) => t.due_on && t.due_on < today) },
    { label: "Today", tone: "text-amber", items: open.filter((t) => t.due_on === today) },
    { label: "Upcoming", tone: "text-muted", items: open.filter((t) => t.due_on && t.due_on > today) },
    { label: "No date", tone: "text-muted", items: open.filter((t) => !t.due_on) },
  ].filter((g) => g.items.length);
  return (
    <>
      <Progress todos={todos} />
      {groups.length ? (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.label}>
              <h3 className={`mb-1 px-2 text-xs font-semibold tracking-wide uppercase ${g.tone}`}>{g.label} <span className="font-normal opacity-70">{g.items.length}</span></h3>
              <ul>{g.items.map((t) => <Row key={t.id} t={t} showOwner={showOwner} />)}</ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty"><ListTodo /> {empty}</p>
      )}
      {!!done.length && (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer px-2 py-1 text-sm text-muted hover:text-text">Done ({done.length})</summary>
          <ul className="mt-1">{done.map((t) => <Row key={t.id} t={t} showOwner={showOwner} />)}</ul>
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

  const dueField = (
    <label className="field sm:w-40">Due<input type="date" name="due_on" min={todayIn()} className="input" /></label>
  );

  return (
    <>
      <PageHeader title="To-do" sub={assign ? "Your own list, plus tasks you hand out to your team." : "Your own list, plus tasks assigned to you."} />
      <div className={`grid gap-6 ${assign ? "lg:grid-cols-2" : "max-w-2xl"}`}>
        <section className="card h-fit">
          <h2 className="h2"><ListTodo /> My list</h2>
          <ActionForm action={addTodo} className="mb-3 flex flex-wrap items-end gap-2 sm:flex-nowrap">
            <label className="field flex-1">Task<input name="title" required maxLength={300} placeholder="What needs doing?" className="input" /></label>
            {dueField}
            <button className="btn btn-primary"><Plus /> Add</button>
          </ActionForm>
          <List todos={(mine ?? []) as unknown as Todo[]} empty="Nothing on your list." />
        </section>

        {assign && (
          <section className="space-y-6">
            <div className="card">
              <h2 className="h2"><UserRoundPlus /> Assign a task</h2>
              <ActionForm action={addTodo} success="Task assigned" className="space-y-3">
                <label className="field">Assign to
                  <select name="owner_id" required className="input" defaultValue="">
                    <option value="" disabled>Pick a person</option>
                    {people?.data?.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </label>
                <label className="field">Task<input name="title" required maxLength={300} placeholder="What should they do?" className="input" /></label>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  {dueField}
                  <button className="btn btn-primary"><Send /> Assign</button>
                </div>
              </ActionForm>
            </div>
            <div className="card">
              <h2 className="h2"><CalendarClock /> Assigned by me</h2>
              <List todos={(assigned?.data ?? []) as unknown as Todo[]} showOwner empty="No open tasks handed out." />
            </div>
          </section>
        )}
      </div>
    </>
  );
}
