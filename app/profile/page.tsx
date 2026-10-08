import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock, Save } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { PhotoPicker } from "@/components/photo-picker";
import { getMe } from "@/lib/me";
import { adminDb } from "@/lib/supabase";
import { ActionForm } from "@/components/action-form";
import { db } from "@/lib/supabase";
import { SalaryBreakdown } from "@/components/salary-breakdown";
import { BankForm } from "@/components/bank-form";
import { breakdown, daysIn, inr } from "@/lib/payroll";
import { fmtDate, todayIn } from "@/lib/util";
import { saveProfile } from "./actions";

export const metadata = { title: "My details" };

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Title + hint on the left, fields on the right (stacked below lg).
function Section({ title, hint, children, className = "" }: { title: string; hint: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={`grid gap-x-10 gap-y-5 py-10 first:pt-0 lg:grid-cols-[180px_1fr] ${className}`}>
      <legend className="sr-only">{title}</legend>
      <div aria-hidden>
        <p className="text-[15px] font-semibold tracking-tight">{title}</p>
        <p className="mt-1 text-sm text-muted">{hint}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

const req = <span className="text-red" aria-hidden>*</span>;
const input = "input h-10";

// Onboarding (first visit after sign-up) and later edits of the same details. Not for admins.
export default async function Profile() {
  const me = await getMe();
  if (!me) redirect("/no-access");
  if (me.role === "admin") redirect("/admin");
  const { data: p } = await adminDb().from("employee_profiles").select("*").eq("employee_id", me.id).maybeSingle();
  const onboarding = !me.onboarded;
  // own salary + bank (RLS: own rows only)
  const today = todayIn();
  const [{ data: sal }, { data: bank }] = onboarding ? [{ data: null }, { data: null }] : await Promise.all([
    db().from("employee_salaries").select("annual_ctc, effective_from").lte("effective_from", today).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    db().from("employee_bank").select("*").maybeSingle(),
  ]);
  const pay = sal ? breakdown(Number(sal.annual_ctc), { month: Number(today.slice(5, 7)), daysInMonth: daysIn(Number(today.slice(0, 4)), Number(today.slice(5, 7))) }) : null;

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[minmax(300px,380px)_1fr]">
      <aside className="flex flex-col gap-8 border-b border-line bg-surface-2 px-4 py-6 sm:px-8 lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0 lg:py-10">
        <div className="flex items-center justify-between gap-4">
          <span className="flex min-w-0 items-center gap-2.5 font-semibold tracking-tight">
            <Logo size={36} />
            <span className="truncate">Open Box Ventures LLP</span>
          </span>
          <ThemeToggle className="lg:hidden" />
        </div>

        <div className="rise lg:my-auto">
          <h1 className="text-3xl leading-[1.1] font-semibold tracking-[-0.03em] lg:text-4xl">
            {onboarding ? `Welcome aboard, ${me.full_name.split(" ")[0]}.` : "My details"}
          </h1>
          <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-muted">
            {onboarding
              ? "A few details before you start. You only fill this in once and can edit it later."
              : "Keep these up to date so the team can reach you."}
          </p>
          <div className="mt-8">
            <PhotoPicker name={me.full_name} />
          </div>
        </div>

        <p className="hidden items-center gap-2 text-xs text-muted lg:flex">
          <Lock className="size-3.5" /> Only you and the admin team can see this.
        </p>
      </aside>

      <div className="px-4 sm:px-8 lg:px-16">
        <div className="mx-auto max-w-3xl">
          <div className="hidden justify-end gap-2 py-6 lg:flex">
            {!onboarding && <Link href="/" className="btn btn-ghost"><ArrowLeft /> Back</Link>}
            <ThemeToggle />
          </div>
          {!onboarding && <Link href="/" className="btn btn-ghost -ml-3 mt-4 lg:hidden"><ArrowLeft /> Back</Link>}

          <ActionForm action={saveProfile} keep success="Saved" className="rise divide-y divide-line pt-8 lg:pt-4">
            <Section title="Personal" hint="As on your official ID.">
              <label className="field sm:col-span-2">Full name {req}<input name="full_name" required autoComplete="name" defaultValue={me.full_name} className={input} /></label>
              <label className="field">Date of birth {req}<input type="date" name="date_of_birth" required autoComplete="bday" defaultValue={p?.date_of_birth ?? ""} className={input} /></label>
              <label className="field">Gender
                <select name="gender" defaultValue={p?.gender ?? ""} className={input}>
                  <option value="">Select</option>
                  {GENDERS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </label>
              <label className="field">Mobile number {req}<input type="tel" name="phone" required autoComplete="tel" defaultValue={p?.phone ?? ""} placeholder="+91 98765 43210" className={input} /></label>
              <label className="field">Personal email<input type="email" name="personal_email" autoComplete="email" defaultValue={p?.personal_email ?? ""} className={input} /></label>
              <label className="field">Blood group
                <select name="blood_group" defaultValue={p?.blood_group ?? ""} className={input}>
                  <option value="">Select</option>
                  {BLOOD.map((b) => <option key={b}>{b}</option>)}
                </select>
              </label>
            </Section>

            {/* ponytail: CSS :has() hides permanent address while "same" is ticked, no client JS */}
            <Section title="Address" hint="Where you live now, and your home address if different." className="[&:has([name=same_address]:checked)_.perm]:hidden">
              <label className="field sm:col-span-2">Current address {req}<textarea name="current_address" required rows={3} autoComplete="street-address" defaultValue={p?.current_address ?? ""} className="input" /></label>
              <label className="check sm:col-span-2"><input type="checkbox" name="same_address" defaultChecked={!p || p.permanent_address === p.current_address} /> Permanent address is the same</label>
              <label className="perm field sm:col-span-2">Permanent address<textarea name="permanent_address" rows={3} defaultValue={p?.permanent_address ?? ""} className="input" /></label>
            </Section>

            <Section title="Emergency contact" hint="Someone we can call if something happens at work.">
              <label className="field sm:col-span-2">Name {req}<input name="emergency_name" required defaultValue={p?.emergency_name ?? ""} className={input} /></label>
              <label className="field">Relationship {req}<input name="emergency_relation" required defaultValue={p?.emergency_relation ?? ""} placeholder="e.g. Mother, Spouse" className={input} /></label>
              <label className="field">Phone {req}<input type="tel" name="emergency_phone" required defaultValue={p?.emergency_phone ?? ""} className={input} /></label>
            </Section>

            <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 bg-bg/90 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0">
              <span className="text-xs text-muted">{req} Required</span>
              <button className="btn btn-primary h-11 px-5">
                {onboarding ? <>Save and continue <ArrowRight /></> : <><Save /> Save changes</>}
              </button>
            </div>
          </ActionForm>
          {!onboarding && (
            <div className="space-y-8 border-t border-line py-10">
              <section>
                <h2 className="text-[15px] font-semibold tracking-tight">My salary</h2>
                {pay && sal ? (
                  <div className="mt-3 max-w-md">
                    <p className="mb-2 text-sm text-muted">{inr(Number(sal.annual_ctc))} a year since {fmtDate(sal.effective_from)}. Monthly, before loss of pay and TDS.</p>
                    <SalaryBreakdown p={pay} />
                  </div>
                ) : <p className="mt-1 text-sm text-muted">Not set up yet. HR adds it.</p>}
              </section>
              <section>
                <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Bank details</h2>
                <BankForm bank={bank} />
              </section>
            </div>
          )}
          <div className="h-10" />
        </div>
      </div>
    </main>
  );
}
