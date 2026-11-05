import { PhoneInput } from "@/components/phone-input";

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const COMPANIES = [["lgoob", "LGOOB"], ["fusion", "Fusion Freights"], ["both", "Both"]];

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

export const req = <span className="text-red" aria-hidden>*</span>;
const input = "input h-10";

// The onboarding form's fields (personal, company, address, emergency, bank). profile / bank pick which parts show:
// "My details" shows both on first visit; /complete/[token] shows only what's still missing.
export function DetailsFields({ fullName, alias, p, profile = true, bank = false }: {
  fullName: string; alias: string | null; p?: Record<string, string | null> | null; profile?: boolean; bank?: boolean;
}) {
  return (
    <>
      {profile && <>
        <Section title="Personal" hint="As on your official ID.">
          <label className="field sm:col-span-2">Full name {req}<input name="full_name" required autoComplete="name" defaultValue={fullName} className={input} /></label>
          <label className="field sm:col-span-2">Alias name<input name="alias_name" maxLength={60} defaultValue={alias ?? ""} placeholder="The name you go by at work, if different" className={input} /></label>
          <label className="field">Date of birth {req}<input type="date" name="date_of_birth" required autoComplete="bday" defaultValue={p?.date_of_birth ?? ""} className={input} /></label>
          <label className="field">Gender
            <select name="gender" defaultValue={p?.gender ?? ""} className={input}>
              <option value="">Select</option>
              {GENDERS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label className="field">Mobile number {req}<PhoneInput name="phone" required autoComplete="tel" defaultValue={p?.phone ?? ""} className={input} /></label>
          <label className="field">Personal email<input type="email" name="personal_email" autoComplete="email" defaultValue={p?.personal_email ?? ""} className={input} /></label>
          <label className="field">Blood group
            <select name="blood_group" defaultValue={p?.blood_group ?? ""} className={input}>
              <option value="">Select</option>
              {BLOOD.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
        </Section>

        {/* .company (globals.css) shows only the picked company's fields; required checked on the server since hidden inputs can't be */}
        <Section title="Company" hint="Who you work with, and the name and email you use there." className="company">
          <div className="field sm:col-span-2" role="radiogroup" aria-label="Which company do you work with?">
            <span>Which company do you work with? {req}</span>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {COMPANIES.map(([v, l]) => <label key={v} className="check"><input type="radio" name="company" value={v} required defaultChecked={p?.company === v} /> {l}</label>)}
            </div>
          </div>
          <label className="lg field">LGOOB alias name {req}<input name="lgoob_alias" maxLength={60} defaultValue={p?.lgoob_alias ?? ""} className={input} /></label>
          <label className="lg field">LGOOB email {req}<input type="email" name="lgoob_email" defaultValue={p?.lgoob_email ?? ""} className={input} /></label>
          <label className="ff field">Fusion Freights alias name {req}<input name="fusion_alias" maxLength={60} defaultValue={p?.fusion_alias ?? ""} className={input} /></label>
          <label className="ff field">Fusion Freights email {req}<input type="email" name="fusion_email" defaultValue={p?.fusion_email ?? ""} className={input} /></label>
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
          <label className="field">Phone {req}<PhoneInput name="emergency_phone" required defaultValue={p?.emergency_phone ?? ""} className={input} /></label>
        </Section>
      </>}
      {bank && (
        <Section title="Bank details" hint="Where your salary is paid. Locked after saving; changes need HR approval.">
        <label className="field">Account holder name {req}<input name="holder_name" required className={input} /></label>
        <label className="field">Bank name {req}<input name="bank_name" required className={input} /></label>
        <label className="field">Account number {req}<input name="account_number" required inputMode="numeric" className={input} /></label>
        <label className="field">IFSC {req}<input name="ifsc" required placeholder="HDFC0001234" className={`${input} uppercase`} /></label>
        <label className="field">PAN<input name="pan" placeholder="ABCDE1234F" className={`${input} uppercase`} /></label>
        <label className="field">UAN (optional)<input name="uan" inputMode="numeric" className={input} /></label>
              </Section>
      )}
    </>
  );
}
