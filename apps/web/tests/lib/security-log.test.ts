import { describe, it, expect, vi } from "vitest";
import { logSecurityEvent } from "../../lib/security-log";

describe("logSecurityEvent", () => {
  it("outputs valid JSON with type and timestamp", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logSecurityEvent({ type: "auth_fail", resource: "/api/loans" });
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(parsed.type).toBe("auth_fail");
    expect(parsed.resource).toBe("/api/loans");
    expect(typeof parsed.ts).toBe("string");
    expect(new Date(parsed.ts).getTime()).toBeGreaterThan(0);
    spy.mockRestore();
  });

  it("omits undefined optional fields from JSON output", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logSecurityEvent({ type: "ownership_violation", userId: "user_abc" });
    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(parsed.userId).toBe("user_abc");
    expect("resource" in parsed).toBe(false);
    expect("details" in parsed).toBe(false);
    spy.mockRestore();
  });
});
