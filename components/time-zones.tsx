import { PageHeader } from "@/components/shell";
import { Clocks } from "@/components/clocks";

export function TimeZones() {
  return (
    <>
      <PageHeader title="Time zones" sub="Live US time zone map, state and city times, and a converter" />
      <Clocks />
    </>
  );
}
