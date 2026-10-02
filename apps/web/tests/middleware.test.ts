import { describe, it, expect, vi } from "vitest";

// Capture the handler passed to clerkMiddleware so it can be invoked directly;
// createRouteMatcher stays real so the protected-path list is what's tested.
vi.mock("@clerk/nextjs/server", async () => {
  const actual =
    await vi.importActual<typeof import("@clerk/nextjs/server")>("@clerk/nextjs/server");
  return { ...actual, clerkMiddleware: (handler: unknown) => handler };
});

import { NextRequest } from "next/server";
import middleware from "../middleware";

type Handler = (auth: { protect: () => Promise<unknown> }, req: NextRequest) => Promise<unknown>;
const handler = middleware as unknown as Handler;

// Clerk's auth.protect() is async: it rejects with a Next.js not-found error for
// a signed-out request. clerkMiddleware only turns that into a 404 if the
// handler's own promise rejects, i.e. if the handler awaits protect().
function signedOut() {
  return { protect: vi.fn().mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404")) };
}

describe("middleware", () => {
  it.each([
    "/api/stocks/price?symbol=AAPL",
    "/api/stocks/dividend?symbol=AAPL",
    "/api/stocks/tw",
    "/api/stocks/us",
    "/api/stocks/crypto",
    "/api/exchange-rate",
    "/api/cathaylife-rates",
    "/api/quotes/AAPL",
    "/api/funds/search?q=x",
  ])("rejects a signed-out request to %s", async (path) => {
    const auth = signedOut();
    await expect(handler(auth, new NextRequest(`http://localhost${path}`))).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK"
    );
    expect(auth.protect).toHaveBeenCalledOnce();
  });

  it("does not protect routes outside the proxy list", async () => {
    const auth = signedOut();
    await expect(
      handler(auth, new NextRequest("http://localhost/api/health"))
    ).resolves.toBeUndefined();
    expect(auth.protect).not.toHaveBeenCalled();
  });
});
