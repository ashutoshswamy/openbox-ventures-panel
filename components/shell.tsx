import { SignOutButton, UserButton } from "@clerk/nextjs";
import { LogOut, ShieldOff } from "lucide-react";
import { Logo as Mark } from "./logo";
import { Nav, type NavLink } from "./nav";
import { ThemeToggle } from "./theme-toggle";
import { AvatarSync } from "./avatar-sync";
import { LiveRefresh } from "./live-refresh";

function Logo({ panel }: { panel: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Mark size={36} />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[15px] font-semibold tracking-tight lg:whitespace-normal">OpenBox Ventures LLP</div>
        <div className="text-xs text-muted">{panel}</div>
      </div>
    </div>
  );
}

export function Shell({
  panel,
  links,
  user,
  children,
}: {
  panel: string;
  links: NavLink[];
  user: { name: string; role: string; avatar: string | null };
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full min-w-0 flex-1 flex-col lg:flex-row">
      <AvatarSync stored={user.avatar} />
      <LiveRefresh />
      <aside className="sticky top-0 z-10 min-w-0 border-b border-line bg-bg/85 backdrop-blur lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0 lg:bg-bg">
        <div className="flex h-full flex-col gap-5 lg:p-3">
          <div className="flex items-center justify-between gap-3 px-4 pt-3 lg:px-2 lg:pt-2">
            <Logo panel={panel} />
            <div className="flex shrink-0 items-center gap-2 lg:hidden"><ThemeToggle /><UserButton /></div>
          </div>
          <Nav links={links} />
          <div className="mt-auto hidden flex-col gap-3 lg:flex">
          <ThemeToggle className="self-start" />
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
            <UserButton />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="text-xs text-muted capitalize">{user.role}</div>
            </div>
          </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
        <div className="rise mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="h1">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

export function Gate({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center p-6">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="card rise w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-xl bg-primary-soft text-text">
          {icon ?? <ShieldOff className="size-6" />}
        </div>
        <h1 className="mb-2 text-xl font-semibold tracking-tight">{title}</h1>
        <div className="space-y-4 text-sm text-muted">{children}</div>
        <SignOutButton>
          <button className="btn mt-6"><LogOut /> Sign out</button>
        </SignOutButton>
      </div>
    </main>
  );
}

export function NoAccess() {
  return (
    <Gate title="No access">
      <p>This account isn&apos;t linked to an active employee. Ask an admin to invite the email you signed in with.</p>
    </Gate>
  );
}
