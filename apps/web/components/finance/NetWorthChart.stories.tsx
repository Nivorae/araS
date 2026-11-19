import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { NetWorthPoint } from "@repo/shared";
import { NetWorthChart } from "./NetWorthChart";

function monthlySeries(
  months: number,
  startAssets: number,
  growth: number,
  liabilities: number
): NetWorthPoint[] {
  return Array.from({ length: months }, (_, i) => {
    const end = new Date(2026, i - months + 11, 28);
    const totalAssets = Math.round(startAssets * Math.pow(1 + growth, i));
    return {
      period: `${end.getMonth() + 1}月`,
      date: end.toISOString(),
      totalAssets,
      totalLiabilities: liabilities,
      netWorth: totalAssets - liabilities,
    };
  });
}

const meta = {
  title: "Finance/NetWorthChart",
  component: NetWorthChart,
  // The chart sizes itself from its container (a flex child, as on the
  // transactions page), so give it a phone-card frame. The heavy right/bottom
  // border is the design's axis, not a layout bug.
  decorators: [
    (Story) => (
      <div className="flex h-64 w-[358px] rounded-2xl bg-white p-4">
        <Story />
      </div>
    ),
  ],
  args: { data: monthlySeries(12, 9_000_000, 0.02, 5_060_000) },
} satisfies Meta<typeof NetWorthChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Growing: Story = {};

/** Liabilities exceed assets: the y-axis has to go below zero. */
export const Negative: Story = {
  args: { data: monthlySeries(12, 3_000_000, -0.03, 4_000_000) },
};

export const SinglePoint: Story = { args: { data: monthlySeries(1, 1_200_000, 0, 0) } };

export const Empty: Story = { args: { data: [] } };
