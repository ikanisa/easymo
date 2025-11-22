import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "../src/components/input";

const meta: Meta<typeof Input> = {
  component: Input,
  title: "Primitives/Input",
  args: {
    placeholder: "Search operators",
  },
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const Invalid: Story = {
  args: {
    invalid: true,
    defaultValue: "bad-email",
  },
};
