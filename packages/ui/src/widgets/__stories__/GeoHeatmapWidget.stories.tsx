import type { Meta, StoryObj } from "@storybook/react";
import { GeoHeatmapWidget } from "../GeoHeatmapWidget";

const meta: Meta<typeof GeoHeatmapWidget> = {
  title: "Widgets/GeoHeatmapWidget",
  component: GeoHeatmapWidget,
  args: {
    zones: [
      { label: "Kacyiru", intensity: 0.9, valueLabel: "Hot" },
      { label: "Kiyovu", intensity: 0.75, valueLabel: "Rising" },
      { label: "Gishushu", intensity: 0.65, valueLabel: "Stable" },
      { label: "Remera", intensity: 0.55, valueLabel: "Warm" },
      { label: "Gacuriro", intensity: 0.4, valueLabel: "Exploring" },
      { label: "Kimironko", intensity: 0.35, valueLabel: "Emerging" },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof GeoHeatmapWidget>;

export const Default: Story = {};
