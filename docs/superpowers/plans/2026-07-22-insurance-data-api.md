# Insurance Module — Data & API Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend foundation for the insurance module — redesigned `Insurance` model, shared constants (insurer list + per-type coverage options), Zod schemas, a premium-gated `InsuranceService` (CRUD), and REST routes — so the mobile/web UI plans can consume a stable API.

**Architecture:** Insurance mirrors `Loan` structurally (a 1:1 extension of `Entry` via `entryId @unique`). `InsuranceService.create` runs a single `$transaction` that creates the backing `Entry` (`topCategory="保險"`, `includeInChart=false`, `value=0` — insurance never counts toward net worth), its opening `EntryHistory`, and the `Insurance` row. Creation is gated on `entitlementsService.isPremium` (insurance is a Premium feature). Routes follow the existing `/api/loans` + `/api/loans/[id]` shape.

**Tech Stack:** Prisma 6 (Postgres), Zod (`@repo/shared`), Next.js 15 Route Handlers, Clerk, Vitest (service tests mock `@/lib/prisma`).

## Global Constraints

- **Insurance never counts toward net worth.** Every insurance `Entry` is created with `includeInChart=false` and `value=0`. (Insurance spec 定位 1)
- **Premium-only.** Only a premium user may create an insurance policy; the server enforces this, not just the UI. (Premium spec 決策五 / 分層總表)
- **Hard-required fields:** `insurer`, `insuredName`, `insuranceType`. Everything else is nullable and `null` means「不確定」— never a sentinel value, never a separate flag. (Insurance spec 欄位模型)
- **Seven insurance types:** `LIFE`, `MEDICAL`, `CANCER`, `ACCIDENT`, `SAVINGS_INVESTMENT`, `LONGTERM_CARE`, `OTHER`.
- **Coverage:** at most `3` items, each `{ key, label, value }`. For the six structured types, `key` must belong to that type's option list; `OTHER` allows free-form labels (any key). (Insurance spec B 區 + Zod schema)
- **Insurer** is stored as a plain string (chosen from the 34-company UI list _or_ free-typed "其他"); the company list is a UI constant, not a DB enum. (Insurance spec 保險公司清單)
- **Migration is zero-risk:** the `Insurance` table has 0 rows (verified 2026-07-22), so the model is redesigned outright.
- **Release gating:** ships in the single native release (≥ 2026-08-01). (Memory: [[project_premium_tier]])
- Conventional Commits, lowercase subject, no scope. Prisma client is regenerated with `pnpm db:generate` after schema edits; single test file via `pnpm --filter @repo/web exec vitest run <file>`.

---

### Task 1: Redesign the Insurance model + migration

**Files:**

- Modify: `apps/web/prisma/schema.prisma` (replace the `Insurance` model; add `InsuranceType` enum)

**Interfaces:**

- Produces: `Insurance` Prisma model with fields `entryId`, `insurer`, `insuredName`, `insuranceType`, `policyName?`, `policyNumber?`, `startDate?`, `paymentTermYears?`, `coveragePeriod?`, `annualPremium?`, `coverage (Json)`; `InsuranceType` enum consumed by Tasks 3–4.

- [ ] **Step 1: Replace the enum + model in schema.prisma**

Add the enum near the other enums and replace the entire existing `model Insurance { ... }` block:

```prisma
enum InsuranceType {
  LIFE
  MEDICAL
  CANCER
  ACCIDENT
  SAVINGS_INVESTMENT
  LONGTERM_CARE
  OTHER
}

model Insurance {
  id             String        @id @default(cuid())
  entryId        String        @unique
  entry          Entry         @relation(fields: [entryId], references: [id], onDelete: Cascade)

  // 核心必填
  insurer        String
  insuredName    String
  insuranceType  InsuranceType

  // 核心選填（null = 不確定）
  policyName       String?
  policyNumber     String?
  startDate        DateTime?
  paymentTermYears Int?
  coveragePeriod   String?
  annualPremium    Decimal?

  // 保障細項（最多 3）：[{ key, label, value }]
  coverage       Json          @default("[]")

  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}
```

The `Entry.insurance Insurance?` back-relation already exists in the schema — leave it.

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:migrate` (interactive name prompt) → name it `redesign_insurance`.
If running non-interactively, run: `pnpm --filter @repo/web exec prisma migrate dev --name redesign_insurance`
Expected: a new migration under `apps/web/prisma/migrations/*_redesign_insurance/` that drops the old savings-specific columns and adds the new ones; applies cleanly (0 rows to migrate).

- [ ] **Step 3: Regenerate the Prisma client**

Run: `pnpm db:generate`
Expected: success; `InsuranceType` now importable from `@prisma/client`.

- [ ] **Step 4: Type-check**

Run: `pnpm --filter @repo/web exec tsc --noEmit`
Expected: no new errors. (Any old code referencing removed `Insurance` columns would surface here — there is none, since the model had no UI.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/prisma/schema.prisma apps/web/prisma/migrations
git commit -m "feat: redesign insurance model for multiple policy types"
```

---

### Task 2: Shared constants — insurer list + coverage options

**Files:**

- Create: `packages/shared/src/constants/insurance.ts`
- Modify: `packages/shared/src/index.ts` (add export)

**Interfaces:**

- Produces: `INSURER_LIST: string[]`, `INSURANCE_TYPES` (readonly tuple), `InsuranceType` (type), `MAX_COVERAGE_ITEMS = 3`, `INSURANCE_COVERAGE_OPTIONS: Record<Exclude<InsuranceType,"OTHER">, {key,label}[]>` — consumed by the Zod schema (Task 3), the service (Task 4), and later UI plans.

- [ ] **Step 1: Create the constants file**

Create `packages/shared/src/constants/insurance.ts`:

```ts
// The 34 Taiwan insurers offered in the insurer <select>, plus a free-typed
// "其他". UI constant only — the DB stores the resolved string, never an enum,
// so adding/renaming an insurer never needs a migration. (Insurance spec)
export const INSURER_LIST: string[] = [
  "三商美邦人壽",
  "中華郵政（壽險處）",
  "中國信託產險",
  "元大人壽",
  "友邦人壽",
  "台灣人壽",
  "合作金庫人壽",
  "安聯人壽",
  "安達國際人壽",
  "安達產險",
  "宏泰人壽",
  "明台產險",
  "旺旺友聯產險",
  "法國巴黎人壽",
  "法國巴黎產險",
  "泰安產險",
  "保誠人壽",
  "南山人壽",
  "南山產險",
  "第一金人壽",
  "第一產險",
  "國泰人壽",
  "國泰世紀產險",
  "凱基人壽",
  "富邦人壽",
  "富邦產險",
  "華南產險",
  "新光人壽",
  "新光產險",
  "新安東京海上產險",
  "遠雄人壽",
  "臺銀人壽",
  "和泰產險",
  "全球人壽",
];

export const INSURANCE_TYPES = [
  "LIFE",
  "MEDICAL",
  "CANCER",
  "ACCIDENT",
  "SAVINGS_INVESTMENT",
  "LONGTERM_CARE",
  "OTHER",
] as const;
export type InsuranceType = (typeof INSURANCE_TYPES)[number];

// Human labels for the type <select>.
export const INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
  LIFE: "壽險",
  MEDICAL: "醫療險",
  CANCER: "癌症險",
  ACCIDENT: "意外險",
  SAVINGS_INVESTMENT: "儲蓄/投資型",
  LONGTERM_CARE: "長照/失能",
  OTHER: "其他",
};

export const MAX_COVERAGE_ITEMS = 3;

export interface CoverageOption {
  key: string;
  label: string;
}

// Per-type coverage picklists (user selects up to MAX_COVERAGE_ITEMS). OTHER is
// intentionally absent — it has no predefined list and takes free-form labels.
export const INSURANCE_COVERAGE_OPTIONS: Record<
  Exclude<InsuranceType, "OTHER">,
  CoverageOption[]
> = {
  LIFE: [
    { key: "death_disability", label: "身故/全殘保額" },
    { key: "total_disability", label: "完全失能保險金" },
    { key: "maturity", label: "祝壽保險金" },
    { key: "premium_waiver", label: "豁免保費" },
  ],
  MEDICAL: [
    { key: "hospital_daily", label: "住院日額" },
    { key: "reimbursement_cap", label: "實支實付上限" },
    { key: "surgery_cap", label: "手術費用限額" },
    { key: "outpatient_surgery", label: "門診手術金" },
    { key: "icu_daily", label: "加護病房日額" },
    { key: "recovery", label: "出院療養金" },
  ],
  CANCER: [
    { key: "first_diagnosis", label: "初次罹癌保險金" },
    { key: "cancer_hospital_daily", label: "癌症住院日額" },
    { key: "chemo_radio", label: "化療/放療給付" },
    { key: "cancer_surgery", label: "癌症手術保險金" },
    { key: "cancer_death", label: "癌症身故保險金" },
  ],
  ACCIDENT: [
    { key: "accident_death_disability", label: "意外身故/失能保額" },
    { key: "accident_reimbursement_cap", label: "意外實支實付上限" },
    { key: "accident_hospital_daily", label: "意外住院日額" },
    { key: "fracture", label: "骨折未住院給付" },
    { key: "major_burn", label: "重大燒燙傷保險金" },
  ],
  SAVINGS_INVESTMENT: [
    { key: "sum_insured", label: "保額" },
    { key: "declared_rate", label: "宣告利率" },
    { key: "cash_value", label: "目前保價金" },
    { key: "surrender_value", label: "解約金" },
    { key: "accumulated_bonus", label: "累積增值回饋金" },
  ],
  LONGTERM_CARE: [
    { key: "monthly_benefit", label: "每月給付金" },
    { key: "lump_sum", label: "一次性給付金" },
    { key: "disability_support", label: "失能扶助金" },
    { key: "premium_waiver", label: "豁免保費" },
    { key: "death_premium_refund", label: "身故退還保費" },
  ],
};
```

Add to `packages/shared/src/index.ts`:

```ts
export * from "./constants/insurance";
```

- [ ] **Step 2: Type-check the shared package**

Run: `pnpm --filter @repo/shared exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/constants/insurance.ts packages/shared/src/index.ts
git commit -m "feat: add insurer list and coverage option constants"
```

---

### Task 3: Zod schemas for insurance

**Files:**

- Modify: `packages/shared/src/schemas/finance.ts` (append insurance schemas)
- Test: `packages/shared/tests/insuranceSchema.test.ts` (create)

**Interfaces:**

- Consumes: `INSURANCE_TYPES`, `INSURANCE_COVERAGE_OPTIONS`, `MAX_COVERAGE_ITEMS` (Task 2).
- Produces: `CreateInsuranceSchema` / `CreateInsurance`, `UpdateInsuranceSchema` / `UpdateInsurance`, `CoverageItemSchema`, `InsuranceTypeSchema` — consumed by the service (Task 4) and routes (Task 5).

- [ ] **Step 1: Write the failing test**

First confirm the shared test dir/config: check for an existing `packages/shared/tests` or `*.test.ts` next to sources and mirror it. If none exists, create `packages/shared/tests/insuranceSchema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CreateInsuranceSchema } from "../src/schemas/finance";

const BASE = { insurer: "國泰人壽", insuredName: "本人", insuranceType: "MEDICAL" as const };

describe("CreateInsuranceSchema", () => {
  it("accepts the three required fields alone (everything else optional)", () => {
    expect(CreateInsuranceSchema.safeParse(BASE).success).toBe(true);
  });

  it("rejects a missing insurer", () => {
    const { insurer, ...rest } = BASE;
    expect(CreateInsuranceSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an unknown insurance type", () => {
    expect(CreateInsuranceSchema.safeParse({ ...BASE, insuranceType: "PET" }).success).toBe(false);
  });

  it("accepts up to 3 coverage items with valid keys for the type", () => {
    const r = CreateInsuranceSchema.safeParse({
      ...BASE,
      coverage: [
        { key: "hospital_daily", label: "住院日額", value: 2000 },
        { key: "reimbursement_cap", label: "實支實付上限", value: 100000 },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects more than 3 coverage items", () => {
    const item = { key: "hospital_daily", label: "住院日額", value: 1 };
    expect(
      CreateInsuranceSchema.safeParse({ ...BASE, coverage: [item, item, item, item] }).success
    ).toBe(false);
  });

  it("rejects a coverage key not in the type's option list", () => {
    const r = CreateInsuranceSchema.safeParse({
      ...BASE,
      coverage: [{ key: "declared_rate", label: "宣告利率", value: 2 }], // SAVINGS key on MEDICAL
    });
    expect(r.success).toBe(false);
  });

  it("allows any coverage key when type is OTHER (free-form)", () => {
    const r = CreateInsuranceSchema.safeParse({
      insurer: "全球人壽",
      insuredName: "本人",
      insuranceType: "OTHER",
      coverage: [{ key: "custom_1", label: "海外突發疾病", value: 500000 }],
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/shared exec vitest run tests/insuranceSchema.test.ts`
Expected: FAIL — `CreateInsuranceSchema` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Append to `packages/shared/src/schemas/finance.ts`:

```ts
// Insurance
import {
  INSURANCE_TYPES,
  INSURANCE_COVERAGE_OPTIONS,
  MAX_COVERAGE_ITEMS,
  type InsuranceType,
} from "../constants/insurance";

export const InsuranceTypeSchema = z.enum(INSURANCE_TYPES);

export const CoverageItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
});
export type CoverageItem = z.infer<typeof CoverageItemSchema>;

const coverageArray = z
  .array(CoverageItemSchema)
  .max(MAX_COVERAGE_ITEMS, `最多 ${MAX_COVERAGE_ITEMS} 項保障`)
  .optional();

// Cross-field rule: for the six structured types, every coverage key must be a
// known option for that type. OTHER is free-form (any key allowed).
function validCoverageKeys(type: InsuranceType, coverage: CoverageItem[] | undefined): boolean {
  if (!coverage || coverage.length === 0 || type === "OTHER") return true;
  const allowed = new Set(INSURANCE_COVERAGE_OPTIONS[type].map((o) => o.key));
  return coverage.every((c) => allowed.has(c.key));
}

export const CreateInsuranceSchema = z
  .object({
    insurer: z.string().min(1, "保險公司為必填"),
    insuredName: z.string().min(1, "被保人為必填"),
    insuranceType: InsuranceTypeSchema,
    policyName: z.string().optional(),
    policyNumber: z.string().optional(),
    startDate: z.string().optional(),
    paymentTermYears: z.number().int().positive().optional(),
    coveragePeriod: z.string().optional(),
    annualPremium: z.number().nonnegative().optional(),
    coverage: coverageArray,
  })
  .superRefine((data, ctx) => {
    if (!validCoverageKeys(data.insuranceType, data.coverage)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["coverage"],
        message: "保障細項不屬於此險種",
      });
    }
  });
export type CreateInsurance = z.infer<typeof CreateInsuranceSchema>;

export const UpdateInsuranceSchema = z.object({
  insurer: z.string().min(1).optional(),
  insuredName: z.string().min(1).optional(),
  insuranceType: InsuranceTypeSchema.optional(),
  policyName: z.string().nullable().optional(),
  policyNumber: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  paymentTermYears: z.number().int().positive().nullable().optional(),
  coveragePeriod: z.string().nullable().optional(),
  annualPremium: z.number().nonnegative().nullable().optional(),
  coverage: coverageArray,
});
export type UpdateInsurance = z.infer<typeof UpdateInsuranceSchema>;

export const InsuranceSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  insurer: z.string(),
  insuredName: z.string(),
  insuranceType: InsuranceTypeSchema,
  policyName: z.string().nullable(),
  policyNumber: z.string().nullable(),
  startDate: z.string().nullable(),
  paymentTermYears: z.number().nullable(),
  coveragePeriod: z.string().nullable(),
  annualPremium: z.number().nullable(),
  coverage: z.array(CoverageItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Insurance = z.infer<typeof InsuranceSchema>;
```

> Note: `z.enum` requires a mutable tuple; `INSURANCE_TYPES` is `as const` (readonly). If `z.enum(INSURANCE_TYPES)` reports a readonly-type error, wrap as `z.enum([...INSURANCE_TYPES] as [string, ...string[]])`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/shared exec vitest run tests/insuranceSchema.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/finance.ts packages/shared/tests/insuranceSchema.test.ts
git commit -m "feat: add insurance zod schemas with coverage validation"
```

---

### Task 4: InsuranceService (premium-gated CRUD)

**Files:**

- Create: `apps/web/services/insurance.service.ts`
- Test: `apps/web/tests/services/insurance.service.test.ts` (create)

**Interfaces:**

- Consumes: `entitlementsService.isPremium` (from the entry-limit plan, [[project_premium_tier]]); `CreateInsurance` / `UpdateInsurance` types (Task 3); `prisma` (`$transaction`, `entry`, `entryHistory`, `insurance`).
- Produces: `insuranceService.create(data, userId)`, `.findById(id, userId)`, `.update(id, data, userId)`, `.deleteByEntryId(entryId, userId)`; `PremiumRequiredError` (exported, mapped to 403 by Task 5).

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/services/insurance.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn) => fn(txMock)),
    insurance: { findFirst: vi.fn(), update: vi.fn() },
    entry: { deleteMany: vi.fn() },
  },
}));

vi.mock("@/services/entitlements.service", () => ({
  entitlementsService: { isPremium: vi.fn() },
}));

vi.mock("@/lib/serialize", () => ({
  d: (v: unknown) => Number(v),
  dn: (v: unknown) => (v == null ? null : Number(v)),
}));

const txMock = {
  entry: { create: vi.fn(), update: vi.fn() },
  entryHistory: { create: vi.fn() },
  insurance: { create: vi.fn() },
};

import { prisma } from "@/lib/prisma";
import { entitlementsService } from "../../services/entitlements.service";
import { insuranceService, PremiumRequiredError } from "../../services/insurance.service";

const USER_ID = "user_test123";
const BASE = { insurer: "國泰人壽", insuredName: "本人", insuranceType: "MEDICAL" as const };

describe("InsuranceService.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.entry.create.mockResolvedValue({ id: "entry-1", value: 0 });
    txMock.entryHistory.create.mockResolvedValue({});
    txMock.insurance.create.mockResolvedValue({
      id: "ins-1",
      entryId: "entry-1",
      ...BASE,
      policyName: null,
      policyNumber: null,
      startDate: null,
      paymentTermYears: null,
      coveragePeriod: null,
      annualPremium: null,
      coverage: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("throws PremiumRequiredError for a non-premium user", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(false);
    await expect(insuranceService.create(BASE, USER_ID)).rejects.toBeInstanceOf(
      PremiumRequiredError
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates an Entry with topCategory 保險, includeInChart false, value 0", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(true);
    await insuranceService.create(BASE, USER_ID);
    expect(txMock.entry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          topCategory: "保險",
          includeInChart: false,
          value: 0,
        }),
      })
    );
  });

  it("persists the insurance row with its type and coverage", async () => {
    vi.mocked(entitlementsService.isPremium).mockResolvedValue(true);
    await insuranceService.create(
      { ...BASE, coverage: [{ key: "hospital_daily", label: "住院日額", value: 2000 }] },
      USER_ID
    );
    expect(txMock.insurance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entryId: "entry-1", insuranceType: "MEDICAL" }),
      })
    );
  });
});

describe("InsuranceService.findById", () => {
  beforeEach(() => vi.clearAllMocks());
  it("scopes the lookup by userId via the entry relation", async () => {
    vi.mocked(prisma.insurance.findFirst).mockResolvedValue(null);
    expect(await insuranceService.findById("ins-1", USER_ID)).toBeNull();
    expect(prisma.insurance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ins-1", entry: { userId: USER_ID } } })
    );
  });
});

describe("InsuranceService.deleteByEntryId", () => {
  beforeEach(() => vi.clearAllMocks());
  it("deletes the entry scoped by userId (cascade removes the insurance)", async () => {
    vi.mocked(prisma.entry.deleteMany).mockResolvedValue({ count: 1 });
    await insuranceService.deleteByEntryId("entry-1", USER_ID);
    expect(prisma.entry.deleteMany).toHaveBeenCalledWith({
      where: { id: "entry-1", userId: USER_ID },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/web exec vitest run tests/services/insurance.service.test.ts`
Expected: FAIL — `insurance.service.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/services/insurance.service.ts`:

```ts
import type { Prisma } from "@prisma/client";
import type { CreateInsurance, UpdateInsurance } from "@repo/shared";
import { prisma } from "@/lib/prisma";
import { d, dn } from "@/lib/serialize";
import { entitlementsService } from "@/services/entitlements.service";

// Thrown when a non-premium user attempts an insurance write. The route maps
// this to a 403 PREMIUM_REQUIRED envelope so the client can open the paywall.
export class PremiumRequiredError extends Error {
  constructor() {
    super("Premium subscription required");
    this.name = "PremiumRequiredError";
  }
}

function serializeInsurance(ins: {
  id: string;
  entryId: string;
  insurer: string;
  insuredName: string;
  insuranceType: string;
  policyName: string | null;
  policyNumber: string | null;
  startDate: Date | null;
  paymentTermYears: number | null;
  coveragePeriod: string | null;
  annualPremium: Prisma.Decimal | null;
  coverage: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...ins,
    startDate: ins.startDate ? ins.startDate.toISOString() : null,
    annualPremium: dn(ins.annualPremium),
    coverage: (ins.coverage as unknown) ?? [],
  };
}

export class InsuranceService {
  async create(data: CreateInsurance, userId: string) {
    if (!(await entitlementsService.isPremium(userId))) throw new PremiumRequiredError();

    return prisma.$transaction(async (tx) => {
      const entry = await tx.entry.create({
        data: {
          userId,
          name: data.policyName?.trim() || data.insurer,
          topCategory: "保險",
          subCategory: data.insuranceType,
          value: 0,
          includeInChart: false,
        },
      });

      await tx.entryHistory.create({
        data: { entryId: entry.id, delta: 0, balance: 0 },
      });

      const insurance = await tx.insurance.create({
        data: {
          entryId: entry.id,
          insurer: data.insurer,
          insuredName: data.insuredName,
          insuranceType: data.insuranceType,
          policyName: data.policyName ?? null,
          policyNumber: data.policyNumber ?? null,
          startDate: data.startDate ? new Date(data.startDate) : null,
          paymentTermYears: data.paymentTermYears ?? null,
          coveragePeriod: data.coveragePeriod ?? null,
          annualPremium: data.annualPremium ?? null,
          coverage: (data.coverage ?? []) as Prisma.InputJsonValue,
        },
      });

      return { entryId: entry.id, ...serializeInsurance(insurance) };
    });
  }

  async findById(id: string, userId: string) {
    const insurance = await prisma.insurance.findFirst({
      where: { id, entry: { userId } },
    });
    return insurance ? serializeInsurance(insurance) : null;
  }

  async update(id: string, data: UpdateInsurance, userId: string) {
    const existing = await prisma.insurance.findFirst({ where: { id, entry: { userId } } });
    if (!existing) return null;

    const updated = await prisma.insurance.update({
      where: { id },
      data: {
        ...(data.insurer !== undefined && { insurer: data.insurer }),
        ...(data.insuredName !== undefined && { insuredName: data.insuredName }),
        ...(data.insuranceType !== undefined && { insuranceType: data.insuranceType }),
        ...(data.policyName !== undefined && { policyName: data.policyName }),
        ...(data.policyNumber !== undefined && { policyNumber: data.policyNumber }),
        ...(data.startDate !== undefined && {
          startDate: data.startDate ? new Date(data.startDate) : null,
        }),
        ...(data.paymentTermYears !== undefined && { paymentTermYears: data.paymentTermYears }),
        ...(data.coveragePeriod !== undefined && { coveragePeriod: data.coveragePeriod }),
        ...(data.annualPremium !== undefined && { annualPremium: data.annualPremium }),
        ...(data.coverage !== undefined && {
          coverage: (data.coverage ?? []) as Prisma.InputJsonValue,
        }),
      },
    });
    return serializeInsurance(updated);
  }

  async deleteByEntryId(entryId: string, userId: string) {
    // Cascade on Entry→Insurance removes the insurance row.
    return prisma.entry.deleteMany({ where: { id: entryId, userId } });
  }
}

export const insuranceService = new InsuranceService();
```

> `d`/`dn` come from `@/lib/serialize` (Decimal→number). `dn` is unused if you inline null handling — remove the `d` import if the linter flags it; keep only what the file uses.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/web exec vitest run tests/services/insurance.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/services/insurance.service.ts apps/web/tests/services/insurance.service.test.ts
git commit -m "feat: add premium-gated insurance service"
```

---

### Task 5: Insurance REST routes

**Files:**

- Create: `apps/web/app/api/insurances/route.ts` (POST)
- Create: `apps/web/app/api/insurances/[id]/route.ts` (GET/PATCH/DELETE)
- Test: `apps/web/tests/api/insurances.route.test.ts` (create)

**Interfaces:**

- Consumes: `CreateInsuranceSchema` / `UpdateInsuranceSchema` (Task 3); `insuranceService`, `PremiumRequiredError` (Task 4).
- Produces: `POST /api/insurances` → 201; `403 PREMIUM_REQUIRED` when non-premium; `GET/PATCH/DELETE /api/insurances/[id]` scoped by owner (404 on miss).

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/api/insurances.route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security-log", () => ({ logSecurityEvent: vi.fn() }));
vi.mock("@/services/insurance.service", () => {
  class PremiumRequiredError extends Error {}
  return { insuranceService: { create: vi.fn() }, PremiumRequiredError };
});

import { auth } from "@clerk/nextjs/server";
import { insuranceService, PremiumRequiredError } from "@/services/insurance.service";
import { POST } from "../../app/api/insurances/route";

const VALID = { insurer: "國泰人壽", insuredName: "本人", insuranceType: "MEDICAL" };
function req(body: unknown) {
  return new NextRequest("http://localhost/api/insurances", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/insurances", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    expect((await POST(req(VALID))).status).toBe(401);
  });

  it("403 PREMIUM_REQUIRED when the service rejects a non-premium user", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(insuranceService.create).mockRejectedValue(new PremiumRequiredError());
    const res = await POST(req(VALID));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("PREMIUM_REQUIRED");
  });

  it("201 on success", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
    vi.mocked(insuranceService.create).mockResolvedValue({ id: "ins-1" } as never);
    expect((await POST(req(VALID))).status).toBe(201);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/web exec vitest run tests/api/insurances.route.test.ts`
Expected: FAIL — routes do not exist.

- [ ] **Step 3: Write the POST route**

Create `apps/web/app/api/insurances/route.ts`:

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CreateInsuranceSchema } from "@repo/shared";
import { insuranceService, PremiumRequiredError } from "@/services/insurance.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/insurances" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const data = CreateInsuranceSchema.parse(await req.json());
    const result = await insuranceService.create(data, userId);
    return ok(result, 201);
  } catch (e) {
    if (e instanceof PremiumRequiredError) {
      return err("PREMIUM_REQUIRED", "此功能需要 Premium 訂閱", 403);
    }
    return handleError(e);
  }
}
```

- [ ] **Step 4: Write the [id] route**

Create `apps/web/app/api/insurances/[id]/route.ts`:

```ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UpdateInsuranceSchema } from "@repo/shared";
import { insuranceService, PremiumRequiredError } from "@/services/insurance.service";
import { ok, err, handleError } from "@/lib/api-response";
import { logSecurityEvent } from "@/lib/security-log";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/insurances/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const insurance = await insuranceService.findById(id, userId);
    if (!insurance) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `insurances/${id}` });
      return err("NOT_FOUND", "Insurance not found", 404);
    }
    return ok(insurance);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/insurances/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const existing = await insuranceService.findById(id, userId);
    if (!existing) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `insurances/${id}` });
      return err("NOT_FOUND", "Insurance not found", 404);
    }
    const data = UpdateInsuranceSchema.parse(await req.json());
    const insurance = await insuranceService.update(id, data, userId);
    return ok(insurance);
  } catch (e) {
    if (e instanceof PremiumRequiredError) {
      return err("PREMIUM_REQUIRED", "此功能需要 Premium 訂閱", 403);
    }
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      logSecurityEvent({ type: "auth_fail", resource: "/api/insurances/[id]" });
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    const { id } = await params;
    const insurance = await insuranceService.findById(id, userId);
    if (!insurance) {
      logSecurityEvent({ type: "ownership_violation", userId, resource: `insurances/${id}` });
      return err("NOT_FOUND", "Insurance not found", 404);
    }
    await insuranceService.deleteByEntryId(insurance.entryId, userId);
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @repo/web exec vitest run tests/api/insurances.route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/insurances
git add apps/web/tests/api/insurances.route.test.ts
git commit -m "feat: add insurance rest routes"
```

---

### Task 6: Entry list carries insurance summary

**Files:**

- Modify: `apps/web/services/entries.service.ts` (`list` at `apps/web/services/entries.service.ts:39`)
- Test: `apps/web/tests/services/entries.service.test.ts` (extend)

**Interfaces:**

- Consumes: `prisma.entry.findMany` with an `insurance` include.
- Produces: each listed entry now carries `insurance: { insuranceType, insurer, insuredName } | null`, so the UI can group 保險 entries into a card and label each policy without a second round trip.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/tests/services/entries.service.test.ts` (within the existing `EntriesService.list` describe or a new one):

```ts
it("includes an insurance summary on the listed entries", async () => {
  vi.mocked(prisma.entry.findMany).mockResolvedValue([
    {
      id: "e1",
      userId: USER_ID,
      name: "醫療險",
      topCategory: "保險",
      subCategory: "MEDICAL",
      stockCode: null,
      bankCode: null,
      note: null,
      value: 0,
      includeInChart: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      loan: null,
      history: [],
      insurance: { insuranceType: "MEDICAL", insurer: "國泰人壽", insuredName: "本人" },
    },
  ] as never);
  const [entry] = await entriesService.list(USER_ID);
  expect(entry.insurance).toEqual({
    insuranceType: "MEDICAL",
    insurer: "國泰人壽",
    insuredName: "本人",
  });
  expect(prisma.entry.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      include: expect.objectContaining({
        insurance: { select: { insuranceType: true, insurer: true, insuredName: true } },
      }),
    })
  );
});
```

Also extend the `vi.mock("@/lib/prisma", ...)` `entry.findMany` — it already exists; no change needed. If other existing `list` tests mock `findMany` return values without an `insurance` key, add `insurance: null` to those fixtures so the mapping doesn't read undefined.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/web exec vitest run tests/services/entries.service.test.ts`
Expected: FAIL — `list` neither includes nor returns `insurance`.

- [ ] **Step 3: Update `list`**

In `apps/web/services/entries.service.ts`, change the `list` method's query and mapping:

```ts
async list(userId: string) {
  const entries = await prisma.entry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      loan: true,
      history: { select: { units: true } },
      insurance: { select: { insuranceType: true, insurer: true, insuredName: true } },
    },
  });
  return entries.map(({ history, loan, insurance, ...e }) => ({
    ...e,
    value: d(e.value),
    loan: loan ? serializeLoan(loan) : null,
    insurance: insurance ?? null,
    units: history.some((h) => h.units != null)
      ? history.reduce((s, h) => s + (h.units ? d(h.units) : 0), 0)
      : null,
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @repo/web exec vitest run tests/services/entries.service.test.ts`
Expected: PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add apps/web/services/entries.service.ts apps/web/tests/services/entries.service.test.ts
git commit -m "feat: include insurance summary in entry list"
```

---

## Self-Review

**Spec coverage (insurance spec):**

- Redesigned `Insurance` model, 7-type enum, `null=不確定` nullable columns, JSON coverage → Task 1. ✅
- 34-company insurer list + per-type coverage options as UI constants → Task 2. ✅
- Zod: 3 required fields, `coverage` ≤ 3, per-type key membership, `OTHER` free-form → Task 3. ✅
- Insurance entry: `topCategory=保險`, `includeInChart=false`, `value=0` (不計入淨值) → Task 4 (test asserts it). ✅
- Premium-only creation, server-enforced → Task 4 (`PremiumRequiredError`) + Task 5 (403 `PREMIUM_REQUIRED`). ✅
- CRUD + owner-scoped routes mirroring loans → Tasks 4–5. ✅
- Entry list surfaces insurance so the UI can render the 保險 card → Task 6. ✅
- **Out of scope (separate plans):** the insurer `<select>` UI, the policy form, the detail page, and the `categoryConfig` 保險 category on web + mobile. Those are the Insurance **UI plans** (mobile, then web), which consume these endpoints. The card "共 N 張保單" display and `Entry.value=0` presentation are satisfied at the data layer here; their rendering is a UI-plan concern.

**Placeholder scan:** No TBD/TODO; every code and test step is complete. The two inline notes (readonly `z.enum` workaround; drop unused `serialize` import) are conditional guidance, not placeholders. ✅

**Type consistency:** `InsuranceType`/`INSURANCE_TYPES` defined in Task 2, consumed by Tasks 3–4. `CreateInsurance`/`UpdateInsurance` defined in Task 3, consumed by Task 4. `PremiumRequiredError` defined in Task 4, imported+mocked identically in Task 5. Coverage shape `{ key, label, value }` identical across Tasks 2, 3, 4. `insuranceService` method names (`create`/`findById`/`update`/`deleteByEntryId`) consistent between Tasks 4 and 5. ✅

**Ordering:** 1 (schema) → 2 (constants) → 3 (schemas, needs constants) → 4 (service, needs schemas + schema/migration + entitlements) → 5 (routes, needs service + schemas) → 6 (entry list, needs schema). Execute in order.

**Known consideration (not a gap):** loans and insurance create their `Entry` directly (bypassing `EntriesService.create`), so neither counts toward `FREE_ENTRY_LIMIT`. For insurance this is intentional (it's premium-only and not an asset). Flagged for awareness; no change here.
