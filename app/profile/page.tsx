import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, Lock, Save, Send } from "lucide-react";
import { DetailsFields, req } from "@/components/details-fields";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { PhotoPicker } from "@/components/photo-picker";
import { getMe } from "@/lib/me";
import { adminDb } from "@/lib/supabase";
import { ActionForm } from "@/components/action-form";
import { db } from "@/lib/supabase";
import { SalaryBreakdown } from "@/components/salary-breakdown";
import { LiveRefresh } from "@/components/live-refresh";
import { type Bank, BankForm, BankLock, BankUnlock } from "@/components/bank-form";
import { Secret } from "@/components/secret";
import { bankUnlocked } from "@/lib/bank-unlock";
import { breakdown, daysIn, inr } from "@/lib/payroll";
import { fmtDate, todayIn } from "@/lib/util";
import { saveProfile } from "./actions";
import { requestBankEdit } from "./bank-actions";

export const metadata = { title: "My details" };

// Onboarding (first visit after sign-up) and later edits of the same details. Not for admins.
export default async function Profile() {
  const me = await getMe();
  if (!me) redirect("/no-access");
  if (me.role === "admin") redirect("/admin");
  const onboarding = !me.onboarded;
  // own salary + bank (RLS: own rows only). Bank values only after password re-entry.
  const today = todayIn();
  const unlocked = !onboarding && await bankUnlocked(me.id); // cookie check, no network
  const none = { data: null };
  const [{ data: p }, { data: sal }, { data: bank }] = await Promise.all([
    adminDb().from("employee_profiles").select("*").eq("employee_id", me.id).maybeSingle(),
    onboarding ? none : db().from("employee_salaries").select("annual_ctc, effective_from").lte("effective_from", today).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    onboarding ? none : db().from("employee_bank").select<string, Bank>(unlocked ? "*" : "employee_can_edit, edit_requested_at").maybeSingle(),
  ]);
  const pay = sal ? breakdown(Number(sal.annual_ctc), { month: Number(today.slice(5, 7)), daysInMonth: daysIn(Number(today.slice(0, 4)), Number(today.slice(5, 7))) }) : null;

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[minmax(300px,380px)_1fr]">
      <LiveRefresh meId={me.id} meName={me.full_name} />
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
            <DetailsFields fullName={me.full_name} alias={me.alias_name} p={p} bank={onboarding} />

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
                    <p className="mb-2 text-sm text-muted"><Secret label="annual salary">{inr(Number(sal.annual_ctc))}</Secret> a year since {fmtDate(sal.effective_from)}. Monthly, before loss of pay and TDS.</p>
                    <Secret block label="salary breakdown"><SalaryBreakdown p={pay} /></Secret>
                  </div>
                ) : <p className="mt-1 text-sm text-muted">Not set up yet. HR adds it.</p>}
              </section>
              <section>
                <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Bank details</h2>
                {!bank ? <BankForm /> : (
                  <div className="space-y-4">
                    {!unlocked ? <BankUnlock /> : bank.employee_can_edit ? (
                      <>
                        <p className="rounded-xl bg-amber-soft p-3 text-sm text-amber">Editing is unlocked. Once you click save, your details lock again and you&apos;ll need to request access again for further changes.</p>
                        <BankForm bank={bank} />
                      </>
                    ) : (
                      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                        {[["Account holder", bank.holder_name], ["Bank", bank.bank_name], ["Account number", bank.account_number], ["IFSC", bank.ifsc], ["PAN", bank.pan], ["UAN", bank.uan]].map(([k, v]) => (
                          <div key={k}><dt className="text-xs text-muted">{k}</dt><dd>{v || "-"}</dd></div>
                        ))}
                      </dl>
                    )}
                    {unlocked && <BankLock />}
                    {!bank.employee_can_edit && (bank.edit_requested_at ? (
                      <p className="flex items-center gap-2 text-sm text-muted"><Clock className="size-4" /> Edit requested {fmtDate(bank.edit_requested_at.slice(0, 10))}. Waiting for HR or an admin to allow it.</p>
                    ) : (
                      <ActionForm action={requestBankEdit} success="Request sent to HR / admin" className="flex flex-wrap items-center gap-3">
                        <button className="btn"><Send /> Request to edit</button>
                        <span className="text-sm text-muted"><Lock className="mr-1 inline size-3.5" />Locked. HR or an admin has to allow changes.</span>
                      </ActionForm>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
          <div className="h-10" />
        </div>
      </div>
    </main>
  );
}
