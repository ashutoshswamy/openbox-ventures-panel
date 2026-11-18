// Indian CTC → monthly salary breakdown. Pure functions, no DB (the sheet snapshots the output).

// ponytail: fixed policy percentages. Move to a per-org settings table if they ever differ per employee.
export const BASIC_PCT = 0.5; // of monthly gross
export const HRA_PCT = 0.2;
export const SPECIAL_PCT = 0.2;
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
  basic: number; hra: number; special: number; other_allowance: number; gross: number;
  employee_pf: number; employer_pf: number; employee_esi: number; employer_esi: number;
  pt: number; tds: number; other_deductions: number; lop_days: number; lop_amount: number; net: number;
};

// month: 1-12 (PT differs in Feb). daysInMonth drives LOP.
// ponytail: ESI/PT computed on full gross, not LOP-reduced gross.
export function breakdown(annualCtc: number, o: { month?: number; daysInMonth?: number; lopDays?: number; tds?: number; other?: number } = {}): Pay {
  const { month = new Date().getMonth() + 1, daysInMonth = 30, lopDays = 0, tds = 0, other = 0 } = o;
  const m = annualCtc / 12;
  // Solve CTC = gross + capped employer PF + employer ESI, with basic = 50% of gross.
  const grossFor = (esiRate: number) => Math.max(m / (1 + PF_RATE * BASIC_PCT + esiRate), (m - PF_RATE * PF_WAGE_CAP) / (1 + esiRate));
  let gross = grossFor(0);
  let employer_esi = 0;
  if (grossFor(ESI_ER) <= ESI_LIMIT) {
    gross = grossFor(ESI_ER);
    employer_esi = ESI_ER * gross;
  }
  gross = r2(gross);
  const basic = r2(gross * BASIC_PCT);
  const hra = r2(gross * HRA_PCT);
  const special = r2(gross * SPECIAL_PCT);
  const employer_pf = r2(PF_RATE * Math.min(basic, PF_WAGE_CAP));
  const esiOn = employer_esi > 0;
  const employee_pf = employer_pf;
  const employee_esi = esiOn ? r2(ESI_EE * gross) : 0;
  const pt = professionalTax(gross, month);
  const lop_amount = r2((gross / daysInMonth) * lopDays);
  const net = gross - lop_amount - employee_pf - employee_esi - pt - r2(tds) - r2(other);
  return {
    basic, hra, special, other_allowance: r2(gross - basic - hra - special), gross,
    employee_pf: r2(employee_pf), employer_pf: r2(employer_pf), employee_esi: r2(employee_esi), employer_esi: r2(employer_esi),
    pt, tds: r2(tds), other_deductions: r2(other), lop_days: lopDays, lop_amount: r2(lop_amount), net: r2(net),
  };
}

export const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

export function rupeesInWords(amount: number) {
  const small = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const words = (n: number): string => {
    if (n < 20) return small[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` ${small[n % 10]}` : "");
    for (const [unit, label] of [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"], [100, "Hundred"]] as const) {
      if (n >= unit) return `${words(Math.floor(n / unit))} ${label}${n % unit ? ` ${words(n % unit)}` : ""}`;
    }
    return "";
  };
  const paise = Math.round(Math.abs(amount) * 100);
  return `${amount < 0 ? "Minus " : ""}Rupees ${words(Math.floor(paise / 100))}${paise % 100 ? ` and ${words(paise % 100)} Paise` : ""} Only`;
}

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

const esc = (v: string) => v.replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function payslipEmail(to: string, name: string, month: string, url: string, net: number) {
  const firstName = name.split(" ")[0] ?? name;
  const label = monthLabel(month);
  const subject = `Your payslip for ${label}`;
  const text = `Hi ${firstName},\n\nYour payslip for ${label} is ready. Net pay: ${inr(net)}\n\nView your payslip: ${url}\n\nYou may need to sign in to the employee panel to open it.\n\nOpen Box Ventures LLP`;
  const html = `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#fafafa;font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#18181b"><div style="max-width:480px;margin:auto;padding:32px;background:#fff;border:1px solid #e4e4e7;border-radius:16px"><h1 style="font-size:22px;margin:0 0 16px">Your payslip is ready</h1><p>Hi ${esc(firstName)},</p><p>Your payslip for <strong>${esc(label)}</strong> is ready.</p><p><strong>Net pay: ${esc(inr(net))}</strong></p><p><a href="${esc(url)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#18181b;color:#fff;text-decoration:none">View payslip</a></p><p style="font-size:12px;color:#5f5f69">You may need to sign in to the employee panel to open it.</p><p style="font-size:12px;color:#5f5f69">Open Box Ventures LLP</p></div></body></html>`;
  return { to, subject, text, html };
}
