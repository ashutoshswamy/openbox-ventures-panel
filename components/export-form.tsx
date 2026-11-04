"use client";

import { useState } from "react";
import { Download } from "lucide-react";

// Asks what to export: one day, a whole month, or a date range. The route reads day | month | from+to.
export function ExportForm({ action, date, office, people }: { action: string; date: string; office?: string | null; people?: { id: string; full_name: string }[] }) {
  const [scope, setScope] = useState<"day" | "month" | "range">("month");
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="field">Export
        <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="input w-auto">
          <option value="day">A single day</option>
          <option value="month">A month</option>
          <option value="range">A date range</option>
        </select>
      </label>
      {scope === "day" && <label className="field">Day<input type="date" name="day" required defaultValue={date} className="input w-auto" /></label>}
      {scope === "month" && <label className="field">Month<input type="month" name="month" required defaultValue={date.slice(0, 7)} className="input w-auto" /></label>}
      {scope === "range" && (
        <>
          <label className="field">From<input type="date" name="from" required defaultValue={date.slice(0, 8) + "01"} className="input w-auto" /></label>
          <label className="field">To<input type="date" name="to" required defaultValue={date} className="input w-auto" /></label>
        </>
      )}
      {people && (
        <label className="field">Who
          <select name="employee" defaultValue="" className="input w-auto">
            <option value="">Everyone</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </label>
      )}
      {office && <input type="hidden" name="office" value={office} />}
      <button className="btn"><Download /> Download CSV</button>
    </form>
  );
}
