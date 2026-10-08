import { CalendarDays, Clock3, MessagesSquare } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const points = [
  [Clock3, "Check in from the office or from home"],
  [CalendarDays, "Apply for leave and track your balance"],
  [MessagesSquare, "Message teammates and start video calls"],
] as const;

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line bg-surface-2 p-12 lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5">
          <Logo size={44} className="rounded-xl" />
          <span className="text-lg font-semibold tracking-tight">Open Box Ventures LLP</span>
        </div>
        <div className="my-auto max-w-md">
          <h2 className="text-5xl leading-[1.05] font-semibold tracking-[-0.035em]">Your workday at Open Box Ventures LLP, in one place.</h2>
          <ul className="mt-10 space-y-4">
            {points.map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3 text-muted">
                <span className="grid size-9 place-items-center rounded-lg border border-line bg-surface text-text"><Icon className="size-[18px]" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted">Internal use only · Open Box Ventures LLP</p>
      </section>
      <section className="relative grid place-items-center p-6">
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="rise">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <Logo size={36} />
            <span className="font-semibold tracking-tight">Open Box Ventures LLP</span>
          </div>
          <h1 className="mb-6 text-sm font-medium text-muted">Open Box Ventures LLP employee panel</h1>
          {children}
        </div>
      </section>
    </main>
  );
}
