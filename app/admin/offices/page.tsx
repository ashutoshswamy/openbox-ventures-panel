import { adminPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { DEFAULT_TZ, WEEKDAYS } from "@/lib/util";
import { Building2, ChevronDown, Clock3, ExternalLink, MapPin, Plus, Save, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/shell";
import { GeoFill } from "@/components/geo-fill";
import { deleteOffice, saveOffice } from "../actions";

export const metadata = { title: "Offices" };

type Office = {
  id: string; name: string; address: string | null; timezone: string; lat: number | null; lng: number | null;
  radius_m: number; work_start: string; work_end: string; grace_min: number; work_days: number[];
};

function OfficeForm({ o }: { o?: Office }) {
  return (
    <ActionForm action={saveOffice} keep={!!o} success={o ? "Saved" : undefined} className="grid gap-4 sm:grid-cols-2">
      {o && <input type="hidden" name="id" value={o.id} />}
      <label className="field">Name<input name="name" required defaultValue={o?.name} className="input" /></label>
      <label className="field">Timezone<input name="timezone" defaultValue={o?.timezone ?? DEFAULT_TZ} className="input" /></label>
      <label className="field sm:col-span-2">Address<input name="address" defaultValue={o?.address ?? ""} className="input" /></label>
      <label className="field">Latitude<input name="lat" type="number" step="any" defaultValue={o?.lat ?? ""} className="input" /></label>
      <label className="field">Longitude<input name="lng" type="number" step="any" defaultValue={o?.lng ?? ""} className="input" /></label>
      <label className="field">Check-in radius (m)<input name="radius_m" type="number" min={10} defaultValue={o?.radius_m ?? 200} className="input" /></label>
      <div className="flex items-end gap-2">
        <GeoFill />
        {o?.lat != null && (
          <a className="btn btn-ghost" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${o.lat},${o.lng}`}><ExternalLink /> Map</a>
        )}
      </div>
      <label className="field">Work starts<input name="work_start" type="time" defaultValue={o?.work_start.slice(0, 5) ?? "09:30"} className="input" /></label>
      <label className="field">Work ends<input name="work_end" type="time" defaultValue={o?.work_end.slice(0, 5) ?? "18:30"} className="input" /></label>
      <label className="field">Late after (grace, min)<input name="grace_min" type="number" min={0} defaultValue={o?.grace_min ?? 15} className="input" /></label>
      <fieldset className="field sm:col-span-2">
        <legend className="mb-1.5">Working days</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d, i) => (
            <label key={d} className="cursor-pointer">
              <input type="checkbox" name="work_days" value={i + 1} defaultChecked={(o?.work_days ?? [1, 2, 3, 4, 5]).includes(i + 1)} className="peer sr-only" />
              <span className="inline-block rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition-colors peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary">{d}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">{o ? <button className="btn btn-primary"><Save /> Save changes</button> : <button className="btn btn-primary"><Plus /> Create office</button>}</div>
    </ActionForm>
  );
}

export default async function Offices() {
  await adminPage();
  const { data: offices } = await db().from("offices").select("*").order("name");

  return (
    <>
      <PageHeader title="Offices" sub="Location, check-in radius, hours and working days for each branch." />
      <div className="max-w-4xl space-y-6">
        {offices?.map((o: Office) => (
          <details key={o.id} className="card group">
            <summary className="flex cursor-pointer items-center gap-4">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><Building2 className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{o.name}</span>
                <span className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span className="flex items-center gap-1"><Clock3 className="size-3.5" /> {o.work_start.slice(0, 5)}-{o.work_end.slice(0, 5)}</span>
                  <span className={`flex items-center gap-1 ${o.lat == null ? "text-amber" : ""}`}><MapPin className="size-3.5" /> {o.lat == null ? "Location not set" : `${o.radius_m} m radius`}</span>
                </span>
              </span>
              <ChevronDown className="size-5 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-6 space-y-4 border-t border-line pt-6">
              <OfficeForm o={o} />
              <ActionForm action={deleteOffice} confirm={`Delete ${o.name}? Its departments are deleted too.`}>
                <input type="hidden" name="id" value={o.id} />
                <button className="btn btn-ghost btn-danger"><Trash2 /> Delete office</button>
              </ActionForm>
            </div>
          </details>
        ))}
        <section className="card">
          <h2 className="h2"><Plus /> New office</h2>
          <OfficeForm />
        </section>
      </div>
    </>
  );
}
