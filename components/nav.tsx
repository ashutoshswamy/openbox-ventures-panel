"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, CalendarDays, Globe, ClipboardCheck, FileText, CalendarCheck2, Clock3, Inbox, LayoutDashboard, ListTodo, LayoutGrid, LifeBuoy, Megaphone, MessagesSquare, Network, ScrollText, UserRound, Users, Wallet,
} from "lucide-react";

const icons = {
  dashboard: LayoutDashboard,
  overview: LayoutGrid,
  attendance: Clock3,
  leave: CalendarDays,
  approvals: CalendarCheck2,
  chat: MessagesSquare,
  directory: Users,
  employees: Users,
  offices: Building2,
  departments: Network,
  announcements: Megaphone,
  support: LifeBuoy,
  issues: Inbox,
  profile: UserRound,
  todos: ListTodo,
  payroll: Wallet,
  audit: ScrollText,
  reviews: ClipboardCheck,
  reports: FileText,
  timezones: Globe,
};
export type NavIcon = keyof typeof icons;
export type NavLink = [href: string, label: string, icon: NavIcon, count?: number];

function active(path: string, href: string) {
  return href === "/" || href === "/admin" || href === "/hr" ? path === href : path === href || path.startsWith(href + "/");
}

export function Nav({ links }: { links: NavLink[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-0.5 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:p-0">
      {links.map(([href, label, icon, count]) => {
        const Icon = icons[icon];
        const on = active(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            title={label}
            className={`group relative flex shrink-0 items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors group-data-[collapsed=true]/shell:lg:justify-center ${
              on ? "border-line bg-surface text-text shadow-[0_1px_2px_rgb(24_24_27/0.05)]" : "border-transparent text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            <Icon className={`size-[18px] ${on ? "text-text" : "opacity-80 group-hover:opacity-100"}`} strokeWidth={1.75} />
            <span className="group-data-[collapsed=true]/shell:lg:hidden">{label}</span>
            {!!count && <span className="ml-auto rounded-full bg-amber-soft px-1.5 text-xs font-semibold text-amber tabular-nums group-data-[collapsed=true]/shell:lg:absolute group-data-[collapsed=true]/shell:lg:top-1 group-data-[collapsed=true]/shell:lg:right-1.5 group-data-[collapsed=true]/shell:lg:size-2 group-data-[collapsed=true]/shell:lg:bg-amber group-data-[collapsed=true]/shell:lg:p-0 group-data-[collapsed=true]/shell:lg:text-[0]">{count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
