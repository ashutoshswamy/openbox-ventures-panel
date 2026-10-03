import { clerkMiddleware } from "@clerk/nextjs/server";

// Session only. Access checks live where data is read: getMe()/require*() in layouts,
// server actions and route handlers; RLS in the DB.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
