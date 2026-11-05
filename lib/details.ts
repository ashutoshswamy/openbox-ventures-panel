import "server-only";
import { adminDb } from "./supabase";
import { type parseProfile, tidyName, tidyOrg } from "./profile";
import { str } from "./util";

export type Parsed = Exclude<ReturnType<typeof parseProfile>, string>;

// Bank fields of the onboarding form → employee_bank row, or an error string.
export function parseBank(fd: FormData, employee_id: string) {
  const f = (k: string) => str(fd, k) ?? "";
  const [holder, bankName, account, ifsc, pan, uan] = [tidyName(f("holder_name"))!, tidyOrg(f("bank_name"))!, f("account_number").replace(/[\s-]/g, ""), f("ifsc").replace(/\s/g, "").toUpperCase(), f("pan").replace(/\s/g, "").toUpperCase(), f("uan").replace(/[\s-]/g, "")];
  if (!holder || !bankName || !account || !ifsc) return "Bank details are required";
  if (!/^[0-9]{6,20}$/.test(account)) return "Invalid account number";
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return "Invalid IFSC";
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return "Invalid PAN";
  if (uan && !/^[0-9]{12}$/.test(uan)) return "Invalid UAN";
  return { employee_id, holder_name: holder, bank_name: bankName, account_number: account, ifsc, pan: pan || null, uan: uan || null };
}

// Server key: callers have already decided who may write this employee's details.
// parsed null = bank only (the completion link when the profile already exists).
export async function writeDetails(employeeId: string, parsed: Parsed | null, bank: ReturnType<typeof parseBank> | null) {
  const sb = adminDb();
  if (bank && typeof bank !== "string") {
    const { error } = await sb.from("employee_bank").upsert(bank);
    if (error) return error.message;
  }
  if (!parsed) return null;
  const { error } = await sb.from("employee_profiles").upsert({ employee_id: employeeId, ...parsed.profile, updated_at: new Date().toISOString() });
  if (error) return error.message;
  await sb.from("employees").update({ full_name: parsed.name, alias_name: parsed.alias }).eq("id", employeeId);
  return null;
}
