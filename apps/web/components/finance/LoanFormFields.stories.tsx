import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { LoanFormFields, type LoanFormValues } from "./LoanFormFields";

const EMPTY: LoanFormValues = {
  loanName: "",
  totalAmount: "",
  annualInterestRate: "",
  termMonths: "",
  startDate: "",
  gracePeriodMonths: "",
  repaymentType: "principal_interest",
};

const meta = {
  title: "Finance/LoanFormFields",
  component: LoanFormFields,
  decorators: [
    (Story) => (
      <div className="w-[375px] overflow-hidden rounded-2xl bg-white">
        <Story />
      </div>
    ),
  ],
  args: { values: EMPTY, color: "#374254", onChange: fn() },
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return (
      <LoanFormFields
        {...args}
        onChange={(values) => {
          args.onChange(values);
          updateArgs({ values });
        }}
      />
    );
  },
} satisfies Meta<typeof LoanFormFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Filled: Story = {
  args: {
    values: {
      loanName: "台北房貸",
      totalAmount: "8000000",
      annualInterestRate: "2.185",
      termMonths: "360",
      startDate: "2024-03-15",
      gracePeriodMonths: "24",
      repaymentType: "principal_equal",
    },
  },
};

export const WithErrors: Story = {
  args: {
    errors: {
      loanName: "請輸入貸款名稱",
      totalAmount: "金額必須大於 0",
      termMonths: "請輸入期數",
    },
  },
};
