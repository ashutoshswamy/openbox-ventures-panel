import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { adminDb } from "./supabase";
import { SITE_URL } from "./util";

// "Complete your details" links: /complete/<token> works without signing in, so only the sha256 is stored.
// One live link per person, valid 7 days, single use. It can only fill in what is missing, never overwrite.
const DAYS = 7;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

// What the person still has to fill in, or null when nothing is missing.
export async function missing(employeeId: string) {
  const sb = adminDb();
  const [{ data: p }, { data: b }] = await Promise.all([
    sb.from("employee_profiles").select("employee_id").eq("employee_id", employeeId).maybeSingle(),
    sb.from("employee_bank").select("employee_id").eq("employee_id", employeeId).maybeSingle(),
  ]);
  return p && b ? null : { profile: !p, bank: !b };
}

// New link (replaces the old one). Returns the URL, or an error string.
export async function issueLink(employeeId: string, by: string) {
  if (!(await missing(employeeId))) return { error: "Details and bank account are already filled in" };
  const token = randomBytes(32).toString("base64url");
  const { error } = await adminDb().from("completion_links").upsert({
    employee_id: employeeId, token_hash: hash(token), created_by: by, used_at: null, created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + DAYS * 864e5).toISOString(),
  });
  return error ? { error: error.message } : { url: `${SITE_URL}/complete/${token}` };
}

// Person + what is missing for a live token, else null.
export async function openLink(token: string) {
  const { data } = await adminDb().from("completion_links")
    .select("employee:employees!inner(id, full_name, alias_name, active)")
    .eq("token_hash", hash(token)).is("used_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  const emp = data?.employee as unknown as { id: string; full_name: string; alias_name: string | null; active: boolean } | undefined;
  const need = emp?.active ? await missing(emp.id) : null;
  return emp && need ? { emp, need } : null;
}

// Claim the link (true once; a second submit or a race gets false). Give it back if the save fails.
export async function claimLink(token: string) {
  const { data } = await adminDb().from("completion_links").update({ used_at: new Date().toISOString() })
    .eq("token_hash", hash(token)).is("used_at", null).gt("expires_at", new Date().toISOString()).select("employee_id");
  return !!data?.length;
}
export const releaseLink = (token: string) => adminDb().from("completion_links").update({ used_at: null }).eq("token_hash", hash(token));

// Optional email via Resend (RESEND_API_KEY + MAIL_FROM). false = not configured or failed: share the link by hand.
export async function mail(to: string, subject: string, text: string) {
  const { RESEND_API_KEY: key, MAIL_FROM: from } = process.env;
  if (!key || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  }).catch(() => null);
  return !!res?.ok;
}
