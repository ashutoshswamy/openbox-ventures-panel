// node lib/payroll.check.mjs
import assert from "node:assert/strict";
import { breakdown, workingDays, rupeesInWords } from "./payroll.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.02, `${a} ≈ ${b}`);

// 12 lakh: split based on gross, PF capped at 1800, CTC adds back up
let p = breakdown(1200000, { month: 10, daysInMonth: 31 });
assert.equal(p.basic, 49100); assert.equal(p.hra, 19640);
assert.equal(p.special, 19640); assert.equal(p.other_allowance, 9820);
assert.equal(p.employer_pf, 1800); assert.equal(p.employee_esi, 0); assert.equal(p.pt, 200);
near(p.gross + p.employer_pf + p.employer_esi, 100000);
near(p.net, p.gross - 1800 - 200);
assert.equal(breakdown(1200000, { month: 2 }).pt, 300);

// LOP, TDS, other
p = breakdown(1200000, { month: 10, daysInMonth: 31, lopDays: 2, tds: 1000, other: 500 });
near(p.lop_amount, (p.gross / 31) * 2);
near(p.net, p.gross - p.lop_amount - 1800 - 200 - 1000 - 500);

// 2.4 lakh: ESI applies, still sums to CTC
p = breakdown(240000, { month: 10 });
assert.ok(p.employee_esi > 0 && p.gross <= 21000);
near(p.gross + p.employer_pf + p.employer_esi, 20000);

// working days: Mon-Fri, minus a holiday (Oct 2026: 1st is Thursday)
assert.equal(workingDays("2026-10-01", "2026-10-07", [1, 2, 3, 4, 5], new Set(["2026-10-02"])).length, 4);


// Percentages, rounding, PF cap and ESI across salary ranges.
for (const ctc of [120000, 240000, 275000, 360000, 400000, 600000, 1200000, 1234567.89]) {
  const pay = breakdown(ctc, { month: 10, daysInMonth: 31, lopDays: 0.5 });
  near(pay.basic, pay.gross * 0.5);
  near(pay.hra, pay.gross * 0.2);
  near(pay.special, pay.gross * 0.2);
  near(pay.other_allowance, pay.gross * 0.1);
  near(pay.basic + pay.hra + pay.special + pay.other_allowance, pay.gross);
  near(pay.gross + pay.employer_pf + pay.employer_esi, ctc / 12);
  near(pay.employee_pf, Math.min(pay.basic, 15000) * 0.12);
  near(pay.net, pay.gross - pay.lop_amount - pay.employee_pf - pay.employee_esi - pay.pt);
}
assert.equal(rupeesInWords(50000), "Rupees Fifty Thousand Only");
assert.equal(rupeesInWords(12345678.9), "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Ninety Paise Only");
assert.equal(rupeesInWords(0), "Rupees Zero Only");
assert.equal(rupeesInWords(99.999), "Rupees One Hundred Only");
assert.equal(rupeesInWords(-10.5), "Minus Rupees Ten and Fifty Paise Only");
console.log("payroll ok");
