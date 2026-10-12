"use client";
import { useState } from "react";
import { CalendarClock, Circle, CircleCheck, ListTodo, Plus, Send, Trash2, UserRoundPlus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { emp, today } from "@/lib/demo/data";
import { isStaff, useHrEmployees } from "@/lib/demo/hr";
import { useTodos, type Todo } from "@/lib/demo/shared";
import { newId } from "@/lib/demo/store";
import { useRole } from "@/lib/demo/use-role";
import { fmtDate } from "@/lib/util";
import { PageHeader } from "../_parts";

type Ctx = { me: { id: string }; toggle: (id: string) => void; del: (t: Todo) => void };
function Row({ t, showOwner, ctx }: { t: Todo; showOwner?: boolean; ctx: Ctx }) {
  const { me, toggle, del } = ctx;
  const o = emp(t.owner_id);
  const by = t.assigned_by ? emp(t.assigned_by) : null;
  const overdue = !t.done && t.due_on && t.due_on < today();
  return (
    <li className="flex items-start gap-3 py-2.5">
      <button onClick={() => toggle(t.id)} title={t.done ? "Mark not done" : "Mark done"} className="mt-0.5 cursor-pointer text-muted hover:text-text">
        {t.done ? <CircleCheck className="size-5 text-green" /> : <Circle className="size-5" />}
      </button>
      {showOwner && <Avatar name={o.name} size="size-7" />}
      <div className="min-w-0 flex-1">
        <p className={`text-sm break-words ${t.done ? "text-muted line-through" : ""}`}>{t.title}</p>
        <p className="text-xs text-muted">
          {showOwner && o.name}
          {!showOwner && by && `From ${by.name}`}
          {t.due_on && <span className={overdue ? "font-medium text-red" : ""}>{(showOwner || by) && " · "}Due {fmtDate(t.due_on)}</span>}
        </p>
      </div>
      {(t.assigned_by === me.id || !t.assigned_by) && (
        <button className="btn btn-ghost btn-icon btn-danger h-7" title="Delete" onClick={() => del(t)}><Trash2 /></button>
      )}
    </li>
  );
}

function List({ list, showOwner, empty, ctx }: { list: Todo[]; showOwner?: boolean; empty: string; ctx: Ctx }) {
  const open = list.filter((t) => !t.done);
  const done = list.filter((t) => t.done);
  return (
    <>
      {open.length ? <ul className="divide-y divide-line">{open.map((t) => <Row key={t.id} t={t} showOwner={showOwner} ctx={ctx} />)}</ul> : <p className="empty"><ListTodo /> {empty}</p>}
      {!!done.length && (
        <details className="mt-2 border-t border-line pt-2">
          <summary className="cursor-pointer py-1 text-sm text-muted hover:text-text">Done ({done.length})</summary>
          <ul className="divide-y divide-line">{done.map((t) => <Row key={t.id} t={t} showOwner={showOwner} ctx={ctx} />)}</ul>
        </details>
      )}
    </>
  );
}

export default function Todos() {
  const { me } = useRole("hr");
  const [todos, setTodos] = useTodos();
  const [emps] = useHrEmployees();
  const [owner, setOwner] = useState("");
  const add = (ownerId: string, fd: FormData) =>
    setTodos((t) => [...t, { id: newId(), owner_id: ownerId, title: String(fd.get("title")).trim(), due_on: String(fd.get("due_on") || "") || null, done: false, assigned_by: ownerId === me.id ? null : me.id }]);
  const toggle = (id: string) => setTodos((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const del = (t: Todo) => (!t.assigned_by || confirm("Withdraw this task?")) && setTodos((l) => l.filter((x) => x.id !== t.id));

  const due = <label className="field sm:w-40">Due<input type="date" name="due_on" min={today()} className="input" /></label>;
  const people = emps.filter((e) => isStaff(e) && e.id !== me.id);

  return (
    <>
      <PageHeader title="To-do" sub="Your own list, plus tasks you hand out to your team." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card h-fit">
          <h2 className="h2"><ListTodo /> My list</h2>
          <form
            className="mb-3 flex flex-wrap items-end gap-2 sm:flex-nowrap"
            onSubmit={(e) => { e.preventDefault(); add(me.id, new FormData(e.currentTarget)); e.currentTarget.reset(); }}
          >
            <label className="field flex-1">Task<input name="title" required maxLength={300} placeholder="What needs doing?" className="input" /></label>
            {due}
            <button className="btn btn-primary"><Plus /> Add</button>
          </form>
          <List ctx={{ me, toggle, del }} list={todos.filter((t) => t.owner_id === me.id)} empty="Nothing on your list." />
        </section>
        <section className="space-y-6">
          <div className="card">
            <h2 className="h2"><UserRoundPlus /> Assign a task</h2>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add(owner, new FormData(e.currentTarget)); e.currentTarget.reset(); setOwner(""); }}>
              <label className="field">Assign to
                <select required value={owner} onChange={(e) => setOwner(e.target.value)} className="input">
                  <option value="" disabled>Pick a person</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="field">Task<input name="title" required maxLength={300} placeholder="What should they do?" className="input" /></label>
              <div className="flex flex-wrap items-end justify-between gap-3">
                {due}
                <button className="btn btn-primary"><Send /> Assign</button>
              </div>
            </form>
          </div>
          <div className="card">
            <h2 className="h2"><CalendarClock /> Assigned by me</h2>
            <List ctx={{ me, toggle, del }} list={todos.filter((t) => t.assigned_by === me.id && t.owner_id !== me.id)} showOwner empty="No open tasks handed out." />
          </div>
        </section>
      </div>
    </>
  );
}
