import type { MetadataRoute } from "next";

// Installable on phones ("Add to Home Screen").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpenBox Ventures Portal",
    short_name: "OpenBox",
    description: "Attendance, leave, chat and meetings for the OpenBox Ventures LLP team.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#18181b",
    icons: [
      { src: "/icon.png", sizes: "256x256", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/logo.png", sizes: "1254x1254", type: "image/png", purpose: "any" },
    ],
  };
}
