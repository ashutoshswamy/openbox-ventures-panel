"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlaskConical, ShieldCheck, UserRound, Users, Wallet } from "lucide-react";
import { ME_BY_ROLE, ROLE_LABEL, emp, type DemoRole } from "@/lib/demo/data";
import { HOME_OF } from "@/lib/demo/nav";
import { resetDemo, useDemoRole } from "@/lib/demo/store";

const blurb: Record<DemoRole, [React.ComponentType<{ className?: string }>, string]> = {
  employee: [UserRound, "Check in, apply for leave, chat, view payslips"],
  manager: [Users, "Approve your team's leave and attendance"],
  hr: [Wallet, "Final approvals, payroll, announcements"],
  admin: [ShieldCheck, "Whole organisation: offices, employees, audit log"],
};

export function DemoPicker() {
  const router = useRouter();
  const [, setRole] = useDemoRole();
  return (
    <div className="w-80 max-w-full">
      <div className="badge badge-amber mb-3"><FlaskConical className="size-3.5" /> Demo</div>
      <h2 className="mb-1 text-xl font-semibold tracking-tight">Try the panel</h2>
      <p className="mb-5 text-sm text-muted">Everything works, but it&apos;s sample data. Nothing is saved or sent.</p>
      <div className="space-y-2">
        {(Object.keys(ROLE_LABEL) as DemoRole[]).map((r) => {
          const [Icon, text] = blurb[r];
          return (
            <button key={r} className="card-link flex w-full items-center gap-3 p-3 text-left" onClick={() => { resetDemo(); setRole(() => r); router.push(HOME_OF[r]); }}>
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft"><Icon className="size-[18px]" /></span>
              <span className="min-w-0 text-sm"><span className="block font-medium">{ROLE_LABEL[r]} · {emp(ME_BY_ROLE[r]).name}</span><span className="text-muted">{text}</span></span>
            </button>
          );
        })}
      </div>
      <Link href="/sign-in" className="btn btn-ghost mt-4 w-full">Back to sign in</Link>
    </div>
  );
}
