"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";

// Re-renders server components when a message lands in any channel the user can read (RLS-filtered).
// ponytail: full refresh per message, fine for a company-sized team; append-in-place if chat gets busy.
export function LiveRefresh() {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!session) return;
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      accessToken: () => session.getToken(),
    });
    const ch = sb
      .channel("messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => router.refresh())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [session, router]);

  return null;
}

// Hide the channel list on mobile while a channel is open.
export function ChatSidebar({ children }: { children: React.ReactNode }) {
  const open = useSelectedLayoutSegment();
  return <aside className={`min-h-0 flex-col border-line bg-surface-2/40 md:flex md:w-72 md:border-r ${open ? "hidden" : "flex flex-1 md:flex-none"}`}>{children}</aside>;
}

// Sidebar row; highlights the open channel.
export function ChannelLink({ id, children }: { id: string; children: React.ReactNode }) {
  const active = useSelectedLayoutSegment() === id;
  return (
    <Link
      href={`/chat/${id}`}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${active ? "bg-surface shadow-[0_1px_2px_rgb(24_24_27/0.06)] ring-1 ring-line" : "hover:bg-surface-2"}`}
    >
      {children}
    </Link>
  );
}
