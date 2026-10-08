"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { getMe, rateLimit } from "@/lib/me";
import { adminDb } from "@/lib/supabase";

// Copy the caller's Clerk profile photo into employees.avatar_url (null when they have none).
// Reads the photo from Clerk server-side, so the client can't plant an arbitrary URL.
export async function syncAvatar() {
  const me = await getMe();
  const user = await currentUser();
  if (!me || !user) return;
  await rateLimit(me.id);
  const url = user.hasImage ? user.imageUrl : null;
  await adminDb().from("employees").update({ avatar_url: url }).eq("id", me.id);
  revalidatePath("/", "layout");
}
