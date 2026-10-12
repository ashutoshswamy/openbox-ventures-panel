import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { auth, clerkClient } from "@clerk/nextjs/server";

// Re-enter-password gates (bank details, other people's DMs).
// Proof = httpOnly cookie "<employee id>.<expiry>.<hmac>", signed with the Clerk secret (server-only).
export function unlocker(name: string, ttlS = 10 * 60) {
  const sign = (v: string) => createHmac("sha256", process.env.CLERK_SECRET_KEY!).update(`${name}:${v}`).digest("base64url");
  return {
    async unlocked(employeeId: string) {
      const [id, exp, sig] = ((await cookies()).get(name)?.value ?? "").split(".");
      if (id !== employeeId || !(Number(exp) > Date.now() / 1000) || !sig) return false;
      const want = Buffer.from(sign(`${id}.${exp}`));
      const got = Buffer.from(sig);
      return got.length === want.length && timingSafeEqual(got, want);
    },
    async set(employeeId: string) {
      const v = `${employeeId}.${Math.floor(Date.now() / 1000) + ttlS}`;
      (await cookies()).set(name, `${v}.${sign(v)}`, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: ttlS });
    },
    async clear() {
      (await cookies()).delete(name);
    },
  };
}

// null = password is right, else the error to show.
export async function checkPassword(password: string) {
  const { userId } = await auth();
  if (!userId || !password) return "Enter your password";
  const clerk = await clerkClient();
  if (!(await clerk.users.getUser(userId)).passwordEnabled) return "Your account has no password yet. Set one in Manage account → Security, then try again.";
  try {
    await clerk.users.verifyPassword({ userId, password });
  } catch {
    return "Wrong password";
  }
  return null;
}
