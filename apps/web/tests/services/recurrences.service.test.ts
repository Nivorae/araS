import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    entry: {
      findFirst: vi.fn(),
    },
    recurrence: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/serialize", () => ({ d: (v: unknown) => Number(v) }));

import { prisma } from "@/lib/prisma";
import { recurrencesService } from "../../services/recurrences.service";

const USER_ID = "user_test123";

const createInput = {
  entryId: "entry_1",
  type: "expense" as const,
  amount: 100,
  category: "訂閱",
  source: "daily" as const,
  frequency: "MONTHLY" as const,
  dayOfMonth: 1,
  startDate: new Date("2026-06-01").toISOString(),
};

const fakeRow = {
  id: "rec_1",
  entryId: "entry_1",
  userId: USER_ID,
  type: "expense",
  amount: { toNumber: () => 100 },
  category: "訂閱",
  source: "daily",
  note: null,
  frequency: "MONTHLY",
  dayOfMonth: 1,
  dayOfWeek: null,
  monthOfYear: null,
  startDate: new Date("2026-06-01"),
  nextRunAt: new Date("2026-06-01"),
  lastRunAt: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("RecurrencesService.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when entry does not belong to user", async () => {
    vi.mocked(prisma.entry.findFirst).mockResolvedValue(null);

    const result = await recurrencesService.create(createInput, USER_ID);

    expect(result).toBeNull();
    expect(prisma.entry.findFirst).toHaveBeenCalledWith({
      where: { id: "entry_1", userId: USER_ID },
    });
    expect(prisma.recurrence.create).not.toHaveBeenCalled();
  });

  it("creates recurrence when entry belongs to user", async () => {
    vi.mocked(prisma.entry.findFirst).mockResolvedValue({ id: "entry_1" } as never);
    vi.mocked(prisma.recurrence.create).mockResolvedValue(fakeRow as never);

    const result = await recurrencesService.create(createInput, USER_ID);

    expect(result).not.toBeNull();
    expect(prisma.recurrence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID, entryId: "entry_1" }),
      })
    );
  });
});
