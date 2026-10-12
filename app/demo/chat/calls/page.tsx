"use client";

import Link from "next/link";
import { ArrowLeft, History, Video } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { daysFrom, emp } from "@/lib/demo/data";
import { fmtDate, fmtTime } from "@/lib/util";

// Static sample history: [channel id, channel name, starter, days ago, duration min, participants]
const CALLS: [string, string, string, number, number, string[]][] = [
  ["dep-d1", "Engineering", "e3", 1, 32, ["e3", "e4", "e5"]],
  ["dm1", "Arjun Kapoor", "e3", 2, 12, ["e3", "e4"]],
  ["grp1", "Project Falcon", "e6", 4, 45, ["e6", "e3", "e4", "e5"]],
];

export default function Calls() {
  const calls = CALLS.map(([ch, name, starter, ago, dur, people]) => {
    const start = `${daysFrom(-ago)}T10:30:00+05:30`;
    return { ch, name, starter: emp(starter).name, start, dur, people: people.map((p) => emp(p).name) };
  });
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link href="/demo/chat" className="btn btn-ghost -ml-2 md:hidden"><ArrowLeft /> Conversations</Link>
        <h2 className="h2"><History /> Call history</h2>
        {!calls.length && <p className="empty"><Video />No calls yet. Start one from any chat.</p>}
        <ul className="space-y-3">
          {calls.map((c) => (
            <li key={c.ch} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/demo/chat/${c.ch}`} className="font-semibold hover:underline">{c.name}</Link>
                  <p className="text-xs text-muted">{fmtDate(c.start.slice(0, 10))} {fmtTime(c.start)} · started by {c.starter}</p>
                </div>
                <span className="badge shrink-0 tabular-nums">{c.dur} min</span>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {c.people.map((p) => (
                  <li key={p} className="flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pr-2.5 pl-0.5 text-xs">
                    <Avatar name={p} size="size-5 text-[9px]" />
                    {p}
                    <span className="text-muted tabular-nums">· {Math.max(1, c.dur - 2)} min</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
