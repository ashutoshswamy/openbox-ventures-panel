import { employeePage } from "@/lib/me";
import { TimeZones } from "@/components/time-zones";

export const metadata = { title: "Time zones" };

export default async function Page() {
  await employeePage();
  return <TimeZones />;
}
