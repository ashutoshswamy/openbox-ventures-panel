"use client";

import { Video } from "lucide-react";
import { startCall } from "@/app/(employee)/actions";

// Opens Jitsi in a new tab (embedding meet.jit.si is capped at 5 min) and posts the link to the channel.
export function CallButton({ channelId, url }: { channelId: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="btn" onClick={() => startCall(channelId)}>
      <Video /> <span className="hidden sm:inline">Video call</span>
    </a>
  );
}
