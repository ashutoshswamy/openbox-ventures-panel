"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Camera, CircleAlert, LoaderCircle, Trash2 } from "lucide-react";
import { syncAvatar } from "@/app/profile/avatar-actions";
import { Avatar } from "./avatar";

// Upload/remove profile photo. Stored by Clerk (same photo as the Clerk profile), then synced to our DB.
export function PhotoPicker({ name }: { name: string }) {
  const { user } = useUser();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const src = user?.hasImage ? user.imageUrl : null;

  const run = (file: File | null) =>
    start(async () => {
      setError(null);
      try {
        if (file && file.size > 10 * 1024 * 1024) throw new Error("Photo must be under 10 MB");
        await user!.setProfileImage({ file });
        await user!.reload();
        await syncAvatar();
        router.refresh();
      } catch (e) {
        setError((e as Error).message || "Couldn't update the photo");
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar name={name} src={src} size="size-16 text-lg" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={!user || pending} onClick={() => input.current?.click()}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Camera />} {src ? "Change photo" : "Upload photo"}
          </button>
          {src && (
            <button type="button" className="btn btn-ghost btn-danger" disabled={pending} onClick={() => run(null)}>
              <Trash2 /> Remove
            </button>
          )}
        </div>
        <p className="text-xs text-muted">JPG or PNG, square works best. Also changes your sign-in profile photo.</p>
        {error && <p className="error"><CircleAlert className="size-4" /> {error}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) run(f);
        }}
      />
    </div>
  );
}
