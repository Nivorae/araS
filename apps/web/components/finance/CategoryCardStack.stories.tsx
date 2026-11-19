import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { demoEntries } from "../../.storybook/mocks/financeStore";
import { buildStackCategories, CategoryCardStack } from "./CategoryCardStack";
import { getNodeIcon } from "./categoryConfig";

const meta = {
  title: "Finance/CategoryCardStack",
  component: CategoryCardStack,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto h-dvh max-w-md px-4 pt-6">
        <Story />
      </div>
    ),
  ],
  args: {
    categories: buildStackCategories(demoEntries),
    hideBalance: false,
    getEntryIcon: getNodeIcon,
    onEntryClick: fn(),
    onExpandChange: fn(),
    onAddClick: fn(),
  },
} satisfies Meta<typeof CategoryCardStack>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo account's categories. Click a card to expand it. */
export const Default: Story = {};

/** The eye-icon "hide balance" toggle on the assets page. */
export const HiddenBalance: Story = { args: { hideBalance: true } };

export const SingleCategory: Story = {
  args: {
    categories: buildStackCategories(demoEntries.filter((e) => e.topCategory === "流動資金")),
  },
};
