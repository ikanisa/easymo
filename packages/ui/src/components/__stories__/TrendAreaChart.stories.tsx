import type { Meta, StoryObj } from "@storybook/react";

import { TrendAreaChart } from "../../charts/TrendAreaChart";

const meta: Meta<typeof TrendAreaChart> = {
  title: "Components/TrendAreaChart",
  component: TrendAreaChart,
  args: {
    ariaLabel: "Token redemption volume vs issuance",
    data: Array.from({ length: 10 }).map((_, index) => ({
      name: `Day ${index + 1}`,
      value: Math.round(50 + Math.sin(index) * 15 + index * 2),
      secondaryValue: Math.round(48 + Math.cos(index) * 10 + index),
    })),
  },
};

export default meta;

type Story = StoryObj<typeof TrendAreaChart>;

export const Default: Story = {};

export const CurrencyFormatting: Story = {
  args: {
    formatTooltipValue: (value: number) => Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value),
  },
};
