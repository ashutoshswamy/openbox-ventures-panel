import { requireStaff } from "@/lib/me";
import { db } from "@/lib/supabase";
import { monthRange, validDay, validMonth } from "@/lib/calendar";

const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // block spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

// ?day=… | ?month=… | ?from=…&to=… (either end may be left open)
function span(sp: URLSearchParams) {
  const d = validDay(sp.get("day"), "");
  if (d) return { from: d, to: d };
  const m = validMonth(sp.get("month"), "");
  if (m) return monthRange(m);
  return { from: validDay(sp.get("from"), ""), to: validDay(sp.get("to"), "") };
}

// RLS scopes rows: managers only get their office.
export async function GET(req: Request) {
  const me = await requireStaff();
  const sp = new URL(req.url).searchParams;
  const { from, to } = span(sp);
  let q = db()
    .from("attendance_report")
    .select("employee_id, date, full_name, email, office_name, mode, check_in_at, check_out_at, hours, late, early_leave, note")
    .gte("date", from || "1970-01-01")
    .lte("date", to || "2999-12-31")
    .order("full_name")
    .order("employee_id")
    .order("date");
  const office = me.role === "admin" ? sp.get("office") : me.office_id;
  if (office) q = q.eq("office_id", office);
  const who = sp.get("employee");
  if (who) q = q.eq("employee_id", who);
  const { data, error } = await q;
  if (error) return new Response(error.message, { status: 400 });

  const cols = ["date", "full_name", "email", "office_name", "mode", "check_in_at", "check_out_at", "hours", "late", "early_leave", "note"] as const;
  // one block per person: name/email/office only on their first row, blank line between people
  const who3 = ["full_name", "email", "office_name"];
  const lines: string[] = [cols.join(",")];
  let prev: string | null = null;
  for (const r of data) {
    const first = r.employee_id !== prev;
    if (first && prev) lines.push("");
    lines.push(cols.map((c) => cell(!first && who3.includes(c) ? "" : r[c])).join(","));
    prev = r.employee_id;
  }
  const csv = lines.join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv",
      "content-disposition": `attachment; filename="attendance_${from || "all"}_${to || "all"}.csv"`,
    },
  });
}
