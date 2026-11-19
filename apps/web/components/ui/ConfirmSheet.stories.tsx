import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ConfirmSheet, NoticeSheet } from "./ConfirmSheet";

const meta = {
  title: "UI/ConfirmSheet",
  component: ConfirmSheet,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    title: "刪除這個帳戶？",
    message: "帳戶和所有紀錄都會一起刪除，無法復原。",
    onConfirm: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof ConfirmSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** While the delete request is in flight: buttons locked, spinner shown. */
export const Busy: Story = { args: { busy: true } };

export const CustomLabels: Story = {
  args: {
    title: "清除快取？",
    message: "",
    confirmLabel: "清除",
    busyLabel: "清除中…",
  },
};

/** The one-button variant, used for errors and notices. */
export const Notice: StoryObj<typeof NoticeSheet> = {
  render: (args) => <NoticeSheet {...args} />,
  args: {
    open: true,
    title: "請在 App 中操作",
    message: "這個功能目前只在 iOS App 提供。",
    onClose: fn(),
  },
};
