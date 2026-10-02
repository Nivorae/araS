import { describe, it, expect, vi, beforeEach } from "vitest";

const store = vi.hoisted(() => new Map<string, string>());
vi.mock("../../../mobile/node_modules/@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void store.set(k, v)),
    removeItem: vi.fn(async (k: string) => void store.delete(k)),
  },
}));

import { getAccountItem, setAccountItem } from "../../../mobile/lib/accountStorage";

// Retirement inputs, salary and recent stock picks were stored under one
// device-wide key, so the next account signed in on the phone saw them.
describe("account-scoped storage", () => {
  beforeEach(() => store.clear());

  it("keeps each account's value separate", async () => {
    await setAccountItem("retirementParams", "user_a", "A");
    await setAccountItem("retirementParams", "user_b", "B");

    expect(await getAccountItem("retirementParams", "user_a")).toBe("A");
    expect(await getAccountItem("retirementParams", "user_b")).toBe("B");
  });

  // Upgrading must not wipe what a user already saved: the first account to
  // read adopts the old device-wide value, and the old key is removed so a
  // later account can't read it too.
  it("moves a legacy device-wide value to the first account that reads it", async () => {
    store.set("retirementParams", "legacy");

    expect(await getAccountItem("retirementParams", "user_a")).toBe("legacy");
    expect(store.has("retirementParams")).toBe(false);
    expect(await getAccountItem("retirementParams", "user_b")).toBeNull();
  });

  it("prefers the account's own value over a legacy one", async () => {
    store.set("retirementParams", "legacy");
    await setAccountItem("retirementParams", "user_a", "mine");

    expect(await getAccountItem("retirementParams", "user_a")).toBe("mine");
  });
});
