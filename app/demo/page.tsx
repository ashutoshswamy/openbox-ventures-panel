import { DemoPicker } from "@/components/demo-picker";
import { AuthFrame } from "@/components/auth-frame";

export const metadata = { title: "Try the demo" };

export default function Page() {
  return (
    <AuthFrame>
      <DemoPicker />
    </AuthFrame>
  );
}
