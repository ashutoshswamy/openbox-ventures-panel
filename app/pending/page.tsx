import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Hourglass, TriangleAlert } from "lucide-react";
import { getMe } from "@/lib/me";
import { Gate } from "@/components/shell";
import { RoleWatcher } from "@/components/role-watcher";

export const metadata = { title: "Waiting for access" };

export default async function Pending() {
  const me = await getMe();
  if (!me) redirect("/no-access");
  if (me.role) redirect("/");
  if (!me.onboarded) redirect("/profile");
  // Role set in Clerk but missing from the token → session token claim not configured.
  const clerkRole = (await currentUser())?.publicMetadata?.role as string | undefined;

  return (
    <Gate icon={<Hourglass className="size-6" />} title={`Welcome, ${me.full_name.split(" ")[0]}`}>
      <RoleWatcher />
      <p>
        Your account is ready, but no role has been assigned yet. An admin will set it up shortly. This page continues
        on its own once that&apos;s done.
      </p>
      {clerkRole && (
        <div className="rounded-xl bg-amber-soft p-4 text-left text-amber">
          <p className="flex items-center gap-2 font-medium"><TriangleAlert className="size-4" /> Role set, session missing it</p>
          <p className="mt-1">
            Your role is <b>{clerkRole}</b>, but your session doesn&apos;t include it. If signing out and in doesn&apos;t fix it, add this in
            Clerk → Configure → Sessions → Customize session token:
          </p>
          <code className="mt-2 block rounded-lg bg-surface p-2 text-xs text-text">{`"metadata": "{{user.public_metadata}}"`}</code>
        </div>
      )}
    </Gate>
  );
}
