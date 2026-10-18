"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMe, rateLimit } from "@/lib/me";
import { adminDb } from "@/lib/supabase";
import { parseProfile } from "@/lib/profile";
import { str } from "@/lib/util";

// Server key on purpose: users waiting for a role have no RLS access yet. Writes only the caller's own row.
export async function saveProfile(fd: FormData) {
  const me = await getMe();
  if (!me || me.role === "admin") return "Not allowed";
  await rateLimit(me.id);

  const parsed = parseProfile(fd);
  if (typeof parsed === "string") return parsed;

  // New users must give bank details up front (later edits go through the locked bank form).
  let bank = null;
  if (!me.onboarded) {
    const f = (k: string) => str(fd, k) ?? "";
    const [holder, bankName, account, ifsc, pan, uan] = [f("holder_name"), f("bank_name"), f("account_number"), f("ifsc").toUpperCase(), f("pan").toUpperCase(), f("uan")];
    if (!holder || !bankName || !account || !ifsc) return "Bank details are required";
    if (!/^[0-9]{6,20}$/.test(account)) return "Invalid account number";
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return "Invalid IFSC";
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return "Invalid PAN";
    if (uan && !/^[0-9]{12}$/.test(uan)) return "Invalid UAN";
    bank = { employee_id: me.id, holder_name: holder, bank_name: bankName, account_number: account, ifsc, pan: pan || null, uan: uan || null };
  }

  const sb = adminDb();
  if (bank) {
    const { error } = await sb.from("employee_bank").upsert(bank);
    if (error) return error.message;
  }
  const { error } = await sb.from("employee_profiles").upsert({ employee_id: me.id, ...parsed.profile, updated_at: new Date().toISOString() });
  if (error) return error.message;
  await sb.from("employees").update({ full_name: parsed.name, alias_name: parsed.alias }).eq("id", me.id);

  revalidatePath("/", "layout");
  if (!me.onboarded) redirect("/"); // routing takes it from here (pending role → /pending)
  return null;
}
