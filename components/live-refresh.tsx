"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import { Phone, PhoneOff } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { CALL_ENDED } from "@/lib/util";

// Re-renders server components when any published table changes in a row the user can read (RLS-filtered),
// and when the tab comes back into view (catches events missed while asleep/offline).
// ponytail: full refresh per change (debounced), fine for a company-sized team; append-in-place if chat gets busy.
type Msg = { id: string; channel_id: string; sender_id: string | null; body: string | null };
type Ringing = { channel: string; from: string };
const CALL = "Started a video call:"; // startCall() message prefix
const RING_MS = 30_000;

// Ringtone without an audio file: two-tone burst every 2s. Browsers only allow sound after the user has
// interacted with the page once (unlocked by the click listener below).
let audio: AudioContext | undefined;
function ring() {
  if (!audio) return () => {};
  const ctx = audio;
  const burst = () => {
    for (const [f, t] of [[880, 0], [660, 0.25], [880, 0.5], [660, 0.75]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), at = ctx.currentTime + t;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.15, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(at);
      o.stop(at + 0.23);
    }
  };
  burst();
  const id = setInterval(burst, 2000);
  return () => clearInterval(id);
}

// meId: messages I sent don't alert me.
export function LiveRefresh({ meId }: { meId: string }) {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const path = useRef(pathname); // read inside the realtime handler without resubscribing per navigation
  useEffect(() => { path.current = pathname; }, [pathname]);
  const [ringing, setRinging] = useState<Ringing | null>(null);
  const stopRing = useRef<() => void>(() => {});

  // first click/key unlocks sound and asks for notification permission (both need a user gesture in some browsers)
  useEffect(() => {
    const unlock = () => {
      audio ??= new AudioContext();
      audio.resume();
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const dismiss = () => {
    stopRing.current();
    setRinging(null);
  };

  useEffect(() => {
    if (!isSignedIn) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(t);
      t = setTimeout(() => router.refresh(), 300); // bulk inserts (announcements) → one refresh
    };
    const onVisible = () => document.visibilityState === "visible" && refresh();

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      accessToken: () => getToken(),
    });
    // new message for me (RLS: only channels I'm in) → browser notification, unless I'm looking at that chat; calls ring
    const onMessage = async ({ new: m }: { new: Msg }) => {
      // call ended (by anyone, incl. me in another tab) → stop ringing for that channel
      if (m.body?.startsWith(CALL_ENDED)) {
        setRinging((r) => {
          if (r?.channel !== m.channel_id) return r;
          stopRing.current();
          return null;
        });
        return;
      }
      if (!m.sender_id || m.sender_id === meId) return; // system posts (announcements) don't ping
      const href = `/chat/${m.channel_id}`;
      const call = m.body?.startsWith(CALL);
      if (!call && path.current === href && document.visibilityState === "visible") return;
      const { data } = await sb.from("employees").select("full_name").eq("id", m.sender_id).maybeSingle();
      const from = data?.full_name ?? "Someone";
      if (call) {
        stopRing.current();
        stopRing.current = ring();
        setRinging({ channel: m.channel_id, from });
        setTimeout(() => { stopRing.current(); setRinging((r) => (r?.channel === m.channel_id ? null : r)); }, RING_MS);
      }
      if ("Notification" in window && Notification.permission === "granted" && (call || document.visibilityState !== "visible" || !path.current.startsWith("/chat"))) {
        const n = new Notification(call ? `${from} is calling` : from, {
          body: call ? "Video call. Open the chat to join." : m.body?.slice(0, 140) || "Sent an attachment",
          tag: call ? `call:${m.channel_id}` : m.id,
          icon: "/apple-touch-icon.png",
        });
        n.onclick = () => { window.focus(); router.push(href); n.close(); };
      }
    };
    const ch = sb
      .channel("live")
      .on("postgres_changes", { event: "*", schema: "public" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, onMessage)
      .subscribe();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
      sb.removeChannel(ch);
      stopRing.current();
    };
  }, [isSignedIn, getToken, router, meId]);

  if (!ringing) return null;
  return (
    <div role="alertdialog" aria-label={`${ringing.from} is calling`} className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 pl-4 shadow-lg">
      <span className="grid size-9 animate-pulse place-items-center rounded-full bg-primary text-primary-fg"><Phone className="size-4" /></span>
      <div className="mr-2 leading-tight">
        <div className="text-sm font-semibold">{ringing.from}</div>
        <div className="text-xs text-muted">Incoming video call</div>
      </div>
      <Link href={`/chat/${ringing.channel}`} onClick={dismiss} className="btn btn-primary"><Phone /> Answer</Link>
      <button type="button" onClick={dismiss} className="btn btn-icon" aria-label="Dismiss call" title="Dismiss"><PhoneOff /></button>
    </div>
  );
}

// Hide the channel list on mobile while a channel is open.
export function ChatSidebar({ children }: { children: React.ReactNode }) {
  const open = useSelectedLayoutSegment();
  return <aside className={`min-h-0 flex-col border-line bg-surface-2/40 md:flex md:w-72 md:border-r ${open ? "hidden" : "flex flex-1 md:flex-none"}`}>{children}</aside>;
}

// Sidebar row; highlights the open channel.
export function ChannelLink({ id, children }: { id: string; children: React.ReactNode }) {
  const active = useSelectedLayoutSegment() === id;
  return (
    <Link
      href={`/chat/${id}`}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${active ? "bg-surface shadow-[0_1px_2px_rgb(24_24_27/0.06)] ring-1 ring-line" : "hover:bg-surface-2"}`}
    >
      {children}
    </Link>
  );
}
