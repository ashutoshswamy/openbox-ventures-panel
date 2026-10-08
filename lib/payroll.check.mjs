// node lib/payroll.check.mjs
import assert from "node:assert/strict";
import { breakdown, workingDays } from "./payroll.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.02, `${a} ≈ ${b}`);

// 12 lakh: basic 50k, HRA 20k, PF capped at 1800, no ESI, CTC adds back up
let p = breakdown(1200000, { month: 10, daysInMonth: 31 });
assert.equal(p.basic, 50000); assert.equal(p.hra, 20000);
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
console.log("payroll ok");
