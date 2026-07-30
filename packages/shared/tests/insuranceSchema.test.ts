import { describe, it, expect } from "vitest";
import { CreateInsuranceSchema } from "../src/schemas/finance";

const BASE = { insurer: "國泰人壽", insuredName: "本人", insuranceType: "MEDICAL" as const };

describe("CreateInsuranceSchema", () => {
  it("accepts the three required fields alone (everything else optional)", () => {
    expect(CreateInsuranceSchema.safeParse(BASE).success).toBe(true);
  });

  it("rejects a missing insurer", () => {
    const rest = { insuredName: BASE.insuredName, insuranceType: BASE.insuranceType };
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
