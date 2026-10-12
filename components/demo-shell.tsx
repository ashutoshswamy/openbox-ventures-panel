"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, FlaskConical, LogIn, RotateCcw } from "lucide-react";
import { Logo } from "./logo";
import { Nav } from "./nav";
import { ThemeToggle } from "./theme-toggle";
import { GlobalSearch } from "./search";
import { Avatar } from "./avatar";
import { ROLE_LABEL, type DemoRole } from "@/lib/demo/data";
import { HOME_OF, navFor, type Section } from "@/lib/demo/nav";
import { resetDemo, useDemoRole } from "@/lib/demo/store";
import { useRole } from "@/lib/demo/use-role";

const ROLES = Object.keys(ROLE_LABEL) as DemoRole[];

// Same chrome as components/shell.tsx, minus Clerk / Supabase. Banner + role switcher on top.
export function DemoShell({ section, children }: { section: Section; children: React.ReactNode }) {
  const { role, me } = useRole(section);
  const [, setPicked] = useDemoRole();
  const router = useRouter();
  const { panel, links, switchTo } = navFor(section, role);

  return (
    <div className="flex min-h-dvh w-full min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-line bg-amber-soft px-4 py-1.5 text-xs text-amber">
        <span className="flex items-center gap-1.5 font-medium"><FlaskConical className="size-3.5" /> Demo mode: sample data, nothing is saved or sent</span>
        <label className="flex items-center gap-1.5">
          View as
          <select
            className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-text"
            value={role}
            onChange={(e) => {
              const r = e.target.value as DemoRole;
              setPicked(() => r);
              router.push(HOME_OF[r]);
            }}
          >
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </label>
        <button className="flex items-center gap-1 underline-offset-2 hover:underline" onClick={() => resetDemo()}><RotateCcw className="size-3" /> Reset demo</button>
        <Link href="/sign-in" className="flex items-center gap-1 underline-offset-2 hover:underline"><LogIn className="size-3" /> Exit</Link>
      </div>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col lg:flex-row">
        <aside className="sticky top-0 z-10 min-w-0 border-b border-line bg-bg/85 backdrop-blur lg:h-[calc(100dvh-2rem)] lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0 lg:bg-bg">
          <div className="flex h-full flex-col gap-5 lg:p-3">
            <div className="flex items-center justify-between gap-3 px-4 pt-3 lg:px-2 lg:pt-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <Logo size={36} />
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[15px] font-semibold tracking-tight lg:whitespace-normal">Open Box Ventures LLP</div>
                  <div className="text-xs text-muted">{panel}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 lg:hidden"><ThemeToggle /></div>
            </div>
            <div className="-mb-3 px-3 lg:mb-0 lg:px-0"><GlobalSearch links={links} demo /></div>
            <Nav links={links} />
            <div className="mt-auto hidden flex-col gap-2 lg:flex">
              {switchTo && <Link href={switchTo.href} className="btn btn-ghost justify-start"><ArrowLeftRight /> {switchTo.label}</Link>}
              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
                <Avatar name={me.name} src={null} />
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-medium">{me.name}</div>
                  <div className="text-xs text-muted">{ROLE_LABEL[role]}</div>
                </div>
              </div>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10 lg:pt-4">
          <div className="mb-4 hidden justify-end lg:flex"><ThemeToggle /></div>
          <div className="rise mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
