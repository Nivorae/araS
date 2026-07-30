import { auth as clerkAuth, verifyToken } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Drop-in replacement for Clerk's `auth()` that also accepts sessions issued by
 * the OLD development instance during the dev -> production migration.
 *
 * Why: the shipped iOS build authenticates against the development instance and
 * has its publishable key compiled in, so it cannot be updated remotely. The
 * moment this API starts validating against the production instance, every user
 * still on the old build would get a 401 with no way to understand why — there
 * is no force-update screen in the shipped app. Users update from the App Store
 * at their own pace, and the premium promotion runs during that window.
 *
 * So for a transition period the API accepts both:
 *   1. Production tokens — the normal path, returned unchanged.
 *   2. Legacy dev tokens — verified against the old secret key, then translated
 *      to the user's NEW id via `UserIdMigration`, which mirrors the
 *      `external_id` recorded when production users were pre-seeded.
 *
 * The database has already been rewritten to production ids by
 * `scripts/clerk/remap-user-ids.ts`, so translating here is what keeps old
 * builds reading their own data.
 *
 * The fallback is inert unless `CLERK_LEGACY_SECRET_KEY` is set. Ending the
 * transition is therefore a matter of deleting that one environment variable in
 * Vercel — no deploy required — after which this behaves exactly like Clerk's
 * `auth()`. Delete this file and revert the imports once that is done.
 *
 * Only bearer tokens are translated. The web app is served fresh from Vercel and
 * picks up the new publishable key on reload, so browser sessions do not need a
 * grace period; only the compiled-in native builds do.
 */

const LEGACY_SECRET_KEY = process.env.CLERK_LEGACY_SECRET_KEY;

// Per-instance memo. Lambdas are short-lived and the map is at most a few
// hundred rows, so this avoids a database round trip on every legacy request
// without needing invalidation — the mapping is immutable once written.
const translated = new Map<string, string | null>();

async function toProductionUserId(legacyUserId: string): Promise<string | null> {
  const cached = translated.get(legacyUserId);
  if (cached !== undefined) return cached;

  const row = await prisma.userIdMigration.findUnique({
    where: { legacyUserId },
    select: { userId: true },
  });
  translated.set(legacyUserId, row?.userId ?? null);
  return row?.userId ?? null;
}

export async function auth(): Promise<{ userId: string | null }> {
  // The production instance is always tried first, so the common path costs
  // nothing extra once everyone has updated.
  try {
    const { userId } = await clerkAuth();
    if (userId) return { userId };
  } catch {
    // Fall through: an unverifiable token here is exactly the legacy case.
  }

  if (!LEGACY_SECRET_KEY) return { userId: null };

  const authorization = (await headers()).get("authorization");
  if (!authorization?.startsWith("Bearer ")) return { userId: null };

  try {
    const payload = await verifyToken(authorization.slice("Bearer ".length), {
      secretKey: LEGACY_SECRET_KEY,
    });
    if (!payload.sub) return { userId: null };
    return { userId: await toProductionUserId(payload.sub) };
  } catch {
    // Not a valid token for either instance.
    return { userId: null };
  }
}
