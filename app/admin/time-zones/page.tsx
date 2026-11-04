import { staffPage } from "@/lib/me";
import { TimeZones } from "@/components/time-zones";

export const metadata = { title: "Time zones" };

export default async function Page() {
  await staffPage();
  return <TimeZones />;
}
