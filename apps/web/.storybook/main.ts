import type { StorybookConfig } from "@storybook/nextjs-vite";

// `@/*`, `@repo/ui` and `@repo/shared` resolve through tsconfig.json paths —
// the framework applies them itself, so there are no aliases to keep in sync here.
const config: StorybookConfig = {
  stories: [
    "../components/**/*.stories.@(ts|tsx)",
    "../../../packages/ui/src/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: { name: "@storybook/nextjs-vite", options: {} },
  core: { disableTelemetry: true },
  // Only the asset folders components load (logos, wallet cards, icons) — not
  // all of public/, which is mostly landing-page images.
  staticDirs: [
    { from: "../public/banks", to: "/banks" },
    { from: "../public/insurance", to: "/insurance" },
    { from: "../public/wallets", to: "/wallets" },
    { from: "../public/icons", to: "/icons" },
  ],
  // Vite would otherwise copy the whole of apps/web/public as its publicDir,
  // undoing the narrowing above.
  viteFinal: (viteConfig) => ({ ...viteConfig, publicDir: false }),
};

export default config;
