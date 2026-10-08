"use server";

import { revalidatePath } from "next/cache";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { rateLimit, requireMe } from "@/lib/me";
import { clearBankUnlock, setBankUnlock } from "@/lib/bank-unlock";
import { db } from "@/lib/supabase";
import { str } from "@/lib/util";

// Own bank details, or (HR/admin) an employee's: employee_id field. save_bank_details() checks who may.
// Format checks (IFSC, PAN, account, UAN) are table constraints.
export async function saveBank(fd: FormData) {
  const me = await requireMe();
  const { error } = await db().rpc("save_bank_details", {
    p_emp: str(fd, "employee_id") ?? me.id,
    p_holder: str(fd, "holder_name"),
    p_account: str(fd, "account_number"),
    p_ifsc: str(fd, "ifsc"),
    p_bank: str(fd, "bank_name"),
    p_pan: str(fd, "pan"),
    p_uan: str(fd, "uan"),
  });
  if (error) {
    const c = error.message.match(/employee_bank_(\w+)_check/)?.[1];
    return c ? `Invalid ${{ ifsc: "IFSC", pan: "PAN", uan: "UAN", account_number: "account number" }[c] ?? c}` : error.message;
  }
  revalidatePath("/", "layout");
}

export async function requestBankEdit() {
  await requireMe();
  const { error } = await db().rpc("request_bank_edit");
  if (error) return error.message;
  revalidatePath("/", "layout");
}

// HR/admin: let the employee change their bank details once.
export async function allowBankEdit(fd: FormData) {
  await requireMe();
  const { error } = await db().rpc("allow_bank_edit", { p_emp: str(fd, "employee_id") });
  if (error) return error.message;
  revalidatePath("/", "layout");
}

// Re-enter the account password to see bank details for 10 minutes.
export async function unlockBank(fd: FormData) {
  const me = await requireMe();
  await rateLimit(`bank-pw:${me.id}`, 5, 300); // ponytail: 5 tries / 5 min on top of Clerk's own lockout
  const { userId } = await auth();
  const password = String(fd.get("password") ?? "");
  if (!userId || !password) return "Enter your password";
  const clerk = await clerkClient();
  if (!(await clerk.users.getUser(userId)).passwordEnabled) return "Your account has no password yet. Set one in Manage account → Security, then try again.";
  try {
    await clerk.users.verifyPassword({ userId, password });
  } catch {
    return "Wrong password";
  }
  await setBankUnlock(me.id);
  revalidatePath("/", "layout");
}

export async function lockBank() {
  await clearBankUnlock();
  revalidatePath("/", "layout");
}
