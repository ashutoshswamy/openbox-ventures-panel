"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { Video } from "lucide-react";
import { startCall } from "@/app/(employee)/actions";
import { meetUrl, roomOf } from "@/lib/util";

const EMPTY_GRACE_MS = 60_000; // empty call stays joinable this long

// Presence: Jitsi can't tell us who's in a room, so the panel tab that opened the Jitsi tab reports it
// (Supabase Realtime presence, topic = room url) until that tab is closed, and heartbeats call_ping() for the call history.
// ponytail: reload/close the panel tab and you drop out of the count; JaaS webhooks if that matters.
type GetToken = () => Promise<string | null>;
const client = (getToken: GetToken) =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { accessToken: getToken });
const topic = (url: string) => `call:${url.split("/").pop()}`;

function joinCall(url: string, name: string, getToken: GetToken) {
  const w = window.open(url, "_blank");
  if (!w) return;
  try { w.opener = null; } catch {} // still about:blank here; Jitsi can't touch the panel tab
  const sb = client(getToken);
  const ch = sb.channel(topic(url));
  ch.subscribe((s) => s === "SUBSCRIBED" && ch.track({ name }));
  const ping = () => sb.rpc("call_ping", { p_room: roomOf(url) }).then(() => {}); // errors (old/unknown call) ignored
  ping();
  let n = 0;
  const poll = setInterval(() => {
    if (w.closed) {
      clearInterval(poll);
      ping(); // stamps the leave time
      sb.removeChannel(ch);
    } else if (++n % 10 === 0) ping(); // every 20s
  }, 2000);
}

// Opens Jitsi in a new tab (embedding meet.jit.si is capped at 5 min) and posts the link to the channel.
// Fresh room per call, so an ended call's link leads nowhere.
export function CallButton({ channelId, name }: { channelId: string; name: string }) {
  const { getToken } = useAuth();
  return (
    <button
      type="button"
      className="btn"
      onClick={() => {
        const room = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
        joinCall(meetUrl(channelId, room), name, getToken);
        startCall(channelId, room);
      }}
    >
      <Video /> <span className="hidden sm:inline">Video call</span>
    </button>
  );
}

// Newest call in a channel: joinable while anyone's in it, ended after a minute with nobody.
export function CallCard({ url, name, startedAt, icon, endForm }: { url: string; name: string; startedAt: string; icon: React.ReactNode; endForm: React.ReactNode }) {
  const { getToken } = useAuth();
  const [people, setPeople] = useState<string[] | null>(null); // null = not synced yet
  const [deadline, setDeadline] = useState(() => Date.parse(startedAt) + EMPTY_GRACE_MS);
  const [, tick] = useState(0);

  useEffect(() => {
    const sb = client(getToken);
    const ch = sb.channel(topic(url));
    let had = false;
    ch.on("presence", { event: "sync" }, () => {
      const names = Object.values(ch.presenceState<{ name: string }>()).map((p) => p[0].name);
      if (had && !names.length) setDeadline(Date.now() + EMPTY_GRACE_MS); // just emptied
      had = names.length > 0;
      setPeople(names);
    }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [url, getToken]);

  const empty = people !== null && !people.length;
  useEffect(() => {
    if (!empty) return;
    const t = setTimeout(() => tick((n) => n + 1), Math.max(0, deadline - Date.now()) + 100);
    return () => clearTimeout(t);
  }, [empty, deadline]);

  // eslint-disable-next-line react-hooks/purity -- re-rendered by the timer above at the deadline
  if (empty && Date.now() > deadline) return <Ended icon={icon} />;
  return (
    <div className="flex items-center gap-3 py-1">
      <button type="button" onClick={() => joinCall(url, name, getToken)} className="flex items-center gap-3 text-left font-medium">
        {icon}
        <span>
          Video call{people?.length ? " in progress" : " started"}
          <span className="block text-xs font-normal opacity-70">
            {people === null ? "Tap to join" : people.length ? `${people.join(", ")} · tap to join` : "Nobody's in yet · tap to join"}
          </span>
        </span>
      </button>
      {endForm}
    </div>
  );
}

export function Ended({ icon }: { icon: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 py-1 font-medium opacity-80">
      {icon}
      <span>Video call ended<span className="block text-xs font-normal opacity-70">This call is over</span></span>
    </p>
  );
}
