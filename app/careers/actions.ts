"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { adminDb } from "@/lib/supabase";
import { str } from "@/lib/util";

const TYPES: Record<string, string> = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
const MAX_RESUME = 4 * 1024 * 1024; // keep in step with the resumes bucket + bodySizeLimit

// Public, no login. Server key only; the bucket and tables are closed to everyone else.
export async function applyForJob(fd: FormData) {
  const sb = adminDb();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  // ponytail: per-IP fixed window via the shared rate_limits table. Bot floods: Vercel Firewall / captcha.
  const { data: ok } = await sb.rpc("hit_rate_limit", { p_key: `apply:${ip}`, p_max: 5, p_window_s: 3600 });
  if (!ok) return "Too many applications from this connection. Try again later.";

  const jobId = str(fd, "job_id");
  const name = str(fd, "name");
  const email = str(fd, "email")?.toLowerCase();
  const file = fd.get("resume");
  if (!jobId || !name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter your name and a valid email.";
  if (!(file instanceof File) || !file.size) return "Attach your resume.";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!Object.hasOwn(TYPES, ext)) return "Resume must be a PDF or Word file.";
  if (file.size > MAX_RESUME) return "Resume must be under 4 MB.";

  const { data: job } = await sb.from("jobs").select("id").eq("id", jobId).eq("open", true).maybeSingle();
  if (!job) return "This role is no longer open.";

  const path = `${job.id}/${randomUUID()}.${ext}`;
  const up = await sb.storage.from("resumes").upload(path, file, { contentType: TYPES[ext] });
  if (up.error) return "Couldn't upload your resume. Try again.";
  const { error } = await sb.from("job_applications").insert({ job_id: job.id, name, email, phone: str(fd, "phone"), note: str(fd, "note"), resume_path: path });
  if (error) {
    await sb.storage.from("resumes").remove([path]);
    return error.code === "23505" ? "You've already applied for this role." : "Couldn't submit your application. Try again.";
  }
}
