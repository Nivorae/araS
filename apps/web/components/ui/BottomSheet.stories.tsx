import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { BottomSheet, SheetHandle } from "./BottomSheet";

const meta = {
  title: "UI/BottomSheet",
  component: BottomSheet,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onClose: fn(),
    onClosed: fn(),
    dismissOnBackdrop: true,
    label: "示範",
    panelClassName: "px-5 pb-8",
    children: null,
  },
  // `open` is driven by the args so the controls panel, the backdrop, Esc and
  // the trigger button all stay in step.
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return (
      <div className="flex h-dvh items-center justify-center">
        <button
          type="button"
          onClick={() => updateArgs({ open: true })}
          className="rounded-full bg-[#1c1c1e] px-5 py-2.5 text-[15px] font-semibold text-white"
        >
          打開
        </button>
        <BottomSheet
          {...args}
          onClose={() => {
            args.onClose();
            updateArgs({ open: false });
          }}
        >
          <SheetHandle />
          {args.children ?? (
            <>
              <p className="mb-2 text-[17px] font-semibold text-[#1c1c1e]">標題</p>
              <p className="text-[14px] text-[#8e8e93]">
                點背景或按 Esc 關閉。關閉動畫結束後才會觸發 onClosed。
              </p>
            </>
          )}
        </BottomSheet>
      </div>
    );
  },
} satisfies Meta<typeof BottomSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Closed: Story = { args: { open: false } };

/** Backdrop taps are ignored — only Esc or an explicit button closes it. */
export const NoBackdropDismiss: Story = { args: { dismissOnBackdrop: false } };

/** Long content scrolls inside the panel once it hits `maxHeight`. */
export const TallContent: Story = {
  args: {
    maxHeight: "60dvh",
    panelClassName: "px-5 pb-8 overflow-y-auto",
    children: (
      <ul className="divide-y divide-[#f2f2f7]">
        {Array.from({ length: 30 }, (_, i) => (
          <li key={i} className="py-3 text-[15px] text-[#1c1c1e]">
            項目 {i + 1}
          </li>
        ))}
      </ul>
    ),
  },
};
