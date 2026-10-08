import Link from "next/link";
import { ArrowLeft, History, Video } from "lucide-react";
import { pageMe } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate, fmtTime } from "@/lib/util";
import { Avatar } from "@/components/avatar";

export const metadata = { title: "Call history" };

type Person = { joined_at: string; last_seen_at: string; employee: { full_name: string; avatar_url: string | null } | null };
type Call = { id: string; channel_id: string; started_at: string; ended_at: string | null; starter: { full_name: string } | null; people: Person[] };

const IDLE_MS = 60_000; // nobody pinged for this long = call over (matches the chat's empty-call grace)

// End time, or null while someone is still in it.
function endOf(c: Call) {
  if (c.ended_at) return c.ended_at;
  const last = Math.max(Date.parse(c.started_at), ...c.people.map((p) => Date.parse(p.last_seen_at)));
  return Date.now() - last > IDLE_MS ? new Date(last).toISOString() : null;
}

function duration(from: string, to: string) {
  const min = Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
  return min < 1 ? "under a minute" : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

export default async function Calls() {
  await pageMe();
  const sb = db();
  const [{ data: channels }, { data }] = await Promise.all([
    sb.rpc("my_channels"),
    sb.from("calls")
      .select("id, channel_id, started_at, ended_at, starter:employees!calls_started_by_fkey(full_name), people:call_participants(joined_at, last_seen_at, employee:employees(full_name, avatar_url))")
      .order("started_at", { ascending: false })
      .limit(100),
  ]);
  const names = new Map((channels as { id: string; name: string | null }[] | null)?.map((c) => [c.id, c.name ?? "Unnamed"]));
  const calls = ((data ?? []) as unknown as Call[]).map((c) => ({ ...c, end: endOf(c) }));

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link href="/chat" className="btn btn-ghost -ml-2 md:hidden"><ArrowLeft /> Conversations</Link>
        <h2 className="h2"><History /> Call history</h2>
        {!calls.length && <p className="empty"><Video />No calls yet. Start one from any chat.</p>}
        <ul className="space-y-3">
          {calls.map((c) => (
            <li key={c.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/chat/${c.channel_id}`} className="font-semibold hover:underline">{names.get(c.channel_id) ?? "Conversation"}</Link>
                  <p className="text-xs text-muted">
                    {fmtDate(c.started_at.slice(0, 10))} {fmtTime(c.started_at)}
                    {c.starter && ` · started by ${c.starter.full_name}`}
                  </p>
                </div>
                {c.end ? (
                  <span className="badge shrink-0 tabular-nums">{duration(c.started_at, c.end)}</span>
                ) : (
                  <span className="badge badge-green shrink-0">Ongoing</span>
                )}
              </div>
              {c.people.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {c.people.map((p, i) => (
                    <li key={i} className="flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pr-2.5 pl-0.5 text-xs">
                      <Avatar name={p.employee?.full_name ?? "?"} src={p.employee?.avatar_url} size="size-5 text-[9px]" />
                      {p.employee?.full_name ?? "Former employee"}
                      <span className="text-muted tabular-nums">· {duration(p.joined_at, p.last_seen_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
