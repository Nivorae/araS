import type { clerkClient } from "@clerk/nextjs/server";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

// Derived from the factory rather than imported from `@clerk/backend`, which is
// only a transitive dependency and so is not resolvable under pnpm's strict
// layout. This is also exactly the object the route hands us.
type ClerkClient = Awaited<ReturnType<typeof clerkClient>>;

const REVOKE_TIMEOUT_MS = 4000;

/**
 * Providers whose grant can be revoked with nothing but the user's own access
 * token.
 *
 * `line` and `apple` are absent deliberately, not by oversight: LINE's revoke
 * endpoint requires the channel's client_id/client_secret and Apple's requires
 * a signed client-secret JWT, and neither credential is configured here. Apple
 * is also unaffected in practice — its native flow never opens a browser, so it
 * cannot hit the interstitial this module exists to prevent.
 */
const REVOKE_ENDPOINTS: Record<string, (token: string) => Promise<Response>> = {
  google: (token) =>
    fetchWithTimeout(
      "https://oauth2.googleapis.com/revoke",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }).toString(),
      },
      REVOKE_TIMEOUT_MS
    ),
};

// Clerk returns the provider either bare (`google`) or prefixed (`oauth_google`)
// depending on the endpoint and SDK version. Normalise before matching.
function normalizeProvider(provider: string): string {
  return provider.replace(/^oauth_/, "");
}

function logRevoke(userId: string, provider: string, ok: boolean, detail?: string) {
  console.warn(
    JSON.stringify({
      type: "oauth_revoke",
      userId,
      provider,
      ok,
      ...(detail ? { detail } : {}),
      ts: new Date().toISOString(),
    })
  );
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function revokeProvider(
  client: ClerkClient,
  userId: string,
  provider: string
): Promise<void> {
  try {
    // Cast: Clerk types this as a closed OAuthProvider union, but the value here
    // comes from the user's own external accounts, so it is a provider Clerk
    // itself issued.
    const res = await client.users.getUserOauthAccessToken(
      userId,
      provider as Parameters<ClerkClient["users"]["getUserOauthAccessToken"]>[1]
    );
    const tokens = res.data ?? [];
    if (tokens.length === 0) {
      logRevoke(userId, provider, false, "no access token");
      return;
    }

    for (const { token } of tokens) {
      const response = await REVOKE_ENDPOINTS[provider]!(token);
      // 400 is the provider saying the token is already dead — the grant is gone
      // either way, which is the outcome we wanted.
      const ok = response.ok || response.status === 400;
      logRevoke(userId, provider, ok, ok ? undefined : `HTTP ${response.status}`);
    }
  } catch (e) {
    logRevoke(userId, provider, false, describe(e));
  }
}

/**
 * Revokes a user's OAuth grants at the provider, before their Clerk account is
 * deleted.
 *
 * Load-bearing rather than housekeeping. Deleting the Clerk user drops our side
 * of the relationship but leaves the provider-side grant standing. On the next
 * sign-in Google then skips first-time consent and takes a re-authorization
 * path whose URL pattern Safari's Safe Browsing flags as deceptive — the user
 * gets a full-page "Deceptive Website Warning" and cannot sign in again at all.
 * Revoking returns the account to a genuinely never-authorized state, so the
 * next sign-in is a clean first-time consent.
 *
 * Confirmed on a real device 2026-08-04: two separate Google accounts were
 * locked out this way after deletion, and manually removing the grant at
 * myaccount.google.com/permissions restored sign-in for both. Apple sign-in was
 * never affected, matching the native-vs-browser split above.
 *
 * MUST run before `users.deleteUser` — once the Clerk user is gone their OAuth
 * tokens are no longer retrievable.
 *
 * Best-effort by design: account deletion is an App Store requirement
 * (Guideline 5.1.1(v)) and must not fail because a provider is down or a token
 * has already expired.
 */
export async function revokeOAuthGrants(client: ClerkClient, userId: string): Promise<void> {
  let providers: string[];
  try {
    const user = await client.users.getUser(userId);
    providers = [
      ...new Set(user.externalAccounts.map((account) => normalizeProvider(account.provider))),
    ];
  } catch (e) {
    logRevoke(userId, "unknown", false, `lookup failed: ${describe(e)}`);
    return;
  }

  await Promise.all(
    providers
      .filter((provider) => provider in REVOKE_ENDPOINTS)
      .map((provider) => revokeProvider(client, userId, provider))
  );
}
