import Link from "next/link";
import { MessagesSquare, SquarePen } from "lucide-react";

export const metadata = { title: "Chat" };

// Desktop placeholder; on mobile the channel list fills the screen instead.
export default function ChatHome() {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center gap-3 p-8 text-center md:flex">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary"><MessagesSquare className="size-7" /></span>
      <p className="font-medium">Pick a conversation</p>
      <p className="max-w-xs text-sm text-muted">Or start a new direct message or group with your teammates.</p>
      <Link href="/chat/new" className="btn btn-primary mt-2"><SquarePen /> New conversation</Link>
    </div>
  );
}
