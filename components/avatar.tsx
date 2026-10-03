import Image from "next/image";
import { initials } from "@/lib/util";

// Profile photo (Clerk) when set, else deterministic tinted initials.
const tints = ["bg-primary-soft text-primary", "bg-blue-soft text-blue", "bg-amber-soft text-amber", "bg-green-soft text-green", "bg-red-soft text-red"];

export function Avatar({ name, src, size = "size-10" }: { name: string; src?: string | null; size?: string }) {
  if (src)
    return (
      <span className={`relative shrink-0 overflow-hidden rounded-full bg-surface-2 ${size}`}>
        <Image src={src} alt={name} fill sizes="96px" className="object-cover" />
      </span>
    );
  const tint = tints[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % tints.length];
  return <span className={`grid shrink-0 place-items-center rounded-full text-sm font-semibold ${size} ${tint}`}>{initials(name)}</span>;
}
