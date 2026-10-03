import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/supabase";

// Stable link to the company Announcements channel.
export default async function AnnouncementsChannel() {
  const { data } = await db().from("channels").select("id").eq("announcements", true).maybeSingle();
  if (!data) notFound();
  redirect(`/chat/${data.id}`);
}
