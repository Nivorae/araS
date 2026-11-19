import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { EmptyAssetsVortex } from "./EmptyAssetsVortex";

const meta = {
  title: "Finance/EmptyAssetsVortex",
  component: EmptyAssetsVortex,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto h-dvh max-w-md">
        <Story />
      </div>
    ),
  ],
  args: { onAdd: fn() },
} satisfies Meta<typeof EmptyAssetsVortex>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What the assets page shows before the first account is added. */
export const Default: Story = {};
