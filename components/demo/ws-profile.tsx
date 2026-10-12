"use client";
import { useRef, useState } from "react";
import { Camera, Clock, EyeOff, KeyRound, Lock, Save, Send, Trash2 } from "lucide-react";
import { DemoShell } from "@/components/demo-shell";
import { Avatar } from "@/components/avatar";
import { SalaryBreakdown } from "@/components/salary-breakdown";
import { Secret } from "@/components/secret";
import { breakdown, daysIn, inr } from "@/lib/payroll";
import { fmtDate } from "@/lib/util";
import { today } from "@/lib/demo/data";
import { useDemo } from "@/lib/demo/store";
import { useRole } from "@/lib/demo/use-role";
import { Notice, PageHeader, type Msg } from "./ws-common";

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const COMPANIES = [["lgoob", "LGOOB"], ["fusion", "Fusion Freights"], ["both", "Both"]];
const req = <span className="text-red" aria-hidden>*</span>;
const input = "input h-10";

type Bank = { holder_name: string; account_number: string; ifsc: string; bank_name: string; pan: string; uan: string; can_edit: boolean; requested: boolean };
type Prof = Record<string, string>;

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

export function DemoProfile() {
  return <DemoShell section="workspace"><Body /></DemoShell>;
}

function Body() {
  const { me } = useRole("workspace");
  const [photo, setPhoto] = useDemo<string | null>(`ws:photo:${me.id}`, () => null);
  const [p, setP] = useDemo<Prof>(`ws:profile:${me.id}`, () => ({ full_name: me.name, phone: me.phone, personal_email: "", company: "both", current_address: "12, Baner Road, Pune 411045", emergency_name: "Meena Iyer", emergency_relation: "Mother", emergency_phone: "+91 98200 99999" }));
  const [bank, setBank] = useDemo<Bank | null>(`ws:bank:${me.id}`, () => null);
  const [unlocked, setUnlocked] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [bmsg, setBmsg] = useState<Msg>(null);
  const file = useRef<HTMLInputElement>(null);
  const [company, setCompany] = useState(p.company);
  const [same, setSame] = useState(true);
  const t = today();
  const pay = breakdown(me.ctc, { month: Number(t.slice(5, 7)), daysInMonth: daysIn(Number(t.slice(0, 4)), Number(t.slice(5, 7))) });
  const v = (k: string) => p[k] ?? "";

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return setMsg({ ok: false, text: "Photo must be under 10 MB" });
    const r = new FileReader();
    r.onload = () => setPhoto(() => String(r.result));
    r.readAsDataURL(f);
  };

  return (
    <>
      <PageHeader title="My details" sub="Keep these up to date so the team can reach you." />
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Avatar name={me.name} src={photo} size="size-16 text-lg" />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => file.current?.click()}><Camera /> {photo ? "Change photo" : "Upload photo"}</button>
            {photo && <button type="button" className="btn btn-ghost btn-danger" onClick={() => setPhoto(() => null)}><Trash2 /> Remove</button>}
          </div>
          <p className="text-xs text-muted">JPG or PNG, square works best. Kept in this browser tab only.</p>
        </div>
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <p className="mb-6 flex items-center gap-2 text-xs text-muted"><Lock className="size-3.5" /> Only you and the admin team can see this.</p>

      <div className="max-w-3xl">
        <form
          className="divide-y divide-line"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setP(() => Object.fromEntries([...fd.entries()].filter(([, x]) => typeof x === "string")) as Prof);
            setMsg({ ok: true, text: "Saved" });
          }}
        >
          <Section title="Personal" hint="As on your official ID.">
            <label className="field sm:col-span-2">Full name {req}<input name="full_name" required autoComplete="name" defaultValue={v("full_name")} className={input} /></label>
            <label className="field sm:col-span-2">Alias name<input name="alias_name" maxLength={60} defaultValue={v("alias_name")} placeholder="The name you go by at work, if different" className={input} /></label>
            <label className="field">Date of birth {req}<input type="date" name="date_of_birth" required autoComplete="bday" defaultValue={v("date_of_birth") || "1998-03-14"} className={input} /></label>
            <label className="field">Gender
              <select name="gender" defaultValue={v("gender")} className={input}><option value="">Select</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select>
            </label>
            <label className="field">Mobile number {req}<input type="tel" name="phone" required autoComplete="tel" defaultValue={v("phone")} placeholder="+91 98765 43210" className={input} /></label>
            <label className="field">Personal email<input type="email" name="personal_email" autoComplete="email" defaultValue={v("personal_email")} className={input} /></label>
            <label className="field">Blood group
              <select name="blood_group" defaultValue={v("blood_group")} className={input}><option value="">Select</option>{BLOOD.map((b) => <option key={b}>{b}</option>)}</select>
            </label>
          </Section>

          <Section title="Company" hint="Who you work with, and the name and email you use there.">
            <div className="field sm:col-span-2" role="radiogroup" aria-label="Which company do you work with?">
              <span>Which company do you work with? {req}</span>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {COMPANIES.map(([k, l]) => <label key={k} className="check"><input type="radio" name="company" value={k} required checked={company === k} onChange={() => setCompany(k)} /> {l}</label>)}
              </div>
            </div>
            {(company === "lgoob" || company === "both") && <>
              <label className="field">LGOOB alias name {req}<input name="lgoob_alias" maxLength={60} required defaultValue={v("lgoob_alias")} className={input} /></label>
              <label className="field">LGOOB email {req}<input type="email" name="lgoob_email" required defaultValue={v("lgoob_email")} className={input} /></label>
            </>}
            {(company === "fusion" || company === "both") && <>
              <label className="field">Fusion Freights alias name {req}<input name="fusion_alias" maxLength={60} required defaultValue={v("fusion_alias")} className={input} /></label>
              <label className="field">Fusion Freights email {req}<input type="email" name="fusion_email" required defaultValue={v("fusion_email")} className={input} /></label>
            </>}
          </Section>

          <Section title="Address" hint="Where you live now, and your home address if different.">
            <label className="field sm:col-span-2">Current address {req}<textarea name="current_address" required rows={3} autoComplete="street-address" defaultValue={v("current_address")} className="input" /></label>
            <label className="check sm:col-span-2"><input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} /> Permanent address is the same</label>
            {!same && <label className="field sm:col-span-2">Permanent address<textarea name="permanent_address" rows={3} defaultValue={v("permanent_address")} className="input" /></label>}
          </Section>

          <Section title="Emergency contact" hint="Someone we can call if something happens at work.">
            <label className="field sm:col-span-2">Name {req}<input name="emergency_name" required defaultValue={v("emergency_name")} className={input} /></label>
            <label className="field">Relationship {req}<input name="emergency_relation" required defaultValue={v("emergency_relation")} placeholder="e.g. Mother, Spouse" className={input} /></label>
            <label className="field">Phone {req}<input type="tel" name="emergency_phone" required defaultValue={v("emergency_phone")} className={input} /></label>
          </Section>

          <div className="sticky bottom-0 flex items-center justify-between gap-3 bg-bg/90 py-4 backdrop-blur">
            <span className="text-xs text-muted">{req} Required</span>
            <div className="flex items-center gap-4"><Notice msg={msg} /><button className="btn btn-primary h-11 px-5"><Save /> Save changes</button></div>
          </div>
        </form>

        <div className="space-y-8 border-t border-line py-10">
          <section>
            <h2 className="text-[15px] font-semibold tracking-tight">My salary</h2>
            <div className="mt-3 max-w-md">
              <p className="mb-2 text-sm text-muted"><Secret label="annual salary">{inr(me.ctc)}</Secret> a year since {fmtDate(me.joined_on)}. Monthly, before loss of pay and TDS.</p>
              <Secret block label="salary breakdown"><SalaryBreakdown p={pay} /></Secret>
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Bank details</h2>
            {!bank || (bank.can_edit && unlocked) ? (
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const g = (k: string) => String(fd.get(k) ?? "").trim();
                  setBank(() => ({ holder_name: g("holder_name"), bank_name: g("bank_name"), account_number: g("account_number"), ifsc: g("ifsc").toUpperCase(), pan: g("pan").toUpperCase(), uan: g("uan"), can_edit: false, requested: false }));
                  setUnlocked(false);
                  setBmsg({ ok: true, text: "Saved" });
                }}
              >
                <label className="field">Account holder name<input name="holder_name" required defaultValue={bank?.holder_name ?? ""} className="input" /></label>
                <label className="field">Bank name<input name="bank_name" required defaultValue={bank?.bank_name ?? ""} className="input" /></label>
                <label className="field">Account number<input name="account_number" required inputMode="numeric" pattern="[0-9]{6,20}" defaultValue={bank?.account_number ?? ""} className="input" /></label>
                <label className="field">IFSC<input name="ifsc" required pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" placeholder="HDFC0001234" defaultValue={bank?.ifsc ?? ""} className="input uppercase" /></label>
                <label className="field">PAN<input name="pan" pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" placeholder="ABCDE1234F" defaultValue={bank?.pan ?? ""} className="input uppercase" /></label>
                <label className="field">UAN (optional)<input name="uan" inputMode="numeric" pattern="[0-9]{12}" defaultValue={bank?.uan ?? ""} className="input" /></label>
                <div className="flex items-center gap-4 sm:col-span-2"><button className="btn btn-primary"><Save /> Save bank details</button><Notice msg={bmsg} /></div>
              </form>
            ) : (
              <div className="space-y-4">
                {!unlocked ? (
                  <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setUnlocked(true); }}>
                    <label className="field min-w-56 flex-1">Enter your account password to view bank details (any password works in the demo)
                      <input type="password" name="password" required className="input" />
                    </label>
                    <button className="btn btn-primary"><KeyRound /> View</button>
                  </form>
                ) : (
                  <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    {[["Account holder", bank.holder_name], ["Bank", bank.bank_name], ["Account number", bank.account_number], ["IFSC", bank.ifsc], ["PAN", bank.pan], ["UAN", bank.uan]].map(([k, x]) => (
                      <div key={k}><dt className="text-xs text-muted">{k}</dt><dd>{x || "-"}</dd></div>
                    ))}
                  </dl>
                )}
                {unlocked && <button className="btn btn-ghost" onClick={() => setUnlocked(false)}><EyeOff /> Hide bank details</button>}
                {bank.requested ? (
                  <p className="flex items-center gap-2 text-sm text-muted"><Clock className="size-4" /> Edit requested {fmtDate(t)}. Waiting for HR or an admin to allow it.</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="btn" onClick={() => { setBank((c) => c && { ...c, requested: true }); setBmsg({ ok: true, text: "Request sent to HR / admin" }); }}><Send /> Request to edit</button>
                    <span className="text-sm text-muted"><Lock className="mr-1 inline size-3.5" />Locked. HR or an admin has to allow changes.</span>
                  </div>
                )}
                <Notice msg={bmsg} />
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
