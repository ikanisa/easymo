import type { Meta, StoryObj } from "@storybook/react";

import {
  Button,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "../src";

const meta: Meta = {
  title: "Overlays/Dialog",
};

export default meta;

type Story = StoryObj;

export const Basic: Story = {
  render: () => (
    <DialogRoot>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent description="Confirm the new settings before deployment.">
        <DialogTitle className="text-lg font-semibold">Deploy changes</DialogTitle>
        <DialogDescription className="mt-2 text-sm">
          Double check critical environment toggles prior to release.
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" tone="outline">
            Cancel
          </Button>
          <Button>Ship it</Button>
        </div>
      </DialogContent>
    </DialogRoot>
  ),
};
