"use client";
import { PageHeader } from "@/components/demo/adm-ui";
import { emp } from "@/lib/demo/data";
import { useAudit } from "@/lib/demo/shared";

const at = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Audit() {
  const [rows] = useAudit();
  return (
    <>
      <PageHeader title="Audit log" sub="Changes to people, pay, leave and org settings. Bank values are never stored." />
      <section className="card overflow-x-auto">
        {!rows.length ? <p className="text-sm text-muted">Nothing logged yet.</p> : (
          <table className="table">
            <thead><tr><th>When</th><th>Who</th><th>What</th><th>Whose</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap text-muted tabular-nums">{at(r.at)}</td>
                  <td className="whitespace-nowrap">{emp(r.actor).name}</td>
                  <td className="whitespace-nowrap"><span className={`badge ${/^(Added|Created|Posted|Approved|Imported|Reactivated|Resolved)/.test(r.action) ? "badge-green" : /^(Deleted|Removed|Rejected|Deactivated|Sent back)/.test(r.action) ? "badge-red" : "badge-blue"}`}>{r.action}</span></td>
                  <td className="whitespace-nowrap">{r.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
