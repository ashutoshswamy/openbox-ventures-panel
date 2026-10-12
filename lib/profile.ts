import { str } from "./util";

const PHONE = /^\+?[\d\s-]{7,15}$/;
const MAIL = /^\S+@\S+\.\S+$/;

// Validates the personal-details form (own profile page + admin/HR edit). Returns an error string or the rows to write.
export function parseProfile(fd: FormData): string | { name: string; alias: string | null; profile: Record<string, string | null> } {
  const required = ["full_name", "date_of_birth", "phone", "current_address", "emergency_name", "emergency_relation", "emergency_phone"];
  if (required.some((k) => !str(fd, k))) return "Please fill in all required fields";

  const age = (Date.now() - new Date(str(fd, "date_of_birth")!).getTime()) / (365.25 * 864e5);
  if (!(age >= 14 && age <= 100)) return "Check the date of birth";
  for (const k of ["phone", "emergency_phone"]) if (!PHONE.test(str(fd, k)!)) return "Phone numbers should be 7-15 digits";
  const alias = str(fd, "alias_name");
  if (alias && alias.length > 60) return "Alias name is too long";
  const email = str(fd, "personal_email");
  if (email && !MAIL.test(email)) return "Personal email doesn't look right";

  const company = str(fd, "company");
  if (!company || !["lgoob", "fusion", "both"].includes(company)) return "Pick which company they work with";
  const companyFields: Record<string, string | null> = { lgoob_alias: null, lgoob_email: null, fusion_alias: null, fusion_email: null };
  for (const [key, name, on] of [["lgoob", "LGOOB", company !== "fusion"], ["fusion", "Fusion Freights", company !== "lgoob"]] as const) {
    if (!on) continue;
    const a = str(fd, `${key}_alias`), e = str(fd, `${key}_email`);
    if (!a || !e) return `Enter the ${name} alias name and email`;
    if (a.length > 60) return `${name} alias name is too long`;
    if (!MAIL.test(e) || e.length > 254) return `${name} email doesn't look right`;
    companyFields[`${key}_alias`] = a;
    companyFields[`${key}_email`] = e.toLowerCase();
  }

  const current = str(fd, "current_address")!;
  return {
    name: str(fd, "full_name")!,
    alias,
    profile: {
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
    },
  };
}
