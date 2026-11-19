import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

const meta = {
  title: "Shared UI/Card",
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>淨資產</CardTitle>
        <CardDescription>所有帳戶加總</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">NT$1,234,567</p>
      </CardContent>
    </Card>
  ),
};
