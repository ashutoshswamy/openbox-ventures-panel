import { adminPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { fmtDate } from "@/lib/util";
import Link from "next/link";
import { ArrowLeft, CalendarClock, ChevronDown, PartyPopper, Plus, Save, Tag, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/shell";
import { closeYear, deleteHoliday, saveHoliday, saveLeaveType } from "../../actions";

export const metadata = { title: "Leave policy" };

type LeaveType = {
  id: string; name: string; paid: boolean; yearly_quota: number; accrual: "yearly" | "monthly";
  carry_forward_max: number; allow_half_day: boolean; doc_required_after_days: number | null; active: boolean;
};

function TypeForm({ t }: { t?: LeaveType }) {
  return (
    <ActionForm action={saveLeaveType} keep={!!t} success={t ? "Saved" : undefined} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {t && <input type="hidden" name="id" value={t.id} />}
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

export default async function LeavePolicy() {
  await adminPage();
  const sb = db();
  const year = new Date().getFullYear();
  const [{ data: types }, { data: holidays }, { data: offices }, { count: carried }] = await Promise.all([
    sb.from("leave_types").select("*").order("name"),
    sb.from("holidays").select("*, office:offices(name)").gte("date", `${year}-01-01`).order("date"),
    sb.from("offices").select("id, name").order("name"),
    sb.from("leave_carry_forward").select("*", { count: "exact", head: true }).eq("year", year),
  ]);

  return (
    <>
    <PageHeader title="Leave policy" sub="Leave types, yearly quotas, holidays and year-end carry forward.">
      <Link href="/admin/leave" className="btn"><ArrowLeft /> Requests</Link>
    </PageHeader>
    <div className="max-w-5xl space-y-6">
      <section className="space-y-4">
        <h2 className="h2"><Tag /> Leave types</h2>
        {types?.map((t: LeaveType) => (
          <details key={t.id} className={`card group ${t.active ? "" : "opacity-60"}`}>
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="mr-2 font-semibold">{t.name}</span>
              <span className="badge badge-teal tabular-nums">{Number(t.yearly_quota)} days / year</span>
              <span className="badge">{t.accrual === "monthly" ? "Monthly credit" : "Credited yearly"}</span>
              {Number(t.carry_forward_max) > 0 && <span className="badge">Carry up to {Number(t.carry_forward_max)}</span>}
              {!t.paid && <span className="badge badge-amber">Unpaid</span>}
              {!t.active && <span className="badge">Inactive</span>}
              <ChevronDown className="ml-auto size-5 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-6 border-t border-line pt-6"><TypeForm t={t} /></div>
          </details>
        ))}
        <div className="card"><h3 className="h2"><Plus /> New leave type</h3><TypeForm /></div>
      </section>

      <section className="card space-y-4">
        <h2 className="h2 mb-0"><PartyPopper /> Holidays {year}</h2>
        <ul className="divide-y divide-line">
          {holidays?.map((h) => (
            <li key={h.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-32 font-medium tabular-nums">{fmtDate(h.date)}</span>
              <span className="flex-1">{h.name}</span>
              <span className="badge">{(h.office as { name?: string } | null)?.name ?? "All offices"}</span>
              <ActionForm action={deleteHoliday}>
                <input type="hidden" name="id" value={h.id} />
                <button className="btn btn-ghost btn-icon btn-danger" title="Remove"><Trash2 /></button>
              </ActionForm>
            </li>
          ))}
          {!holidays?.length && <li className="py-3 text-sm text-muted">No holidays added for this year.</li>}
        </ul>
        <ActionForm action={saveHoliday} className="flex flex-wrap gap-2">
          <input type="date" name="date" required className="input w-auto" />
          <input name="name" required placeholder="Holiday name" className="input w-auto flex-1" />
          <select name="office_id" className="input w-auto">
            <option value="">All offices</option>
            {offices?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button className="btn btn-primary"><Plus /> Add holiday</button>
        </ActionForm>
      </section>

      <section className="card space-y-4">
        <h2 className="h2 mb-0"><CalendarClock /> Close year</h2>
        <p className="text-sm text-muted">
          Carries each employee&apos;s unused balance (capped per type) into the next year. Safe to re-run.
          {carried ? ` ${carried} carry-forward balances exist for ${year}.` : ""}
        </p>
        <ActionForm action={closeYear} confirm="Carry forward balances now?" className="flex gap-2">
          <input type="number" name="year" defaultValue={year - 1} className="input w-28" />
          <button className="btn">Carry forward</button>
        </ActionForm>
      </section>
    </div>
    </>
  );
}
