"use client";
import { useState } from "react";
import { Building2, CircleAlert, CircleCheckBig, House, LogOut, TriangleAlert } from "lucide-react";
import { Workday } from "@/components/workday";
import { DEFAULT_TZ } from "@/lib/util";
import { office, today, type DemoEmployee } from "@/lib/demo/data";
import { useCheckins } from "@/lib/demo/shared";
import { derive } from "@/lib/demo/workspace";

// Today's attendance: live workday clock + check-in/out (demo state instead of geolocation + server actions).
export function Today({ me }: { me: DemoEmployee }) {
  const [list, set] = useCheckins();
  const [error, setError] = useState<string | null>(null);
  const off = office(me.office_id);
  const a = list.find((x) => x.employee_id === me.id && x.date === today());
  const status = !a ? "none" : a.out_at ? "out" : "in";
  const d = a ? derive(a, off) : null;
  const day = new Date().toLocaleDateString("en-IN", { timeZone: DEFAULT_TZ, weekday: "long", day: "numeric", month: "long" });
  const checkIn = (mode: "office" | "wfh") => {
    setError(null);
    set((cur) => [...cur, { employee_id: me.id, date: today(), in_at: new Date().toISOString(), out_at: null, mode }]);
  };
  const checkOut = () => {
    if (!a) return setError("You haven't checked in");
    set((cur) => cur.map((x) => (x === a ? { ...x, out_at: new Date().toISOString() } : x)));
  };

  return (
    <section className="card relative overflow-hidden p-6 md:p-7">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="eyebrow">{day}</span>
        {off && <span className="badge"><Building2 /> {off.name}</span>}
        {a && (
          <span className={`badge ${a.mode === "wfh" ? "badge-blue" : "badge-green"}`}>
            {a.mode === "wfh" ? <House /> : <Building2 />} {a.mode === "wfh" ? "Working from home" : "In office"}
          </span>
        )}
        {d?.late && <span className="badge badge-amber"><TriangleAlert /> Late</span>}
        {d?.hours != null && <span className="badge badge-teal">{d.hours} h worked</span>}
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <Workday tz={DEFAULT_TZ} start={off?.work_start ?? "09:30"} end={off?.work_end ?? "18:30"} grace={off?.grace_min ?? 15} checkIn={a?.in_at} checkOut={a?.out_at} />
        {status === "out" ? (
          <p className="flex items-center gap-2 text-sm font-medium text-green"><CircleCheckBig className="size-5" /> Day complete</p>
        ) : (
          <div className="flex flex-col gap-2 lg:items-end">
            <div className="flex flex-wrap gap-2">
              {status === "none" ? (
                <>
                  <button className="btn btn-primary h-11 px-5" onClick={() => checkIn("office")}><Building2 /> Check in at office</button>
                  <button className="btn h-11 px-5" onClick={() => checkIn("wfh")}><House /> Work from home</button>
                </>
              ) : (
                <button className="btn btn-primary h-11 px-5" onClick={checkOut}><LogOut /> Check out</button>
              )}
            </div>
            {error && <p className="error lg:justify-end"><CircleAlert className="size-4" /> {error}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
