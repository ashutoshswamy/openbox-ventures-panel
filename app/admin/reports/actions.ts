"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate, str } from "@/lib/util";

const KINDS = ["daily", "weekly", "monthly"];

type Row = { kind: string; period_start: string; period_end: string; body: string; employee: { full_name: string; department: { name: string } | null } | null };

// Draft = every filed report in range, grouped by person, as editable markdown.
// RLS limits rows (manager: own dept, branch head: own office, admin: all).
export async function compileReport(fd: FormData) {
  const me = await requireStaff();
  const kind = str(fd, "kind") ?? "";
  const from = str(fd, "from");
  const to = str(fd, "to");
  const office = me.role === "admin" ? str(fd, "office") : null;
  if (!KINDS.includes(kind) || !from || !to || to < from) return "Pick a report type and a valid date range";

  let q = db()
    .from("work_reports")
    .select("kind, period_start, period_end, body, employee:employees!inner(full_name, office_id, department:departments(name))")
    .eq("kind", kind).gte("period_start", from).lte("period_end", to)
    .order("period_start").limit(2000);
  if (office) q = q.eq("employee.office_id", office);
  const { data, error } = await q;
  if (error) return error.message;
  const rows = (data ?? []) as unknown as Row[];
  if (!rows.length) return "No reports filed in that range";

  const title = str(fd, "title") ?? `${kind[0].toUpperCase() + kind.slice(1)} report`;
  const byPerson = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.employee?.full_name ?? "Unknown"}${r.employee?.department ? ` (${r.employee.department.name})` : ""}`;
    byPerson.set(key, [...(byPerson.get(key) ?? []), r]);
  }
  const body = [
    `# ${title}`,
    `${fmtDate(from)} to ${fmtDate(to)} · ${rows.length} ${kind} reports from ${byPerson.size} people`,
    ...[...byPerson].flatMap(([who, rs]) => [
      `\n## ${who}`,
      ...rs.flatMap((r) => [`\n### ${r.period_start === r.period_end ? fmtDate(r.period_start) : `${fmtDate(r.period_start)} to ${fmtDate(r.period_end)}`}`, r.body]),
    ]),
  ].join("\n");

  const { data: row, error: e2 } = await db()
    .from("compiled_reports")
    .insert({ author_id: me.id, title, kind, period_start: from, period_end: to, body })
    .select("id").single();
  if (e2) return e2.message;
  redirect(`/admin/reports/${row.id}`);
}

export async function saveCompiled(fd: FormData) {
  await requireStaff();
  const title = str(fd, "title");
  const body = typeof fd.get("body") === "string" ? (fd.get("body") as string) : "";
  if (!title || !body.trim()) return "Title and text are required";
  const { error } = await db().from("compiled_reports").update({ title, body, updated_at: new Date().toISOString() }).eq("id", str(fd, "id"));
  if (error) return error.message;
  revalidatePath("/admin/reports", "layout");
}

export async function deleteCompiled(fd: FormData) {
  await requireStaff();
  const { error } = await db().from("compiled_reports").delete().eq("id", str(fd, "id"));
  if (error) return error.message;
  redirect("/admin/reports");
}
