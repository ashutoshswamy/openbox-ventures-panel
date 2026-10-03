import { Building2, House, TriangleAlert } from "lucide-react";
import { db } from "@/lib/supabase";
import { DEFAULT_TZ } from "@/lib/util";
import { CheckIn } from "./check-in";
import { Workday } from "./workday";

// Today's attendance: live workday clock + check-in/out.
export async function Today({ employeeId, officeId }: { employeeId: string; officeId: string | null }) {
  const sb = db();
  const [{ data: date }, { data: office }] = await Promise.all([
    sb.rpc("my_today"),
    officeId ? sb.from("offices").select("name, timezone, work_start, work_end, grace_min").eq("id", officeId).maybeSingle() : { data: null },
  ]);
  const { data: a } = await sb.from("attendance_report").select("*").eq("employee_id", employeeId).eq("date", date).maybeSingle();
  const status = !a ? "none" : a.check_out_at ? "out" : "in";
  const tz = office?.timezone ?? DEFAULT_TZ;
  const day = new Date().toLocaleDateString("en-IN", { timeZone: tz, weekday: "long", day: "numeric", month: "long" });

  return (
    <section className="card relative overflow-hidden p-6 md:p-7">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="eyebrow">{day}</span>
        {office && <span className="badge"><Building2 /> {office.name}</span>}
        {a && (
          <span className={`badge ${a.mode === "wfh" ? "badge-blue" : "badge-green"}`}>
            {a.mode === "wfh" ? <House /> : <Building2 />} {a.mode === "wfh" ? "Working from home" : "In office"}
          </span>
        )}
        {a?.late && <span className="badge badge-amber"><TriangleAlert /> Late</span>}
        {a?.hours != null && <span className="badge badge-teal">{a.hours} h worked</span>}
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <Workday
          tz={tz}
          start={office?.work_start ?? "09:30"}
          end={office?.work_end ?? "18:30"}
          grace={office?.grace_min ?? 15}
          checkIn={a?.check_in_at}
          checkOut={a?.check_out_at}
        />
        <CheckIn status={status} />
      </div>
    </section>
  );
}
