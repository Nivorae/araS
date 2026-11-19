import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { InsurerLogo } from "./InsurerLogo";

const meta = {
  title: "UI/InsurerLogo",
  component: InsurerLogo,
  args: { name: "國泰人壽", size: 32 },
} satisfies Meta<typeof InsurerLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** SVG logo. */
export const Svg: Story = {};

/** Raster wordmark, contained on a white badge. */
export const Raster: Story = { args: { name: "安達國際人壽", size: 48 } };

/** Not in the insurer list: first-character tile. */
export const Unknown: Story = { args: { name: "某某產險" } };

export const Gallery: Story = {
  render: (args) => (
    <div className="flex gap-3">
      {["國泰人壽", "富邦人壽", "保誠人壽", "安達國際人壽", "某某產險"].map((n) => (
        <InsurerLogo key={n} {...args} name={n} />
      ))}
    </div>
  ),
};
