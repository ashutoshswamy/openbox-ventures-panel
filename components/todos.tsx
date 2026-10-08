import { CalendarClock, Circle, CircleCheck, ListTodo, Plus, Send, Trash2, UserRoundPlus } from "lucide-react";
import type { Me } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate, todayIn } from "@/lib/util";
import { addTodo, deleteTodo, toggleTodo } from "@/app/todo-actions";
import { ActionForm } from "./action-form";
import { Avatar } from "./avatar";
import { PageHeader } from "./shell";

type Todo = {
  id: string; title: string; due_on: string | null; done_at: string | null; assigned_by: string | null;
  assigner: { full_name: string } | null; owner: { full_name: string; avatar_url: string | null } | null;
};
const cols = "id, title, due_on, done_at, assigned_by, assigner:employees!todos_assigned_by_fkey(full_name), owner:employees!todos_owner_id_fkey(full_name, avatar_url)";

function Row({ t, meId, showOwner }: { t: Todo; meId: string; showOwner?: boolean }) {
  const overdue = !t.done_at && t.due_on && t.due_on < todayIn();
  const canDelete = t.assigned_by === meId || !t.assigned_by;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <ActionForm action={toggleTodo} keep>
        <input type="hidden" name="id" value={t.id} />
        <button name="done" value={t.done_at ? "0" : "1"} title={t.done_at ? "Mark not done" : "Mark done"} className="mt-0.5 cursor-pointer text-muted hover:text-text">
          {t.done_at ? <CircleCheck className="size-5 text-green" /> : <Circle className="size-5" />}
        </button>
      </ActionForm>
      {showOwner && t.owner && <Avatar name={t.owner.full_name} src={t.owner.avatar_url} size="size-7" />}
      <div className="min-w-0 flex-1">
        <p className={`text-sm break-words ${t.done_at ? "text-muted line-through" : ""}`}>{t.title}</p>
        <p className="text-xs text-muted">
          {showOwner && t.owner?.full_name}
          {!showOwner && t.assigner && `From ${t.assigner.full_name}`}
          {t.due_on && (
            <span className={overdue ? "font-medium text-red" : ""}>
              {(showOwner || t.assigner) && " · "}Due {fmtDate(t.due_on)}
            </span>
          )}
        </p>
      </div>
      {canDelete && (
        <ActionForm action={deleteTodo} confirm={t.assigned_by ? "Withdraw this task?" : undefined}>
          <input type="hidden" name="id" value={t.id} />
          <button className="btn btn-ghost btn-icon btn-danger h-7" title="Delete"><Trash2 /></button>
        </ActionForm>
      )}
    </li>
  );
}

function List({ todos, meId, showOwner, empty }: { todos: Todo[]; meId: string; showOwner?: boolean; empty: string }) {
  const open = todos.filter((t) => !t.done_at);
  const done = todos.filter((t) => t.done_at);
  return (
    <>
      {open.length ? (
        <ul className="divide-y divide-line">{open.map((t) => <Row key={t.id} t={t} meId={meId} showOwner={showOwner} />)}</ul>
      ) : (
        <p className="empty"><ListTodo /> {empty}</p>
      )}
      {!!done.length && (
        <details className="mt-2 border-t border-line pt-2">
          <summary className="cursor-pointer py-1 text-sm text-muted hover:text-text">Done ({done.length})</summary>
          <ul className="divide-y divide-line">{done.map((t) => <Row key={t.id} t={t} meId={meId} showOwner={showOwner} />)}</ul>
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
          <List todos={(mine ?? []) as unknown as Todo[]} meId={me.id} empty="Nothing on your list." />
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
              <List todos={(assigned?.data ?? []) as unknown as Todo[]} meId={me.id} showOwner empty="No open tasks handed out." />
            </div>
          </section>
        )}
      </div>
    </>
  );
}
