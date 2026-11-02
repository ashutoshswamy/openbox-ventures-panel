import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Status" };
export const revalidate = 60; // probes run at most once a minute, shared by all visitors

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

type State = "up" | "slow" | "down";
type Result = { name: string; hint: string; state: State; ms: number };

// Any HTTP answer below 500 means the service is reachable (401/404 from a locked-down endpoint still counts).
// ponytail: reachability + latency only, no history. Add an uptime table + cron if you need past incidents.
async function probe(name: string, hint: string, url: string, headers?: HeadersInit): Promise<Result> {
  const t = Date.now();
  let ok = false;
  try {
    const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(5000) });
    ok = res.status < 500;
  } catch {}
  const ms = Date.now() - t;
  return { name, hint, ms, state: !ok ? "down" : ms > 3000 ? "slow" : "up" };
}

const LABEL: Record<State, string> = { up: "Operational", slow: "Degraded", down: "Outage" };
const TONE: Record<State, string> = { up: "bg-green", slow: "bg-amber", down: "bg-red" };
const TEXT: Record<State, string> = { up: "text-green", slow: "text-amber", down: "text-red" };
const BANNER: Record<State, string> = { up: "bg-green-soft text-green", slow: "bg-amber-soft text-amber", down: "bg-red-soft text-red" };

export default async function Page() {
  const results = await Promise.all([
    probe("Database", "Attendance, leave, payroll, HR data", `${supabase}/rest/v1/`, { apikey: key }),
    probe("File storage", "Chat attachments, uploads, payslips", `${supabase}/storage/v1/version`, { apikey: key }),
    probe("Sign-in", "Accounts and sessions (Clerk)", "https://api.clerk.com/v1/health"),
    probe("Video calls", "Meetings (Jitsi)", "https://meet.jit.si/"),
  ]);
  const checked = new Date();
  const overall: State = results.some((r) => r.state === "down") ? "down" : results.some((r) => r.state === "slow") ? "slow" : "up";
  const headline = { up: "All systems operational", slow: "Some systems are slow", down: "Some systems are down" }[overall];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-8 sm:py-14">
      <header className="mb-8 flex items-center gap-2.5">
        <Logo size={36} />
        <span className="font-semibold tracking-tight">Open Box Ventures LLP</span>
        <ThemeToggle className="ml-auto" />
      </header>

      <h1 className="text-sm font-medium text-muted">System status</h1>
      <p className={`mt-2 rounded-xl px-4 py-3 text-lg font-semibold tracking-tight ${BANNER[overall]}`}>{headline}</p>

      <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
        {results.map((r) => (
          <li key={r.name} className="flex items-center gap-3 px-4 py-3.5">
            <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${TONE[r.state]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.name}</p>
              <p className="truncate text-xs text-muted">{r.hint}</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-medium ${TEXT[r.state]}`}>{LABEL[r.state]}</p>
              {r.state !== "down" && <p className="text-xs text-muted">{r.ms} ms</p>}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-muted">
        Checked <time dateTime={checked.toISOString()}>{checked.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" })} IST</time> · refreshes every minute
      </p>
    </main>
  );
}
