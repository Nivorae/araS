import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FitText } from "./FitText";

const meta = {
  title: "UI/FitText",
  component: FitText,
  args: { children: "NT$12,345,678", fontSize: 34, minScale: 0.6 },
  argTypes: {
    fontSize: { control: { type: "range", min: 12, max: 60 } },
    minScale: { control: { type: "range", min: 0.2, max: 1, step: 0.05 } },
  },
  decorators: [
    (Story) => (
      <div className="w-48 rounded-xl bg-white p-3 font-bold text-[#1c1c1e]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FitText>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Fits as-is: rendered at the full `fontSize`. */
export const Short: Story = { args: { children: "NT$1,234" } };

/** Too wide for the 192px box: shrinks until it fits. */
export const Shrinks: Story = {};

/** Even `minScale` isn't enough, so it clips. */
export const ClipsAtMinScale: Story = {
  args: { children: "NT$12,345,678,901,234", minScale: 0.8 },
};
