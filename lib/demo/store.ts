"use client";
// Tiny in-memory store for demo mode. Keyed state survives client-side navigation (module scope), is shared across
// pages (same key = same data) and is wiped by resetDemo() or a full reload. Nothing is persisted or sent anywhere.
import { useSyncExternalStore } from "react";

const state = new Map<string, unknown>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));

export function useDemo<T>(key: string, seed: () => T): [T, (fn: (cur: T) => T) => void] {
  const get = () => {
    if (!state.has(key)) state.set(key, seed());
    return state.get(key) as T;
  };
  const value = useSyncExternalStore(subscribe, get, get);
  const set = (fn: (cur: T) => T) => {
    state.set(key, fn(get()));
    notify();
  };
  return [value, set];
}

export function resetDemo() {
  state.clear();
  notify();
}

// Active demo role ("employee" | "manager" | "hr" | "admin"); null until one is picked on /demo.
export const useDemoRole = () => useDemo<import("./data").DemoRole | null>("role", () => null);
export const newId = () => Math.random().toString(36).slice(2, 10);
