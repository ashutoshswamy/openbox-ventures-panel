import Link from "next/link";
import { ArrowRight, CalendarDays, Hourglass, Megaphone } from "lucide-react";
import { employeePage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate, greeting, splitPost } from "@/lib/util";
import { Today } from "@/components/today";
import { PageHeader } from "@/components/shell";
import { Attachment } from "@/components/attachment";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const me = await employeePage();
  const sb = db();
  const [{ data: balances }, { data: news }, { count: pending }] = await Promise.all([
    sb.from("leave_balances").select("leave_type_id, name, balance, entitled, used").eq("employee_id", me.id).order("name"),
    sb.from("messages").select("id, body, attachment_path, created_at, channel:channels!inner(announcements)").eq("channel.announcements", true).order("created_at", { ascending: false }).limit(4),
    sb.from("leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", me.id).eq("status", "pending"),
  ]);

  return (
    <>
      <PageHeader title={`${greeting()}, ${me.full_name.split(" ")[0]}`} sub="Here's your day at a glance." />
      <div className="space-y-6">
        <Today employeeId={me.id} officeId={me.office_id} />

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
            {!!pending && (
              <p className="mt-4 flex items-center gap-2 text-sm text-amber"><Hourglass className="size-4" /> {pending} request{pending > 1 ? "s" : ""} waiting for approval</p>
            )}
          </section>

          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="h2 mb-0"><Megaphone /> Announcements</h2>
              <Link href="/chat/announcements" className="btn btn-ghost text-primary">Open <ArrowRight /></Link>
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
              <p className="empty"><Megaphone /> No announcements yet.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
