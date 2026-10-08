import { inr, type Pay } from "@/lib/payroll";

// Monthly breakdown table (earnings, deductions, net). Zero rows hidden.
export function SalaryBreakdown({ p }: { p: Pay }) {
  const rows: [string, number, boolean?][] = [
    ["Basic", p.basic], ["HRA", p.hra], ["Special allowance", p.special], ["Gross", p.gross, true],
    ["Employee PF", -p.employee_pf], ["Employee ESI", -p.employee_esi], ["Professional tax", -p.pt],
    [`Loss of pay (${p.lop_days} d)`, -p.lop_amount], ["TDS", -p.tds], ["Other deductions", -p.other_deductions],
    ["Net pay", p.net, true],
  ];
  return (
    <table className="table">
      <tbody>
        {rows.filter(([, v, b]) => b || v !== 0).map(([k, v, b]) => (
          <tr key={k} className={b ? "font-semibold" : ""}>
            <td>{k}</td>
            <td className="text-right tabular-nums">{inr(v)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="text-sm text-muted"><td>Employer PF / ESI (part of CTC)</td><td className="text-right tabular-nums">{inr(p.employer_pf)} / {inr(p.employer_esi)}</td></tr>
      </tfoot>
    </table>
  );
}
