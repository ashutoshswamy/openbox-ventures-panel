import { Logo } from "@/components/logo";

// Public (the link is the credential): no login, no panel shell, kept out of search and out of Referer headers.
export const metadata = { title: "Complete your details", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default function CompleteLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <div className="mb-10 flex items-center gap-3">
        <Logo size={36} />
        <span className="text-[15px] font-semibold tracking-tight">Open Box Ventures LLP</span>
      </div>
      {children}
    </main>
  );
}
