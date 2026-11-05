"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMe, rateLimit } from "@/lib/me";
import { missing } from "@/lib/completion";
import { parseBank, writeDetails } from "@/lib/details";
import { parseProfile } from "@/lib/profile";

// Signed-in employee fills in their own missing parts. Never overwrites what is already saved.
export async function submitCompletion(fd: FormData) {
  const me = await getMe();
  if (!me || me.role === "admin") return "Not allowed";
  await rateLimit(me.id);
  const need = await missing(me.id);
  if (!need) return "Everything is already filled in";

  let parsed = null;
  if (need.profile) {
    const p = parseProfile(fd);
    if (typeof p === "string") return p;
    parsed = p;
  }
  const bank = need.bank ? parseBank(fd, me.id) : null;
  if (typeof bank === "string") return bank;

  const err = await writeDetails(me.id, parsed, bank);
  if (err) return err;
  revalidatePath("/", "layout");
  redirect("/");
}
