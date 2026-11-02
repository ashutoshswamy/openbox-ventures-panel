import Image from "next/image";
import { initials } from "@/lib/util";
import { StatusDot } from "./status-dot";

// Profile photo (Clerk) when set, else deterministic tinted initials.
const tints = ["bg-primary-soft text-primary", "bg-blue-soft text-blue", "bg-amber-soft text-amber", "bg-green-soft text-green", "bg-red-soft text-red"];

export const tintFor = (name: string) => tints[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % tints.length];

export function Avatar({ name, src, size = "size-10", userId }: { name: string; src?: string | null; size?: string; userId?: string | null }) {
  const face = <Face name={name} src={src} size={size} />;
  // userId → live presence dot in the corner
  return userId ? <span className={`relative inline-block shrink-0 align-middle ${size.split(" ")[0]}`}>{face}<StatusDot id={userId} /></span> : face;
}

function Face({ name, src, size }: { name: string; src?: string | null; size: string }) {
  if (src)
    return (
      <span className={`relative block shrink-0 overflow-hidden rounded-full bg-surface-2 ${size}`}>
        <Image src={src} alt={name} fill sizes="96px" className="object-cover" />
      </span>
    );
  const tint = tintFor(name);
  return <span className={`grid shrink-0 place-items-center rounded-full text-sm font-semibold ${size} ${tint}`}>{initials(name)}</span>;
}
