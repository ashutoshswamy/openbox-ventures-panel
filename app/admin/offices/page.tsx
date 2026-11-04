import { adminPage } from "@/lib/me";
import { db } from "@/lib/supabase";
import { DEFAULT_TZ, WEEKDAYS } from "@/lib/util";
import Link from "next/link";
import { Building2, ExternalLink, MapPin, Network, Plus, Save, TriangleAlert, Trash2, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/shell";
import { GeoFill } from "@/components/geo-fill";
import { LocalTime } from "@/components/local-time";
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

// One settings block: what it is on the left, the fields on the right. Blocks are separated by a hairline, not boxed.
function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-x-12 gap-y-5 border-t border-line py-8 first:border-t-0 first:pt-0 lg:grid-cols-[15rem_1fr]">
      <legend className="sr-only">{title}</legend>
      <div className="max-w-[26ch]" aria-hidden>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{hint}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

const toggle = "flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5 transition-colors hover:bg-surface-2/60 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-2 has-focus-visible:ring-primary";

function OfficeForm({ o }: { o?: Office }) {
  const dayId = `days-${o?.id ?? "new"}`;
  return (
    <ActionForm action={saveOffice} keep={!!o} success={o ? "Office saved" : "Office created"}>
      {o && <input type="hidden" name="id" value={o.id} />}

      <Section title="Basics" hint="The name people see, and the timezone every clock and report uses.">
        <label className="field">Name<input name="name" required defaultValue={o?.name} className="input" /></label>
        <label className="field">Timezone<input name="timezone" defaultValue={o?.timezone ?? DEFAULT_TZ} className="input" placeholder="Asia/Kolkata" /></label>
        <label className="field sm:col-span-2">Address<input name="address" defaultValue={o?.address ?? ""} className="input" /></label>
      </Section>

      <Section title="Check-in location" hint="Office check-ins only work inside this radius. Stand at the office and use your location.">
        <label className="field">Latitude<input name="lat" type="number" step="any" defaultValue={o?.lat ?? ""} className="input tabular-nums" /></label>
        <label className="field">Longitude<input name="lng" type="number" step="any" defaultValue={o?.lng ?? ""} className="input tabular-nums" /></label>
        <label className="field">Radius (metres)<input name="radius_m" type="number" min={10} defaultValue={o?.radius_m ?? 200} className="input tabular-nums" /></label>
        <div className="flex items-end gap-2">
          <GeoFill />
          {o?.lat != null && <a className="btn btn-ghost" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${o.lat},${o.lng}`}><ExternalLink /> Map</a>}
        </div>
      </Section>

      <Section title="Working hours" hint="When the day starts and ends, and how late counts as late.">
        <label className="field">Work starts<input name="work_start" type="time" defaultValue={o?.work_start.slice(0, 5) ?? "09:30"} className="input tabular-nums" /></label>
        <label className="field">Work ends<input name="work_end" type="time" defaultValue={o?.work_end.slice(0, 5) ?? "18:30"} className="input tabular-nums" /></label>
        <label className="field">Late after (minutes of grace)<input name="grace_min" type="number" min={0} defaultValue={o?.grace_min ?? 15} className="input tabular-nums" /></label>
        <div className="field">
          <span id={dayId}>Working days</span>
          <div role="group" aria-labelledby={dayId} className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => (
              <label key={d} className="cursor-pointer">
                <input type="checkbox" name="work_days" value={i + 1} defaultChecked={(o?.work_days ?? [1, 2, 3, 4, 5]).includes(i + 1)} className="peer sr-only" />
                <span className="inline-block min-w-11 rounded-lg border border-line px-2.5 py-1.5 text-center text-sm text-muted transition-[background-color,border-color,color,transform] hover:border-text/30 active:scale-[0.97] peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-fg peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface">{d}</span>
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Daylight saving" hint="Switch to a second set of hours while DST is in effect, and back when it ends.">
        <label className={`${toggle} sm:col-span-2`}>
          <input type="checkbox" name="dst_enabled" defaultChecked={o?.dst_enabled ?? false} className="mt-0.5 size-4 accent-primary" />
          <span className="text-sm"><span className="block font-medium">Use the DST hours</span><span className="text-xs text-muted">When on, these hours replace the regular ones above.</span></span>
        </label>
        <label className="field">DST work starts<input name="dst_work_start" type="time" defaultValue={o?.dst_work_start.slice(0, 5) ?? "09:30"} className="input tabular-nums" /></label>
        <label className="field">DST work ends<input name="dst_work_end" type="time" defaultValue={o?.dst_work_end.slice(0, 5) ?? "18:30"} className="input tabular-nums" /></label>
      </Section>

      <Section title="Work reports" hint="What employees write before they can check out. Managers read these under Work reports.">
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3">
          {REPORTS.map(([name, label, when]) => (
            <label key={name} className={toggle}>
              <input type="checkbox" name={name} defaultChecked={o?.[name] ?? false} className="mt-0.5 size-4 accent-primary" />
              <span className="text-sm"><span className="block font-medium">{label}</span><span className="text-xs text-muted">{when}</span></span>
            </label>
          ))}
        </div>
      </Section>

      {/* stays in view while you scroll a long form */}
      <div className="sticky bottom-4 z-10 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/95 p-3 pl-4 shadow-lg backdrop-blur">
        <p className="text-sm text-muted">{o ? <>Changes apply to everyone in <b className="font-medium text-text">{o.name}</b>.</> : "The office is created empty. Add departments and invite people next."}</p>
        {o ? <button className="btn btn-primary"><Save /> Save changes</button> : <button className="btn btn-primary"><Plus /> Create office</button>}
      </div>
    </ActionForm>
  );
}

export default async function Offices({ searchParams }: PageProps<"/admin/offices">) {
  await adminPage();
  const sp = await searchParams;
  const sb = db();
  const [{ data: offices }, { data: depts }, { data: staff }] = await Promise.all([
    sb.from("offices").select("*").order("name"),
    sb.from("departments").select("office_id"),
    sb.from("employees").select("office_id").eq("active", true).or("role.is.null,role.neq.admin"),
  ]);
  const count = (rows: { office_id: string | null }[] | null, id: string) => rows?.filter((r) => r.office_id === id).length ?? 0;
  const list = (offices ?? []) as Office[];
  const adding = sp.office === "new" || !list.length;
  const o = adding ? undefined : list.find((x) => x.id === sp.office) ?? list[0];
  const hours = (x: Office) => `${x.work_start_eff.slice(0, 5)} to ${x.work_end_eff.slice(0, 5)}${x.dst_enabled ? " (DST)" : ""}`;

  return (
    <>
      <PageHeader title="Offices" sub="Location, check-in radius, hours and working days for each branch." />
      <div className="max-w-5xl space-y-10">
        <nav aria-label="Offices" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((x) => {
            const on = !adding && o?.id === x.id;
            return (
              <Link key={x.id} href={`?office=${x.id}`} aria-current={on ? "page" : undefined}
                className={`group rounded-2xl border bg-surface p-4 transition-[border-color,box-shadow] ${on ? "border-primary shadow-[0_0_0_1px_var(--color-primary)]" : "border-line hover:border-text/30"}`}>
                <span className="flex items-start gap-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors ${on ? "bg-primary text-primary-fg" : "bg-primary-soft text-primary"}`}><Building2 className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold tracking-tight">{x.name}</span>
                    <span className="block truncate text-sm text-muted">{x.address || "No address"}</span>
                  </span>
                  <LocalTime tz={x.timezone} className="shrink-0 text-sm font-medium" />
                </span>
                <span className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  <span className="tabular-nums">{hours(x)}</span>
                  <span className="flex items-center gap-1 tabular-nums"><Users className="size-3.5" />{count(staff, x.id)}</span>
                  {x.lat == null && <span className="flex items-center gap-1 font-medium text-amber"><TriangleAlert className="size-3.5" />Location not set</span>}
                </span>
              </Link>
            );
          })}
          <Link href="?office=new" aria-current={adding ? "page" : undefined}
            className={`flex min-h-24 items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-sm font-medium transition-colors ${adding ? "border-primary bg-primary-soft text-text" : "border-line text-muted hover:border-text/40 hover:text-text"}`}>
            <Plus className="size-4" /> New office
          </Link>
        </nav>

        <section aria-label={o ? `Settings for ${o.name}` : "New office"}>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">{o ? o.name : "New office"}</h2>
              {o && <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted"><span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{o.lat == null ? "Location not set" : `${o.radius_m} m check-in radius`}</span><span>{dayRange(o.work_days)}</span><span>{REPORTS.filter(([k]) => o[k]).map(([, l]) => l).join(", ") || "No work reports"}</span></p>}
            </div>
            {o && (
              <div className="flex flex-wrap items-center gap-1">
                <Link href="/admin/departments" className="btn btn-ghost"><Network /> {count(depts, o.id)} {count(depts, o.id) === 1 ? "department" : "departments"}</Link>
                <ActionForm action={deleteOffice} success="Office deleted" confirm={`Delete ${o.name}? Its departments are deleted too.`}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="btn btn-ghost btn-danger"><Trash2 /> Delete</button>
                </ActionForm>
              </div>
            )}
          </div>
          <OfficeForm key={o?.id ?? "new"} o={o} />
        </section>
      </div>
    </>
  );
}
