"use client";

import { useEffect, useState } from "react";

// Current time in an office's timezone, refreshed every 30 s.
export function LocalTime({ tz, className }: { tz: string; className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  let text = "--:--";
  if (now) { try { text = new Intl.DateTimeFormat("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(now); } catch { text = "Bad timezone"; } }
  return <span className={`tabular-nums ${className ?? ""}`} suppressHydrationWarning>{text}</span>;
}
