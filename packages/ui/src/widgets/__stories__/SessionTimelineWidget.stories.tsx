import type { Meta, StoryObj } from "@storybook/react";
import { SessionTimelineWidget } from "../SessionTimelineWidget";

const meta: Meta<typeof SessionTimelineWidget> = {
  title: "Widgets/SessionTimelineWidget",
  component: SessionTimelineWidget,
  args: {
    events: [
      {
        id: "request",
        label: "Request captured",
        timestamp: "08:02",
        status: "completed",
        description: "Passenger shared 2 BR brief via WhatsApp.",
        actor: "Passenger",
      },
      {
        id: "quotes",
        label: "Vendors fanned out",
        timestamp: "08:04",
        status: "completed",
        description: "3 marketplace vendors responding.",
        actor: "Agent Core",
      },
      {
        id: "negotiation",
        label: "Negotiation in progress",
        timestamp: "08:06",
        status: "active",
        description: "Waiting on counter offer for BK reference property.",
        actor: "Property agent",
      },
      {
        id: "shortlist",
        label: "Shortlist dispatch",
        timestamp: "08:09",
        status: "upcoming",
        description: "Shortlist + owner slots scheduled for push notification.",
        actor: "Scheduler",
      },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof SessionTimelineWidget>;

export const Default: Story = {};
