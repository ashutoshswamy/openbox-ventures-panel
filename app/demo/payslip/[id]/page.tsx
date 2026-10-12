import { DemoPayslip } from "@/components/demo/ws-payslip";

export const metadata = { title: "Payslip" };
// id = "<payroll run id>_<employee id>", e.g. p2_e4
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <DemoPayslip id={(await params).id} />;
}
