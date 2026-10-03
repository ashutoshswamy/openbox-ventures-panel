import { requireStaff } from "@/lib/me";
import { db } from "@/lib/supabase";

const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // block spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "all");

// RLS scopes rows: managers only get their office.
export async function GET(req: Request) {
  const me = await requireStaff();
  const sp = new URL(req.url).searchParams;
  let q = db()
    .from("attendance_report")
    .select("date, full_name, email, office_name, mode, check_in_at, check_out_at, hours, late, early_leave, note")
    .gte("date", sp.get("from") ?? "1970-01-01")
    .lte("date", sp.get("to") ?? "2999-12-31")
    .order("date")
    .order("full_name");
  const office = me.role === "admin" ? sp.get("office") : me.office_id;
  if (office) q = q.eq("office_id", office);
  const { data, error } = await q;
  if (error) return new Response(error.message, { status: 400 });

  const cols = ["date", "full_name", "email", "office_name", "mode", "check_in_at", "check_out_at", "hours", "late", "early_leave", "note"] as const;
  const csv = [cols.join(","), ...data.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv",
      "content-disposition": `attachment; filename="attendance_${day(sp.get("from"))}_${day(sp.get("to"))}.csv"`,
    },
  });
}
