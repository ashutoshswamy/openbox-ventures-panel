"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import { Bell, MapPin, Phone, PhoneOff, Volume2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { CALL_AUDIO, CALL_ENDED, CALL_VIDEO } from "@/lib/util";
import { getManual, onManualChange, setStates, type Status } from "@/lib/presence";

// Re-renders server components when any published table changes in a row the user can read (RLS-filtered),
// and when the tab comes back into view (catches events missed while asleep/offline).
// ponytail: full refresh per change (debounced), fine for a company-sized team; append-in-place if chat gets busy.
type Msg = { id: string; channel_id: string; sender_id: string | null; body: string | null };
type Ringing = { channel: string; from: string; audio: boolean };
const RING_MS = 30_000;
const IDLE_MS = 5 * 60_000; // no input this long → Idle (only when my status is Online)

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
      o.type = "square"; // harmonic-rich = cuts through
      g.gain.setValueAtTime(0.5, at);
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

// Short two-note chime: higher + brighter for a tag (@me), softer for a plain message.
export function ding(tag: boolean) {
  if (!audio) return;
  const ctx = audio;
  for (const [f, t] of tag ? [[988, 0], [1319, 0.12]] : [[698, 0], [880, 0.1]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(), at = ctx.currentTime + t;
    o.type = "triangle"; // louder + clearer than sine at the same gain
    o.frequency.value = f;
    g.gain.setValueAtTime(tag ? 0.8 : 0.6, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
    o.connect(g).connect(ctx.destination);
    o.start(at);
    o.stop(at + 0.31);
  }
}

// meId: messages I sent don't alert me. meName: a "@meName" in a message gets the louder tag chime.
export function LiveRefresh({ meId, meName }: { meId: string; meName: string }) {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const path = useRef(pathname); // read inside the realtime handler without resubscribing per navigation
  useEffect(() => { path.current = pathname; }, [pathname]);
  const [ringing, setRinging] = useState<Ringing | null>(null);
  const stopRing = useRef<() => void>(() => {});

  // first click/key unlocks sound (needs a user gesture); permissions are asked by <PermissionGate>
  useEffect(() => {
    const unlock = () => {
      audio ??= new AudioContext();
      audio.resume();
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
      if (getManual() === "dnd") return; // Do Not Disturb: no chime, ring, popup or notification (unread badges still count)
      const href = `/chat/${m.channel_id}`;
      const audio = !!m.body?.startsWith(CALL_AUDIO);
      const call = audio || !!m.body?.startsWith(CALL_VIDEO); // startCall() message prefixes
      const tagged = !!m.body && m.body.includes(`@${meName}`);
      if (!call && path.current === href && document.visibilityState === "visible") return;
      if (!call) ding(tagged);
      const { data } = await sb.from("employees").select("full_name").eq("id", m.sender_id).maybeSingle();
      const from = data?.full_name ?? "Someone";
      if (call) {
        stopRing.current();
        stopRing.current = ring();
        setRinging({ channel: m.channel_id, from, audio });
        setTimeout(() => { stopRing.current(); setRinging((r) => (r?.channel === m.channel_id ? null : r)); }, RING_MS);
      }
      if ("Notification" in window && Notification.permission === "granted" && (call || document.visibilityState !== "visible" || !path.current.startsWith("/chat"))) {
        const n = new Notification(call ? `${from} is calling` : tagged ? `${from} mentioned you` : from, {
          body: call ? `${audio ? "Audio" : "Video"} call. Open the chat to join.` : m.body?.slice(0, 140) || "Sent an attachment",
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

    // Presence: a heartbeat per tab, written server-side for the signed-in person only (presence_ping), so it can't be faked.
    // Stop pinging (tab closed, phone locked, offline) and the server drops me from the list after 2 min.
    // ponytail: polling every 30 s; swap for a Realtime channel if latency matters.
    let alive = true;
    let active = Date.now();
    let sent: Status | undefined;
    let lastToken: string | null = null;
    const tab = crypto.randomUUID();
    const effective = (): Status => (getManual() === "online" && Date.now() - active > IDLE_MS ? "idle" : getManual());
    const beat = async () => {
      sent = effective();
      try {
        lastToken = await getToken();
        await sb.rpc("presence_ping", { p_tab: tab, p_status: sent });
        const { data } = await sb.rpc("presence_list");
        if (alive && data) setStates(new Map((data as { employee_id: string; status: Status }[]).map((r) => [r.employee_id, r.status])));
      } catch {} // offline: the next tick retries
    };
    const bump = () => {
      active = Date.now();
      if (sent === "idle" && getManual() === "online") beat(); // woke up
    };
    const leave = () => {
      if (lastToken) fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/presence_leave`, {
        method: "POST", keepalive: true,
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, authorization: `Bearer ${lastToken}`, "content-type": "application/json" },
        body: JSON.stringify({ p_tab: tab }),
      }).catch(() => {});
    };
    const acts = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "focus"] as const;
    acts.forEach((a) => window.addEventListener(a, bump, { passive: true }));
    const tick = setInterval(beat, 30_000); // background tabs get throttled to ~1/min; the server allows 2 min
    const unsub = onManualChange(beat); // status picked in the menu → tell everyone now
    const onVis = () => document.visibilityState === "visible" && bump();
    document.addEventListener("visibilitychange", onVis);
    addEventListener("pagehide", leave);
    beat();

    return () => {
      clearTimeout(t);
      alive = false;
      clearInterval(tick);
      unsub();
      leave();
      removeEventListener("pagehide", leave);
      acts.forEach((a) => window.removeEventListener(a, bump));
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("visibilitychange", onVisible);
      sb.removeChannel(ch);
      setStates(new Map());
      stopRing.current();
    };
  }, [isSignedIn, getToken, router, meId, meName]);

  return (
    <>
      <PermissionGate />
      {ringing && <CallPopup ringing={ringing} dismiss={dismiss} />}
    </>
  );
}

function CallPopup({ ringing, dismiss }: { ringing: Ringing; dismiss: () => void }) {
  return (
    <div role="alertdialog" aria-label={`${ringing.from} is calling`} className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 pl-4 shadow-lg">
      <span className="grid size-9 animate-pulse place-items-center rounded-full bg-primary text-primary-fg"><Phone className="size-4" /></span>
      <div className="mr-2 leading-tight">
        <div className="text-sm font-semibold">{ringing.from}</div>
        <div className="text-xs text-muted">Incoming {ringing.audio ? "audio" : "video"} call</div>
      </div>
      <Link href={`/chat/${ringing.channel}`} onClick={dismiss} className="btn btn-primary"><Phone /> Answer</Link>
      <button type="button" onClick={dismiss} className="btn btn-icon" aria-label="Dismiss call" title="Dismiss"><PhoneOff /></button>
    </div>
  );
}

type Perm = "granted" | "denied" | "prompt" | "unsupported";
const notifPerm = (): Perm => ("Notification" in window ? (Notification.permission === "default" ? "prompt" : Notification.permission) : "unsupported");
const geoPerm = async (): Promise<Perm> => {
  if (!("geolocation" in navigator)) return "unsupported";
  try { return (await navigator.permissions.query({ name: "geolocation" })).state; } catch { return "prompt"; }
};

// Blocks the site until notifications + location (office check-in) are allowed and sound is unlocked.
// Unsupported (e.g. iOS Safari outside a home-screen app) counts as fine; denied can only be fixed in browser settings.
function PermissionGate() {
  const [p, setP] = useState<{ n: Perm; g: Perm } | null>(null);
  const [skip, setSkip] = useState(false);
  const check = () => { geoPerm().then((g) => setP({ n: notifPerm(), g })); };

  useEffect(() => {
    check();
    const subs: PermissionStatus[] = [];
    for (const name of ["notifications", "geolocation"] as const)
      navigator.permissions?.query({ name }).then((s) => { s.onchange = check; subs.push(s); }).catch(() => {});
    window.addEventListener("focus", check); // user came back from browser settings
    return () => { window.removeEventListener("focus", check); subs.forEach((s) => (s.onchange = null)); };
  }, []);

  const allow = async () => {
    audio ??= new AudioContext();
    await audio.resume();
    ding(true); // proves sound works; user sees/hears it
    if (notifPerm() === "prompt") await Notification.requestPermission();
    if ((await geoPerm()) === "prompt")
      await new Promise((r) => navigator.geolocation.getCurrentPosition(r, r, { timeout: 15000 }));
    check();
  };

  if (!p || skip) return null;
  const ok = (x: Perm) => x === "granted" || x === "unsupported";
  if (ok(p.n) && ok(p.g)) return null;
  const denied = p.n === "denied" || p.g === "denied";
  const row = (icon: React.ReactNode, label: string, why: string, s: Perm) => (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">{icon}</span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-sm font-semibold">{label} <span className={`text-xs font-normal ${s === "denied" ? "text-red-600" : "text-muted"}`}>{ok(s) ? "allowed" : s === "denied" ? "blocked" : "needed"}</span></div>
        <div className="text-xs text-muted">{why}</div>
      </div>
    </li>
  );
  return (
    <div role="dialog" aria-modal="true" aria-label="Allow permissions" className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-lg">
        <h2 className="text-lg font-semibold">Allow a few permissions first</h2>
        <p className="mt-1 text-sm text-muted">The panel needs these to work properly.</p>
        <ul className="mt-4 flex flex-col gap-3">
          {row(<Bell className="size-4" />, "Notifications", "Messages, mentions and incoming calls.", p.n)}
          {row(<Volume2 className="size-4" />, "Sound", "Chimes and call ringtone. Unlocked when you tap the button.", "granted")}
          {row(<MapPin className="size-4" />, "Location", "Office check-in.", p.g)}
        </ul>
        {denied && <p className="mt-4 rounded-lg bg-surface-2 p-3 text-xs text-muted">Blocked permissions can only be changed in your browser: click the lock icon in the address bar → Site settings → allow, then come back to this tab.</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={allow} className="btn btn-primary flex-1">{denied ? "Check again" : "Allow all"}</button>
          {denied && <button type="button" onClick={() => setSkip(true)} className="btn">Continue anyway</button>}
        </div>
      </div>
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
