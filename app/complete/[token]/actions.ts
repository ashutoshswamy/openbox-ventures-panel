"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { claimLink, openLink, releaseLink } from "@/lib/completion";
import { parseBank, writeDetails } from "@/lib/details";
import { parseProfile } from "@/lib/profile";
import { adminDb } from "@/lib/supabase";
import { str } from "@/lib/util";

// Public: the token is the credential. Writes only what is still missing for that one person.
export async function submitCompletion(fd: FormData) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  // ponytail: per-IP fixed window via the shared rate_limits table, same as /careers.
  const { data: ok } = await adminDb().rpc("hit_rate_limit", { p_key: `complete:${ip}`, p_max: 20, p_window_s: 3600 });
  if (!ok) return "Too many attempts from this connection. Try again later.";

  const token = str(fd, "token") ?? "";
  const link = await openLink(token);
  if (!link) return "This link has expired or was already used. Ask HR for a new one.";
  const { emp, need } = link;

  let parsed = null;
  if (need.profile) {
    const p = parseProfile(fd);
    if (typeof p === "string") return p;
    parsed = p;
  }
  const bank = need.bank ? parseBank(fd, emp.id) : null;
  if (typeof bank === "string") return bank;

  if (!(await claimLink(token))) return "This link was just used. Ask HR for a new one if something is missing.";
  const err = await writeDetails(emp.id, parsed, bank);
  if (err) {
    await releaseLink(token);
    return err;
  }
  redirect("/complete/done");
}
