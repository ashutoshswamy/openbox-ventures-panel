import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/util";

// Only the sign-in page is public; everything else is behind login and stays out of search.
// Static assets stay crawlable so search engines can render the sign-in page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/sign-in", "/_next/static/", "/logo.png", "/og-image.png", "/favicon", "/apple-touch-icon.png", "/android-chrome-", "/site.webmanifest"], disallow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
