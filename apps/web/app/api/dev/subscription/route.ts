import { auth } from "@clerk/nextjs/server";
import { SubscriptionStatus } from "@prisma/client";
import { deriveAppleAccountToken } from "@repo/shared";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api-response";

const DEV_PRODUCT_ID = "dev_test_premium";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

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

    const appleAccountToken = deriveAppleAccountToken(userId);

    if (body.action === "activate") {
      await prisma.subscription.upsert({
        where: { appleAccountToken },
        create: {
          appleAccountToken,
          productId: DEV_PRODUCT_ID,
          status: SubscriptionStatus.active,
          expiresAt: new Date(Date.now() + ONE_YEAR_MS),
          originalTransactionId: `dev-${userId}`,
          environment: "Sandbox",
        },
        update: {
          productId: DEV_PRODUCT_ID,
          status: SubscriptionStatus.active,
          expiresAt: new Date(Date.now() + ONE_YEAR_MS),
          environment: "Sandbox",
        },
      });
    } else {
      // deleteMany (not delete) — no-throw if the row never existed, matching
      // this codebase's ownership-scoped delete convention (see CLAUDE.md).
      await prisma.subscription.deleteMany({ where: { appleAccountToken } });
    }

    return ok({ isPremium: body.action === "activate" });
  } catch (e) {
    return handleError(e);
  }
}
