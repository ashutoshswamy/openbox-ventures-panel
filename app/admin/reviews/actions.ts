"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/me";
import { db } from "@/lib/supabase";
import { str } from "@/lib/util";

// start_review_cycle() / submit_manager_review() decide who may; these just relay.
export async function startCycle(fd: FormData) {
  const me = await requireStaff();
  const office = me.role === "admin" ? str(fd, "office") : me.office_id; // HR / branch head: own office only
  const { error } = await db().rpc("start_review_cycle", { p_name: str(fd, "name"), p_office: office, p_start: str(fd, "start"), p_end: str(fd, "end") });
  if (error) return error.message;
  revalidatePath("/", "layout");
}

export async function closeCycle(fd: FormData) {
  await requireStaff();
  const { error } = await db().rpc("close_review_cycle", { p_id: str(fd, "id") });
  if (error) return error.message;
  revalidatePath("/", "layout");
}

export async function deleteCycle(fd: FormData) {
  await requireStaff();
  const { error } = await db().rpc("delete_review_cycle", { p_id: str(fd, "id") });
  if (error) return error.message;
  revalidatePath("/", "layout");
}

export async function rateEmployee(fd: FormData) {
  await requireStaff();
  const { error } = await db().rpc("submit_manager_review", { p_id: str(fd, "id"), p_rating: Number(str(fd, "rating")), p_comments: str(fd, "comments") });
  if (error) return error.message;
  revalidatePath("/", "layout");
}
