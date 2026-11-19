import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { demoEntries } from "../../.storybook/mocks/financeStore";
import { EntryDetailPage } from "./EntryDetailPage";

// The entry is looked up in useFinanceStore by id (guest-mode demo data).
// Guests have no server-side history, so the record list shows its empty
// state; a signed-in version needs MSW (docs/TODO.md).
const idOf = (name: string) => demoEntries.find((e) => e.name === name)?.id ?? null;

const meta = {
  title: "Finance/EntryDetailPage",
  component: EntryDetailPage,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    entryId: idOf("Cathay United Bank"),
    onClose: fn(),
    onAddRecord: fn(),
    onEdit: fn(),
    onDelete: fn(async () => {}),
  },
} satisfies Meta<typeof EntryDetailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BankAccount: Story = {};

export const Liability: Story = { args: { entryId: idOf("信用卡") } };

export const FixedAsset: Story = { args: { entryId: idOf("房屋") } };
