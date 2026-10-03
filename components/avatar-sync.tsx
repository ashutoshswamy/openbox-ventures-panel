"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { syncAvatar } from "@/app/profile/avatar-actions";

// Photo changed in Clerk (e.g. UserButton → Manage account)? Push it to our DB so colleagues see it.
// Only fires when Clerk and the stored copy differ.
export function AvatarSync({ stored }: { stored: string | null }) {
  const { user, isLoaded } = useUser();
  const current = isLoaded && user ? (user.hasImage ? user.imageUrl : null) : undefined;

  useEffect(() => {
    if (current !== undefined && current !== stored) syncAvatar();
  }, [current, stored]);

  return null;
}
