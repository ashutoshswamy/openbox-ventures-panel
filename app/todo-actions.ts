"use server";

import { revalidatePath } from "next/cache";
import { requireMe, requireStaff } from "@/lib/me";
import { db } from "@/lib/supabase";
import { str } from "@/lib/util";

// Shared by both panels (/todos, /admin/todos). RLS decides who can assign to whom.

function done() {
  revalidatePath("/", "layout");
}

export async function addTodo(fd: FormData) {
  const title = str(fd, "title");
  if (!title) return "Write the task first";
  const owner = str(fd, "owner_id");
  const me = owner ? await requireStaff() : await requireMe();
  const { error } = await db().from("todos").insert({
    owner_id: owner ?? me.id,
    assigned_by: owner ? me.id : null,
    title,
    due_on: str(fd, "due_on"),
  });
  if (error) return owner ? "You can't assign tasks to this person" : error.message;
  done();
}

export async function toggleTodo(fd: FormData) {
  await requireMe();
  const { error } = await db()
    .from("todos")
    .update({ done_at: fd.get("done") === "1" ? new Date().toISOString() : null })
    .eq("id", str(fd, "id"));
  if (error) return error.message;
  done();
}

export async function deleteTodo(fd: FormData) {
  await requireMe();
  const { data, error } = await db().from("todos").delete().eq("id", str(fd, "id")).select("id");
  if (error) return error.message;
  if (!data?.length) return "Only the person who assigned this can remove it";
  done();
}
