// Create (or promote) an admin in Clerk + Supabase.
// Usage: npm run create-admin -- <email> "<Full Name>" [password]
// Without a password the user signs in with whatever non-password method Clerk allows
// (email code / link), or via "Forgot password".
import { createClient } from "@supabase/supabase-js";

const [rawEmail, fullName, password] = process.argv.slice(2);
if (!rawEmail?.includes("@") || !fullName) {
  console.error('Usage: npm run create-admin -- <email> "<Full Name>" [password]');
  process.exit(1);
}
for (const k of ["CLERK_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"]) {
  if (!process.env[k]) throw new Error(`${k} missing (is .env.local filled in?)`);
}
const email = rawEmail.trim().toLowerCase();

async function clerk(path, init = {}) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Clerk ${path}: ${body.errors?.map((e) => e.long_message ?? e.message).join("; ") ?? res.status}`);
  return body;
}

// 1. Clerk user with publicMetadata.role = admin (reuse if the email already exists)
const [first, ...rest] = fullName.trim().split(/\s+/);
let [user] = await clerk(`/users?email_address=${encodeURIComponent(email)}`);
if (user) {
  await clerk(`/users/${user.id}/metadata`, { method: "PATCH", body: JSON.stringify({ public_metadata: { role: "admin" } }) });
  if (user.banned) await clerk(`/users/${user.id}/unban`, { method: "POST" });
  if (password) await clerk(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ password }) });
  console.log(`Clerk: existing user ${user.id} promoted to admin`);
} else {
  user = await clerk("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [email],
      first_name: first,
      last_name: rest.join(" ") || undefined,
      ...(password ? { password } : { skip_password_requirement: true }),
      public_metadata: { role: "admin" },
    }),
  });
  console.log(`Clerk: created user ${user.id}`);
}

// 2. Supabase employee row, linked to the Clerk user
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { error } = await sb
  .from("employees")
  // admins sit outside the workforce: no office/department
  .upsert({ email, full_name: fullName.trim(), clerk_user_id: user.id, active: true, role: "admin", office_id: null, department_id: null, designation: null }, { onConflict: "email" });
if (error) throw new Error(`Supabase: ${error.message}`);
console.log(`Supabase: employee row ready for ${email}`);
console.log("Done. Sign in at /sign-in.");
