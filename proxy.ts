import { clerkMiddleware } from "@clerk/nextjs/server";

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Session only. Access checks live where data is read: getMe()/require*() in layouts,
// server actions and route handlers; RLS in the DB.
// Strict CSP: per-request nonce on every script (Next + Clerk pick it up from the header), no inline/foreign scripts.
export default clerkMiddleware({
  contentSecurityPolicy: {
    strict: true,
    directives: {
      "connect-src": [supabase, supabase.replace(/^http/, "ws")], // REST, uploads, realtime
      "img-src": ["data:", "blob:", supabase], // attachments: /files redirects to signed storage URLs
      "media-src": ["self", "blob:", supabase],
      "frame-ancestors": ["none"], // no clickjacking
      "object-src": ["none"],
      "base-uri": ["self"],
      "upgrade-insecure-requests": [],
    },
  },
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
