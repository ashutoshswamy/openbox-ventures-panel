"use client";
import Link from "next/link";
import { ArrowLeft, CalendarClock, ChevronDown, PartyPopper, Plus, Save, Tag, Trash2, Upload } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader, useAdm } from "@/components/demo/adm-ui";
import { useHolidays, useLeaveTypes, useOffices, type AdmLeaveType } from "@/lib/demo/admin";
import { newId } from "@/lib/demo/store";
import { fmtDate, str } from "@/lib/util";

// quote-aware split of one CSV line
const cells = (line: string) => [...line.matchAll(/\s*(?:"([^"]*)"|([^,]*))\s*(?:,|$)/g)].map((m) => (m[1] ?? m[2] ?? "").trim()).slice(0, -1);
// YYYY-MM-DD | DD-MM-YYYY | DD/MM/YYYY -> ISO, or null if not a real date
function isoDate(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (!m) return null;
  const [y, mo, d] = s.includes("-") && m[1].length === 4 ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]];
  const dt = new Date(`${y}-${mo}-${d}T00:00:00Z`);
  return dt.getUTCDate() === Number(d) && dt.getUTCMonth() + 1 === Number(mo) ? `${y}-${mo}-${d}` : null;
}

export default function LeavePolicy() {
  const { log } = useAdm();
  const [types, setTypes] = useLeaveTypes();
  const [holidays, setHolidays] = useHolidays();
  const [offices] = useOffices();
  const year = new Date().getFullYear();

  const saveType = async (fd: FormData, t?: AdmLeaveType) => {
    const doc = str(fd, "doc_required_after_days");
    const row: AdmLeaveType = {
      id: t?.id ?? newId(), name: str(fd, "name")!, yearly_quota: Number(str(fd, "yearly_quota")), accrual: fd.get("accrual") === "monthly" ? "monthly" : "yearly",
      carry_forward_max: Number(str(fd, "carry_forward_max")) || 0, doc_required_after_days: doc ? Number(doc) : null,
      paid: fd.has("paid"), allow_half_day: fd.has("allow_half_day"), active: fd.has("active"),
    };
    setTypes((l) => (t ? l.map((x) => (x.id === t.id ? row : x)) : [...l, row]));
    log(t ? "Updated leave type" : "Added leave type", row.name);
  };

  const typeForm = (t?: AdmLeaveType) => {
    return (
      <ActionForm action={(fd) => saveType(fd, t)} keep={!!t} success={t ? "Saved" : undefined} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="field">Name<input name="name" required defaultValue={t?.name} className="input" /></label>
        <label className="field">Days / year<input name="yearly_quota" type="number" step="0.5" min={0} required defaultValue={t?.yearly_quota ?? 12} className="input" /></label>
        <label className="field">Credited
          <select name="accrual" defaultValue={t?.accrual ?? "yearly"} className="input">
            <option value="yearly">All at year start</option>
            <option value="monthly">Monthly (quota ÷ 12)</option>
          </select>
        </label>
        <label className="field">Max carry forward<input name="carry_forward_max" type="number" step="0.5" min={0} defaultValue={t?.carry_forward_max ?? 0} className="input" /></label>
        <label className="field">Doc required after (days)<input name="doc_required_after_days" type="number" min={0} defaultValue={t?.doc_required_after_days ?? ""} placeholder="never" className="input" /></label>
        <div className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-2 lg:col-span-3">
          <label className="check"><input type="checkbox" name="paid" defaultChecked={t?.paid ?? true} /> Paid (balance enforced)</label>
          <label className="check"><input type="checkbox" name="allow_half_day" defaultChecked={t?.allow_half_day ?? true} /> Half days allowed</label>
          <label className="check"><input type="checkbox" name="active" defaultChecked={t?.active ?? true} /> Active</label>
        </div>
        <div>{t ? <button className="btn btn-primary"><Save /> Save changes</button> : <button className="btn btn-primary"><Plus /> Add leave type</button>}</div>
      </ActionForm>
    );
  }

  const importHolidays = async (fd: FormData) => {
    const file = fd.get("file");
    const pasted = fd.get("csv");
    const text = file instanceof File && file.size ? await file.text() : typeof pasted === "string" ? pasted : "";
    const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l, i) => [i + 1, l.trim()] as const).filter(([, l]) => l);
    if (!lines.length) return "Paste some rows or choose a CSV file";
    if (lines.length > 500) return "Too many rows (max 500)";
    const byName = new Map(offices.map((o) => [o.name.toLowerCase(), o.id]));
    const errors: string[] = [];
    const rows: { date: string; name: string; office_id: string | null }[] = [];
    for (const [n, line] of lines) {
      const [d, name, office] = cells(line);
      if (n === lines[0][0] && /^date$/i.test(d)) continue;
      const date = isoDate(d ?? "");
      if (!date) errors.push(`Line ${n}: invalid date "${d ?? ""}"`);
      else if (!name) errors.push(`Line ${n}: name is missing`);
      else if (office && !byName.has(office.toLowerCase())) errors.push(`Line ${n}: unknown office "${office}"`);
      else rows.push({ date, name, office_id: office ? byName.get(office.toLowerCase())! : null });
    }
    if (errors.length) return errors.slice(0, 10).join("\n") + (errors.length > 10 ? `\n...and ${errors.length - 10} more` : "");
    if (!rows.length) return "No rows to import";
    const fresh = rows.filter((r) => !holidays.some((h) => h.date === r.date && h.name === r.name && h.office_id === r.office_id));
    setHolidays((l) => [...l, ...fresh.map((r) => ({ id: newId(), ...r }))].sort((a, b) => a.date.localeCompare(b.date)));
    log("Imported holidays", `${fresh.length} rows`);
  };

  return (
    <>
      <PageHeader title="Leave policy" sub="Leave types, yearly quotas, holidays and year-end carry forward.">
        <Link href="/demo/admin/leave" className="btn"><ArrowLeft /> Requests</Link>
      </PageHeader>
      <div className="max-w-5xl space-y-6">
        <section className="space-y-4">
          <h2 className="h2"><Tag /> Leave types</h2>
          {types.map((t) => (
            <details key={t.id} className={`card group ${t.active ? "" : "opacity-60"}`}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <span className="mr-2 font-semibold">{t.name}</span>
                <span className="badge badge-teal tabular-nums">{t.yearly_quota} days / year</span>
                <span className="badge">{t.accrual === "monthly" ? "Monthly credit" : "Credited yearly"}</span>
                {t.carry_forward_max > 0 && <span className="badge">Carry up to {t.carry_forward_max}</span>}
                {!t.paid && <span className="badge badge-amber">Unpaid</span>}
                {!t.active && <span className="badge">Inactive</span>}
                <ChevronDown className="ml-auto size-5 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-6 border-t border-line pt-6">{typeForm(t)}</div>
            </details>
          ))}
          <div className="card"><h3 className="h2"><Plus /> New leave type</h3>{typeForm()}</div>
        </section>

        <section className="card space-y-4">
          <h2 className="h2 mb-0"><PartyPopper /> Holidays {year}</h2>
          <ul className="divide-y divide-line">
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-32 font-medium tabular-nums">{fmtDate(h.date)}</span>
                <span className="flex-1">{h.name}</span>
                <span className="badge">{offices.find((o) => o.id === h.office_id)?.name ?? "All offices"}</span>
                <button className="btn btn-ghost btn-icon btn-danger" title="Remove" onClick={() => { setHolidays((l) => l.filter((x) => x.id !== h.id)); log("Removed holiday", h.name); }}><Trash2 /></button>
              </li>
            ))}
            {!holidays.length && <li className="py-3 text-sm text-muted">No holidays added for this year.</li>}
          </ul>
          <ActionForm
            action={async (fd) => {
              const row = { id: newId(), date: str(fd, "date")!, name: str(fd, "name")!, office_id: str(fd, "office_id") };
              setHolidays((l) => [...l, row].sort((a, b) => a.date.localeCompare(b.date)));
              log("Added holiday", row.name);
            }}
            className="flex flex-wrap gap-2"
          >
            <input type="date" name="date" required className="input w-auto" />
            <input name="name" required placeholder="Holiday name" className="input w-auto flex-1" />
            <select name="office_id" className="input w-auto">
              <option value="">All offices</option>
              {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button className="btn btn-primary"><Plus /> Add holiday</button>
          </ActionForm>
          <details className="border-t border-line pt-4">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><Upload className="size-4" /> Import from CSV</summary>
            <ActionForm action={importHolidays} success="Imported" className="mt-4 space-y-3 whitespace-pre-line">
              <p className="text-sm text-muted">
                One holiday per line: <code>date,name[,office name]</code>. Dates as YYYY-MM-DD, DD-MM-YYYY or DD/MM/YYYY. Leave the office blank for all offices.
                Every row is checked first; nothing is added if any row is wrong. Exact duplicates are skipped.
              </p>
              <pre className="rounded-xl bg-surface-2/70 p-3 text-xs">{"date,name,office\n2027-01-26,Republic Day\n15-08-2027,Independence Day\n2027-11-01,Local festival,Pune HQ"}</pre>
              <textarea name="csv" rows={5} placeholder="Paste rows here" className="input font-mono text-xs" />
              <input type="file" name="file" accept=".csv,text/csv" className="input" />
              <button className="btn btn-primary"><Upload /> Import</button>
            </ActionForm>
          </details>
        </section>

        <section className="card space-y-4">
          <h2 className="h2 mb-0"><CalendarClock /> Close year</h2>
          <p className="text-sm text-muted">Carries each employee&apos;s unused balance (capped per type) into the next year. Safe to re-run.</p>
          <ActionForm action={async () => { log("Closed leave year", "carry forward"); }} confirm="Carry forward balances now?" success="Balances carried forward (demo)" className="flex gap-2">
            <input type="number" name="year" defaultValue={year - 1} className="input w-28" />
            <button className="btn">Carry forward</button>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
