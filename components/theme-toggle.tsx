"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Choice = "light" | "dark" | "system";
const OPTIONS = [
  ["light", Sun, "Light"],
  ["dark", Moon, "Dark"],
  ["system", Monitor, "System"],
] as const;

const dark = () => matchMedia("(prefers-color-scheme: dark)");

// Choice lives in localStorage (per browser); absent = follow the OS.
function read(): Choice {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb); // other tabs
  window.addEventListener("themechange", cb); // this tab
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("themechange", cb);
  };
}

function apply(choice: Choice) {
  document.documentElement.dataset.theme = choice === "system" ? (dark().matches ? "dark" : "light") : choice;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const choice = useSyncExternalStore(subscribe, read, () => null);

  // keep <html data-theme> in step (other tabs, and the OS while on "system")
  useEffect(() => {
    if (!choice) return;
    apply(choice);
    if (choice !== "system") return;
    const mq = dark();
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const pick = (c: Choice) => {
    try {
      if (c === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", c);
    } catch {}
    apply(c);
    window.dispatchEvent(new Event("themechange"));
  };

  return (
    <div role="radiogroup" aria-label="Theme" className={`inline-flex rounded-lg border border-line bg-surface-2 p-0.5 ${className}`}>
      {OPTIONS.map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          title={label}
          onClick={() => pick(value)}
          className={`grid size-7 cursor-pointer place-items-center rounded-md transition-colors ${
            choice === value ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
          }`}
        >
          <Icon className="size-3.5" strokeWidth={2} />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
