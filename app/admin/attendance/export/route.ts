import { requireStaff } from "@/lib/me";
import { db } from "@/lib/supabase";
import { eachDay, isoDow, monthRange, validDay, validMonth } from "@/lib/calendar";
import { todayIn } from "@/lib/util";

// ?day=… | ?month=… | ?from=…&to=… (+ optional office, employee). Downloads an Attendance Muster:
// one row per person, one column per day (P / WFH / A / H / OFF / leave codes), and totals. CSV.
function span(sp: URLSearchParams, today: string) {
  const d = validDay(sp.get("day"), "");
  if (d) return { from: d, to: d };
  const m = validMonth(sp.get("month"), "");
  if (m) return monthRange(m);
  const from = validDay(sp.get("from"), ""), to = validDay(sp.get("to"), "");
  if (from || to) return { from: from || to, to: to || from };
  return monthRange(today.slice(0, 7));
}

const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const nice = (d: string) => `${Number(d.slice(8))}-${MON[Number(d.slice(5, 7)) - 1].slice(0, 3)}-${d.slice(0, 4)}`;
// "Casual Leave" → CL, "Sick" → SIC
const codeOf = (name: string) => { const w = name.trim().split(/\s+/).filter(Boolean); return (w.length > 1 ? w.map((x) => x[0]).join("").slice(0, 3) : name.slice(0, 3)).toUpperCase(); };

// RLS scopes rows: managers only get their office / department.
export async function GET(req: Request) {
  const me = await requireStaff();
  const sp = new URL(req.url).searchParams;
  const today = todayIn();
  const { from, to } = span(sp, today);
  const days = eachDay(from, to);
  if (days.length > 62) return new Response("Pick a range of 62 days or less", { status: 400 });
  const office = me.role === "admin" ? sp.get("office") : me.office_id;
  const who = sp.get("employee");
  const sb = db();

  let emps = sb.from("employees").select("id, full_name, employee_code, designation, office_id, department_id, joined_on, exit_date, office:offices(name, work_days)").eq("active", true).not("clerk_user_id", "is", null).or("role.is.null,role.neq.admin").order("full_name");
  if (office) emps = emps.eq("office_id", office);
  if (who) emps = emps.eq("id", who);
  if (me.role === "manager") emps = emps.eq("department_id", me.department_id ?? "");
  // PostgREST returns at most 1000 rows per request: page through
  const att = async () => {
    const all: { employee_id: string; date: string; mode: string }[] = [];
    for (let i = 0; ; i += 1000) {
      let q = sb.from("attendance_report").select("employee_id, date, mode").gte("date", from).lte("date", to).order("id").range(i, i + 999);
      if (office) q = q.eq("office_id", office);
      const { data } = await q;
      all.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) return all;
    }
  };
  const [{ data: people, error }, rows, { data: leaves }, { data: hols }] = await Promise.all([
    emps,
    att(),
    sb.from("leave_requests").select("employee_id, start_date, end_date, half_day, type:leave_types(name)").eq("status", "approved").lte("start_date", to).gte("end_date", from),
    sb.from("holidays").select("office_id, date").gte("date", from).lte("date", to),
  ]);
  if (error) return new Response(error.message, { status: 400 });

  const here = new Set(rows.map((r) => `${r.employee_id}|${r.date}`));
  const wfh = new Set(rows.filter((r) => r.mode === "wfh").map((r) => `${r.employee_id}|${r.date}`));
  const codes = new Map<string, string>(); // leave codes used, for the legend

  const body = (people ?? []).map((p) => {
    const o = p.office as unknown as { name: string; work_days: number[] } | null;
    const work = o?.work_days ?? [1, 2, 3, 4, 5];
    const hol = new Set(hols?.filter((h) => h.office_id === null || h.office_id === p.office_id).map((h) => h.date));
    const mine = (leaves ?? []).filter((l) => l.employee_id === p.id);
    const t = { P: 0, L: 0, H: 0, A: 0, OFF: 0, total: 0 };
    const cells = days.map((d) => {
      if ((p.joined_on && d < p.joined_on) || (p.exit_date && d > p.exit_date)) return "";
      const k = `${p.id}|${d}`;
      const lv = mine.find((l) => l.start_date <= d && l.end_date >= d);
      const name = (lv?.type as unknown as { name?: string } | null)?.name ?? "Leave";
      const lc = codeOf(name);
      if (lv) codes.set(lc, name);
      let c = "";
      if (here.has(k)) {
        if (lv?.half_day) { c = `P:${lc}`; t.P += 0.5; t.L += 0.5; } else { c = wfh.has(k) ? "WFH" : "P"; t.P++; }
      } else if (lv) {
        if (lv.half_day) { c = `${lc}:A`; t.L += 0.5; t.A += 0.5; } else { c = lc; t.L++; }
      } else if (!work.includes(isoDow(d))) { c = "OFF"; t.OFF++; }
      else if (hol.has(d)) { c = "H"; t.H++; }
      else if (d < today) { c = "A"; t.A++; }
      if (c) t.total++;
      return c;
    });
    return { p, o, cells, t };
  });

  const monthly = days.length > 1 && from.endsWith("-01") && to === monthRange(from.slice(0, 7)).to;
  const file = monthly ? `${MON[Number(from.slice(5, 7)) - 1]}-${from.slice(0, 4)}` : from === to ? nice(from) : `${nice(from)}_to_${nice(to)}`;

  const TOT = ["Present", "Leave", "Holiday", "Absent", "Off Day", "Rest Day", "On duty", "Status unknown", "Total"];
  const cell = (v: unknown) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }; // quote; block formula injection
  const csv = [
    ["Employee Name", "Employee No", "Designation", "Location", ...days.map((d) => Number(d.slice(8))), ...TOT],
    ...body.map(({ p, o, cells, t }) => [p.full_name, p.employee_code ?? "", p.designation ?? "", o?.name ?? "", ...cells, t.P, t.L, t.H, t.A, t.OFF, 0, 0, 0, t.total]),
  ].map((r) => r.map(cell).join(",")).join("\n");
  return new Response("\uFEFF" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="Attendance_Muster__${file}.csv"` } });
}
