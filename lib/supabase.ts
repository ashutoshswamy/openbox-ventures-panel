import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Acts as the signed-in user; RLS applies.
export function db() {
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    accessToken: async () => (await auth()).getToken(),
  });
}

// Bypasses RLS. Server-only, never expose.
export function adminDb() {
  return createClient(url, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}
