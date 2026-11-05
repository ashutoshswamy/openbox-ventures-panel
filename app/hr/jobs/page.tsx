import { hrPage } from "@/lib/me";
import { JobsBoard } from "@/components/jobs-board";

export const metadata = { title: "Jobs" };

export default async function Jobs() {
  await hrPage();
  return <JobsBoard />;
}
