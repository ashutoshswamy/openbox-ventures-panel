import Link from "next/link";
import { ArrowRight, BellRing, CalendarDays, Check, Megaphone } from "lucide-react";
import { employeePage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate, greeting, splitPost, todayIn } from "@/lib/util";
import { todaysCelebrations } from "@/lib/pending";
import { Today } from "@/components/today";
import { PageHeader } from "@/components/shell";
import { Attachment } from "@/components/attachment";
import { CountUp } from "@/components/count-up";
import { Celebrate } from "@/components/confetti";
import { MonthEvents } from "@/components/month-events";
import { ActionForm } from "@/components/action-form";
import { readAnnouncements } from "./actions";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const me = await employeePage();
  const sb = db();
  const today = todayIn();
  const week = new Date(Date.parse(today) + 7 * 864e5).toISOString().slice(0, 10);
  // announcements I have not read yet: once I open the channel (or press Mark all read) they leave this card; the channel keeps the history
  const { data: seen } = await sb.from("channel_members").select("last_read_at, channel:channels!inner(announcements)").eq("employee_id", me.id).eq("channel.announcements", true).maybeSingle();
  const [{ data: balances }, { data: news }, { count: pending }, { data: due }, { data: holidays }, celebrations, { count: openTodos }, { data: self }] = await Promise.all([
    sb.from("leave_balances").select("leave_type_id, name, balance, entitled, used").eq("employee_id", me.id).order("name"),
    sb.from("messages").select("id, body, attachment_path, created_at, channel:channels!inner(announcements)").eq("channel.announcements", true).gt("created_at", seen?.last_read_at ?? "1970-01-01").order("created_at", { ascending: false }).limit(4),
    sb.from("leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", me.id).eq("status", "pending"),
    sb.from("todos").select("id, title, due_on").eq("owner_id", me.id).is("done_at", null).lte("due_on", today).order("due_on"),
    sb.from("holidays").select("name, date, office_id").gte("date", today).lte("date", week).order("date"),
    todaysCelebrations(),
    sb.from("todos").select("id", { count: "exact", head: true }).eq("owner_id", me.id).is("done_at", null),
    sb.from("employees").select("joined_on").eq("id", me.id).maybeSingle(),
  ]);
  const daysLeft = (balances ?? []).reduce((n, b) => n + Number(b.balance), 0);
  const nextHoliday = holidays?.find((h) => !h.office_id || h.office_id === me.office_id);
  const reminders = [
    ...(due ?? []).map((t) => ({ key: t.id, href: "/todos", text: `${t.due_on! < today ? "Overdue" : "Due today"}: ${t.title}` })),
    ...celebrations.map((c) => ({ key: c, href: undefined, text: c })),
    ...(nextHoliday ? [{ key: "holiday", href: "/leave", text: `Holiday: ${nextHoliday.name}, ${fmtDate(nextHoliday.date)}` }] : []),
  ];

  // confetti only for me: my own birthday / anniversary, or a first-week welcome
  const mine = celebrations.find((c) => c.startsWith(`${me.full_name}'s`));
  const joinedDays = self?.joined_on ? (Date.parse(today) - Date.parse(self.joined_on)) / 864e5 : 99;
  const party = mine
    ? { id: mine, title: mine.endsWith("birthday") ? `Happy birthday, ${me.full_name.split(" ")[0]}!` : `Happy work anniversary, ${me.full_name.split(" ")[0]}!`, text: mine.endsWith("birthday") ? "The whole team is wishing you a great day." : "Thank you for being part of Open Box Ventures." }
    : joinedDays <= 7 ? { id: "welcome", title: `Welcome aboard, ${me.full_name.split(" ")[0]}!`, text: "Glad to have you on the team." } : null;

  return (
    <>
      <PageHeader title={`${greeting()}, ${me.full_name.split(" ")[0]}`} sub="Here's your day at a glance." />
      <div className="space-y-6">
        {party && <Celebrate {...party} />}
        <Today officeId={me.office_id} workMode={me.work_mode} />

        <div className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface">
          {[
            { href: "/todos", n: openTodos ?? 0, label: "open tasks", note: due?.length ? `${due.length} due or overdue` : "none due", warn: !!due?.length },
            { href: "/leave", n: daysLeft, label: "leave days left", note: "all types", warn: false },
            { href: "/leave", n: pending ?? 0, label: "requests pending", note: pending ? "awaiting approval" : "all caught up", warn: !!pending },
          ].map(({ href, n, label, note, warn }) => (
            <Link key={label} href={href} className="px-4 py-3.5 transition-colors first:rounded-l-2xl last:rounded-r-2xl hover:bg-surface-2/60 md:px-5">
              <p className="text-2xl font-semibold tracking-tight tabular-nums"><CountUp value={n} decimals={Number.isInteger(n) ? 0 : 1} /></p>
              <p className="text-sm">{label}</p>
              <p className={`text-xs ${warn ? "text-amber" : "text-muted"}`}>{note}</p>
            </Link>
          ))}
        </div>

        {reminders.length > 0 && (
          <section className="flex flex-wrap gap-2" aria-label="Reminders">
            {reminders.map((r) => {
              const cls = "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm";
              const body = <><BellRing className="size-3.5 text-amber" /> {r.text}</>;
              return r.href ? <Link key={r.key} href={r.href} className={`${cls} transition hover:border-text/30`}>{body}</Link> : <span key={r.key} className={cls}>{body}</span>;
            })}
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="h2 mb-0"><CalendarDays /> Leave balance</h2>
              <Link href="/leave" className="btn btn-ghost text-primary">Apply <ArrowRight /></Link>
            </div>
            {balances?.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {balances.map((b) => {
                  const pct = Number(b.entitled) ? Math.min(100, (Number(b.used) / Number(b.entitled)) * 100) : 0;
                  return (
                    <div key={b.leave_type_id} className="rounded-xl bg-surface-2/70 p-4">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-medium">{b.name}</span>
                        <span className="text-xs text-muted tabular-nums">{Number(b.used)} / {Number(b.entitled)} used</span>
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{Number(b.balance)}<span className="ml-1 text-sm font-normal text-muted">days left</span></div>
                      <div className="mt-3 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="empty"><CalendarDays /> No leave types have been set up yet.</p>
            )}
          </section>

          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="h2 mb-0"><Megaphone /> New announcements</h2>
              <div className="flex items-center gap-1">
                {!!news?.length && <ActionForm action={readAnnouncements} success="Announcements cleared"><button className="btn btn-ghost"><Check /> Mark all read</button></ActionForm>}
                <Link href="/chat/announcements" className="btn btn-ghost text-primary">Open <ArrowRight /></Link>
              </div>
            </div>
            {news?.length ? (
              <ul className="divide-y divide-line">
                {news.map((n) => {
                  const [title, text] = splitPost(n.body);
                  return (
                    <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={title ? "font-medium" : "text-sm"}>{title ?? text}</span>
                        <span className="shrink-0 text-xs text-muted">{fmtDate(n.created_at.slice(0, 10))}</span>
                      </div>
                      {title && <p className="mt-1 line-clamp-3 text-sm whitespace-pre-wrap text-muted">{text}</p>}
                      {n.attachment_path && <div className="text-sm [&_img]:max-h-40 [&_video]:max-h-40"><Attachment id={n.id} path={n.attachment_path} chip="bg-surface-2" /></div>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="empty"><Megaphone /> You are all caught up.</p>
            )}
          </section>
        </div>
        <MonthEvents officeId={me.office_id} />
      </div>
    </>
  );
}
