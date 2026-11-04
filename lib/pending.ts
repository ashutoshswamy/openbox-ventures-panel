import "server-only";
import { adminDb } from "./supabase";
import { DEFAULT_TZ, todayIn } from "./util";

// Pending approvals, scoped by whatever RLS lets `sb` (a db() client) see. Excludes the viewer's own requests.
// Leave: any non-final status (so it also covers 'manager_approved' without naming it).
// olderThanHours: only requests waiting longer than that (0 = all).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pendingCounts(sb: any, meId: string, olderThanHours = 0) {
  const cutoff = new Date(Date.now() - olderThanHours * 3600_000).toISOString();
  const [{ count: leave }, { count: regularizations }] = await Promise.all([
    sb.from("leave_requests").select("id", { count: "exact", head: true }).not("status", "in", "(approved,rejected,cancelled)").neq("employee_id", meId).lte("created_at", cutoff),
    sb.from("regularizations").select("id", { count: "exact", head: true }).eq("status", "pending").neq("employee_id", meId).lte("created_at", cutoff),
  ]);
  return { leave: (leave ?? 0) as number, regularizations: (regularizations ?? 0) as number };
}

// Posts today's birthday / anniversary / holiday-eve announcements. The Vercel cron does this at 03:00 UTC, but cron only runs on a
// deployed production site, so dashboards also trigger it. daily_reminders() logs what it posted, so running it again is harmless.
let remindedOn = "";
export async function ensureDailyReminders() {
  const day = todayIn(DEFAULT_TZ);
  if (remindedOn === day) return;
  const { error } = await adminDb().rpc("daily_reminders");
  if (!error) remindedOn = day;
}

// Colleagues with a birthday / work anniversary today (names only, no age).
// Server key: date_of_birth is private to the person + admins, so only the name leaves this function.
// ponytail: scans active employees in JS, fine at company scale.
export async function todaysCelebrations() {
  await ensureDailyReminders().catch(() => {});
  const md = todayIn(DEFAULT_TZ).slice(5);
  const year = Number(todayIn(DEFAULT_TZ).slice(0, 4));
  const { data } = await adminDb().from("employees").select("full_name, joined_on, profile:employee_profiles(date_of_birth)").eq("active", true).or("role.is.null,role.neq.admin");
  const out: string[] = [];
  for (const e of data ?? []) {
    const dob = (e.profile as { date_of_birth?: string } | null)?.date_of_birth;
    if (dob?.slice(5) === md) out.push(`${e.full_name}'s birthday`);
    if (e.joined_on?.slice(5) === md && year - Number(e.joined_on.slice(0, 4)) >= 1) {
      const y = year - Number(e.joined_on.slice(0, 4));
      out.push(`${e.full_name}'s ${y}-year work anniversary`);
    }
  }
  return out;
}

export type MonthEvent = { date: string; kind: "birthday" | "anniversary" | "joined" | "holiday"; text: string };

// Everything still to come this month (plus today): birthdays, work anniversaries, new joiners, holidays. Names and dates only, no ages.
// Server key like todaysCelebrations(); holidays are limited to the viewer's office (+ company-wide ones). officeId undefined = every office (admin).
export async function monthEvents(officeId?: string | null): Promise<MonthEvent[]> {
  await ensureDailyReminders().catch(() => {});
  const today = todayIn(DEFAULT_TZ);
  const month = today.slice(0, 7);
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const sb = adminDb();
  const [{ data: emps }, { data: hols }] = await Promise.all([
    sb.from("employees").select("full_name, joined_on, profile:employee_profiles(date_of_birth)").eq("active", true).or("role.is.null,role.neq.admin"),
    sb.from("holidays").select("name, date, office_id").gte("date", today).lte("date", end).order("date"),
  ]);
  const out: MonthEvent[] = (hols ?? []).filter((h) => officeId === undefined || !h.office_id || h.office_id === officeId).map((h) => ({ date: h.date, kind: "holiday", text: h.name }));
  const year = Number(month.slice(0, 4));
  for (const e of emps ?? []) {
    const dob = (e.profile as { date_of_birth?: string } | null)?.date_of_birth;
    if (dob?.slice(5, 7) === month.slice(5, 7)) {
      const d = `${month}-${dob.slice(8, 10)}`;
      if (d >= today) out.push({ date: d, kind: "birthday", text: `${e.full_name}'s birthday` });
    }
    if (e.joined_on) {
      const y = year - Number(e.joined_on.slice(0, 4));
      if (e.joined_on.slice(5, 7) === month.slice(5, 7)) {
        const d = `${month}-${e.joined_on.slice(8, 10)}`;
        if (y >= 1 && d >= today) out.push({ date: d, kind: "anniversary", text: `${e.full_name}'s ${y}-year work anniversary` });
        if (y === 0 && e.joined_on <= today) out.push({ date: e.joined_on, kind: "joined", text: `${e.full_name} joined the team` });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.text.localeCompare(b.text));
}

// How many of today's automatic posts (birthdays, anniversaries, holiday eve) are still missing from the Announcements channel.
// Mirrors daily_reminders() and compares with its reminder_log.
export async function missingReminders() {
  const day = todayIn(DEFAULT_TZ);
  const md = day.slice(5);
  const year = Number(day.slice(0, 4));
  const tomorrow = new Date(Date.parse(day + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
  const sb = adminDb();
  const [{ data: emps }, { data: hols }, { data: log }] = await Promise.all([
    sb.from("employees").select("id, joined_on, profile:employee_profiles(date_of_birth)").eq("active", true).or("role.is.null,role.neq.admin"),
    sb.from("holidays").select("id").eq("date", tomorrow),
    sb.from("reminder_log").select("kind, ref").eq("day", day),
  ]);
  const done = new Set((log ?? []).map((l) => `${l.kind}:${l.ref}`));
  const want: string[] = (hols ?? []).map((h) => `holiday:${h.id}`);
  for (const e of emps ?? []) {
    if ((e.profile as { date_of_birth?: string } | null)?.date_of_birth?.slice(5) === md) want.push(`birthday:${e.id}`);
    if (e.joined_on?.slice(5) === md && year - Number(e.joined_on.slice(0, 4)) >= 1) want.push(`anniversary:${e.id}`);
  }
  return want.filter((w) => !done.has(w)).length;
}
