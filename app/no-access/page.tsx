import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { NoAccess } from "@/components/shell";

export const metadata = { title: "No access" };

export default async function Page() {
  if (await getMe()) redirect("/");
  return <NoAccess />;
}
