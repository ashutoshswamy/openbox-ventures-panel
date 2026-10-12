"use client";
import Link from "next/link";
import { ArrowRight, Building2, Clock, Hourglass, Inbox, House, Palmtree, TriangleAlert, UserX } from "lucide-react";
import { PageHeader, useAdm } from "@/components/demo/adm-ui";
import { useAttendance, useOffices } from "@/lib/demo/admin";
import { useIssues, useLeave, useRegularizations } from "@/lib/demo/shared";
import { daysFrom, today } from "@/lib/demo/data";

const KINDS = [
  { key: "office", label: "In office", icon: Building2, bar: "bg-green", tone: "text-green" },
  { key: "wfh", label: "From home", icon: House, bar: "bg-blue", tone: "text-blue" },
  { key: "leave", label: "On leave", icon: Palmtree, bar: "bg-amber", tone: "text-amber" },
  { key: "absent", label: "Not checked in", icon: UserX, bar: "bg-line", tone: "text-muted" },
] as const;

export default function AdminHome() {
  const { me, isAdmin, staff, emps, inScope } = useAdm();
  const [offices] = useOffices();
  const { rows } = useAttendance();
  const [leaves] = useLeave();
  const [regs] = useRegularizations();
  const [issues] = useIssues();
  const t = today();
  const scoped = offices.filter((o) => isAdmin || o.id === me.office_id);
  const empOf = (id: string) => emps.find((e) => e.id === id);

  const pending = leaves.filter((l) => ["pending", "manager_approved"].includes(l.status) && l.employee_id !== me.id && (isAdmin || (empOf(l.employee_id) && inScope(empOf(l.employee_id)!)))).length;
  const stale = leaves.filter((l) => l.status === "pending" && l.applied_on < daysFrom(0) && l.employee_id !== me.id && (isAdmin || inScope(empOf(l.employee_id)!))).length;
  const staleReg = isAdmin ? regs.filter((r) => r.status === "pending").length : 0;
  const openIssues = isAdmin ? issues.filter((i) => i.status === "open").length : 0;

  const stats = scoped.map((o) => {
    const people = staff.filter((p) => p.office_id === o.id);
    const att = rows.filter((r) => r.date === t && people.some((p) => p.id === r.employee_id));
    const leave = people.filter((p) => !att.some((a) => a.employee_id === p.id) && leaves.some((l) => l.employee_id === p.id && l.status === "approved" && l.from <= t && l.to >= t)).length;
    const office = att.filter((a) => a.mode === "office").length;
    const wfh = att.filter((a) => a.mode === "wfh").length;
    return { ...o, total: people.length, office, wfh, leave, absent: Math.max(0, people.length - att.length - leave), late: att.filter((a) => a.late).length };
  });
  const sum = (k: "office" | "wfh" | "leave" | "absent" | "late" | "total") => stats.reduce((n, s) => n + s[k], 0);

  return (
    <>
      <PageHeader
        title={isAdmin ? "Today across Open Box Ventures LLP" : `Today at ${scoped[0]?.name ?? "your office"}`}
        sub={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      />
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {KINDS.map(({ key, label, icon: Icon, tone }) => (
            <div key={key} className="card p-4">
              <div className={`flex items-center gap-2 text-sm ${tone}`}><Icon className="size-4" /> {label}</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{sum(key)}</div>
            </div>
          ))}
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm text-amber"><TriangleAlert className="size-4" /> Late</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{sum("late")}</div>
          </div>
        </div>

        {!!pending && (
          <Link href="/demo/admin/leave" className="card card-link flex items-center gap-4 border-amber/30 bg-amber-soft/40">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-soft text-amber"><Hourglass className="size-5" /></span>
            <span className="flex-1"><b>{pending}</b> leave request{pending > 1 ? "s" : ""} waiting for review</span>
            <ArrowRight className="size-5 text-muted" />
          </Link>
        )}

        {(stale > 0 || staleReg > 0) && (
          <section className="card border-amber/30">
            <h2 className="h2"><Clock /> Needs attention <span className="text-sm font-normal text-muted">waiting over 24 hours</span></h2>
            <ul className="space-y-1 text-sm">
              {stale > 0 && <li><Link href="/demo/admin/leave" className="hover:underline"><b>{stale}</b> leave request{stale > 1 ? "s" : ""}</Link></li>}
              {staleReg > 0 && <li><Link href="/demo/admin/attendance" className="hover:underline"><b>{staleReg}</b> attendance regularization{staleReg > 1 ? "s" : ""}</Link></li>}
            </ul>
          </section>
        )}

        {!!openIssues && (
          <Link href="/demo/admin/issues" className="card card-link flex items-center gap-4">
            <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><Inbox className="size-5" /></span>
            <span className="flex-1"><b>{openIssues}</b> open issue{openIssues > 1 ? "s" : ""} reported by the team</span>
            <ArrowRight className="size-5 text-muted" />
          </Link>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {stats.map((s) => (
            <Link key={s.id} href={`/demo/admin/attendance`} className="card card-link block">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold"><Building2 className="size-4 text-muted" /> {s.name}</h2>
                <span className="text-sm text-muted">{s.total} people</span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
                {KINDS.map(({ key, bar }) => (s.total && s[key] ? <div key={key} className={bar} style={{ width: `${(s[key] / s.total) * 100}%` }} /> : null))}
              </div>
              <dl className="mt-4 grid grid-cols-4 gap-2">
                {KINDS.map(({ key, label, bar }) => (
                  <div key={key}>
                    <dt className="flex items-center gap-1.5 text-xs text-muted"><span className={`size-2 rounded-full ${bar}`} />{label}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{s[key]}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
