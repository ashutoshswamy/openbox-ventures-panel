import { redirect } from "next/navigation";
import { requireMe } from "@/lib/me";
import { adminDb, db } from "@/lib/supabase";
import { mediaKind } from "@/lib/util";

// Private file download: RLS-checked lookup, then short-lived signed URL.
const sources = {
  leave: { table: "leave_requests", column: "doc_path", bucket: "leave-docs" },
  msg: { table: "messages", column: "attachment_path", bucket: "attachments" },
} as const;

export async function GET(req: Request, { params }: RouteContext<"/files/[kind]/[id]">) {
  await requireMe();
  const { kind, id } = await params;
  if (!Object.hasOwn(sources, kind)) return new Response("Not found", { status: 404 });
  const src = sources[kind as keyof typeof sources];
  if (!src) return new Response("Not found", { status: 404 });

  const { data } = await db().from(src.table).select(src.column).eq("id", id).maybeSingle();
  const path = (data as Record<string, string | null> | null)?.[src.column];
  if (!path) return new Response("Not found", { status: 404 });

  // ?view: images/videos inline (for <img>/<video>, from the storage origin, never ours). Everything else downloads.
  const view = new URL(req.url).searchParams.has("view") && !!mediaKind(path);
  const { data: signed } = await adminDb().storage.from(src.bucket).createSignedUrl(path, view ? 3600 : 60, view ? undefined : { download: true });
  if (!signed) return new Response("Not found", { status: 404 });
  redirect(signed.signedUrl);
}
