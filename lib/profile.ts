import { str } from "./util";

const PHONE = /^\+?[\d\s-]+$/;
const digits = (s: string) => s.replace(/\D/g, "").length;
const MAIL = /^\S+@\S+\.\S+$/;

// ponytail: simple tidy-ups, no locale rules (Mcdonald, van der Berg come out plain). Edit by hand if a name needs it.
const squash = (s: string) => s.replace(/[ \t]+/g, " ").trim();
// Mixed-case input keeps 2-3 letter caps words ("Haneen PT"); anything with an @ (email used as alias) is left alone.
export const tidyName = (s: string | null) => {
  if (!s) return s;
  const t = squash(s);
  if (t.includes("@")) return t;
  const keep = /[a-z]/.test(t);
  return t.split(" ").map((w) => (keep && /^[A-Z]{2,3}$/.test(w) ? w : w.toLowerCase().replace(/(^|[\-'’.(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()))).join(" ");
};
// Bank names: acronyms (HDFC, ICICI, SBI) stay caps, "of/and" lowercase, rest title-cased.
export const tidyOrg = (s: string | null) => s && squash(s).split(" ").map((w) =>
  /^[A-Z]{2,5}$/.test(w) && w !== "BANK" ? w : /^(of|and|the)$/i.test(w) ? w.toLowerCase() : tidyName(w)!).join(" ");
// Addresses: one tidy line per line, title-cased (2-3 letter ALL-CAPS words like VPO, HP, SBI stay as typed), "4b" → "4B", "," followed by one space.
export const tidyAddress = (s: string | null) => s && s.split(/\r?\n/).map((l) =>
  l.replace(/\s*,\s*/g, ", ").replace(/,\s*$/, "").split(/\s+/).map((w) => (/^[A-Z]{2,3}\W*$/.test(w) ? w : tidyName(w)!)).join(" ")
    .replace(/\b(\d+)([a-z])\b/gi, (_, n, c) => n + c.toUpperCase()).trim()).filter(Boolean).join("\n");
// "+91 9876543210" / "91-98765 43210" / "+919876543210" → "+91 98765 43210" (Indian numbers grouped 5+5; others "+code digits"; no code → bare digits).
export function tidyPhone(s: string) {
  const t = squash(s), all = t.replace(/\D/g, "");
  const m = t.match(/^\+?(\d{1,3})[\s-]+(.*)$/);
  const [code, rest] = m ? [m[1], m[2].replace(/\D/g, "")] : t.startsWith("+") && all.length === 12 && all.startsWith("91") ? ["91", all.slice(2)] : ["", all];
  const body = code === "91" && rest.length === 10 ? rest.replace(/(\d{5})(\d{5})/, "$1 $2") : rest;
  return code ? `+${code} ${body}` : t.startsWith("+") ? `+${all}` : all.length === 10 ? all.replace(/(\d{5})(\d{5})/, "$1 $2") : all;
}

// Validates the personal-details form (own profile page + admin/HR edit). Returns an error string or the rows to write.
export function parseProfile(fd: FormData): string | { name: string; alias: string | null; profile: Record<string, string | null> } {
  const required = ["full_name", "date_of_birth", "phone", "current_address", "emergency_name", "emergency_relation", "emergency_phone"];
  if (required.some((k) => !str(fd, k))) return "Please fill in all required fields";

  const age = (Date.now() - new Date(str(fd, "date_of_birth")!).getTime()) / (365.25 * 864e5);
  if (!(age >= 14 && age <= 100)) return "Check the date of birth";
  for (const k of ["phone", "emergency_phone"]) if (!PHONE.test(str(fd, k)!) || digits(str(fd, k)!) < 8 || digits(str(fd, k)!) > 15) return "Phone numbers should be 8-15 digits";
  const alias = str(fd, "alias_name");
  if (alias && alias.length > 60) return "Alias name is too long";
  const email = str(fd, "personal_email")?.toLowerCase() ?? null;
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
    companyFields[`${key}_alias`] = tidyName(a);
    companyFields[`${key}_email`] = e.toLowerCase();
  }

  const current = tidyAddress(str(fd, "current_address"))!;
  return {
    name: tidyName(str(fd, "full_name"))!,
    alias: tidyName(alias),
    profile: {
      date_of_birth: str(fd, "date_of_birth"),
      gender: str(fd, "gender"),
      phone: tidyPhone(str(fd, "phone")!),
      personal_email: email,
      blood_group: str(fd, "blood_group"),
      current_address: current,
      permanent_address: fd.get("same_address") === "on" ? current : tidyAddress(str(fd, "permanent_address")),
      emergency_name: tidyName(str(fd, "emergency_name")),
      emergency_relation: tidyName(str(fd, "emergency_relation")),
      emergency_phone: tidyPhone(str(fd, "emergency_phone")!),
      company,
      ...companyFields,
    },
  };
}
