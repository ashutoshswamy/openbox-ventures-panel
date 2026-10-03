import { FileText } from "lucide-react";
import { mediaKind } from "@/lib/util";

// Message attachment: image/video inline, anything else as a download chip.
export function Attachment({ id, path, chip = "bg-surface" }: { id: string; path: string; chip?: string }) {
  const src = `/files/msg/${id}`;
  const name = path.split("/").pop()!;
  const kind = mediaKind(path);
  if (kind === "image")
    return (
      <a href={`${src}?view`} target="_blank" rel="noreferrer" className="mt-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed URL behind a redirect, next/image can't optimise it */}
        <img src={`${src}?view`} alt={name} loading="lazy" className="max-h-72 max-w-full rounded-xl object-contain" />
      </a>
    );
  if (kind === "video") return <video src={`${src}?view`} controls preload="metadata" playsInline className="mt-1 max-h-80 w-full max-w-md rounded-xl bg-surface-2" />;
  return (
    <a href={src} target="_blank" rel="noreferrer" className={`mt-1 flex items-center gap-2 rounded-lg px-2 py-1.5 ${chip}`}>
      <FileText className="size-4 shrink-0" />
      <span className="truncate">{name}</span>
    </a>
  );
}
