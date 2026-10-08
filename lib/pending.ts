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

// Colleagues with a birthday / work anniversary today (names only, no age).
// Server key: date_of_birth is private to the person + admins, so only the name leaves this function.
// ponytail: scans active employees in JS, fine at company scale.
export async function todaysCelebrations() {
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
