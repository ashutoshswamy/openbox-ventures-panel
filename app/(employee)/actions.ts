"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/me";
import { adminDb, db } from "@/lib/supabase";
import { CALL_ENDED, meetUrl, roomOf, str } from "@/lib/util";

function done() {
  revalidatePath("/", "layout");
}

// ── Attendance ──

export async function checkIn(mode: "office" | "wfh", lat?: number, lng?: number) {
  await requireMe();
  const { error } = await db().rpc("check_in", { p_mode: mode, p_lat: lat ?? null, p_lng: lng ?? null });
  if (error) return error.message;
  done();
}

export async function checkOut() {
  await requireMe();
  const { error } = await db().rpc("check_out");
  if (error) return error.message;
  done();
}

export async function requestRegularization(fd: FormData) {
  await requireMe();
  const { error } = await db().rpc("request_regularization", {
    p_date: str(fd, "date"),
    p_mode: str(fd, "mode") ?? "office",
    p_in: str(fd, "check_in"),
    p_out: str(fd, "check_out"),
    p_reason: str(fd, "reason"),
  });
  if (error) return error.message;
  done();
}

// ── Leave ──

export async function applyLeave(fd: FormData) {
  await requireMe();
  const { error } = await db().rpc("apply_leave", {
    p_type: str(fd, "leave_type_id"),
    p_start: str(fd, "start_date"),
    p_end: str(fd, "end_date") ?? str(fd, "start_date"),
    p_half: fd.get("half_day") === "on",
    p_reason: str(fd, "reason"),
    p_doc: str(fd, "doc"), // already uploaded by AttachInput; apply_leave only accepts your own paths
  });
  if (error) return error.message;
  done();
}

export async function updateLeaveDoc(fd: FormData) {
  await requireMe();
  const { error } = await db().rpc("update_leave_doc", { p_id: str(fd, "id"), p_doc: str(fd, "doc") });
  if (error) return error.message;
  done();
}

export async function cancelLeave(fd: FormData) {
  await requireMe();
  const { error } = await db().rpc("cancel_leave", { p_id: str(fd, "id") });
  if (error) return error.message;
  done();
}

// ── Chat ──

export async function openDm(fd: FormData) {
  await requireMe();
  const { data, error } = await db().rpc("dm_with", { other: str(fd, "employee_id") });
  if (error) return error.message;
  redirect(`/chat/${data}`);
}

export async function createGroup(fd: FormData) {
  const me = await requireMe();
  const name = str(fd, "name");
  if (!name) return "Name required";
  const members = new Set([me.id, ...fd.getAll("members").map(String)]);
  const sb = db();
  const { data: ch, error } = await sb.from("channels").insert({ name, type: "group", created_by: me.id }).select("id").single();
  if (error) return error.message;
  const { error: e2 } = await sb.from("channel_members").insert([...members].map((employee_id) => ({ channel_id: ch.id, employee_id })));
  if (e2) return e2.message;
  redirect(`/chat/${ch.id}`);
}

export async function sendMessage(fd: FormData) {
  const me = await requireMe();
  const channel_id = str(fd, "channel_id");
  const body = str(fd, "body");
  const attachment_path = str(fd, "attachment"); // already uploaded by AttachInput; RLS only accepts your own paths
  if (!body && !attachment_path) return null;
  const { error } = await db().from("messages").insert({ channel_id, sender_id: me.id, body, attachment_path });
  if (error) return error.message;
  revalidatePath(`/chat/${channel_id}`);
}

export type Bucket = "attachments" | "leave-docs";
const BUCKETS: Bucket[] = ["attachments", "leave-docs"];

// Signed upload URL so the browser sends files straight to storage (no server-action body limit).
// Size cap = bucket file_size_limit, enforced by storage. Path starts with the uploader's id:
// the DB only accepts references to your own uploads.
export async function attachUrl(bucket: Bucket, fileName: string) {
  const me = await requireMe();
  if (!BUCKETS.includes(bucket)) throw new Error("Invalid bucket");
  await sweepOrphans(me.id);
  const path = `${me.id}/${crypto.randomUUID()}/${fileName.replace(/[^\w.-]+/g, "_").slice(-100)}`;
  const { data, error } = await adminDb().storage.from(bucket).createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  return { path: data.path, token: data.token };
}

// Files picked but never sent (or whose message was deleted), older than a day.
// ponytail: swept per user on their next upload, no cron; add a scheduled sweep if inactive users' leftovers matter.
async function sweepOrphans(ownerId: string) {
  const sb = adminDb();
  const { data } = await sb.rpc("orphan_uploads", { owner: ownerId });
  for (const b of BUCKETS) {
    const names = (data as { bucket: string; name: string }[] | null)?.filter((o) => o.bucket === b).map((o) => o.name);
    if (names?.length) await sb.storage.from(b).remove(names);
  }
}

export async function startCall(channelId: string, room: string) {
  const me = await requireMe();
  if (!/^[a-f0-9]{12}$/.test(room)) throw new Error("Invalid room");
  const sb = db();
  const { error } = await sb.rpc("start_call", { ch: channelId, p_room: room });
  if (error) throw new Error(error.message);
  await sb.from("messages").insert({ channel_id: channelId, sender_id: me.id, body: `Started a video call: ${meetUrl(channelId, room)}` });
  revalidatePath(`/chat/${channelId}`);
}

// Any channel member can end a call; the page then shows its link as ended.
export async function endCall(fd: FormData) {
  const me = await requireMe();
  const channel_id = str(fd, "channel_id");
  const url = str(fd, "url");
  if (!channel_id || !url?.startsWith("https://meet.jit.si/")) return "Invalid call";
  const sb = db();
  await sb.rpc("end_call", { p_room: roomOf(url) }); // calls from before call history have no row: nothing to close
  const { error } = await sb.from("messages").insert({ channel_id, sender_id: me.id, body: CALL_ENDED + url });
  if (error) return error.message;
  revalidatePath(`/chat/${channel_id}`);
}

// Read marker. Department channel members get their row on first read.
export async function markRead(channelId: string) {
  const me = await requireMe();
  const sb = db();
  const now = new Date().toISOString();
  const { data } = await sb.from("channel_members").update({ last_read_at: now }).eq("channel_id", channelId).eq("employee_id", me.id).select("channel_id");
  if (!data?.length) await sb.from("channel_members").insert({ channel_id: channelId, employee_id: me.id, last_read_at: now });
}

// ── Report an issue ──

export async function reportIssue(fd: FormData) {
  const me = await requireMe();
  const subject = str(fd, "subject");
  const body = str(fd, "body");
  if (!subject || !body) return "Add a subject and describe the issue";
  const { error } = await db().from("issues").insert({ employee_id: me.id, subject, body });
  if (error) return error.message;
  done();
}
