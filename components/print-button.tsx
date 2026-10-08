"use client";

import { Printer } from "lucide-react";

// Browser print → "Save as PDF". ponytail: no PDF library.
export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="btn btn-primary"><Printer /> Print / Save PDF</button>;
}
