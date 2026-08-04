import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { clerkClient } from "@clerk/nextjs/server";
import { revokeOAuthGrants } from "../../lib/oauth-revoke";

type ClerkClient = Awaited<ReturnType<typeof clerkClient>>;

const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

function makeClient(overrides: {
  externalAccounts?: { provider: string }[];
  tokens?: { token: string }[];
  getUserError?: Error;
  getTokenError?: Error;
}) {
  const getUser = overrides.getUserError
    ? vi.fn().mockRejectedValue(overrides.getUserError)
    : vi.fn().mockResolvedValue({ externalAccounts: overrides.externalAccounts ?? [] });

  const getUserOauthAccessToken = overrides.getTokenError
    ? vi.fn().mockRejectedValue(overrides.getTokenError)
    : vi.fn().mockResolvedValue({ data: overrides.tokens ?? [] });

  return {
    client: { users: { getUser, getUserOauthAccessToken } } as unknown as ClerkClient,
    getUser,
    getUserOauthAccessToken,
  };
}

describe("revokeOAuthGrants", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("revokes a google grant at the provider", async () => {
    const { client } = makeClient({
      externalAccounts: [{ provider: "google" }],
      tokens: [{ token: "ya29.token" }],
    });

    await revokeOAuthGrants(client, "user_1");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(GOOGLE_REVOKE_URL);
    expect(init.method).toBe("POST");
    expect(init.body).toBe("token=ya29.token");
  });

  // Clerk returns the provider prefixed on some endpoints; an unnormalised
  // comparison would silently skip revocation and reintroduce the lockout.
  it("normalises the oauth_ prefixed provider name", async () => {
    const { client } = makeClient({
      externalAccounts: [{ provider: "oauth_google" }],
      tokens: [{ token: "ya29.prefixed" }],
    });

    await revokeOAuthGrants(client, "user_1");

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0]![1].body).toBe("token=ya29.prefixed");
  });

  it("skips providers with no revoke endpoint configured", async () => {
    const { client, getUserOauthAccessToken } = makeClient({
      externalAccounts: [{ provider: "apple" }, { provider: "line" }],
    });

    await revokeOAuthGrants(client, "user_1");

    expect(getUserOauthAccessToken).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Every failure path below must resolve, not throw: account deletion is an
  // App Store requirement and cannot be blocked by a provider problem.
  it("does not throw when the provider returns an error status", async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 503 });
    const { client } = makeClient({
      externalAccounts: [{ provider: "google" }],
      tokens: [{ token: "ya29.token" }],
    });

    await expect(revokeOAuthGrants(client, "user_1")).resolves.toBeUndefined();
  });

  it("does not throw when the revoke request itself rejects", async () => {
    fetchSpy.mockRejectedValue(new Error("network down"));
    const { client } = makeClient({
      externalAccounts: [{ provider: "google" }],
      tokens: [{ token: "ya29.token" }],
    });

    await expect(revokeOAuthGrants(client, "user_1")).resolves.toBeUndefined();
  });

  it("does not throw when the token lookup fails", async () => {
    const { client } = makeClient({
      externalAccounts: [{ provider: "google" }],
      getTokenError: new Error("clerk 500"),
    });

    await expect(revokeOAuthGrants(client, "user_1")).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not throw when the user lookup fails", async () => {
    const { client } = makeClient({ getUserError: new Error("user not found") });

    await expect(revokeOAuthGrants(client, "user_1")).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("handles a user with no external accounts", async () => {
    const { client, getUserOauthAccessToken } = makeClient({ externalAccounts: [] });

    await revokeOAuthGrants(client, "user_1");

    expect(getUserOauthAccessToken).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
