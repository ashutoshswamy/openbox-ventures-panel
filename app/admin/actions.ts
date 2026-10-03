"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin, requireStaff, type Role } from "@/lib/me";
import { db } from "@/lib/supabase";
import { DEFAULT_TZ, SITE_URL, str, zonedIso } from "@/lib/util";

// Writes go through db() (user's token), so RLS double-checks every require*() below.

function done() {
  revalidatePath("/", "layout");
}

function num(fd: FormData, key: string) {
  const v = str(fd, key);
  return v === null ? null : Number(v);
}

const ROLES: Role[] = ["employee", "manager", "admin"];
// "" = not assigned
function role(fd: FormData): Role | null {
  const r = str(fd, "role") as Role | null;
  if (r && !ROLES.includes(r)) throw new Error("Invalid role");
  return r;
}

// ── Offices ──

export async function saveOffice(fd: FormData) {
  await requireAdmin();
  const row = {
    name: str(fd, "name"),
    address: str(fd, "address"),
    timezone: str(fd, "timezone") ?? DEFAULT_TZ,
    lat: num(fd, "lat"),
    lng: num(fd, "lng"),
    radius_m: num(fd, "radius_m") ?? 200,
    work_start: str(fd, "work_start") ?? "09:30",
    work_end: str(fd, "work_end") ?? "18:30",
    grace_min: num(fd, "grace_min") ?? 15,
    work_days: fd.getAll("work_days").map(Number),
  };
  try {
    new Intl.DateTimeFormat("en", { timeZone: row.timezone });
  } catch {
    return `Unknown timezone "${row.timezone}"`;
  }
  const id = str(fd, "id");
  const { error } = id ? await db().from("offices").update(row).eq("id", id) : await db().from("offices").insert(row);
  if (error) return error.message;
  done();
}

export async function deleteOffice(fd: FormData) {
  await requireAdmin();
  const { error } = await db().from("offices").delete().eq("id", str(fd, "id"));
  if (error) return error.message;
  done();
}

// ── Departments ──

export async function saveDepartment(fd: FormData) {
  await requireAdmin();
  const row = { name: str(fd, "name"), office_id: str(fd, "office_id") };
  const id = str(fd, "id");
  const sb = db();
  // department channel is created/renamed by DB triggers
  const { error } = id ? await sb.from("departments").update({ name: row.name }).eq("id", id) : await sb.from("departments").insert(row);
  if (error) return error.message;
  done();
}

export async function deleteDepartment(fd: FormData) {
  await requireAdmin();
  const { error } = await db().from("departments").delete().eq("id", str(fd, "id"));
  if (error) return error.message;
  done();
}

// ── Employees ──
// Invites carry no role. After they join, an admin assigns one (Clerk publicMetadata.role).

async function invite(email: string) {
  const clerk = await clerkClient();
  const { data: pending } = await clerk.invitations.getInvitationList({ query: email, status: "pending" });
  await Promise.all(pending.map((i) => clerk.invitations.revokeInvitation(i.id)));
  await clerk.invitations.createInvitation({
    emailAddress: email,
    redirectUrl: `${SITE_URL}/sign-up`, // fixed origin, never taken from request headers
    ignoreExisting: true,
  });
}

// department implies office
async function placement(fd: FormData) {
  const department_id = str(fd, "department_id");
  if (!department_id) return { department_id: null, office_id: str(fd, "office_id") };
  const { data } = await db().from("departments").select("office_id").eq("id", department_id).single();
  return { department_id, office_id: data?.office_id ?? null };
}

export async function inviteEmployee(fd: FormData) {
  await requireAdmin();
  try {
    const email = str(fd, "email")?.toLowerCase();
    if (!email) return "Email required";
    const { error } = await db().from("employees").insert({
      email,
      full_name: str(fd, "full_name"),
      designation: str(fd, "designation"),
      ...(await placement(fd)),
    });
    if (error) return error.code === "23505" ? "Employee with this email already exists" : error.message;
    await invite(email);
  } catch (e) {
    return `Saved, but invite failed: ${(e as Error).message}`;
  }
  done();
}

export async function updateEmployee(fd: FormData) {
  const me = await requireAdmin();
  try {
    const id = str(fd, "id")!;
    const sb = db();
    const { data: emp, error } = await sb
      .from("employees")
      .update({ full_name: str(fd, "full_name"), designation: str(fd, "designation"), joined_on: str(fd, "joined_on"), ...(await placement(fd)) })
      .eq("id", id)
      .select("email, clerk_user_id")
      .single();
    if (error) return error.message;
    const r = role(fd);
    // admins aren't part of the workforce: no office/department (keeps them out of channels, headcounts, manager scope)
    if (r === "admin") await sb.from("employees").update({ office_id: null, department_id: null, designation: null }).eq("id", id);
    if (emp.clerk_user_id && (str(fd, "old_role") ?? null) !== r) {
      if (id === me.id && r !== "admin") return "You can't remove your own admin role";
      await (await clerkClient()).users.updateUserMetadata(emp.clerk_user_id, { publicMetadata: { role: r } }); // null clears it
      await sb.from("employees").update({ role: r }).eq("id", id);
    }
  } catch (e) {
    return (e as Error).message;
  }
  done();
}

export async function resendInvite(fd: FormData) {
  await requireAdmin();
  try {
    await invite(str(fd, "email")!);
  } catch (e) {
    return (e as Error).message;
  }
  done();
}

// Deactivate = DB inactive (RLS cuts access) + Clerk ban (can't sign in).
export async function setActive(fd: FormData) {
  const me = await requireAdmin();
  const id = str(fd, "id");
  const active = str(fd, "active") === "true";
  if (id === me.id && !active) return "You can't deactivate yourself";
  const { data: emp, error } = await db().from("employees").update({ active }).eq("id", id).select("clerk_user_id").single();
  if (error) return error.message;
  if (emp.clerk_user_id) {
    const clerk = await clerkClient();
    await (active ? clerk.users.unbanUser(emp.clerk_user_id) : clerk.users.banUser(emp.clerk_user_id));
  }
  done();
}

// ── Attendance fixes (manager: own office via RLS) ──

export async function saveAttendance(fd: FormData) {
  await requireStaff();
  const tz = str(fd, "timezone") ?? DEFAULT_TZ;
  const date = str(fd, "date")!;
  const inT = str(fd, "check_in");
  const outT = str(fd, "check_out");
  if (!inT) return "Check-in time required";
  const row = {
    mode: str(fd, "mode") ?? "office",
    check_in_at: zonedIso(date, inT, tz),
    check_out_at: outT ? zonedIso(date, outT, tz) : null,
    note: str(fd, "note"),
  };
  const id = str(fd, "id");
  const sb = db();
  const { error } = id
    ? await sb.from("attendance").update(row).eq("id", id)
    : await sb.from("attendance").insert({ ...row, employee_id: str(fd, "employee_id"), date });
  if (error) return error.message;
  done();
}

export async function deleteAttendance(fd: FormData) {
  await requireStaff();
  const { error } = await db().from("attendance").delete().eq("id", str(fd, "id"));
  if (error) return error.message;
  done();
}

// ── Leave ──

export async function reviewLeave(fd: FormData) {
  const me = await requireStaff();
  const status = str(fd, "status");
  if (status !== "approved" && status !== "rejected") return "Invalid decision";
  const { data, error } = await db()
    .from("leave_requests")
    .update({ status, reviewed_by: me.id, reviewed_at: new Date().toISOString(), review_note: str(fd, "review_note") })
    .eq("id", str(fd, "id"))
    .eq("status", "pending")
    .select("id");
  if (error) return error.message;
  if (!data.length) return "Request not found or already reviewed";
  done();
}

export async function saveLeaveType(fd: FormData) {
  await requireAdmin();
  const row = {
    name: str(fd, "name"),
    paid: fd.get("paid") === "on",
    yearly_quota: num(fd, "yearly_quota") ?? 0,
    accrual: str(fd, "accrual") ?? "yearly",
    carry_forward_max: num(fd, "carry_forward_max") ?? 0,
    allow_half_day: fd.get("allow_half_day") === "on",
    doc_required_after_days: num(fd, "doc_required_after_days"),
    active: fd.get("active") === "on",
  };
  const id = str(fd, "id");
  const { error } = id ? await db().from("leave_types").update(row).eq("id", id) : await db().from("leave_types").insert(row);
  if (error) return error.message;
  done();
}

export async function saveHoliday(fd: FormData) {
  await requireAdmin();
  const { error } = await db().from("holidays").insert({ date: str(fd, "date"), name: str(fd, "name"), office_id: str(fd, "office_id") });
  if (error) return error.message;
  done();
}

export async function deleteHoliday(fd: FormData) {
  await requireAdmin();
  const { error } = await db().from("holidays").delete().eq("id", str(fd, "id"));
  if (error) return error.message;
  done();
}

export async function closeYear(fd: FormData) {
  await requireAdmin();
  const { error } = await db().rpc("close_year", { y: num(fd, "year") });
  if (error) return error.message;
  done();
}

// ── Announcements (posts into the company Announcements chat channel; admins + managers, RLS enforces) ──

export async function saveAnnouncement(fd: FormData) {
  const me = await requireStaff();
  const title = str(fd, "title");
  const body = str(fd, "body");
  if (!title || !body) return "Add a headline and a message";
  const sb = db();
  const { data: ch } = await sb.from("channels").select("id").eq("announcements", true).single();
  if (!ch) return "Announcements channel missing. Re-run supabase/schema.sql (after reset.sql).";
  const { error } = await sb.from("messages").insert({ channel_id: ch.id, sender_id: me.id, body: `${title}\n\n${body}`, attachment_path: str(fd, "attachment") });
  if (error) return error.message;
  done();
}

export async function deleteAnnouncement(fd: FormData) {
  await requireStaff();
  // RLS: managers only match their own posts
  const { data, error } = await db().from("messages").delete().eq("id", str(fd, "id")).select("id");
  if (error) return error.message;
  if (!data?.length) return "You can only delete your own posts";
  done();
}

// ── Issues ──

export async function setIssueStatus(fd: FormData) {
  const me = await requireAdmin();
  const resolved = str(fd, "status") === "resolved";
  const { error } = await db()
    .from("issues")
    .update({
      status: resolved ? "resolved" : "open",
      admin_note: str(fd, "admin_note"),
      resolved_by: resolved ? me.id : null,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq("id", str(fd, "id"));
  if (error) return error.message;
  done();
}
