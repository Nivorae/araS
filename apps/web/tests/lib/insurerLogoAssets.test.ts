import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { INSURERS } from "@repo/shared";
import { INSURER_LOGO_EXT } from "../../components/ui/InsurerLogo";

// InsurerLogo requests exactly the file this map names, so a logo added to or
// removed from public/insurance must be reflected here or it 404s / goes unused.
describe("INSURER_LOGO_EXT", () => {
  const dir = path.resolve(__dirname, "../../public/insurance");
  const files = readdirSync(dir);

  it("matches the files in public/insurance exactly", () => {
    const fromDisk = Object.fromEntries(
      files.map((f) => {
        const ext = path.extname(f).slice(1);
        return [path.basename(f, `.${ext}`), ext];
      })
    );
    expect(INSURER_LOGO_EXT).toEqual(fromDisk);
  });

  it("only names codes that exist in the insurer list", () => {
    const codes = new Set(INSURERS.map((i) => i.code));
    for (const code of Object.keys(INSURER_LOGO_EXT)) expect(codes.has(code)).toBe(true);
  });
});
