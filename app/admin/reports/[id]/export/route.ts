import { requireStaff } from "@/lib/me";
import { db } from "@/lib/supabase";

// md = body as written. txt = PowerPoint outline: no indent = slide title, one tab = bullet, two tabs = sub-bullet.
function outline(md: string) {
  let sub = false; // under a ### date: text is a sub-bullet
  return md
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      if (l.startsWith("### ")) return (sub = true), "\t" + l.slice(4);
      if (/^##? /.test(l)) return (sub = false), l.replace(/^#+ /, "");
      return (sub ? "\t\t" : "\t") + l.replace(/^[-*] /, "").trim();
    })
    .join("\n");
}

// RLS: only the author (or admin) can read it.
export async function GET(req: Request, { params }: RouteContext<"/admin/reports/[id]/export">) {
  await requireStaff();
  const { id } = await params;
  const { data: r } = await db().from("compiled_reports").select("title, body").eq("id", id).maybeSingle();
  if (!r) return new Response("Not found", { status: 404 });
  const md = new URL(req.url).searchParams.get("format") === "md";
  const name = r.title.replace(/[^\w-]+/g, "_").slice(0, 60) || "report";
  return new Response(md ? r.body : outline(r.body), {
    headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": `attachment; filename="${name}.${md ? "md" : "txt"}"` },
  });
}
