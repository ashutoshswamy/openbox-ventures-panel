"use client";

import { useRef, useState } from "react";
import { Calculator, X } from "lucide-react";
import { breakdown, daysIn } from "@/lib/payroll";
import { SalaryBreakdown } from "@/components/salary-breakdown";

// Button + modal. Calculates live as you type (breakdown() is pure), nothing is saved.
export function SalaryCalculator({ month }: { month: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [v, setV] = useState({ ctc: "", month, lop: "", tds: "", other: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const [y, m] = v.month.split("-").map(Number);
  const ctc = Number(v.ctc);
  const calc = ctc > 0 && y && m ? breakdown(ctc, { month: m, daysInMonth: daysIn(y, m), lopDays: Number(v.lop) || 0, tds: Number(v.tds) || 0, other: Number(v.other) || 0 }) : null;

  return (
    <>
      <button type="button" className="btn" onClick={() => dlg.current?.showModal()}><Calculator /> Salary calculator</button>
      <dialog ref={dlg} aria-label="Salary calculator" onClick={(e) => e.target === dlg.current && dlg.current.close()} className="m-auto w-[min(34rem,94vw)] rounded-2xl border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Calculator className="size-4 text-muted" /><h2 className="flex-1 font-semibold">Salary calculator</h2>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={() => dlg.current?.close()}><X /></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field">Annual CTC (₹)<input type="number" min="1" step="0.01" inputMode="decimal" autoFocus value={v.ctc} onChange={set("ctc")} className="input" /></label>
            <label className="field">Month<input type="month" value={v.month} onChange={set("month")} className="input" /></label>
            <label className="field">LOP days<input type="number" min="0" step="0.5" value={v.lop} onChange={set("lop")} className="input" /></label>
            <label className="field">TDS<input type="number" min="0" value={v.tds} onChange={set("tds")} className="input" /></label>
            <label className="field sm:col-span-2">Other deductions<input type="number" min="0" value={v.other} onChange={set("other")} className="input" /></label>
          </div>
          <div className="mt-5">
            {calc ? <SalaryBreakdown p={calc} /> : <p className="text-sm text-muted">Enter an annual CTC to see the monthly breakdown.</p>}
          </div>
        </div>
      </dialog>
    </>
  );
}
