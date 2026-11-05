import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { DetailsFields, req } from "@/components/details-fields";
import { getMe } from "@/lib/me";
import { missing } from "@/lib/completion";
import { submitCompletion } from "./actions";

// Link target for "finish your details". getMe() sends signed-out visitors to sign-in and back here; each person only ever sees their own form.
export default async function Complete() {
  const me = await getMe();
  if (!me) redirect("/no-access");
  if (me.role === "admin") redirect("/admin");
  const need = await missing(me.id);
  if (!need) redirect("/");

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">Hi {me.full_name.split(" ")[0]}, finish your details.</h1>
      <p className="mt-3 text-sm text-muted">
        {need.profile && need.bank ? "Your personal and bank details are still missing." : need.profile ? "Your personal details are still missing." : "Your bank details are still missing."} Only you and the admin team can see this.
      </p>
      <ActionForm action={submitCompletion} className="divide-y divide-line pt-8">
        <DetailsFields fullName={me.full_name} alias={me.alias_name} profile={need.profile} bank={need.bank} />
        <div className="flex items-center justify-between gap-3 py-4">
          <span className="text-xs text-muted">{req} Required</span>
          <button className="btn btn-primary h-11 px-5">Submit <ArrowRight /></button>
        </div>
      </ActionForm>
    </>
  );
}
