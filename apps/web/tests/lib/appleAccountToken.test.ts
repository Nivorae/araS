import { describe, it, expect } from "vitest";
import { deriveAppleAccountToken } from "@repo/shared";

describe("deriveAppleAccountToken", () => {
  it("is deterministic for the same userId", () => {
    const a = deriveAppleAccountToken("user_2abc123");
    const b = deriveAppleAccountToken("user_2abc123");
    expect(a).toBe(b);
  });

  it("differs across userIds", () => {
    const a = deriveAppleAccountToken("user_2abc123");
    const b = deriveAppleAccountToken("user_2xyz789");
    expect(a).not.toBe(b);
  });

  it("produces a valid UUID", () => {
    const token = deriveAppleAccountToken("user_2abc123");
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
