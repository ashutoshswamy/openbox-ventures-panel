export const DEFAULT_TZ = "Asia/Kolkata";
// Canonical origin (invite links, canonical/OG/sitemap). Production always uses the real domain so a stray
// NEXT_PUBLIC_SITE_URL (e.g. the *.vercel.app URL) can't leak into SEO tags. Override in dev/preview only.
const DOMAIN = "https://panel.openboxventures.in";
export const SITE_URL = process.env.VERCEL_ENV === "production" ? DOMAIN : (process.env.NEXT_PUBLIC_SITE_URL ?? DOMAIN);
// Shared-link preview defaults. Page-level openGraph/twitter replace the parent's, so pages spread these.
const OG_IMAGE = { url: "/og-image.png", width: 1730, height: 909, alt: "Open Box Ventures LLP Panel: attendance, leave, payroll, HR, chat and meetings" };
export const SHARE = {
  openGraph: { type: "website", siteName: "Open Box Ventures LLP Panel", locale: "en_IN", images: OG_IMAGE },
  twitter: { card: "summary_large_image", images: OG_IMAGE },
} as const;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// YYYY-MM-DD in a timezone
export function todayIn(tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

export function fmtTime(iso: string | null | undefined, tz = DEFAULT_TZ) {
  return iso ? new Date(iso).toLocaleTimeString("en-IN", { timeZone: tz, hour: "2-digit", minute: "2-digit" }) : "-";
}

export function fmtDate(d: string) {
  return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// "2026-10-03" + "09:30" in tz → UTC ISO string
export function zonedIso(date: string, time: string, tz = DEFAULT_TZ) {
  const guess = new Date(`${date}T${time}:00Z`);
  const asTz = new Date(guess.toLocaleString("en-US", { timeZone: tz }));
  const asUtc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (asTz.getTime() - asUtc.getTime())).toISOString();
}

// FormData string or null
export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// ponytail: public meet.jit.si, room name = channel id (unguessable) + per-call suffix. Self-host Jitsi / LiveKit if privacy or recording needed.
export function meetUrl(channelId: string, room: string) {
  return `https://meet.jit.si/OpenboxVentures-${channelId.replaceAll("-", "")}${room}`;
}

export const roomOf = (url: string) => url.slice(-12);

export const CALL_ENDED = "Ended the video call: ";

export function greeting(tz = DEFAULT_TZ) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export const LEAVE_TONE: Record<string, string> = {
  pending: "badge-amber",
  manager_approved: "badge-blue",
  approved: "badge-green",
  rejected: "badge-red",
  cancelled: "",
};

export function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

// Announcement posts are "Headline\n\nMessage"; automated posts are a single line.
// Attachments shown inline, by file extension. Everything else downloads.
export function mediaKind(path: string): "image" | "video" | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "m4v"].includes(ext)) return "video";
  return null;
}

export function splitPost(body: string): [title: string | null, text: string] {
  const i = body.indexOf("\n\n");
  return i > 0 ? [body.slice(0, i), body.slice(i + 2)] : [null, body];
}
