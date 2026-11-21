import { inr, monthLabel, daysIn, rupeesInWords } from "@/lib/payroll";
import { fmtDate } from "@/lib/util";
import { Logo } from "@/components/logo";
import styles from "./payslip-doc.module.css";

export type PayslipEmp = { full_name: string; employee_code: string | null; designation: string | null; joined_on: string | null; department: { name: string } | null; office: { name: string } | null };
export type PayslipBank = { bank_name: string | null; account_number: string | null; pan: string | null; uan: string | null } | null;
export type PayslipLine = Record<string, unknown>;

// Printable layout for one payroll line. Shared by the single payslip page and bulk generation so every payslip comes out identical.
export function PayslipDoc({ line: l, run, employee: e, bank, pageBreak }: { line: PayslipLine; run: { month: string; status: string }; employee: PayslipEmp; bank: PayslipBank; pageBreak?: boolean }) {
  const n = (k: string) => Number(l[k] ?? 0);
  const [year, month] = run.month.split("-").map(Number);
  const calendarDays = daysIn(year, month);
  const earnings: [string, number][] = [["Basic", n("basic")], ["HRA", n("hra")], ["Special allowance", n("special")], ["Other allowance", n("other_allowance")]];
  const deductions: [string, number][] = (
    [["Provident fund", n("employee_pf")], ["ESI", n("employee_esi")], ["Professional tax", n("pt")], [`Loss of pay (${n("lop_days")} d)`, n("lop_amount")], ["TDS", n("tds")], ["Other deductions", n("other_deductions")]] as [string, number][]
  ).filter(([, v]) => v !== 0);
  const totalDed = deductions.reduce((s, [, v]) => s + v, 0);

  const details = [
    [["Name", e.full_name], ["Joining Date", e.joined_on && fmtDate(e.joined_on)], ["Designation", e.designation],
      ["Department", e.department?.name], ["Location", e.office?.name], ["Effective Work Days", calendarDays - n("lop_days")], ["LOP", n("lop_days")]],
    [["Employee No", e.employee_code], ["Bank Name", bank?.bank_name], ["Bank Account No", bank?.account_number],
      ["PAN Number", bank?.pan], ["PF No", null], ["PF UAN", bank?.uan]],
  ];

  return (
    <div className={`${styles.viewport} ${pageBreak ? styles.pageBreak : ""}`}>
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
  );
}
