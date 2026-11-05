import { ArrowRight, Lock } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { DetailsFields, req } from "@/components/details-fields";
import { openLink } from "@/lib/completion";
import { submitCompletion } from "./actions";

export default async function Complete({ params }: PageProps<"/complete/[token]">) {
  const { token } = await params;
  const link = await openLink(token);
  if (!link) return (
    <div className="empty py-16">
      <Lock />
      <p className="text-lg font-semibold">This link has expired or was already used.</p>
      <p className="text-sm text-muted">Ask HR to send you a new one.</p>
    </div>
  );

  const { emp, need } = link;
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">Hi {emp.full_name.split(" ")[0]}, finish your details.</h1>
      <p className="mt-3 text-sm text-muted">
        {need.profile && need.bank ? "Your personal and bank details are still missing." : need.profile ? "Your personal details are still missing." : "Your bank details are still missing."} This link works once and expires in a few days. Only you and the admin team can see this.
      </p>
      <ActionForm action={submitCompletion} className="divide-y divide-line pt-8">
        <input type="hidden" name="token" value={token} />
        <DetailsFields fullName={emp.full_name} alias={emp.alias_name} profile={need.profile} bank={need.bank} />
        <div className="flex items-center justify-between gap-3 py-4">
          <span className="text-xs text-muted">{req} Required</span>
          <button className="btn btn-primary h-11 px-5">Submit <ArrowRight /></button>
        </div>
      </ActionForm>
    </>
  );
}
