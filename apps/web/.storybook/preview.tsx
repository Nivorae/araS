import type { Preview } from "@storybook/nextjs-vite";
import { INITIAL_VIEWPORTS } from "storybook/viewport";
import { seedFinanceStore, type FinanceStoreSeed } from "./mocks/financeStore";
import "./storybook.css";

declare module "@storybook/nextjs-vite" {
  interface Parameters {
    /** Overrides applied on top of the guest-mode demo data in `useFinanceStore`. */
    financeStore?: FinanceStoreSeed;
  }
}

const preview: Preview = {
  parameters: {
    nextjs: { appDirectory: true },
    layout: "centered",
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    viewport: { options: INITIAL_VIEWPORTS },
    backgrounds: {
      options: {
        app: { name: "App (#f2f2f7)", value: "#f2f2f7" },
        surface: { name: "Surface (#ffffff)", value: "#ffffff" },
      },
    },
    // Report a11y violations in the panel without failing anything yet.
    a11y: { test: "todo" },
  },
  initialGlobals: {
    backgrounds: { value: "app" },
  },
  // Reset before every story so one story's store writes can't leak into the next.
  beforeEach: async ({ parameters }) => {
    await seedFinanceStore(parameters.financeStore);
  },
};

export default preview;
