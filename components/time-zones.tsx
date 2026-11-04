import { PageHeader } from "@/components/shell";
import { Clocks } from "@/components/clocks";

export function TimeZones() {
  return (
    <>
      <PageHeader title="Time zones" sub="Live US and India times, to pick a good moment for a call or dispatch" />
      <Clocks />
    </>
  );
}
