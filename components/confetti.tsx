"use client";

import { useEffect, useState } from "react";
import { PartyPopper, X } from "lucide-react";

const COLORS = ["#f2611d", "#2f5bff", "#13743a", "#f0c24a", "#c42a6e", "#6d3fd6", "#0e7490"];

// Canvas confetti, no dependency. ~3 seconds, then the canvas removes itself. Skipped when the user prefers reduced motion.
export function fireConfetti(count = 140) {
  if (typeof document === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  c.setAttribute("aria-hidden", "true");
  c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:200";
  const dpr = devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const g = c.getContext("2d")!;
  g.scale(dpr, dpr);
  const bits = Array.from({ length: count }, (_, i) => {
    const side = i % 2 ? 1 : -1; // two bursts from the lower corners
    const a = (Math.PI / 180) * (side === 1 ? 105 + Math.random() * 40 : 35 + Math.random() * 40);
    const v = 9 + Math.random() * 11;
    return { x: side === 1 ? innerWidth : 0, y: innerHeight * 0.85, vx: Math.cos(a) * v * (side === 1 ? 1 : 1), vy: -Math.sin(a) * v, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, c: COLORS[i % COLORS.length] };
  });
  const t0 = performance.now();
  const frame = (t: number) => {
    const life = (t - t0) / 3200;
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) {
      b.vy += 0.32; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.globalAlpha = Math.max(0, 1 - Math.max(0, life - 0.6) / 0.4);
      g.fillStyle = b.c; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); g.restore();
    }
    if (life < 1) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}

// Banner + confetti, once per person per day per occasion (remembered in localStorage).
export function Celebrate({ id, title, text }: { id: string; title: string; text: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const key = `celebrated:${id}:${new Date().toDateString()}`;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setOpen(true);
    const t = setTimeout(() => fireConfetti(), 350);
    return () => clearTimeout(t);
  }, [id]);
  if (!open) return null;
  return (
    <div role="status" className="pop flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-soft text-amber"><PartyPopper className="size-5" /></span>
      <div className="min-w-0 flex-1 leading-tight"><div className="font-semibold">{title}</div><div className="text-sm text-muted">{text}</div></div>
      <button type="button" className="btn btn-ghost btn-icon" aria-label="Dismiss" onClick={() => setOpen(false)}><X /></button>
    </div>
  );
}
