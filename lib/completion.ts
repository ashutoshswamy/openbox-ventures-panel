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

// Optional email via Resend (RESEND_API_KEY + MAIL_FROM). false = not configured or failed.
export async function mail(to: string, subject: string, text: string, html?: string) {
  const { RESEND_API_KEY: key, MAIL_FROM: from } = process.env;
  if (!key || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, html }),
  }).catch(() => null);
  return !!res?.ok;
}

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// Site theme (zinc palette, Bricolage Grotesque). Table layout + inline styles: what email clients render reliably.
// The web font loads in Apple Mail / iOS; Gmail and Outlook fall back to the system font.
export function completionEmail(name: string, url: string, siteUrl: string) {
  const font = "'Bricolage Grotesque',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#fafafa;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;padding:32px;font-family:${font};color:#18181b;">
<tr><td style="padding-bottom:24px;"><img src="${esc(siteUrl)}/logo.png" width="40" height="40" alt="Open Box Ventures" style="display:block;border-radius:8px;"></td></tr>
<tr><td style="font-size:22px;font-weight:700;letter-spacing:-0.01em;padding-bottom:12px;">Complete your details</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#18181b;padding-bottom:24px;">Hi ${esc(name)},<br><br>Please sign in and fill in your remaining details (personal and bank information) so we can finish setting you up.</td></tr>
<tr><td style="padding-bottom:24px;"><a href="${esc(url)}" style="display:inline-block;background:#18181b;color:#fafafa;text-decoration:none;font-family:${font};font-size:15px;font-weight:600;padding:12px 24px;border-radius:10px;">Complete my details</a></td></tr>
<tr><td style="font-size:12px;line-height:1.5;color:#5f5f69;border-top:1px solid #e4e4e7;padding-top:16px;">Button not working? Paste this link into your browser:<br><a href="${esc(url)}" style="color:#5f5f69;">${esc(url)}</a></td></tr>
<tr><td style="font-size:12px;color:#5f5f69;padding-top:16px;">Open Box Ventures LLP</td></tr>
</table></td></tr></table></body></html>`;
}
