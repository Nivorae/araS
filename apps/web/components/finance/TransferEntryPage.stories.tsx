import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { demoEntries } from "../../.storybook/mocks/financeStore";
import { TransferEntryPage } from "./TransferEntryPage";

// Reads the other accounts from useFinanceStore, which preview.tsx seeds with
// the demo data in guest mode — so 轉帳 only updates local state.
const source = demoEntries.find((e) => e.name === "Cathay United Bank") ?? null;

const meta = {
  title: "Finance/TransferEntryPage",
  component: TransferEntryPage,
  parameters: { layout: "fullscreen" },
  args: { open: true, entry: source, onClose: fn(), onDone: fn() },
} satisfies Meta<typeof TransferEntryPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Only one transferable account exists, so there's nowhere to transfer to. */
export const NoCandidates: Story = {
  parameters: { financeStore: { entries: source ? [source] : [] } },
};
