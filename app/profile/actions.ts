"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMe, rateLimit } from "@/lib/me";
import { parseBank, writeDetails } from "@/lib/details";
import { parseProfile } from "@/lib/profile";

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
    bank = parseBank(fd, me.id);
    if (typeof bank === "string") return bank;
  }

  const err = await writeDetails(me.id, parsed, bank);
  if (err) return err;

  revalidatePath("/", "layout");
  if (!me.onboarded) redirect("/"); // routing takes it from here (pending role → /pending)
  return null;
}
