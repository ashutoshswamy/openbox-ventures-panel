import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shell";

const URL = "https://www.time-zones-map.com/";

// Third-party US time zone map, embedded. frame-src in proxy.ts must allow this origin.
export function TimeZones() {
  return (
    <>
      <PageHeader title="Time zones" sub="Live US time zone map for scheduling calls and dispatch">
        <a href={URL} target="_blank" rel="noopener noreferrer" className="btn"><ExternalLink /> Open in new tab</a>
      </PageHeader>
      <iframe src={URL} title="US time zones map" loading="lazy" referrerPolicy="no-referrer" className="h-[calc(100dvh-11rem)] min-h-[32rem] w-full rounded-2xl border border-line bg-surface" />
    </>
  );
}
