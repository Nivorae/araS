import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedProxy = createRouteMatcher([
  "/api/stocks(.*)",
  "/api/exchange-rate(.*)",
  "/api/cathaylife-rates(.*)",
  "/api/quotes(.*)",
  "/api/funds(.*)",
]);

// auth.protect() is async — it must be awaited, or its rejection escapes
// clerkMiddleware and the signed-out request is let through.
export default clerkMiddleware(async (auth, req) => {
  if (isProtectedProxy(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
