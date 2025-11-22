import type { Meta, StoryObj } from "@storybook/react";

import { KpiWidget } from "../../widgets/KpiWidget";

const meta: Meta<typeof KpiWidget> = {
  title: "Components/KPI Widget",
  component: KpiWidget,
  args: {
    label: "On-time dispatch",
    value: "97%",
    changeLabel: "+4.2% vs last week",
    trend: "up",
    context: "Based on 320 live delivery attempts.",
  },
};

export default meta;

type Story = StoryObj<typeof KpiWidget>;

export const Default: Story = {};

export const DownTrend: Story = {
  args: {
    trend: "down",
    changeLabel: "-6.1% vs target",
  },
};

export const Flat: Story = {
  args: {
    trend: "flat",
    changeLabel: "No change",
  },
};
