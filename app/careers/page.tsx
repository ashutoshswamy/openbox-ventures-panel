import Link from "next/link";
import { Briefcase, MapPin } from "lucide-react";
import { adminDb } from "@/lib/supabase";
import { JOB_TYPES } from "@/lib/jobs";

export const metadata = {
  title: "Careers",
  description: "Open roles at Open Box Ventures LLP.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/careers" },
};

export default async function Careers() {
  const { data: jobs } = await adminDb().from("jobs").select("id, title, department, location, type").eq("open", true).order("created_at", { ascending: false });
  return (
    <>
      <h1 className="h1">Join the team</h1>
      <p className="mt-1 mb-8 text-sm text-muted">Open roles at Open Box Ventures LLP.</p>
      <div className="space-y-3">
        {jobs?.map((j) => (
          <Link key={j.id} href={`/careers/${j.id}`} className="card card-link block">
            <h2 className="font-semibold">{j.title}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
              {j.department && <span>{j.department}</span>}
              {j.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{j.location}</span>}
              <span>{JOB_TYPES[j.type as keyof typeof JOB_TYPES]}</span>
            </p>
          </Link>
        ))}
        {!jobs?.length && <p className="card empty"><Briefcase /> No open roles right now. Check back soon.</p>}
      </div>
    </>
  );
}
