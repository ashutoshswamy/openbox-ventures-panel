import { requireStaff } from "@/lib/me";
import { adminDb, db } from "@/lib/supabase";
import { todayIn } from "@/lib/util";

// Employee master sheet (Emp ID, name, DOJ, gender, DOB, email, manager, phone, blood group, PAN, UAN, service years…). Excel, or &format=csv.
// Admin + HR only; HR's own office. Active, signed-up, non-admin staff. Status / Confirmation Date aren't tracked yet, so they stay blank.
const COLS = ["Emp ID", "Emp Name", "DOJ", "Gender", "DOB", "Email ID", "Status", "Confirmation Date", "Age Range", "Manager ID", "Manager Name", "Phone No", "Blood Group", "Employment Status", "PAN No", "UAN No", "Yrs in Service", "Years in Service Range"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const nice = (d: string | null | undefined, upper = false) => { if (!d) return ""; const s = `${d.slice(8, 10)} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`; return upper ? s.toUpperCase() : s; };
const bucket = (n: number, edges: number[]) => { // [20,25,30,35] → "< 20", "20 - 24", … "35+"
  if (n < edges[0]) return `< ${edges[0]}`;
  const i = edges.findLastIndex((e) => n >= e);
  return i === edges.length - 1 ? `${edges[i]}+` : `${edges[i]} - ${edges[i + 1] - 1}`;
};
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET(req: Request) {
  const me = await requireStaff();
  if (me.role !== "admin" && me.role !== "hr") return new Response("Forbidden", { status: 403 });
  const today = todayIn();
  const sb = db();
  let q = sb.from("employees").select("id, full_name, email, employee_code, joined_on, reports_to").eq("active", true).not("clerk_user_id", "is", null).or("role.is.null,role.neq.admin").or(`exit_date.is.null,exit_date.gt.${today}`).order("full_name");
  if (me.role === "hr") q = q.eq("office_id", me.office_id ?? "");
  const { data: emps, error } = await q;
  if (error) return new Response(error.message, { status: 400 });
  const ids = (emps ?? []).map((e) => e.id);
  const mgrIds = [...new Set((emps ?? []).flatMap((e) => (e.reports_to ? [e.reports_to] : [])))];
  const [{ data: profiles }, { data: banks }, { data: mgrs }] = await Promise.all([
    adminDb().from("employee_profiles").select("employee_id, date_of_birth, gender, phone, blood_group, company, lgoob_email, fusion_email").in("employee_id", ids), // server key: RLS hides profiles from HR; ids already scoped above
    sb.from("employee_bank").select("employee_id, pan, uan").in("employee_id", ids),
    adminDb().from("employees").select("id, full_name, employee_code").in("id", mgrIds),
  ]);

  const rows = (emps ?? []).map((e) => {
    const p = profiles?.find((x) => x.employee_id === e.id), b = banks?.find((x) => x.employee_id === e.id), m = mgrs?.find((x) => x.id === e.reports_to);
    const age = p?.date_of_birth ? Math.floor((Date.parse(today) - Date.parse(p.date_of_birth)) / (365.25 * 864e5)) : null;
    const yrs = e.joined_on ? Math.max(0, (Date.parse(today) - Date.parse(e.joined_on)) / (365.25 * 864e5)) : null;
    const email = (p?.company === "fusion" ? p.fusion_email : p?.company === "lgoob" || p?.company === "both" ? p.lgoob_email : null) || e.email; // company email when set, else login email
    return [
      e.employee_code ?? "", e.full_name, e.joined_on ?? "", p?.gender ?? "", nice(p?.date_of_birth, true), email, "", "",
      age === null ? "" : bucket(age, [20, 25, 30, 35]), m?.employee_code ?? "", m?.full_name ?? "", p?.phone ?? "",
      p?.blood_group?.replace(/([+-])$/, (s: string) => ` ${s === "+" ? "+ve" : "-ve"}`) ?? "", "Active", b?.pan ?? "", b?.uan ?? "",
      yrs === null ? "" : yrs.toFixed(2), yrs === null ? "" : bucket(yrs, [0, 2, 5, 10]),
    ];
  });

  const file = `Employees_${today}`;
  if (new URL(req.url).searchParams.get("format") === "csv") {
    const cell = (v: unknown) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }; // quote; block formula injection
    return new Response([COLS, ...rows].map((r) => r.map(cell).join(",")).join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${file}.csv"` } });
  }
  const c = (v: unknown, s = "Cell") => `<Cell ss:StyleID="${s}"><Data ss:Type="String">${esc(v)}</Data></Cell>`;
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="Head"><Font ss:Bold="1"/><Interior ss:Color="#E4E4E7" ss:Pattern="Solid"/></Style><Style ss:ID="Cell"/></Styles>
<Worksheet ss:Name="Employees"><Table>${COLS.map(() => `<Column ss:Width="110"/>`).join("")}
<Row>${COLS.map((h) => c(h, "Head")).join("")}</Row>
${rows.map((r) => `<Row>${r.map((v) => c(v)).join("")}</Row>`).join("\n")}
</Table></Worksheet></Workbook>`;
  return new Response(xml, { headers: { "content-type": "application/vnd.ms-excel", "content-disposition": `attachment; filename="${file}.xls"` } });
}
