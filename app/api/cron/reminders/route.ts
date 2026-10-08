import { adminDb } from "@/lib/supabase";

// Vercel Cron (vercel.json) sends `Authorization: Bearer $CRON_SECRET`. proxy.ts only reads the
// session (no protect), so this passes through Clerk; the secret is the gate.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const { data, error } = await adminDb().rpc("daily_reminders");
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ posted: data });
}
