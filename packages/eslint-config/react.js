import { baseConfig } from "./index.js";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

/** @type {import("typescript-eslint").ConfigArray} */
export const reactConfig = [
  ...baseConfig,
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/no-danger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
    },
    settings: {
      react: { version: "detect" },
    },
  },
];

export default reactConfig;
