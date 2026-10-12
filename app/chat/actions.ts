"use server";

import { revalidatePath } from "next/cache";
import { rateLimit, requireMe } from "@/lib/me";
import { checkPassword } from "@/lib/reauth";
import { dms } from "@/lib/dm-unlock";

// Admin re-enters their password to read DMs they're not in, for 15 minutes.
export async function unlockDms(fd: FormData) {
  const me = await requireMe();
  if (me.role !== "admin") throw new Error("Forbidden");
  await rateLimit(`dm-pw:${me.id}`, 5, 300); // ponytail: 5 tries / 5 min on top of Clerk's own lockout
  const err = await checkPassword(String(fd.get("password") ?? ""));
  if (err) return err;
  await dms.set(me.id);
  revalidatePath("/chat", "layout");
}
