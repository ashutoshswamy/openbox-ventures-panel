"use client";
import { ME_BY_ROLE, emp, type DemoRole } from "./data";
import { useDemoRole } from "./store";
import type { Section } from "./nav";

// Role to act as inside a section (clamped so e.g. an employee opening /demo/admin sees the manager panel) + the matching person.
export function useRole(section: Section) {
  const [picked] = useDemoRole();
  const role: DemoRole =
    section === "hr" ? "hr" : section === "admin" ? (picked === "manager" ? "manager" : "admin") : picked === "admin" || !picked ? "employee" : picked;
  return { role, me: emp(ME_BY_ROLE[role]) };
}
