import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { INSURANCE_COVERAGE_OPTIONS } from "@repo/shared";
import { fn } from "storybook/test";
import { CoveragePickerPage, InsurerPickerPage } from "./InsurerPickerPage";

const meta = {
  title: "Finance/InsurerPickerPage",
  component: InsurerPickerPage,
  parameters: { layout: "fullscreen" },
  args: { open: true, selected: "", onClose: fn(), onSelect: fn(), onOther: fn() },
} satisfies Meta<typeof InsurerPickerPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Type in the search box to filter the insurer list. */
export const Default: Story = {};

export const WithSelection: Story = { args: { selected: "國泰人壽" } };

export const Coverage: StoryObj<typeof CoveragePickerPage> = {
  render: (args) => <CoveragePickerPage {...args} />,
  args: {
    open: true,
    // What InsuranceFormPage passes for a medical policy.
    options: INSURANCE_COVERAGE_OPTIONS.MEDICAL,
    onClose: fn(),
    onPick: fn(),
  },
};
