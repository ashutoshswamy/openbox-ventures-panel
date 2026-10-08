// Indian CTC → monthly salary breakdown. Pure functions, no DB (the sheet snapshots the output).

// ponytail: fixed policy percentages. Move to a per-org settings table if they ever differ per employee.
export const BASIC_PCT = 0.5; // basic = 50% of monthly CTC
export const HRA_PCT = 0.4; // of basic (non-metro)
const PF_RATE = 0.12;
const PF_WAGE_CAP = 15000; // PF on min(basic, 15000)
const ESI_LIMIT = 21000; // ESI applies while monthly gross <= this
const ESI_EE = 0.0075;
const ESI_ER = 0.0325;

const r2 = (x: number) => Math.round(x * 100) / 100;

// ponytail: Maharashtra slab, men's rates (women: nil up to 25000). Per-state slabs when other states are needed.
export function professionalTax(gross: number, month: number) {
  if (gross <= 7500) return 0;
  if (gross <= 10000) return 175;
  return month === 2 ? 300 : 200;
}

export type Pay = {
  basic: number; hra: number; special: number; gross: number;
  employee_pf: number; employer_pf: number; employee_esi: number; employer_esi: number;
  pt: number; tds: number; other_deductions: number; lop_days: number; lop_amount: number; net: number;
};

// month: 1-12 (PT differs in Feb). daysInMonth drives LOP.
// ponytail: ESI/PT computed on full gross, not LOP-reduced gross.
export function breakdown(annualCtc: number, o: { month?: number; daysInMonth?: number; lopDays?: number; tds?: number; other?: number } = {}): Pay {
  const { month = new Date().getMonth() + 1, daysInMonth = 30, lopDays = 0, tds = 0, other = 0 } = o;
  const m = annualCtc / 12;
  const basic = m * BASIC_PCT;
  const hra = basic * HRA_PCT;
  const employer_pf = PF_RATE * Math.min(basic, PF_WAGE_CAP);
  // gross + employer PF + employer ESI = monthly CTC; ESI depends on gross, so solve for it
  let gross = m - employer_pf;
  let employer_esi = 0;
  if ((m - employer_pf) / (1 + ESI_ER) <= ESI_LIMIT) {
    gross = (m - employer_pf) / (1 + ESI_ER);
    employer_esi = ESI_ER * gross;
  }
  const esiOn = employer_esi > 0;
  const employee_pf = employer_pf;
  const employee_esi = esiOn ? ESI_EE * gross : 0;
  const pt = professionalTax(gross, month);
  const lop_amount = (gross / daysInMonth) * lopDays;
  const net = gross - lop_amount - employee_pf - employee_esi - pt - tds - other;
  const rounded = r2(gross);
  return {
    basic: r2(basic), hra: r2(hra), special: r2(rounded - r2(basic) - r2(hra)), gross: rounded,
    employee_pf: r2(employee_pf), employer_pf: r2(employer_pf), employee_esi: r2(employee_esi), employer_esi: r2(employer_esi),
    pt, tds: r2(tds), other_deductions: r2(other), lop_days: lopDays, lop_amount: r2(lop_amount), net: r2(net),
  };
}

export const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

export const daysIn = (year: number, month: number) => new Date(year, month, 0).getDate();

// ISO weekday 1-7 of a YYYY-MM-DD
const isoDow = (d: string) => new Date(d + "T00:00:00Z").getUTCDay() || 7;

// Working days (office work_days, minus holidays) in [from, to], inclusive, as YYYY-MM-DD strings.
export function workingDays(from: string, to: string, workDays: number[], holidays: Set<string>) {
  const out: string[] = [];
  for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += 864e5) {
    const d = new Date(t).toISOString().slice(0, 10);
    if (workDays.includes(isoDow(d)) && !holidays.has(d)) out.push(d);
  }
  return out;
}

export const STATUS_TONE = { draft: "badge-amber", submitted: "badge-blue", approved: "badge-green" } as const;
export const monthLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
