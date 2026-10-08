// ⚠️ Deletes ALL users in the Clerk instance behind CLERK_SECRET_KEY. Cannot be undone.
// Usage: npm run reset-clerk -- --yes
// Pair with supabase/reset.sql + schema.sql for a full wipe, then npm run create-admin.
if (!process.env.CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY missing (is .env.local filled in?)");
const live = process.env.CLERK_SECRET_KEY.startsWith("sk_live_");
const args = process.argv.slice(2);
if (!args.includes("--yes") || (live && !args.includes("--live"))) {
  console.error(`Deletes every user in the ${live ? "PRODUCTION" : "development"} Clerk instance.`);
  console.error(`Re-run with: npm run reset-clerk -- --yes${live ? " --live" : ""}`);
  process.exit(1);
}

async function clerk(path, init = {}) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Clerk ${path}: ${body.errors?.map((e) => e.long_message ?? e.message).join("; ") ?? res.status}`);
  return body;
}

let deleted = 0;
// always page from offset 0: each delete shifts the list
for (let users; (users = await clerk("/users?limit=100")).length; ) {
  for (const u of users) {
    await clerk(`/users/${u.id}`, { method: "DELETE" });
    deleted++;
    console.log(`deleted ${u.id} ${u.email_addresses?.[0]?.email_address ?? ""}`);
  }
}
console.log(`Done. ${deleted} Clerk user(s) deleted.`);
