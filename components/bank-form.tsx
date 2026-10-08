import { Save } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { saveBank } from "@/app/profile/bank-actions";

export type Bank = { holder_name: string; account_number: string; ifsc: string; bank_name: string; pan: string | null; uan: string | null; employee_can_edit?: boolean; edit_requested_at?: string | null };

export const maskAcct = (a: string) => "•••• " + a.slice(-4);

// employeeId: set by HR/admin editing someone else; omitted = own details.
export function BankForm({ bank, employeeId }: { bank?: Bank | null; employeeId?: string }) {
  return (
    <ActionForm action={saveBank} keep success="Saved" className="grid gap-4 sm:grid-cols-2">
      {employeeId && <input type="hidden" name="employee_id" value={employeeId} />}
      <label className="field">Account holder name<input name="holder_name" required defaultValue={bank?.holder_name ?? ""} className="input" /></label>
      <label className="field">Bank name<input name="bank_name" required defaultValue={bank?.bank_name ?? ""} className="input" /></label>
      <label className="field">Account number<input name="account_number" required inputMode="numeric" pattern="[0-9]{6,20}" defaultValue={bank?.account_number ?? ""} className="input" /></label>
      <label className="field">IFSC<input name="ifsc" required pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" placeholder="HDFC0001234" defaultValue={bank?.ifsc ?? ""} className="input uppercase" /></label>
      <label className="field">PAN<input name="pan" pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" placeholder="ABCDE1234F" defaultValue={bank?.pan ?? ""} className="input uppercase" /></label>
      <label className="field">UAN (optional)<input name="uan" inputMode="numeric" pattern="[0-9]{12}" defaultValue={bank?.uan ?? ""} className="input" /></label>
      <div className="sm:col-span-2"><button className="btn btn-primary"><Save /> Save bank details</button></div>
    </ActionForm>
  );
}
