"use client";
import Link from "next/link";
import { ArrowRight, BellRing, CalendarDays, Hourglass, Megaphone } from "lucide-react";
import { fmtDate, greeting } from "@/lib/util";
import { HOLIDAYS, daysFrom, EMPLOYEES, emp, today } from "@/lib/demo/data";
import { useAnnouncements, useLeave, useTodos } from "@/lib/demo/shared";
import { useRole } from "@/lib/demo/use-role";
import { balances } from "@/lib/demo/workspace";
import { PageHeader } from "./ws-common";
import { Today } from "./ws-today";

export function WorkspaceDashboard() {
  const { me } = useRole("workspace");
  const [todos] = useTodos();
  const [leave] = useLeave();
  const [news] = useAnnouncements();
  const t = today();
  const week = daysFrom(7);
  const due = todos.filter((x) => x.owner_id === me.id && !x.done && x.due_on && x.due_on <= t).sort((a, b) => a.due_on!.localeCompare(b.due_on!));
  const nextHoliday = HOLIDAYS.find((h) => h.date >= t && h.date <= week && (!h.office_id || h.office_id === me.office_id));
  const celebrations = EMPLOYEES.filter((e) => e.joined_on.slice(5) === t.slice(5) && e.joined_on.slice(0, 4) !== t.slice(0, 4)).map((e) => `${e.name}'s work anniversary`);
  const reminders = [
    ...due.map((x) => ({ key: x.id, href: "/demo/workspace/todos", text: `${x.due_on! < t ? "Overdue" : "Due today"}: ${x.title}` })),
    ...celebrations.map((c) => ({ key: c, href: undefined, text: c })),
    ...(nextHoliday ? [{ key: "holiday", href: "/demo/workspace/leave", text: `Holiday: ${nextHoliday.name}, ${fmtDate(nextHoliday.date)}` }] : []),
  ];
  const bal = balances(leave, me.id);
  const pending = leave.filter((r) => r.employee_id === me.id && r.status === "pending").length;
  const posts = [...news].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  return (
    <>
      <PageHeader title={`${greeting()}, ${me.name.split(" ")[0]}`} sub="Here's your day at a glance." />
      <div className="space-y-6">
        <Today me={me} />
        {reminders.length > 0 && (
          <section className="card">
            <h2 className="h2"><BellRing /> Reminders</h2>
            <ul className="divide-y divide-line text-sm">
              {reminders.map((r) => (
                <li key={r.key} className="py-2 first:pt-0 last:pb-0">{r.href ? <Link href={r.href} className="hover:underline">{r.text}</Link> : r.text}</li>
              ))}
            </ul>
          </section>
        )}
        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="h2 mb-0"><CalendarDays /> Leave balance</h2>
              <Link href="/demo/workspace/leave" className="btn btn-ghost text-primary">Apply <ArrowRight /></Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {bal.map((b) => {
                const pct = b.entitled ? Math.min(100, (b.used / b.entitled) * 100) : 0;
                return (
                  <div key={b.id} className="rounded-xl bg-surface-2/70 p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium">{b.name}</span>
                      <span className="text-xs text-muted tabular-nums">{b.used} / {b.entitled} used</span>
                    </div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{b.balance}<span className="ml-1 text-sm font-normal text-muted">days left</span></div>
                    <div className="mt-3 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
            {!!pending && (
              <p className="mt-4 flex items-center gap-2 text-sm text-amber"><Hourglass className="size-4" /> {pending} request{pending > 1 ? "s" : ""} waiting for approval</p>
            )}
          </section>
          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="h2 mb-0"><Megaphone /> Announcements</h2>
              <Link href="/demo/chat" className="btn btn-ghost text-primary">Open <ArrowRight /></Link>
            </div>
            {posts.length ? (
              <ul className="divide-y divide-line">
                {posts.map((n) => (
                  <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{n.title}</span>
                      <span className="shrink-0 text-xs text-muted">{fmtDate(n.date)}</span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-sm whitespace-pre-wrap text-muted">{n.body}</p>
                    <p className="mt-1 text-xs text-muted">{emp(n.author).name}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty"><Megaphone /> No announcements yet.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
