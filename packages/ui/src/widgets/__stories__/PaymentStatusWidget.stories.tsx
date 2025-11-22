import type { Meta, StoryObj } from "@storybook/react";

import { PaymentStatusWidget } from "../PaymentStatusWidget";

const meta: Meta<typeof PaymentStatusWidget> = {
  title: "Widgets/PaymentStatusWidget",
  component: PaymentStatusWidget,
  args: {
    totalVolume: "RWF 24.5M",
    growthLabel: "+8.4% vs last week",
    momoShare: "62%",
    cardShare: "28%",
    pendingCount: 4,
    disputesCount: 1,
  },
};

export default meta;

type Story = StoryObj<typeof PaymentStatusWidget>;

export const Default: Story = {};

export const WithCta: Story = {
  args: {
    cta: (
      <button className="rounded-full border border-slate-300 px-4 py-1 text-sm font-semibold text-slate-700">
        View ledger
      </button>
    ),
  },
};
