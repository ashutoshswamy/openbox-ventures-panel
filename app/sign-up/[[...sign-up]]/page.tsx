import { SignUp } from "@clerk/nextjs";
import { AuthFrame, authAppearance } from "@/components/auth-frame";

export const metadata = { title: "Sign up" };

// Reached only through an admin invitation link (sign-up mode: invite only).
export default function Page() {
  return (
    <AuthFrame title="Create your account" hint="You were invited by an admin. Finish setting up to continue.">
      <SignUp appearance={authAppearance} />
    </AuthFrame>
  );
}
