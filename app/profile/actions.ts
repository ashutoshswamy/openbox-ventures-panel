"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMe, rateLimit } from "@/lib/me";
import { adminDb } from "@/lib/supabase";
import { parseProfile } from "@/lib/profile";

// Server key on purpose: users waiting for a role have no RLS access yet. Writes only the caller's own row.
export async function saveProfile(fd: FormData) {
  const me = await getMe();
  if (!me || me.role === "admin") return "Not allowed";
  await rateLimit(me.id);

  const parsed = parseProfile(fd);
  if (typeof parsed === "string") return parsed;

  const sb = adminDb();
  const { error } = await sb.from("employee_profiles").upsert({ employee_id: me.id, ...parsed.profile, updated_at: new Date().toISOString() });
  if (error) return error.message;
  await sb.from("employees").update({ full_name: parsed.name, alias_name: parsed.alias }).eq("id", me.id);

  revalidatePath("/", "layout");
  if (!me.onboarded) redirect("/"); // routing takes it from here (pending role → /pending)
  return null;
}
