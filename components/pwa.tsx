"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

// ponytail: Chrome/Edge/Android only (beforeinstallprompt). iOS Safari: Share → Add to Home Screen, no API.
type Prompt = Event & { prompt: () => Promise<void> };

export function Pwa() {
  const [ev, setEv] = useState<Prompt | null>(null);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // dev chunks aren't content-hashed, so the cache-first worker would serve stale code: only run it in production
      if (process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
      else {
        navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
        caches?.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
      }
    }
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
