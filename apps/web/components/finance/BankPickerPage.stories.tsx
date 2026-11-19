import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { BankPickerPage } from "./BankPickerPage";

const meta = {
  title: "Finance/BankPickerPage",
  component: BankPickerPage,
  parameters: { layout: "fullscreen" },
  args: { open: true, onClose: fn(), onSelect: fn() },
} satisfies Meta<typeof BankPickerPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSelection: Story = { args: { selectedCode: "cathay" } };
