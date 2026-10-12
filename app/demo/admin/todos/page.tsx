"use client";
import { CalendarClock, Circle, CircleCheck, ListTodo, Plus, Send, Trash2, UserRoundPlus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader, useAdm } from "@/components/demo/adm-ui";
import { emp, today } from "@/lib/demo/data";
import { useTodos, type Todo } from "@/lib/demo/shared";
import { newId } from "@/lib/demo/store";
import { fmtDate, str } from "@/lib/util";

export default function Todos() {
  const { me, emps, isAdmin } = useAdm();
  const [todos, setTodos] = useTodos();
  const sorted = (l: Todo[]) => [...l].sort((a, b) => (a.due_on ?? "9").localeCompare(b.due_on ?? "9"));
  const mine = sorted(todos.filter((t) => t.owner_id === me.id));
  const assigned = sorted(todos.filter((t) => t.assigned_by === me.id && t.owner_id !== me.id));
  const people = emps.filter((p) => p.active && p.role !== "admin" && p.id !== me.id && (isAdmin || (p.office_id === me.office_id && p.department_id === me.department_id)));

  const add = async (fd: FormData, owner: string, by: string | null) => {
    const title = str(fd, "title");
    if (!title) return "Add a task";
    setTodos((l) => [...l, { id: newId(), owner_id: owner, title, due_on: str(fd, "due_on"), done: false, assigned_by: by }]);
  };

  const row = (t: Todo, showOwner?: boolean) => {
    const overdue = !t.done && t.due_on && t.due_on < today();
    const canDelete = t.assigned_by === me.id || !t.assigned_by;
    const owner = emp(t.owner_id);
    const assigner = t.assigned_by ? emp(t.assigned_by) : null;
    return (
      <li key={t.id} className="flex items-start gap-3 py-2.5">
        <button title={t.done ? "Mark not done" : "Mark done"} onClick={() => setTodos((l) => l.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} className="mt-0.5 cursor-pointer text-muted hover:text-text">
          {t.done ? <CircleCheck className="size-5 text-green" /> : <Circle className="size-5" />}
        </button>
        {showOwner && <Avatar name={owner.name} src={null} size="size-7" />}
        <div className="min-w-0 flex-1">
          <p className={`text-sm break-words ${t.done ? "text-muted line-through" : ""}`}>{t.title}</p>
          <p className="text-xs text-muted">
            {showOwner && owner.name}
            {!showOwner && assigner && `From ${assigner.name}`}
            {t.due_on && (
              <span className={overdue ? "font-medium text-red" : ""}>
                {(showOwner || assigner) && " · "}Due {fmtDate(t.due_on)}
              </span>
            )}
          </p>
        </div>
        {canDelete && (
          <button className="btn btn-ghost btn-icon btn-danger h-7" title="Delete" onClick={() => (!t.assigned_by || confirm("Withdraw this task?")) && setTodos((l) => l.filter((x) => x.id !== t.id))}><Trash2 /></button>
        )}
      </li>
    );
  }

  const list = (todos: Todo[], empty: string, showOwner?: boolean) => {
    const open = todos.filter((t) => !t.done);
    const done = todos.filter((t) => t.done);
    return (
      <>
        {open.length ? <ul className="divide-y divide-line">{open.map((t) => row(t, showOwner))}</ul> : <p className="empty"><ListTodo /> {empty}</p>}
        {!!done.length && (
          <details className="mt-2 border-t border-line pt-2">
            <summary className="cursor-pointer py-1 text-sm text-muted hover:text-text">Done ({done.length})</summary>
            <ul className="divide-y divide-line">{done.map((t) => row(t, showOwner))}</ul>
          </details>
        )}
      </>
    );
  };

  const dueField = <label className="field sm:w-40">Due<input type="date" name="due_on" min={today()} className="input" /></label>;

  return (
    <>
      <PageHeader title="To-do" sub="Your own list, plus tasks you hand out to your team." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card h-fit">
          <h2 className="h2"><ListTodo /> My list</h2>
          <ActionForm action={(fd) => add(fd, me.id, null)} className="mb-3 flex flex-wrap items-end gap-2 sm:flex-nowrap">
            <label className="field flex-1">Task<input name="title" required maxLength={300} placeholder="What needs doing?" className="input" /></label>
            {dueField}
            <button className="btn btn-primary"><Plus /> Add</button>
          </ActionForm>
          {list(mine, "Nothing on your list.")}
        </section>
        <section className="space-y-6">
          <div className="card">
            <h2 className="h2"><UserRoundPlus /> Assign a task</h2>
            <ActionForm action={(fd) => add(fd, str(fd, "owner_id") ?? me.id, me.id)} success="Task assigned" className="space-y-3">
              <label className="field">Assign to
                <select name="owner_id" required className="input" defaultValue="">
                  <option value="" disabled>Pick a person</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
            {list(assigned, "No open tasks handed out.", true)}
          </div>
        </section>
      </div>
    </>
  );
}
