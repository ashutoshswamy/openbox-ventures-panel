import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { adminDb } from "./supabase";

export type Role = "employee" | "manager" | "hr" | "admin";
export type Me = {
  id: string;
  email: string;
  full_name: string;
  alias_name: string | null; // set by the employee
  role: Role | null; // null = joined, waiting for an admin to assign a role
  office_id: string | null;
  department_id: string | null;
  onboarded: boolean; // filled the personal details form
  avatar_url: string | null; // Clerk profile photo copy
};
type Assigned = Me & { role: Role };

const cols = "id, email, full_name, alias_name, office_id, department_id, role, avatar_url, profile:employee_profiles(employee_id)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toMe = ({ profile, ...e }: any, role: Role | null): Me => ({ ...e, role, onboarded: !!profile });

// Current employee, or null if not invited / deactivated.
// First sign-in links the Clerk user to the invite row by verified email.
// ponytail: no Clerk webhook - linking on visit covers it.
// Role comes from Clerk publicMetadata.role (via session token).
// Own row read with the server key: RLS hides everything from role-less users.
export const getMe = cache(async (): Promise<Me | null> => {
  const { userId, sessionClaims } = await auth.protect(); // signed out → sign-in redirect
  const role = sessionClaims?.metadata?.role ?? null;

  const { data } = await adminDb().from("employees").select(cols).eq("clerk_user_id", userId).eq("active", true).maybeSingle();
  if (data) {
    // keep employees.role (filtering copy) in step with Clerk
    if (data.role !== role) await adminDb().from("employees").update({ role }).eq("id", data.id);
    return toMe(data, role);
  }

  const email = (await currentUser())?.primaryEmailAddress;
  if (email?.verification?.status !== "verified") return null;

  const { data: linked } = await adminDb()
    .from("employees")
    .update({ clerk_user_id: userId })
    .eq("email", email.emailAddress.toLowerCase())
    .is("clerk_user_id", null)
    .eq("active", true)
    .select(cols)
    .maybeSingle();
  if (linked) {
    // first sign-in = joining date (unless an admin already set one)
    await adminDb().from("employees").update({ joined_on: new Date().toISOString().slice(0, 10) }).eq("id", linked.id).is("joined_on", null);
    if (linked.role !== role) await adminDb().from("employees").update({ role }).eq("id", linked.id);
  }
  return linked && toMe(linked, role);
});

// Per-employee limit on server actions + file routes (everything that goes through requireMe).
// ponytail: Postgres fixed window, one RPC per call. IP-level / page-view floods: Vercel Firewall rate-limit rule.
export async function rateLimit(employeeId: string, max = 120, windowS = 60) {
  const { data, error } = await adminDb().rpc("hit_rate_limit", { p_key: employeeId, p_max: max, p_window_s: windowS });
  if (error) throw new Error("Rate limit check failed");
  if (!data) throw new Error("Too many requests");
}

// For server actions / route handlers. Throws (not redirect) so callers can't skip it.
export async function requireMe(): Promise<Assigned> {
  const me = await getMe();
  if (!me?.role) throw new Error("Unauthorized");
  await rateLimit(me.id);
  return me as Assigned;
}

export async function requireStaff(): Promise<Assigned> {
  const me = await requireMe();
  if (me.role === "employee") throw new Error("Forbidden");
  return me;
}

export async function requireAdmin(): Promise<Assigned> {
  const me = await requireMe();
  if (me.role !== "admin") throw new Error("Forbidden");
  return me;
}

// Pages/layouts: not an active employee → /no-access; details form not filled (non-admins) → /profile;
// no role yet → /pending. (Layouts and pages render in parallel, so every page checks for itself.)
export async function pageMe(): Promise<Assigned> {
  const me = await getMe();
  if (!me) redirect("/no-access");
  if (me.role !== "admin" && !me.onboarded) redirect("/profile");
  if (!me.role) redirect("/pending");
  return me as Assigned;
}

// Employee panel: employees + managers. Admins only get the admin panel.
export async function employeePage(): Promise<Assigned> {
  const me = await pageMe();
  if (me.role === "admin") redirect("/admin");
  return me;
}

// Admin-only pages: managers get bounced to the admin overview.
export async function adminPage(): Promise<Assigned> {
  const me = await pageMe();
  if (me.role !== "admin") redirect(me.role === "hr" ? "/hr" : "/admin");
  return me;
}

// HR portal (/hr): hr only. Admin/manager → /admin, employees → /.
export async function hrPage(): Promise<Assigned> {
  const me = await pageMe();
  if (me.role === "employee") redirect("/");
  if (me.role !== "hr") redirect("/admin");
  return me;
}

// Admin panel pages: admin or manager.
export async function staffPage(): Promise<Assigned> {
  const me = await pageMe();
  if (me.role === "employee") redirect("/");
  return me;
}
