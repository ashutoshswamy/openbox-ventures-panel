import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Clerk-hosted profile photos
  images: { remotePatterns: [{ protocol: "https", hostname: "img.clerk.com" }] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" }, // no clickjacking
          // Content-Security-Policy: per-request nonce, set in proxy.ts
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // geolocation only for this site (office check-in); camera/mic not used here (calls open on Jitsi)
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
        ],
      },
      // behind login: keep out of search (covers files + CSV too). /sign-in is the one indexable page.
      { source: "/:path((?!sign-in(?:/|$)|robots\\.txt$|sitemap\\.xml$).*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
