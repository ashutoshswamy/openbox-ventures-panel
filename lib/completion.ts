import "server-only";
import { adminDb } from "./supabase";

// "Complete your details": /complete shows a signed-in employee only the parts still missing (personal details, bank account).

// What the employee still has to fill in, or null when nothing is missing.
export async function missing(employeeId: string) {
  const sb = adminDb();
  const [{ data: p }, { data: b }] = await Promise.all([
    sb.from("employee_profiles").select("employee_id").eq("employee_id", employeeId).maybeSingle(),
    sb.from("employee_bank").select("employee_id").eq("employee_id", employeeId).maybeSingle(),
  ]);
  return p && b ? null : { profile: !p, bank: !b };
}

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
