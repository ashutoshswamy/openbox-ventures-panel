import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/util";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/sign-in`, changeFrequency: "yearly", priority: 1 }];
}
