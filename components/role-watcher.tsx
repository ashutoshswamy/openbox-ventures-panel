"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, useUser } from "@clerk/nextjs";

// Session token caches publicMetadata for ~60s. On load and every 15s, re-read the user;
// once a role exists, mint a fresh token (updates the session cookie) and enter the app.
export function RoleWatcher() {
  const { session } = useSession();
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!session || !user) return;
    const check = async () => {
      await user.reload();
      if (!user.publicMetadata?.role) return;
      const token = await session.getToken({ skipCache: true });
      const claims = token && JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (claims?.metadata?.role) router.replace("/"); // only once the cookie token carries it
    };
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, [session, user, router]);

  return null;
}
