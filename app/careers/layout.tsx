import Link from "next/link";
import { Logo } from "@/components/logo";

// Public: no login, no panel shell.
export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Link href="/careers" className="mb-10 flex items-center gap-3">
        <Logo size={36} />
        <span className="text-[15px] font-semibold tracking-tight">Open Box Ventures LLP · Careers</span>
      </Link>
      {children}
    </main>
  );
}
