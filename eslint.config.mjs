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
  {
    // RN's Modal is a separate native window that floats above AppLockGate's
    // lock screen; the wrapper draws the lock screen inside the Modal too.
    files: ["apps/mobile/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["Modal"],
              message: "Use Modal from @/components/Modal so the app lock screen covers it.",
            },
          ],
        },
      ],
    },
  },
];
