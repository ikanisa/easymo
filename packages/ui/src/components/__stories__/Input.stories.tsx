import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "../Input";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  args: {
    placeholder: "Search vendors",
    id: "demo-input",
  },
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const WithAdornment: Story = {
  args: {
    startAdornment: "🔍",
    endAdornment: "⌘K",
  },
};

export const Invalid: Story = {
  args: {
    invalid: true,
    hint: "We could not match that value.",
  },
};
