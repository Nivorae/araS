import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { AddAccountPage } from "./AddAccountPage";

const meta = {
  title: "Finance/AddAccountPage",
  component: AddAccountPage,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onClose: fn(),
    onSelectCategory: fn(),
    onSelectInsurance: fn(),
  },
} satisfies Meta<typeof AddAccountPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The global "+" menu: one card per top category. */
export const Default: Story = {};

/** Opened from a category card's "+ 新增", with that category pre-expanded. */
export const PreExpanded: Story = { args: { initialExpanded: "流動資金" } };
