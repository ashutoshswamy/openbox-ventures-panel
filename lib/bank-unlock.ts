import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Bank details are shown only after the viewer re-enters their password (app/profile/bank-actions.ts).
// Proof = httpOnly cookie "<employee id>.<expiry>.<hmac>", signed with the Clerk secret (server-only).
const NAME = "bank_unlock";
const TTL_S = 10 * 60;
const sign = (v: string) => createHmac("sha256", process.env.CLERK_SECRET_KEY!).update(`${NAME}:${v}`).digest("base64url");

export async function bankUnlocked(employeeId: string) {
  const [id, exp, sig] = ((await cookies()).get(NAME)?.value ?? "").split(".");
  if (id !== employeeId || !(Number(exp) > Date.now() / 1000) || !sig) return false;
  const want = Buffer.from(sign(`${id}.${exp}`));
  const got = Buffer.from(sig);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function setBankUnlock(employeeId: string) {
  const v = `${employeeId}.${Math.floor(Date.now() / 1000) + TTL_S}`;
  (await cookies()).set(NAME, `${v}.${sign(v)}`, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: TTL_S });
}

export async function clearBankUnlock() {
  (await cookies()).delete(NAME);
}
