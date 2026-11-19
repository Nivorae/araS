import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { DrillCarousel } from "./DrillCarousel";
import { CATEGORIES, type CategoryNode } from "./categoryConfig";

/** The first category node with its own sub-list (流動資金 → 數位錢包 today). */
function drillTarget(): { color: string; items: CategoryNode[] } {
  for (const top of CATEGORIES) {
    const node = top.children.find((c) => c.children && c.children.length > 1);
    if (node?.children) return { color: top.color, items: node.children };
  }
  throw new Error("categoryConfig has no node with children to drill into");
}

const target = drillTarget();

const meta = {
  title: "Finance/DrillCarousel",
  component: DrillCarousel,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto flex h-dvh max-w-md flex-col justify-center">
        <Story />
      </div>
    ),
  ],
  args: { topColor: target.color, items: target.items, onSubmit: fn() },
} satisfies Meta<typeof DrillCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Swipe or tap the dots; 新增 submits the centred card. */
export const Default: Story = {};

export const TwoItems: Story = { args: { items: target.items.slice(0, 2) } };
