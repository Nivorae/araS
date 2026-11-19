import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { DateField, DatePickerSheet } from "./DatePickerSheet";

const meta = {
  title: "UI/DatePickerSheet",
  component: DatePickerSheet,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    value: "2026-05-06",
    onConfirm: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof DatePickerSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

/** 2024-02-29: switching the year to a non-leap one clamps the day to 28. */
export const LeapDay: Story = { args: { value: "2024-02-29" } };

/** The form-row trigger every date field in the app uses. */
export const Field: StoryObj<typeof DateField> = {
  parameters: { layout: "centered" },
  args: { value: "2026-05-06", onChange: fn() },
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return (
      <div className="w-72 rounded-xl bg-white px-4 py-3">
        <p className="mb-1 text-[12px] text-[#8e8e93]">日期</p>
        <DateField
          {...args}
          onChange={(iso) => {
            args.onChange(iso);
            updateArgs({ value: iso });
          }}
        />
      </div>
    );
  },
};

export const FieldEmpty: StoryObj<typeof DateField> = {
  ...Field,
  args: { value: "", onChange: fn() },
};

export const FieldDisabled: StoryObj<typeof DateField> = {
  ...Field,
  args: { value: "2026-05-06", onChange: fn(), disabled: true },
};
