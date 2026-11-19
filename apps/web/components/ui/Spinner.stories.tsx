import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Spinner } from "./Spinner";

const meta = {
  title: "UI/Spinner",
  component: Spinner,
  args: { size: 14 },
  argTypes: { size: { control: { type: "range", min: 8, max: 64, step: 2 } } },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Large: Story = { args: { size: 40, className: "text-[#374254]" } };

/** Inside a destructive button, as ConfirmSheet renders it while busy. */
export const InButton: Story = {
  render: (args) => (
    <button
      type="button"
      disabled
      className="flex items-center gap-2 rounded-full bg-[#ff3b30] px-6 py-3 text-[15px] font-semibold text-white"
    >
      <Spinner {...args} />
      刪除中…
    </button>
  ),
};
