import { adminPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { DEFAULT_TZ, WEEKDAYS } from "@/lib/util";
import Link from "next/link";
import { Building2, CalendarDays, ChevronDown, ClipboardList, Clock3, ExternalLink, MapPin, Network, Plus, Save, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/shell";
import { GeoFill } from "@/components/geo-fill";
import { deleteOffice, saveOffice } from "../actions";

export const metadata = { title: "Offices" };

type Office = {
  id: string; name: string; address: string | null; timezone: string; lat: number | null; lng: number | null;
  radius_m: number; work_start: string; work_end: string; dst_enabled: boolean; dst_work_start: string; dst_work_end: string; work_start_eff: string; work_end_eff: string; grace_min: number; work_days: number[];
  report_daily: boolean; report_weekly: boolean; report_monthly: boolean;
};

// [1,2,3,4,5] -> "Mon-Fri"; anything else lists the days.
function dayRange(days: number[]) {
  const d = [...days].sort((a, b) => a - b);
  const run = d.length > 2 && d.every((x, i) => x === d[0] + i);
  return run ? `${WEEKDAYS[d[0] - 1]}-${WEEKDAYS[d[d.length - 1] - 1]}` : d.map((x) => WEEKDAYS[x - 1]).join(", ");
}

const REPORTS = [["report_daily", "Daily", "every check-out"], ["report_weekly", "Weekly", "last working day of the week"], ["report_monthly", "Monthly", "last working day of the month"]] as const;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <legend className="mb-3 text-sm font-semibold tracking-tight">{title}</legend>
      {children}
    </fieldset>
  );
}

function OfficeForm({ o }: { o?: Office }) {
  return (
    <ActionForm action={saveOffice} keep={!!o} success={o ? "Saved" : undefined} className="grid gap-x-4 gap-y-8 sm:grid-cols-2">
      {o && <input type="hidden" name="id" value={o.id} />}
      <Group title="Office">
        <label className="field">Name<input name="name" required defaultValue={o?.name} className="input" /></label>
        <label className="field">Timezone<input name="timezone" defaultValue={o?.timezone ?? DEFAULT_TZ} className="input" /></label>
        <label className="field sm:col-span-2">Address<input name="address" defaultValue={o?.address ?? ""} className="input" /></label>
      </Group>
      <Group title="Check-in location">
        <label className="field">Latitude<input name="lat" type="number" step="any" defaultValue={o?.lat ?? ""} className="input tabular-nums" /></label>
        <label className="field">Longitude<input name="lng" type="number" step="any" defaultValue={o?.lng ?? ""} className="input tabular-nums" /></label>
        <label className="field">Check-in radius (m)<input name="radius_m" type="number" min={10} defaultValue={o?.radius_m ?? 200} className="input tabular-nums" /></label>
        <div className="flex items-end gap-2">
          <GeoFill />
          {o?.lat != null && (
            <a className="btn btn-ghost" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${o.lat},${o.lng}`}><ExternalLink /> Map</a>
          )}
        </div>
      </Group>
      <Group title="Hours">
        <label className="field">Work starts<input name="work_start" type="time" defaultValue={o?.work_start.slice(0, 5) ?? "09:30"} className="input tabular-nums" /></label>
        <label className="field">Work ends<input name="work_end" type="time" defaultValue={o?.work_end.slice(0, 5) ?? "18:30"} className="input tabular-nums" /></label>
        <label className="field">DST work starts<input name="dst_work_start" type="time" defaultValue={o?.dst_work_start.slice(0, 5) ?? "09:30"} className="input tabular-nums" /></label>
        <label className="field">DST work ends<input name="dst_work_end" type="time" defaultValue={o?.dst_work_end.slice(0, 5) ?? "18:30"} className="input tabular-nums" /></label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:bg-surface-2/60 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-2 has-focus-visible:ring-primary sm:col-span-2">
          <input type="checkbox" name="dst_enabled" defaultChecked={o?.dst_enabled ?? false} className="mt-0.5 size-4 accent-primary" />
          <span className="text-sm"><span className="block font-medium">Daylight saving time</span><span className="text-xs text-muted">When on, the DST hours above replace the regular hours. Turn off when DST ends.</span></span>
        </label>
        <label className="field">Late after (grace, min)<input name="grace_min" type="number" min={0} defaultValue={o?.grace_min ?? 15} className="input tabular-nums" /></label>
        <div className="field">
          <span id={`days-${o?.id ?? "new"}`}>Working days</span>
          <div role="group" aria-labelledby={`days-${o?.id ?? "new"}`} className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => (
              <label key={d} className="cursor-pointer">
                <input type="checkbox" name="work_days" value={i + 1} defaultChecked={(o?.work_days ?? [1, 2, 3, 4, 5]).includes(i + 1)} className="peer sr-only" />
                <span className="inline-block min-w-11 rounded-lg border border-line px-2.5 py-1.5 text-center text-sm text-muted transition-[background-color,border-color,color,transform] hover:border-text/30 active:scale-[0.97] peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-fg peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface">{d}</span>
              </label>
            ))}
          </div>
        </div>
      </Group>
      <Group title="Work reports at check-out">
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3">
          {REPORTS.map(([name, label, when]) => (
            <label key={name} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:bg-surface-2/60 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-2 has-focus-visible:ring-primary">
              <input type="checkbox" name={name} defaultChecked={o?.[name] ?? false} className="mt-0.5 size-4 accent-primary" />
              <span className="text-sm"><span className="block font-medium">{label}</span><span className="text-xs text-muted">{when}</span></span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted sm:col-span-2">Employees must write what they did before they can check out. Managers read these under Work reports.</p>
      </Group>
      <div className="flex items-center gap-2 sm:col-span-2">{o ? <button className="btn btn-primary"><Save /> Save changes</button> : <button className="btn btn-primary"><Plus /> Create office</button>}</div>
    </ActionForm>
  );
}

export default async function Offices() {
  await adminPage();
  const sb = db();
  const [{ data: offices }, { data: depts }, { data: staff }] = await Promise.all([
    sb.from("offices").select("*").order("name"),
    sb.from("departments").select("office_id"),
    sb.from("employees").select("office_id").eq("active", true).or("role.is.null,role.neq.admin"),
  ]);
  const count = (rows: { office_id: string | null }[] | null, id: string) => rows?.filter((r) => r.office_id === id).length ?? 0;

  return (
    <>
      <PageHeader title="Offices" sub="Location, check-in radius, hours and working days for each branch.">
        <a href="#new-office" className="btn btn-primary"><Plus /> New office</a>
      </PageHeader>
      <div className="max-w-4xl space-y-4">
        {offices?.map((o: Office) => {
          const reports = REPORTS.filter(([k]) => o[k]).map(([, l]) => l);
          return (
            <details key={o.id} className="card group p-0">
              <summary className="flex cursor-pointer items-center gap-4 rounded-2xl p-5 transition-colors hover:bg-surface-2/50 focus-visible:outline-offset-[-2px]">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Building2 className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold tracking-tight">{o.name}</span>
                  {o.address && <span className="block truncate text-sm text-muted">{o.address}</span>}
                  <span className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
                    <span className="flex items-center gap-1.5 tabular-nums"><Clock3 className="size-3.5" /> {o.work_start_eff.slice(0, 5)} to {o.work_end_eff.slice(0, 5)}{o.dst_enabled && " (DST)"}</span>
                    <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /> {dayRange(o.work_days)}</span>
                    <span className={`flex items-center gap-1.5 tabular-nums ${o.lat == null ? "font-medium text-amber" : ""}`}><MapPin className="size-3.5" /> {o.lat == null ? "Location not set" : `${o.radius_m} m radius`}</span>
                    <span className="flex items-center gap-1.5"><ClipboardList className="size-3.5" /> {reports.length ? `${reports.join(", ")} reports` : "No work reports"}</span>
                  </span>
                </span>
                <span className="hidden shrink-0 text-right text-sm tabular-nums sm:block">
                  <span className="block font-semibold">{count(staff, o.id)}</span>
                  <span className="text-xs text-muted">people</span>
                </span>
                <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-6 border-t border-line p-5 pt-6">
                <OfficeForm o={o} />
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                  <Link href="/admin/departments" className="btn btn-ghost -ml-3.5"><Network /> {count(depts, o.id)} {count(depts, o.id) === 1 ? "department" : "departments"}</Link>
                  <ActionForm action={deleteOffice} confirm={`Delete ${o.name}? Its departments are deleted too.`}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="btn btn-ghost btn-danger"><Trash2 /> Delete office</button>
                  </ActionForm>
                </div>
              </div>
            </details>
          );
        })}
        <section id="new-office" className="card scroll-mt-6">
          <h2 className="h2 mb-6"><Plus /> New office</h2>
          <OfficeForm />
        </section>
      </div>
    </>
  );
}
