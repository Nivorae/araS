import { describe, it, expect, vi, beforeEach } from "vitest";
import { deriveAppleAccountToken } from "@repo/shared";

const Purchases = vi.hoisted(() => ({
  configure: vi.fn(),
  logIn: vi.fn(),
  getAppUserID: vi.fn(),
}));
// Mocked by the mobile app's own install path: a bare "react-native" here would
// resolve from apps/web and miss the module apps/mobile actually imports.
vi.mock("../../../mobile/node_modules/react-native-purchases", () => ({ default: Purchases }));
vi.mock("../../../mobile/node_modules/react-native", () => ({
  Platform: { select: (o: { ios: unknown }) => o.ios },
}));
vi.mock("../../../mobile/node_modules/expo-constants", () => ({
  default: { executionEnvironment: "standalone" },
}));

const A = deriveAppleAccountToken("user_a");
const B = deriveAppleAccountToken("user_b");

// Module state (configured / current identity) must start fresh per test.
async function load() {
  vi.resetModules();
  vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", "appl_test");
  return import("../../../mobile/lib/purchases");
}

// RevenueCat's appUserID becomes the StoreKit appAccountToken, which is what
// the webhook attributes a purchase to. If it still names the previous account
// after a sign-out/sign-in on the same device, the new account's purchase is
// credited to the old one.
describe("purchases identity", () => {
  let appUserID: string;

  beforeEach(() => {
    vi.clearAllMocks();
    Purchases.configure.mockImplementation(({ appUserID: id }: { appUserID: string }) => {
      appUserID = id;
    });
    Purchases.logIn.mockImplementation(async (id: string) => {
      appUserID = id;
      return {};
    });
    Purchases.getAppUserID.mockImplementation(async () => appUserID);
  });

  it("configures RevenueCat with the first account's token", async () => {
    const { configurePurchases } = await load();

    configurePurchases("user_a");

    expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: "appl_test", appUserID: A });
  });

  it("logs RevenueCat in as the new account when the account changes", async () => {
    const { configurePurchases, ensurePurchasesUser } = await load();

    configurePurchases("user_a");
    configurePurchases("user_b");

    expect(await ensurePurchasesUser("user_b")).toBe(true);
    expect(Purchases.logIn).toHaveBeenCalledWith(B);
    expect(appUserID).toBe(B);
  });

  it("does not log in again for the same account", async () => {
    const { configurePurchases, ensurePurchasesUser } = await load();

    configurePurchases("user_a");
    configurePurchases("user_a");

    expect(await ensurePurchasesUser("user_a")).toBe(true);
    expect(Purchases.logIn).not.toHaveBeenCalled();
  });

  it("reports a mismatch when switching fails, so the purchase can be blocked", async () => {
    const { configurePurchases, ensurePurchasesUser } = await load();
    Purchases.logIn.mockRejectedValue(new Error("network"));

    configurePurchases("user_a");
    configurePurchases("user_b");

    expect(await ensurePurchasesUser("user_b")).toBe(false);
    expect(appUserID).toBe(A);
  });
});
