import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SHARE, SITE_URL } from "@/lib/util";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  axes: ["opsz"],
});

const description = "Attendance, leave, chat and meetings for the OpenBox Ventures LLP team.";

// Default: noindex (everything is behind login). /sign-in opts back in. Share image: public/og-image.jpg (SHARE in lib/util.ts).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "OpenBox Ventures Portal", template: "%s | OpenBox Ventures" },
  description,
  applicationName: "OpenBox Ventures Portal",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: { ...SHARE.openGraph, title: "OpenBox Ventures Portal", description },
  twitter: { ...SHARE.twitter, title: "OpenBox Ventures Portal", description },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
};

// Runs before first paint: saved choice, else OS setting. Avoids a flash of the wrong theme.
const themeScript = `try{var t=localStorage.getItem("theme");document.documentElement.dataset.theme=t==="light"||t==="dark"?t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${dmSans.variable} h-full antialiased`}
      suppressHydrationWarning // data-theme is set by themeScript before React hydrates
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "var(--primary)",
              colorPrimaryForeground: "var(--primary-fg)",
              colorBackground: "var(--surface)",
              colorForeground: "var(--text)",
              colorMutedForeground: "var(--muted)",
              colorInput: "var(--surface)",
              colorInputForeground: "var(--text)",
              colorNeutral: "var(--text)",
              fontFamily: "var(--font-dm-sans)",
              borderRadius: "0.5rem",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
