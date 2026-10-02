import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CreateRecurrenceSchema, UpdateRecurrenceSchema } from "../src";

const base = {
  entryId: "e1",
  type: "expense",
  amount: 1,
  category: "訂閱",
  frequency: "WEEKLY",
};

// process() back-fills every missed run since startDate, so an unbounded past
// startDate lets one request generate hundreds of rows. Back-dating is capped
// at a year (≈53 weekly runs at most).
describe("recurrence startDate window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T00:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("accepts a start date within the last year", () => {
    const r = CreateRecurrenceSchema.safeParse({ ...base, startDate: "2025-10-10T00:00:00.000Z" });
    expect(r.success).toBe(true);
  });

  it("rejects a start date more than a year ago", () => {
    const r = CreateRecurrenceSchema.safeParse({ ...base, startDate: "2025-09-01T00:00:00.000Z" });
    expect(r.success).toBe(false);
  });

  it("rejects a start date that is not a date", () => {
    expect(CreateRecurrenceSchema.safeParse({ ...base, startDate: "soon" }).success).toBe(false);
  });

  // The edit form re-sends the original startDate; the service applies the
  // window only when it changes, so the schema must not reject old dates.
  it("leaves the window to the service on update but still checks the format", () => {
    expect(UpdateRecurrenceSchema.safeParse({ startDate: "2024-01-01" }).success).toBe(true);
    expect(UpdateRecurrenceSchema.safeParse({ startDate: "soon" }).success).toBe(false);
  });
});
