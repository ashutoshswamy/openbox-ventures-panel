"use client";
import { Circle, CircleCheck, ListTodo, Plus, Trash2 } from "lucide-react";
import { fmtDate as fmtFix } from "@/lib/util";
import { emp, today } from "@/lib/demo/data";
import { newId } from "@/lib/demo/store";
import { useTodos, type Todo } from "@/lib/demo/shared";
import { useRole } from "@/lib/demo/use-role";
import { PageHeader } from "./ws-common";

function Row({ t, meId, toggle, del }: { t: Todo; meId: string; toggle: () => void; del: () => void }) {
  const overdue = !t.done && t.due_on && t.due_on < today();
  const canDelete = t.assigned_by === meId || !t.assigned_by;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <button onClick={toggle} title={t.done ? "Mark not done" : "Mark done"} className="mt-0.5 cursor-pointer text-muted hover:text-text">
        {t.done ? <CircleCheck className="size-5 text-green" /> : <Circle className="size-5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm break-words ${t.done ? "text-muted line-through" : ""}`}>{t.title}</p>
        <p className="text-xs text-muted">
          {t.assigned_by && `From ${emp(t.assigned_by).name}`}
          {t.due_on && (
            <span className={overdue ? "font-medium text-red" : ""}>
              {t.assigned_by && " · "}Due {fmtFix(t.due_on)}
            </span>
          )}
        </p>
      </div>
      {canDelete && (
        <button className="btn btn-ghost btn-icon btn-danger h-7" title="Delete" onClick={() => (!t.assigned_by || confirm("Withdraw this task?")) && del()}><Trash2 /></button>
      )}
    </li>
  );
}

export function WorkspaceTodos() {
  const { me } = useRole("workspace");
  const [all, set] = useTodos();
  const mine = all.filter((t) => t.owner_id === me.id);
  const open = mine.filter((t) => !t.done).sort((a, b) => (a.due_on ?? "9").localeCompare(b.due_on ?? "9"));
  const done = mine.filter((t) => t.done);
  const row = (t: Todo) => (
    <Row key={t.id} t={t} meId={me.id} toggle={() => set((c) => c.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} del={() => set((c) => c.filter((x) => x.id !== t.id))} />
  );

  return (
    <>
      <PageHeader title="To-do" sub="Your own list, plus tasks assigned to you." />
      <div className="grid max-w-2xl gap-6">
        <section className="card h-fit">
          <h2 className="h2"><ListTodo /> My list</h2>
          <form
            className="mb-3 flex flex-wrap items-end gap-2 sm:flex-nowrap"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const title = String(fd.get("title") ?? "").trim();
              if (!title) return;
              set((c) => [...c, { id: newId(), owner_id: me.id, title, due_on: String(fd.get("due_on") ?? "") || null, done: false, assigned_by: null }]);
              e.currentTarget.reset();
            }}
          >
            <label className="field flex-1">Task<input name="title" required maxLength={300} placeholder="What needs doing?" className="input" /></label>
            <label className="field sm:w-40">Due<input type="date" name="due_on" min={today()} className="input" /></label>
            <button className="btn btn-primary"><Plus /> Add</button>
          </form>
          {open.length ? <ul className="divide-y divide-line">{open.map(row)}</ul> : <p className="empty"><ListTodo /> Nothing on your list.</p>}
          {!!done.length && (
            <details className="mt-2 border-t border-line pt-2">
              <summary className="cursor-pointer py-1 text-sm text-muted hover:text-text">Done ({done.length})</summary>
              <ul className="divide-y divide-line">{done.map(row)}</ul>
            </details>
          )}
        </section>
      </div>
    </>
  );
}
