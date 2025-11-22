import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../src/components/button";

const meta: Meta<typeof Button> = {
  component: Button,
  title: "Primitives/Button",
  args: {
    children: "Launch workflow",
  },
  parameters: {
    a11y: {
      config: {
        rules: [{ id: "color-contrast", enabled: true }],
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Secondary" },
};

export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete" },
};

export const WithIcon: Story = {
  args: {
    leadingIcon: <span aria-hidden="true">🚀</span>,
  },
};
