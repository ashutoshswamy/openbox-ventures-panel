// One-off: apply the onboarding tidy-ups (names, addresses, phones, emails, bank ids) to rows saved before they existed.
// Dry run by default (prints before → after). Add --apply to write.
// Usage: npm run tidy-existing [-- --apply]
import { createClient } from "@supabase/supabase-js";
import { tidyAddress, tidyName, tidyOrg, tidyPhone } from "../lib/profile";

const apply = process.argv.includes("--apply");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const bare = (s: string | null) => s?.replace(/[\s-]/g, "") ?? null;
const phone = (s: string | null) => (s && /\d/.test(s) ? tidyPhone(s) : s);

// table → key column → field fixers
const jobs: [string, string, Record<string, (v: string | null) => string | null>][] = [
  ["employees", "id", { full_name: tidyName, alias_name: tidyName }],
  ["employee_profiles", "employee_id", {
    phone, emergency_phone: phone,
    current_address: tidyAddress, permanent_address: tidyAddress,
    emergency_name: tidyName, emergency_relation: tidyName,
    lgoob_alias: tidyName, fusion_alias: tidyName,
    personal_email: (v) => v?.trim().toLowerCase() ?? null,
  }],
  ["employee_bank", "employee_id", {
    holder_name: tidyName, bank_name: tidyOrg,
    account_number: bare, uan: bare,
    ifsc: (v) => bare(v)?.toUpperCase() ?? null, pan: (v) => bare(v)?.toUpperCase() ?? null,
  }],
];

let changed = 0;
for (const [table, key, fixers] of jobs) {
  const { data, error } = await sb.from(table).select("*");
  if (error) throw new Error(`${table}: ${error.message}`);
  for (const row of data ?? []) {
    const patch: Record<string, string | null> = {};
    for (const [col, fix] of Object.entries(fixers)) {
      const old = row[col];
      if (typeof old !== "string") continue;
      const next = fix(old);
      if (next !== old) patch[col] = next;
    }
    if (!Object.keys(patch).length) continue;
    changed++;
    console.log(`${table} ${row[key]}`);
    for (const [c, v] of Object.entries(patch)) console.log(`  ${c}: ${JSON.stringify(row[c])} → ${JSON.stringify(v)}`);
    if (apply) {
      const { error: e } = await sb.from(table).update(patch).eq(key, row[key]);
      if (e) console.error(`  FAILED: ${e.message}`);
    }
  }
}
console.log(`\n${changed} row(s) ${apply ? "updated" : "would change (dry run, pass --apply to write)"}`);
