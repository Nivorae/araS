import { describe, it, expect, vi } from "vitest";
import { createAccountChangeTracker } from "../../../mobile/lib/accountChange";

// The finance store and fetch caches are module-level and outlive sign-out, so
// the next account to sign in on the same device would first render the
// previous account's data. The tracker clears them whenever the account changes.
describe("createAccountChangeTracker", () => {
  it("does not clear on the first observed account", () => {
    const clear = vi.fn();
    const track = createAccountChangeTracker(clear);

    track("user_a");

    expect(clear).not.toHaveBeenCalled();
  });

  it("does not clear while the same account stays signed in", () => {
    const clear = vi.fn();
    const track = createAccountChangeTracker(clear);

    track("user_a");
    track("user_a");

    expect(clear).not.toHaveBeenCalled();
  });

  it("clears on sign-out", () => {
    const clear = vi.fn();
    const track = createAccountChangeTracker(clear);

    track("user_a");
    track(null);

    expect(clear).toHaveBeenCalledOnce();
  });

  // Cleared again on sign-in so a request from the old account that resolved
  // while signed out can't leave its data behind for the new one.
  it("clears again when a different account signs in", () => {
    const clear = vi.fn();
    const track = createAccountChangeTracker(clear);

    track("user_a");
    track(null);
    track("user_b");

    expect(clear).toHaveBeenCalledTimes(2);
  });

  it("clears on a direct switch between accounts", () => {
    const clear = vi.fn();
    const track = createAccountChangeTracker(clear);

    track("user_a");
    track("user_b");

    expect(clear).toHaveBeenCalledOnce();
  });
});
