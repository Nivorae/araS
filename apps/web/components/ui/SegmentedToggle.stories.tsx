import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { SegmentedToggle } from "./SegmentedToggle";

const meta = {
  title: "UI/SegmentedToggle",
  component: SegmentedToggle,
  args: {
    options: [
      { value: "1M", label: "1個月" },
      { value: "1Y", label: "1年" },
      { value: "ALL", label: "全部" },
    ],
    value: "1M",
    onPress: fn(),
  },
  // Wire the tap back into `value` so the pill and the hop animation play.
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return (
      <SegmentedToggle
        {...args}
        onPress={(v) => {
          args.onPress(v);
          updateArgs({ value: v });
        }}
      />
    );
  },
} satisfies Meta<typeof SegmentedToggle<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThreeSegments: Story = {};

export const TwoSegments: Story = {
  args: {
    options: [
      { value: "asset", label: "資產" },
      { value: "debt", label: "負債" },
    ],
    value: "asset",
  },
};
