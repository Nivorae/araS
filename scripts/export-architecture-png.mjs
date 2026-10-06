// Renders docs/diagrams/aras-architecture.html (produced by the archify skill)
// into light/dark PNGs for README.md — GitHub can't display the interactive
// HTML inline. Uses the locally installed Chrome, so no browser download.
//
//   pnpm diagram:png
import { chromium } from "playwright-core";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const dir = path.resolve(fileURLToPath(import.meta.url), "../../docs/diagrams");
const html = pathToFileURL(path.join(dir, "aras-architecture.html")).href;

const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const colorScheme of ["light", "dark"]) {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 2,
      colorScheme,
    });
    await page.goto(html);
    const svg = page.locator("svg[data-quality-profile]").first();
    await svg.waitFor();
    const out = path.join(dir, `aras-architecture.${colorScheme}.png`);
    await svg.screenshot({ path: out });
    console.log(`wrote ${path.relative(process.cwd(), out)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
