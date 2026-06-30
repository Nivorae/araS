import { reactConfig } from "./packages/eslint-config/react.js";

/** @type {import("typescript-eslint").ConfigArray} */
export default [
  ...reactConfig,
  {
    // CommonJS config files in apps/mobile use require/module.exports which
    // are valid Node.js patterns but flagged by the shared ESLint config.
    ignores: [
      "apps/mobile/babel.config.js",
      "apps/mobile/metro.config.js",
      "apps/mobile/tailwind.config.js",
      "apps/mobile/.expo/**",
    ],
  },
];
