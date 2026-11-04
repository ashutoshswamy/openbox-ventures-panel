"use client";

import { useEffect, useRef, useState } from "react";

const calm = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Number that counts up on first show, and glides + flashes when the value changes later (live updates after a realtime refresh).
// Renders 0 until mounted, with the real value kept for screen readers.
export function CountUp({ value, decimals = 0, duration = 800 }: { value: number; decimals?: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  const [flash, setFlash] = useState(0);
  const at = useRef(0); // what is on screen right now (for the next animation's start)
  const first = useRef(true);

  useEffect(() => {
    const from = first.current ? 0 : at.current;
    const wasFirst = first.current;
    first.current = false;
    if (calm() || from === value) { at.current = value; setShown(value); return; }
    if (!wasFirst) setFlash((n) => n + 1);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / (wasFirst ? duration : 500));
      const v = from + (value - from) * (1 - (1 - p) ** 3); // ease-out cubic
      at.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step); else { at.current = value; setShown(value); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const text = (n: number) => (decimals ? n.toFixed(decimals) : String(Math.round(n)));
  return (
    <span key={flash} className={flash ? "count-flash" : undefined}>
      <span className="sr-only">{text(value)}</span>
      <span aria-hidden className="tabular-nums">{text(shown)}</span>
    </span>
  );
}
