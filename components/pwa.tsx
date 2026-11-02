"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

// ponytail: Chrome/Edge/Android only (beforeinstallprompt). iOS Safari: Share → Add to Home Screen, no API.
type Prompt = Event & { prompt: () => Promise<void> };

export function Pwa() {
  const [ev, setEv] = useState<Prompt | null>(null);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const on = (e: Event) => { e.preventDefault(); setEv(e as Prompt); };
    const done = () => setEv(null);
    addEventListener("beforeinstallprompt", on);
    addEventListener("appinstalled", done);
    return () => { removeEventListener("beforeinstallprompt", on); removeEventListener("appinstalled", done); };
  }, []);
  if (!ev) return null;
  return (
    <button type="button" className="btn btn-ghost" onClick={() => { ev.prompt(); setEv(null); }}>
      <Download /> Install app
    </button>
  );
}
