import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { Velaris } from "./velaris";

const points = [
  ["Check in", "from the office or from home."],
  ["Apply for leave", "and track your balance."],
  ["Message teammates", "and start video calls."],
] as const;

// Clerk's own card is flattened so the form sits directly on the page, no box in a box.
export const authAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none border-0 bg-transparent",
    card: "w-full p-0 shadow-none border-0 bg-transparent gap-6",
    header: "hidden",
    footer: "bg-transparent",
    formButtonPrimary: "h-10 shadow-none text-sm font-medium transition-transform active:scale-[0.98]",
    formFieldInput: "h-10 shadow-none",
    socialButtonsBlockButton: "h-10 shadow-none",
  },
};

export function AuthFrame({ children, title = "Sign in", hint = "Use your work account to open the panel." }: { children: React.ReactNode; title?: string; hint?: string }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <Velaris className="hidden text-white lg:block">
        <section className="flex h-full flex-col p-14">
          <div className="flex items-center gap-3">
            <Logo size={40} className="rounded-xl" />
            <span className="text-base font-semibold tracking-tight">Open Box Ventures LLP</span>
          </div>
          <div className="my-auto max-w-xl">
            <h2 className="text-balance text-6xl leading-[1.02] font-semibold tracking-[-0.04em]">Your workday, in one place.</h2>
            <ul className="mt-12 max-w-sm divide-y divide-white/15 border-y border-white/15">
              {points.map(([lead, rest]) => (
                <li key={lead} className="py-4 text-lg tracking-tight text-white/70">
                  <span className="font-medium text-white">{lead}</span> {rest}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/60">Internal use only</p>
        </section>
      </Velaris>
      <section className="relative flex min-h-dvh flex-col justify-center px-6 py-16 sm:px-12">
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="rise mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <Logo size={36} />
            <span className="font-semibold tracking-tight">Open Box Ventures LLP</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-text">{title}</h1>
          <p className="mt-2 mb-8 text-sm text-muted">{hint}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
