import Image from "next/image";

// Company logo (public/logo.png, black square) as a rounded tile; ring is a fixed colour so the logo looks identical in light and dark.
export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Open Box Ventures LLP"
      width={size}
      height={size}
      priority
      className={`shrink-0 rounded-lg ring-1 ring-zinc-500/30 ${className}`}
    />
  );
}
