import { auth } from "@clerk/nextjs/server";
import { subscriptionService } from "@/services/subscription.service";
import { ok, err, handleError } from "@/lib/api-response";

// Dev-only escape hatch: lets a developer flip their OWN Subscription row
// without a real Apple purchase, so premium-gated behavior (paywall, the
// 20-entry free cap, insurance restrictions) can be exercised end-to-end from
// Expo Go, where apps/mobile/lib/purchases.ts no-ops (no real IAP possible).
// The NODE_ENV check below is the only thing that matters for safety — it
// must run before anything else, so this route 404s (doesn't exist) once
// deployed to Vercel production, regardless of what any client sends.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return err("NOT_FOUND", "Not found", 404);
  }

  try {
    const { userId } = await auth();
    if (!userId) {
      return err("UNAUTHORIZED", "Unauthorized", 401);
    }

    const body = (await req.json().catch(() => null)) as { action?: string } | null;
    if (body?.action !== "activate" && body?.action !== "deactivate") {
      return err("VALIDATION_ERROR", "action must be 'activate' or 'deactivate'", 400);
    }

    await subscriptionService.setDevStatus(userId, body.action === "activate");

    return ok({ isPremium: body.action === "activate" });
  } catch (e) {
    return handleError(e);
  }
}
