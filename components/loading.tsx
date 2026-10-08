import { LoaderCircle } from "lucide-react";
import { Logo } from "./logo";

// Route loading screen. full = before any panel has rendered (whole viewport, with logo); otherwise fills the panel's content area.
export function Loading({ full }: { full?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`grid flex-1 place-items-center ${full ? "min-h-dvh" : "min-h-[60vh]"}`}>
      <div className="flex flex-col items-center gap-3 text-sm text-muted">
        {full && <Logo size={48} />}
        <LoaderCircle className="size-6 animate-spin" aria-hidden />
        Loading…
      </div>
    </div>
  );
}
