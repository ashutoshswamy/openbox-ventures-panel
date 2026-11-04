"use client";

import { useEffect } from "react";

// One global tooltip for the whole panel. Shows on hover (after a short pause) or keyboard focus for:
//  - icon-only controls (no visible text) that carry an aria-label
//  - anything with a title attribute (moved to data-tip so the slow native tooltip doesn't double up)
// Uses the popover top layer so it also appears above open dialogs.
const SEL = "[title], [data-tip], button[aria-label], a[aria-label], summary[aria-label], [role=button][aria-label]";

export function Tooltips() {
  useEffect(() => {
    const tip = document.createElement("div");
    tip.setAttribute("role", "tooltip");
    tip.setAttribute("popover", "manual");
    tip.className = "tooltip";
    document.body.appendChild(tip);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: Element | null = null;

    const labelOf = (el: Element) => {
      const t = el.getAttribute("title");
      if (t) { el.setAttribute("data-tip", t); el.removeAttribute("title"); } // suppress the native tooltip
      const own = el.getAttribute("data-tip");
      if (own) return own;
      const aria = el.getAttribute("aria-label");
      return aria && !(el.textContent ?? "").trim() ? aria : null; // only when the control shows no text of its own
    };
    const hide = () => {
      clearTimeout(timer);
      current = null;
      tip.classList.remove("on");
      try { tip.hidePopover(); } catch {}
    };
    const show = (el: Element, text: string) => {
      tip.textContent = text;
      try { tip.showPopover(); } catch {}
      const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      const above = r.top - h - 8 >= 4;
      tip.style.left = `${Math.max(6, Math.min(window.innerWidth - w - 6, r.left + r.width / 2 - w / 2))}px`;
      tip.style.top = `${above ? r.top - h - 8 : r.bottom + 8}px`;
      tip.dataset.side = above ? "top" : "bottom";
      requestAnimationFrame(() => tip.classList.add("on"));
    };
    const enter = (e: Event, delay: number) => {
      const el = (e.target as Element | null)?.closest?.(SEL);
      if (!el || el === current) return;
      hide();
      const text = labelOf(el);
      if (!text) return;
      current = el;
      timer = setTimeout(() => show(el, text), delay);
    };
    const over = (e: Event) => enter(e, 350);
    const focus = (e: Event) => enter(e, 0);
    const out = (e: Event) => { if (current && !current.contains((e as MouseEvent).relatedTarget as Node | null)) hide(); };

    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("keydown", (e) => e.key === "Escape" && hide());
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide);
      window.removeEventListener("scroll", hide, true);
      clearTimeout(timer);
      tip.remove();
    };
  }, []);
  return null;
}
