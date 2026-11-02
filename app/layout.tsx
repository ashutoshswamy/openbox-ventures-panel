import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { DM_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SHARE, SITE_URL } from "@/lib/util";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  axes: ["opsz"],
});

const description = "Attendance, leave, payroll, HR, chat and meetings for the Open Box Ventures LLP team.";

// Default: noindex (everything is behind login). /sign-in opts back in. Share image: public/og-image.jpg (SHARE in lib/util.ts).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Open Box Ventures LLP Panel", template: "%s | Open Box Ventures LLP" },
  description,
  applicationName: "Open Box Ventures LLP Panel",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: { ...SHARE.openGraph, title: "Open Box Ventures LLP Panel", description },
  twitter: { ...SHARE.twitter, title: "Open Box Ventures LLP Panel", description },
  formatDetection: { telephone: false, email: false, address: false },
  // icons + manifest live in public/ (site.webmanifest = installable on phones)
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
};

// Runs before first paint: saved choice, else OS setting. Avoids a flash of the wrong theme.
// Site-wide: the 2nd click of a double-click on anything clickable is dropped (no double submits / double calls / toggling twice).
// ponytail: e.detail = click count; keyboard activations have detail 0 so they always pass.
const noDoubleClick = `addEventListener("click",function(e){if(e.detail>1&&e.target.closest&&e.target.closest("button,a,summary,label,[role=button],input[type=submit],input[type=checkbox],input[type=radio]")){e.preventDefault();e.stopPropagation()}},true);`;
const themeScript = noDoubleClick + `try{var t=localStorage.getItem("theme");document.documentElement.dataset.theme=t==="light"||t==="dark"?t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined; // CSP nonce from proxy.ts
  return (
    <html
      lang="en-IN"
      className={`${dmSans.variable} h-full antialiased`}
      suppressHydrationWarning // data-theme is set by themeScript before React hydrates
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          dynamic // Clerk's scripts get the CSP nonce
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
