import { PageHeader } from "@/components/shell";
import { Clocks } from "@/components/clocks";

export function TimeZones() {
  return (
    <>
      <PageHeader title="Time zones" sub="Live US and Canada time zone maps, state, province and city times, and a converter" />
      <Clocks />
    </>
  );
}
