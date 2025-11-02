import type { Meta, StoryObj } from "@storybook/react";
import { KPIWidget } from "../src/components/kpi-widget";

const meta: Meta<typeof KPIWidget> = {
  component: KPIWidget,
  title: "Data/KPI Widget",
  args: {
    label: "Net voucher redemptions",
    value: "1,248",
    secondary: "+4.2% vs last week",
    trend: {
      direction: "up",
      label: "Up 4.2%",
    },
  },
};

export default meta;

type Story = StoryObj<typeof KPIWidget>;

export const Default: Story = {};

export const Downward: Story = {
  args: {
    trend: {
      direction: "down",
      label: "Down 2.1%",
    },
  },
};
