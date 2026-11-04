import { employeePage } from "@/lib/me";
import { employeeNav } from "@/lib/nav";
import { db } from "@/lib/supabase";
import { DEFAULT_TZ } from "@/lib/util";
import { Shell } from "@/components/shell";
import { CheckoutGuard } from "@/components/checkout-guard";

export default async function EmployeeLayout({ children }: LayoutProps<"/">) {
  const me = await employeePage();
  const sb = db();
  // still checked in? (reminds them to check out once the workday is over)
  const [{ data: shift }, { data: office }] = await Promise.all([
    sb.rpc("my_shift"),
    me.office_id ? sb.from("offices").select("timezone, work_start_eff, work_end_eff").eq("id", me.office_id).maybeSingle() : { data: null },
  ]);
  const checkedIn = !!shift?.id && !shift.check_out_at;
  return (
    <Shell {...employeeNav(me)} user={{ id: me.id, name: me.full_name, role: me.role, avatar: me.avatar_url }}>
      {children}
      {office && <CheckoutGuard checkedIn={checkedIn} start={(office.work_start_eff as string).slice(0, 5)} end={(office.work_end_eff as string).slice(0, 5)} tz={office.timezone ?? DEFAULT_TZ} />}
    </Shell>
  );
}
