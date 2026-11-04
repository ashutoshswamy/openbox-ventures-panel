"use client";

import { Toaster } from "sileo";

// Black pill in both themes (the logo's black). Sileo colours the title by state: green success, red error.
export function AppToaster() {
  return <Toaster position="top-right" theme="light" options={{ fill: "#111114", duration: 4000 }} />;
}
