"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ANN_ID } from "@/lib/demo/chat";

export default function AnnouncementsChannel() {
  const router = useRouter();
  useEffect(() => router.replace(`/demo/chat/${ANN_ID}`), [router]);
  return null;
}
