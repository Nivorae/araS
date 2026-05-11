import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedProxy = createRouteMatcher([
  "/api/stocks(.*)",
  "/api/exchange-rate(.*)",
  "/api/cathaylife-rates(.*)",
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedProxy(req)) auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
