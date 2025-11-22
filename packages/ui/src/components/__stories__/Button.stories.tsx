import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../Button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  args: {
    children: "Click me",
  },
  parameters: {
    a11y: {
      config: {
        rules: [{ id: "button-name", enabled: true }],
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: "primary",
  },
};

export const Outline: Story = {
  args: {
    variant: "outline",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: "Loading",
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <span className="inline-flex items-center gap-2">
        <span aria-hidden>⚡</span>
        Boost
      </span>
    ),
  },
};
