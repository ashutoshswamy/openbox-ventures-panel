import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { SHARE, SITE_URL } from "@/lib/util";
import { AuthFrame, authAppearance } from "@/components/auth-frame";
import { HomeChoice } from "@/components/home-choice";

const title = "Open Box Ventures LLP Panel";
const description = "Attendance, leave, payroll, HR, team chat and video meetings for Open Box Ventures LLP. Sign in on the web, or download the desktop app.";

// The one indexable page: what people find when they search for the panel.
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
  publisher: { "@type": "Organization", name: "Open Box Ventures LLP", logo: `${SITE_URL}/logo.png` },
}).replaceAll("<", "\\u003c");

export default function Page() {
  return (
    <AuthFrame title="Open the panel" hint="Continue in your browser, or download the desktop app.">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <HomeChoice signIn={<SignIn appearance={authAppearance} />} />
    </AuthFrame>
  );
}
