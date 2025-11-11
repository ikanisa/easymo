import type { Meta, StoryObj } from "@storybook/react";
import { SparklineChart } from "../src/components/charts";

const meta: Meta<typeof SparklineChart> = {
  component: SparklineChart,
  title: "Data/Sparkline Chart",
  args: {
    "aria-label": "Token issuance vs redemption",
    description: "Last 14 days",
    data: Array.from({ length: 14 }, (_, index) => ({
      label: `Day ${index + 1}`,
      value: 100 + Math.round(Math.sin(index / 2) * 25 + index * 5),
    })),
  },
};

export default meta;

type Story = StoryObj<typeof SparklineChart>;

export const Default: Story = {};
