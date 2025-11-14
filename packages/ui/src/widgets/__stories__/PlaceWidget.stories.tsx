import type { Meta, StoryObj } from "@storybook/react";
import { PlaceWidget } from "../PlaceWidget";

const meta: Meta<typeof PlaceWidget> = {
  title: "Widgets/PlaceWidget",
  component: PlaceWidget,
  args: {
    name: "Nyarutarama Sky Loft",
    location: "KG 552 St · Kigali",
    rating: 4.9,
    reviewCount: 132,
    statusLabel: "Verified",
    priceRange: "$1,250 / mo",
    etaLabel: "Agent replies in 5 min",
    photoUrl: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80",
    badges: [
      { label: "2 BR" },
      { label: "125 m²" },
      { label: "Lake view", tone: "success" },
    ],
    highlights: [
      { label: "Shortlist rate", value: "68%" },
      { label: "Leads this week", value: "32" },
      { label: "Avg discount", value: "5%" },
    ],
    footer: "Synced from Supabase listings and shortlist telemetry.",
  },
};

export default meta;

type Story = StoryObj<typeof PlaceWidget>;

export const Default: Story = {};

export const WithoutPhoto: Story = {
  args: {
    photoUrl: undefined,
    statusLabel: undefined,
  },
};
