"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMe, rateLimit } from "@/lib/me";
import { adminDb } from "@/lib/supabase";
import { str } from "@/lib/util";

const PHONE = /^\+?[\d\s-]{7,15}$/;

// Server key on purpose: users waiting for a role have no RLS access yet. Writes only the caller's own row.
export async function saveProfile(fd: FormData) {
  const me = await getMe();
  if (!me || me.role === "admin") return "Not allowed";
  await rateLimit(me.id);

  const required = ["full_name", "date_of_birth", "phone", "current_address", "emergency_name", "emergency_relation", "emergency_phone"];
  const missing = required.filter((k) => !str(fd, k));
  if (missing.length) return "Please fill in all required fields";

  const dob = new Date(str(fd, "date_of_birth")!);
  const age = (Date.now() - dob.getTime()) / (365.25 * 864e5);
  if (!(age >= 14 && age <= 100)) return "Check your date of birth";
  for (const k of ["phone", "emergency_phone"]) if (!PHONE.test(str(fd, k)!)) return "Phone numbers should be 7-15 digits";
  const alias = str(fd, "alias_name");
  if (alias && alias.length > 60) return "Alias name is too long";
  const email = str(fd, "personal_email");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return "Personal email doesn't look right";

  const company = str(fd, "company");
  if (!company || !["lgoob", "fusion", "both"].includes(company)) return "Pick which company you work with";
  const companyFields = { lgoob_alias: null, lgoob_email: null, fusion_alias: null, fusion_email: null } as Record<string, string | null>;
  for (const [key, name, on] of [["lgoob", "LGOOB", company !== "fusion"], ["fusion", "Fusion Freights", company !== "lgoob"]] as const) {
    if (!on) continue;
    const a = str(fd, `${key}_alias`), e = str(fd, `${key}_email`);
    if (!a || !e) return `Enter your ${name} alias name and email`;
    if (a.length > 60) return `${name} alias name is too long`;
    if (!/^\S+@\S+\.\S+$/.test(e) || e.length > 254) return `${name} email doesn't look right`;
    companyFields[`${key}_alias`] = a;
    companyFields[`${key}_email`] = e.toLowerCase();
  }

  const current = str(fd, "current_address")!;
  const sb = adminDb();
  const { error } = await sb.from("employee_profiles").upsert({
    employee_id: me.id,
    date_of_birth: str(fd, "date_of_birth"),
    gender: str(fd, "gender"),
    phone: str(fd, "phone"),
    personal_email: email,
    blood_group: str(fd, "blood_group"),
    current_address: current,
    permanent_address: fd.get("same_address") === "on" ? current : str(fd, "permanent_address"),
    emergency_name: str(fd, "emergency_name"),
    emergency_relation: str(fd, "emergency_relation"),
    emergency_phone: str(fd, "emergency_phone"),
    company,
    ...companyFields,
    updated_at: new Date().toISOString(),
  });
  if (error) return error.message;
  await sb.from("employees").update({ full_name: str(fd, "full_name"), alias_name: alias }).eq("id", me.id);

  revalidatePath("/", "layout");
  if (!me.onboarded) redirect("/"); // routing takes it from here (pending role → /pending)
  return null;
}
