import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BankLogo } from "./BankLogo";

const meta = {
  title: "UI/BankLogo",
  component: BankLogo,
  args: { code: "cathay", name: "國泰世華", size: 32 },
} satisfies Meta<typeof BankLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Large: Story = { args: { size: 64 } };

/** Unknown code: the SVG 404s and the first-character tile takes over. */
export const Fallback: Story = { args: { code: "does-not-exist", name: "測試銀行" } };

export const Gallery: Story = {
  render: (args) => (
    <div className="flex gap-3">
      {[
        { code: "bot", name: "台灣銀行" },
        { code: "ctbc", name: "中國信託" },
        { code: "cathay", name: "國泰世華" },
        { code: "dbs", name: "星展銀行" },
        { code: "nope", name: "其他" },
      ].map((b) => (
        <BankLogo key={b.code} {...args} code={b.code} name={b.name} />
      ))}
    </div>
  ),
};
