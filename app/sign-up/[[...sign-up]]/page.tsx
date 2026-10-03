import { SignUp } from "@clerk/nextjs";
import { AuthFrame } from "@/components/auth-frame";

export const metadata = { title: "Sign up" };

// Reached only through an admin invitation link (sign-up mode: invite only).
export default function Page() {
  return (
    <AuthFrame>
      <SignUp />
    </AuthFrame>
  );
}
