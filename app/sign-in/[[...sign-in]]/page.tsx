import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { SHARE, SITE_URL } from "@/lib/util";
import { AuthFrame } from "@/components/auth-frame";

const title = "Sign in to the OpenBox Ventures Portal";
const description = "Sign in to the OpenBox Ventures LLP employee portal for attendance, leave, team chat and video meetings.";

// The one indexable page: what people find when they search for the portal.
export const metadata: Metadata = {
  title: { absolute: title },
  description,
  robots: { index: true, follow: false },
  alternates: { canonical: "/sign-in" },
  openGraph: { ...SHARE.openGraph, url: "/sign-in", title, description },
  twitter: { ...SHARE.twitter, title, description },
};

// JSON-LD; static data, `<` escaped so it can't close the script tag.
const jsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: title,
  description,
  url: `${SITE_URL}/sign-in`,
  publisher: { "@type": "Organization", name: "OpenBox Ventures LLP", logo: `${SITE_URL}/logo.png` },
}).replaceAll("<", "\\u003c");

export default function Page() {
  return (
    <AuthFrame>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SignIn />
    </AuthFrame>
  );
}
