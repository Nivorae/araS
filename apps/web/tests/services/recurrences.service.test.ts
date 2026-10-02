import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// $transaction hands its callback the same mocked client, so tx.* calls are
// asserted through prisma.*.
vi.mock("@/lib/prisma", () => {
  const prisma = {
    entry: {
      findFirst: vi.fn(),
    },
    recurrence: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    transaction: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return { prisma };
});

vi.mock("@/lib/serialize", () => ({ d: (v: unknown) => Number(v) }));

import { prisma } from "@/lib/prisma";
import {
  recurrencesService,
  RecurrenceLimitError,
  RecurrenceBackdateError,
  MAX_RECURRENCES_PER_USER,
} from "../../services/recurrences.service";

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

describe("RecurrencesService.create limits", () => {
  beforeEach(() => vi.clearAllMocks());

  // Each recurrence multiplies the rows process() writes, so the count is capped.
  it("throws RecurrenceLimitError at the per-user cap", async () => {
    vi.mocked(prisma.entry.findFirst).mockResolvedValue({ id: "entry_1" } as never);
    vi.mocked(prisma.recurrence.count).mockResolvedValue(MAX_RECURRENCES_PER_USER);

    await expect(recurrencesService.create(createInput, USER_ID)).rejects.toBeInstanceOf(
      RecurrenceLimitError
    );
    expect(prisma.recurrence.create).not.toHaveBeenCalled();
  });
});

describe("RecurrencesService.process", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T00:00:00.000Z"));
    vi.mocked(prisma.recurrence.findMany).mockResolvedValue([
      { ...fakeRow, nextRunAt: new Date("2026-06-01") },
    ] as never);
  });
  afterEach(() => vi.useRealTimers());

  it("writes every missed run once it has claimed the recurrence", async () => {
    vi.mocked(prisma.recurrence.updateMany).mockResolvedValue({ count: 1 });

    const created = await recurrencesService.process(USER_ID);

    // Jun 1, Jul 1, Aug 1
    expect(created).toBe(3);
    expect(prisma.recurrence.updateMany).toHaveBeenCalledWith({
      where: { id: "rec_1", userId: USER_ID, nextRunAt: new Date("2026-06-01") },
      data: expect.objectContaining({ lastRunAt: expect.any(Date) }),
    });
    const rows = vi.mocked(prisma.transaction.createMany).mock.calls[0]![0]!.data as unknown[];
    expect(rows).toHaveLength(3);
  });

  // A concurrent process() call already advanced nextRunAt, so this one's
  // conditional claim matches nothing and must not insert duplicates.
  it("writes nothing when another call already claimed the runs", async () => {
    vi.mocked(prisma.recurrence.updateMany).mockResolvedValue({ count: 0 });

    const created = await recurrencesService.process(USER_ID);

    expect(created).toBe(0);
    expect(prisma.transaction.createMany).not.toHaveBeenCalled();
  });
});

describe("RecurrencesService.update startDate window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T00:00:00.000Z"));
    vi.mocked(prisma.recurrence.findFirst).mockResolvedValue({
      ...fakeRow,
      startDate: new Date("2024-03-01"),
    } as never);
    vi.mocked(prisma.recurrence.update).mockResolvedValue(fakeRow as never);
  });
  afterEach(() => vi.useRealTimers());

  // The web edit form re-sends the original startDate; an old recurrence must
  // stay editable.
  it("allows an unchanged startDate older than the window", async () => {
    await expect(
      recurrencesService.update("rec_1", { amount: 200, startDate: "2024-03-01" }, USER_ID)
    ).resolves.not.toBeNull();
  });

  it("rejects moving startDate further back than the window", async () => {
    await expect(
      recurrencesService.update("rec_1", { startDate: "2024-01-01" }, USER_ID)
    ).rejects.toBeInstanceOf(RecurrenceBackdateError);
    expect(prisma.recurrence.update).not.toHaveBeenCalled();
  });
});
