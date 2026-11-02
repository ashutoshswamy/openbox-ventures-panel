import { useSyncExternalStore } from "react";

// Who is online right now (Supabase Realtime Presence, fed by <LiveRefresh>) + my own chosen status.
// No "invisible": not connected = offline. Idle is automatic (5 min without input) unless I picked a status by hand.
export type Status = "online" | "idle" | "dnd";
export type Shown = Status | "offline";
export const LABEL: Record<Shown, string> = { online: "Online", idle: "Idle", dnd: "Do Not Disturb", offline: "Offline" };

const KEY = "presence-status";
const valid = (v: unknown): v is Status => v === "online" || v === "idle" || v === "dnd";
const read = (): Status => {
  try { const v = localStorage.getItem(KEY); return valid(v) ? v : "online"; } catch { return "online"; }
};

// ponytail: the chosen status lives in this browser (all its tabs stay in step); add a column on employees to follow people across devices.
let manual: Status = "online";
let states = new Map<string, Status>(); // employee id → status; absent = offline
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const onManual = new Set<() => void>(); // only when MY chosen status changes (not on every presence update)
export const onManualChange = (f: () => void) => (onManual.add(f), () => void onManual.delete(f));
export const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f));

export const getManual = () => manual;
export function setManual(s: Status) {
  manual = s;
  try { localStorage.setItem(KEY, s); } catch {}
  emit();
  onManual.forEach((f) => f());
}
export function setStates(next: Map<string, Status>) {
  states = next;
  emit();
}
// browser-only: call from an effect
export function loadManual() {
  const before = manual;
  manual = read();
  emit();
  if (manual !== before) onManual.forEach((f) => f());
}

export const useStatus = (id: string): Shown => useSyncExternalStore(subscribe, () => states.get(id) ?? "offline", () => "offline");
export const useMyStatus = (): Status => useSyncExternalStore(subscribe, () => manual, () => "online");
