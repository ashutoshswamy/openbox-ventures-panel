import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { pageMe } from "@/lib/me";
import { db } from "@/lib/supabase";
import { inr, monthLabel, daysIn, rupeesInWords } from "@/lib/payroll";
import { fmtDate } from "@/lib/util";
import { Logo } from "@/components/logo";
import { PrintButton } from "@/components/print-button";
import styles from "./payslip.module.css";

export const metadata = { title: "Payslip" };

type Emp = { full_name: string; employee_code: string | null; designation: string | null; joined_on: string | null; department: { name: string } | null; office: { name: string } | null };

// One payroll line as a printable payslip. RLS decides who sees it: the employee (approved sheets only), HR of the office, admin.
export default async function Payslip({ params }: PageProps<"/payslip/[id]">) {
  const me = await pageMe();
  const { id } = await params;
  const { data: l } = await db()
    .from("payroll_lines")
    .select("*, run:payroll_runs(month, status), employee:employees(full_name, employee_code, designation, joined_on, department:departments(name), office:offices(name))")
    .eq("id", id)
    .maybeSingle();
  if (!l) notFound();
  const run = l.run as unknown as { month: string; status: string };
  const e = l.employee as unknown as Emp;
  const { data: bank, error: bankError } = await db().from("employee_bank")
    .select("bank_name, account_number, pan, uan").eq("employee_id", l.employee_id).maybeSingle();
  if (bankError) throw new Error("Unable to load payslip bank details");
  const n = (k: string) => Number(l[k] ?? 0);
  const [year, month] = run.month.split("-").map(Number);
  const calendarDays = daysIn(year, month);
  const earnings: [string, number][] = [["Basic", n("basic")], ["HRA", n("hra")], ["Special allowance", n("special")], ["Other allowance", n("other_allowance")]];
  const deductions: [string, number][] = (
    [["Provident fund", n("employee_pf")], ["ESI", n("employee_esi")], ["Professional tax", n("pt")], [`Loss of pay (${n("lop_days")} d)`, n("lop_amount")], ["TDS", n("tds")], ["Other deductions", n("other_deductions")]] as [string, number][]
  ).filter(([, v]) => v !== 0);
  const totalDed = deductions.reduce((s, [, v]) => s + v, 0);
  const back = me.role === "admin" || me.role === "hr" ? `/${me.role === "hr" ? "hr" : "admin"}/payroll/${l.run_id}` : "/payslips";

  const details = [
    [["Name", e.full_name], ["Joining Date", e.joined_on && fmtDate(e.joined_on)], ["Designation", e.designation],
      ["Department", e.department?.name], ["Location", e.office?.name], ["Effective Work Days", calendarDays - n("lop_days")], ["LOP", n("lop_days")]],
    [["Employee No", e.employee_code], ["Bank Name", bank?.bank_name], ["Bank Account No", bank?.account_number],
      ["PAN Number", bank?.pan], ["PF No", null], ["PF UAN", bank?.uan]],
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between gap-2 print:hidden">
        <Link href={back} className="btn btn-ghost"><ArrowLeft /> Back</Link>
        <PrintButton />
      </div>
      <div className={styles.viewport}>
        <article className={styles.payslip} aria-label={`Payslip for ${monthLabel(run.month)}`}>
          <div className={styles.document}>
            <header className={styles.header}>
              <Logo size={108} className={styles.logo} />
              <div>
                <h1>Open Box Ventures LLP</h1>
                <p>SM Heights C-205,5th Floor NH 5, Phase 8B, Sector 74, Sahibzada Ajit Singh Nagar, Punjab 140308</p>
                <h2>Payslip for the month of {monthLabel(run.month)}</h2>
                {run.status !== "approved" && <p className={styles.draft}>Draft - sheet not approved</p>}
              </div>
            </header>

            <div className={styles.details}>
              {details.map((group, i) => (
                <dl key={i}>
                  {group.map(([label, value]) => <div key={label}><dt>{label}:</dt><dd>{value ?? "-"}</dd></div>)}
                </dl>
              ))}
            </div>

            <div className={styles.amounts}>
              <table>
                <caption className="sr-only">Monthly earnings in rupees. Master and amount show gross earnings before deductions.</caption>
                <colgroup><col style={{ width: "60%" }} /><col style={{ width: "20%" }} /><col style={{ width: "20%" }} /></colgroup>
                <thead><tr><th scope="col">Earnings</th><th scope="col">Master</th><th scope="col">Amount</th></tr></thead>
                <tbody>
                  {earnings.map(([label, value]) => <tr key={label}><th scope="row">{label.toUpperCase()}</th><td>{inr(value)}</td><td>{inr(value)}</td></tr>)}
                  <tr aria-hidden="true" className={styles.filler}><td colSpan={3} /></tr>
                </tbody>
                <tfoot><tr><th scope="row">Total Earnings</th><td>{inr(n("gross"))}</td><td>{inr(n("gross"))}</td></tr></tfoot>
              </table>
              <table>
                <caption className="sr-only">Monthly deductions in rupees, including loss of pay.</caption>
                <thead><tr><th scope="col">Deductions</th><th scope="col">Amount</th></tr></thead>
                <tbody>
                  {deductions.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{inr(value)}</td></tr>)}
                  <tr aria-hidden="true" className={styles.filler}><td colSpan={2} /></tr>
                </tbody>
                <tfoot><tr><th scope="row">Total Deductions</th><td>{inr(totalDed)}</td></tr></tfoot>
              </table>
            </div>

            <div className={styles.net}>
              <p><span>Net Pay for the Month</span><strong>{inr(n("net"))}</strong></p>
              <p><em>({rupeesInWords(n("net"))})</em></p>
            </div>
          </div>
          <p className={styles.footer}>This is a system generated payslip and does not require signature.</p>
        </article>
      </div>
    </main>
  );
}
