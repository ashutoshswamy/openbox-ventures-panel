"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/me";
import { db } from "@/lib/supabase";

// quote-aware split of one CSV line (names with commas: "Eid, day")
function cells(line: string) {
  return [...line.matchAll(/\s*(?:"([^"]*)"|([^,]*))\s*(?:,|$)/g)].map((m) => (m[1] ?? m[2] ?? "").trim()).slice(0, -1);
}

// YYYY-MM-DD | DD-MM-YYYY | DD/MM/YYYY → ISO, or null if not a real date
function isoDate(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (!m) return null;
  const [y, mo, d] = s.includes("-") && m[1].length === 4 ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]];
  const dt = new Date(`${y}-${mo}-${d}T00:00:00Z`);
  return dt.getUTCDate() === Number(d) && dt.getUTCMonth() + 1 === Number(mo) ? `${y}-${mo}-${d}` : null;
}

// Validates every row first (errors by line number), then inserts all-or-nothing via import_holidays().
export async function importHolidays(fd: FormData) {
  await requireAdmin();
  const file = fd.get("file");
  const pasted = fd.get("csv");
  const text = file instanceof File && file.size ? await file.text() : typeof pasted === "string" ? pasted : "";
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l, i) => [i + 1, l.trim()] as const).filter(([, l]) => l);
  if (!lines.length) return "Paste some rows or choose a CSV file";
  if (lines.length > 500) return "Too many rows (max 500)";

  const sb = db();
  const { data: offices } = await sb.from("offices").select("id, name");
  const byName = new Map((offices ?? []).map((o) => [o.name.toLowerCase(), o.id]));

  const errors: string[] = [];
  const rows: { date: string; name: string; office_id: string | null }[] = [];
  for (const [n, line] of lines) {
    const [d, name, office] = cells(line);
    if (n === lines[0][0] && /^date$/i.test(d)) continue; // header row
    const date = isoDate(d ?? "");
    if (!date) errors.push(`Line ${n}: invalid date "${d ?? ""}"`);
    else if (!name) errors.push(`Line ${n}: name is missing`);
    else if (office && !byName.has(office.toLowerCase())) errors.push(`Line ${n}: unknown office "${office}"`);
    else rows.push({ date, name, office_id: office ? byName.get(office.toLowerCase())! : null });
  }
  if (errors.length) return errors.slice(0, 10).join("\n") + (errors.length > 10 ? `\n...and ${errors.length - 10} more` : "");
  if (!rows.length) return "No rows to import";

  const { error } = await sb.rpc("import_holidays", { rows });
  if (error) return error.message;
  revalidatePath("/", "layout");
}
